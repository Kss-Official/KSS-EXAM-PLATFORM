import json
import logging
import os
import re
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.models.candidate import Candidate
from app.models.exam import Exam
from app.admin.services.ai_tools import TOOL_DEFINITIONS, execute_tool

logger = logging.getLogger("ExamSecure.AIService")

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = """You are ExamSecure Copilot, an expert AI operational assistant integrated into the Kalpanaaa Software Solutions Exam Admin Console.
You have real-time access to the live exam platform database through your tools.

Platform Time & Calendar Context:
- Current Platform Reference Year: 2026.
- Today is November 20, 2026 (2026-11-20).
- All exam schedules, slot rosters, and candidate records in this application belong to year 2026 (e.g. 2026-11-18, 2026-11-20).
- When the admin asks about a date like "18th nov", "18 nov", "today", "yesterday", or "tomorrow", ALWAYS interpret it as November 2026 (2026-11-18, 2026-11-20, etc.). NEVER query or assume 2024 or 2025!

Core capabilities:
1. Complete Database Knowledge: Query real-time data on examinations, candidates, schedules, slot distributions, test scores, passing rates, and departments.
2. Webpage State & UI Control: You do NOT just answer with text. You control and update the live web application based on what the admin wants to see.

Platform Navigation Knowledge:
- /admin/overview : High-level summary, metrics cards, quick charts.
- /admin/exams : List of all examinations, creation status, question counts.
- /admin/exams/create : Exam creation wizard.
- /admin/candidates : Candidate directory, date selection pills (Today, Yesterday, 14 Nov, etc.), slot buttons (Slot 1, Slot 2, Slot 3), department dropdown, college dropdown, exam filter, search bar, and "Add Document" bulk upload modal.
- /admin/live-monitoring : Live proctoring, webcam status, examinees currently taking tests.
- /admin/results : Score sheets, rank lists, candidate attempts, high-to-low / low-to-high sorting, exam selector.
- /admin/departments : Academic tracks and college management.
- /admin/settings : System settings.

Rules for UI Actions:
Whenever the admin asks to:
- Show, navigate, view, or open a page (e.g., "Show me the results of that exam", "Take me to candidate directory", "Show live monitoring")
- Filter candidates or records (e.g., "Show Slot 1 candidates for today", "Filter by Developer department", "Show pending candidates")
- Sort records (e.g., "Apply a high-to-low filter", "Sort by lowest score")
- Search records (e.g., "Search for SVU-2026-001")
- Open a modal (e.g., "Open document upload modal")

You MUST include a valid JSON block at the very end of your response in this exact format:
```ui_actions
[
  {
    "action": "NAVIGATE",
    "route": "/admin/results",
    "params": { "examId": 4, "sortBy": "score", "sortOrder": "desc" }
  }
]
```

Action types supported:
1. NAVIGATE:
   - route: string (e.g. "/admin/results", "/admin/candidates", "/admin/live-monitoring", "/admin/exams")
   - params: optional object with keys like { examId, date, slot, search, sortBy, sortOrder }
2. SET_CANDIDATE_FILTER:
   - date: string ("today", "yesterday", "all", or "YYYY-MM-DD")
   - slot: string ("Slot 1", "Slot 2", "Slot 3", "all")
   - department: string (department name or "all")
   - college: string (college name or "all")
   - status: string ("ALL", "COMPLETED", "GOING_ON", "PENDING")
   - search: string (search keyword)
3. APPLY_SORT:
   - column: string ("score", "percentage", "name", "reg_no")
   - direction: "desc" (for high to low) or "asc" (for low to high)
4. OPEN_MODAL:
   - modal: "add_document" | "create_exam" | "slot_timings"
   - defaults: { date, slot, examId }

Tone & Style:
- Professional, concise, precise, direct.
- Explain the key data findings clearly in 1 to 3 sentences.
- Always confirm the action performed (e.g. "Navigating to Results for Azentio Software MCQ and applying a high-to-low score filter.").
"""

