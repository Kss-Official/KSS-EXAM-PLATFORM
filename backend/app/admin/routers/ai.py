import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import AppUser
from app.admin.services.ai_service import AIService

logger = logging.getLogger("ExamSecure.AIRouter")

router = APIRouter(prefix="/api/admin/ai", tags=["AI Copilot"])

class ChatMessage(BaseModel):
    role: str = Field(..., description="user or assistant")
    content: str

class AIChatRequest(BaseModel):
    message: str = Field(..., description="Natural language prompt from admin")
    history: Optional[List[ChatMessage]] = Field(default_factory=list)
    currentPage: Optional[str] = Field(default="/admin/overview", description="Current frontend route")
    currentParams: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Active page filters/state")

class UIAction(BaseModel):
    action: str
    route: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    date: Optional[str] = None
    slot: Optional[str] = None
    department: Optional[str] = None
    college: Optional[str] = None
    status: Optional[str] = None
    search: Optional[str] = None
    column: Optional[str] = None
    direction: Optional[str] = None
    modal: Optional[str] = None
    defaults: Optional[Dict[str, Any]] = None

class AIChatResponse(BaseModel):
    success: bool = True
    reply: str
    client_actions: List[Dict[str, Any]] = Field(default_factory=list)
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)

@router.post("/chat", response_model=AIChatResponse)
def ai_chat_copilot(
    payload: AIChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: AppUser = Depends(get_current_user)
):
    """
    Intelligent AI Copilot endpoint:
    - Queries real-time DB via function calling tools
    - Formulates concise analytical responses
    - Generates client-side action directives to control the live webpage
    """
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Instruction message cannot be empty.")

    try:
        history_dicts = [{"role": h.role, "content": h.content} for h in (payload.history or [])]
        result = AIService.chat(
            message=payload.message.strip(),
            history=history_dicts,
            current_page=payload.currentPage,
            current_params=payload.currentParams,
            db=db
        )
        return AIChatResponse(
            success=True,
            reply=result["reply"],
            client_actions=result.get("client_actions", []),
            tool_calls=result.get("tool_calls", [])
        )
    except Exception as e:
        logger.error(f"Error in AI chat copilot: {e}", exc_info=True)
        return AIChatResponse(
            success=False,
            reply=f"AI Copilot encountered an issue: {str(e)}",
            client_actions=[],
            tool_calls=[]
        )