class AIService:
    @staticmethod
    def _get_api_key() -> str:
        key = getattr(settings, "GROQ_API_KEY", "") or os.getenv("GROQ_API_KEY", "")
        if not key or not key.startswith("gsk_"):
            # Check backend/.env directly if not in env
            try:
                env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
                if os.path.exists(env_path):
                    with open(env_path, "r", encoding="utf-8") as f:
                        for line in f:
                            if line.startswith("GROQ_API_KEY="):
                                key = line.strip().split("=", 1)[1].strip()
                                break
            except Exception:
                pass
        return key

    @classmethod
    def _call_groq(
        cls,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        api_key = cls._get_api_key()
        if not api_key:
            raise ValueError("GROQ_API_KEY is not configured in backend/.env")

        models_to_try = [
            getattr(settings, "GROQ_MODEL", "openai/gpt-oss-120b"),
            "openai/gpt-oss-120b",
            "qwen/qwen3.8-27b",
            "openai/gpt-oss-20b"
        ]

        payload_base: Dict[str, Any] = {
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1500,
        }
        if tools:
            payload_base["tools"] = tools
            payload_base["tool_choice"] = "auto"

        last_error = None
        for model in models_to_try:
            payload = dict(payload_base)
            payload["model"] = model
            data_bytes = json.dumps(payload).encode("utf-8")

            req = urllib.request.Request(
                GROQ_ENDPOINT,
                data=data_bytes,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ExamSecure/2.0"
                }
            )

            try:
                with urllib.request.urlopen(req, timeout=25) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as he:
                err_body = he.read().decode("utf-8", errors="ignore")
                logger.warning(f"Groq API error on model {model}: HTTP {he.code} {err_body}")
                last_error = f"HTTP {he.code}: {err_body}"
                if he.code == 404 or "model_not_found" in err_body:
                    continue  # Try next model
                elif he.code == 400 and "tools" in err_body:
                    # Model might not support tool calling, try next
                    continue
                else:
                    break
            except Exception as e:
                logger.error(f"Groq API connection error on model {model}: {e}")
                last_error = str(e)

        raise RuntimeError(f"Failed to communicate with Groq API: {last_error}")

    @classmethod
    def chat(
        cls,
        message: str,
        history: Optional[List[Dict[str, Any]]] = None,
        current_page: Optional[str] = None,
        current_params: Optional[Dict[str, Any]] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Processes an admin instruction:
        1. Assembles conversation context with system prompt.
        2. Executes database tools via Groq function calling.
        3. Returns user-facing reply and structured client_actions.
        """
        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]

        # Inject real-time database telemetry directly into the conversation
        telemetry_lines = []
        if current_page:
            telemetry_lines.append(f"Active Page: '{current_page}'. Current Parameters: {json.dumps(current_params or {})}")
        if db:
            try:
                date_counts = []
                for d, cnt in db.query(Candidate.exam_date, func.count(Candidate.id)).filter(Candidate.exam_date.isnot(None)).group_by(Candidate.exam_date).all():
                    date_counts.append(f"{d} ({cnt} candidates)")
                total_cand = db.query(Candidate).count()
                telemetry_lines.append("Platform Calendar: November 2026 (Today is 2026-11-20)")
                telemetry_lines.append(f"Total Registered Candidates: {total_cand}")
                telemetry_lines.append(f"Exact Candidate Counts by Date: {', '.join(date_counts) if date_counts else 'None'}")
                telemetry_lines.append("CRITICAL: When the admin asks about a date (e.g. '18th nov'), refer to the year 2026 ('2026-11-18') and output SET_CANDIDATE_FILTER action with that date in ```ui_actions``` so the user's screen switches to it.")
            except Exception as e:
                logger.warning(f"Could not load DB telemetry for AI: {e}")

        if telemetry_lines:
            messages.append({"role": "system", "content": "[LIVE PLATFORM DATABASE TELEMETRY]\n" + "\n".join(telemetry_lines)})

        # Append previous conversation turns (last 8 turns for efficiency)
        if history:
            for h in history[-8:]:
                role = h.get("role", "user")
                content = h.get("content", "")
                if role in ["user", "assistant"] and content:
                    messages.append({"role": role, "content": content})

        # Append latest user message
        messages.append({"role": "user", "content": message})

        executed_tools: List[Dict[str, Any]] = []

        # Tool calling loop (up to 4 iterations for multi-hop tool execution)
        for loop_idx in range(4):
            # On the last allowed iteration, disable tools so the model is forced to formulate its final answer
            tools_for_call = TOOL_DEFINITIONS if loop_idx < 3 else None
            response = cls._call_groq(messages, tools=tools_for_call)
            choice = response["choices"][0]
            msg = choice["message"]
            tool_calls = msg.get("tool_calls")

            if not tool_calls or not db:
                # No more tool calls; assistant formulated its final response
                final_content = msg.get("content") or ""
                reply_text, client_actions = cls._extract_actions(final_content, current_page, current_params, message)
                return {
                    "reply": reply_text,
                    "client_actions": client_actions,
                    "tool_calls": executed_tools
                }

            # Append the assistant message with tool calls
            messages.append(msg)

            # Execute each requested tool against live database
            for tc in tool_calls:
                func_name = tc["function"]["name"]
                raw_args = tc["function"]["arguments"]
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                except Exception:
                    args = {}

                logger.info(f"[AI TOOL CALL] {func_name} with args {args}")
                tool_output = execute_tool(func_name, args, db)
                executed_tools.append({
                    "tool": func_name,
                    "arguments": args,
                    "summary": f"{func_name} executed successfully"
                })

                # Append tool response message
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(tool_output)
                })

        # Final guarantee call if loop exhausted
        final_resp = cls._call_groq(messages, tools=None)
        final_choice = final_resp["choices"][0]["message"]
        final_content = final_choice.get("content") or "Operation completed."
        reply_text, client_actions = cls._extract_actions(final_content, current_page, current_params, message)
        return {
            "reply": reply_text,
            "client_actions": client_actions,
            "tool_calls": executed_tools
        }

    @classmethod
    def _extract_actions(
        cls,
        text: str,
        current_page: Optional[str],
        current_params: Optional[Dict[str, Any]],
        user_message: str
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Separates natural language text from structured UI action directives.
        Also provides deterministic rule-based action inference if the LLM omitted explicit blocks.
        """
        client_actions: List[Dict[str, Any]] = []
        clean_text = text

        # 1. Look for ```ui_actions ... ``` block
        pattern_ui = r"```ui_actions\s*([\s\S]*?)\s*```"
        match_ui = re.search(pattern_ui, text)
        if match_ui:
            try:
                parsed = json.loads(match_ui.group(1).strip())
                if isinstance(parsed, list):
                    client_actions.extend(parsed)
                elif isinstance(parsed, dict):
                    client_actions.append(parsed)
                clean_text = re.sub(pattern_ui, "", clean_text).strip()
            except Exception as e:
                logger.warning(f"Could not parse ```ui_actions: {e}")

        # 2. Look for ```json ... "client_actions": [...] ... ```
        if not client_actions:
            pattern_json = r"```(?:json)?\s*(\{[\s\S]*?\"client_actions\"[\s\S]*?\})\s*```"
            match_json = re.search(pattern_json, text)
            if match_json:
                try:
                    parsed = json.loads(match_json.group(1).strip())
                    actions = parsed.get("client_actions", [])
                    if isinstance(actions, list):
                        client_actions.extend(actions)
                    clean_text = re.sub(pattern_json, "", clean_text).strip()
                except Exception as e:
                    logger.warning(f"Could not parse json client_actions: {e}")

        # 3. Deterministic Fallback & Intent Reinforcement:
        # If user explicitly instructed navigation/sorting and model gave a text response without json action
        lowered_msg = user_message.lower()
        if not client_actions:
            if "result" in lowered_msg and ("show" in lowered_msg or "view" in lowered_msg or "go to" in lowered_msg or "navigate" in lowered_msg):
                # Infer examId if mentioned in text or params
                exam_id_match = re.search(r"exam\s*#?(\d+)|id[:\s]+(\d+)", text, re.IGNORECASE)
                eid = int(exam_id_match.group(1) or exam_id_match.group(2)) if exam_id_match else 4
                client_actions.append({
                    "action": "NAVIGATE",
                    "route": "/admin/results",
                    "params": {"examId": eid}
                })
            elif "high to low" in lowered_msg or "descending" in lowered_msg or "top score" in lowered_msg:
                client_actions.append({
                    "action": "APPLY_SORT",
                    "column": "score",
                    "direction": "desc"
                })
            elif "low to high" in lowered_msg or "ascending" in lowered_msg:
                client_actions.append({
                    "action": "APPLY_SORT",
                    "column": "score",
                    "direction": "asc"
                })
            elif "slot 1" in lowered_msg:
                client_actions.append({
                    "action": "SET_CANDIDATE_FILTER",
                    "slot": "Slot 1"
                })
            elif "slot 2" in lowered_msg:
                client_actions.append({
                    "action": "SET_CANDIDATE_FILTER",
                    "slot": "Slot 2"
                })
            elif "slot 3" in lowered_msg:
                client_actions.append({
                    "action": "SET_CANDIDATE_FILTER",
                    "slot": "Slot 3"
                })
            elif "upload" in lowered_msg and "document" in lowered_msg:
                client_actions.append({
                    "action": "OPEN_MODAL",
                    "modal": "add_document"
                })
            elif "live monitoring" in lowered_msg or "proctor" in lowered_msg:
                client_actions.append({
                    "action": "NAVIGATE",
                    "route": "/admin/live-monitoring"
                })
            elif "candidate directory" in lowered_msg or "candidates" in lowered_msg:
                client_actions.append({
                    "action": "NAVIGATE",
                    "route": "/admin/candidates"
                })

        # Guarantee date navigation if user mentions a calendar date (e.g., 18th nov -> 2026-11-18)
        date_pattern = re.search(r'\b(1[4-9]|2[0-5])(?:th)?\s+(?:nov|november)\b', lowered_msg)
        if date_pattern:
            day_val = date_pattern.group(1)
            target_d = f"2026-11-{day_val}"
            existing = next((a for a in client_actions if a.get("action") == "SET_CANDIDATE_FILTER"), None)
            if existing:
                existing["date"] = target_d
            else:
                client_actions.append({
                    "action": "SET_CANDIDATE_FILTER",
                    "date": target_d
                })

        return clean_text.strip(), client_actions
