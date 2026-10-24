import json
import re

with open(r'c:\Users\HP\Desktop\Akash\Exam Portal\Frontend\src\pages\candidate\CandidateExamPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'const DEFAULT_60_QUESTIONS = \[(.*?)\];\s*interface CandidateExamPageProps', content, re.DOTALL)
if not m:
    print("Could not find DEFAULT_60_QUESTIONS")
    exit(1)

raw_block = m.group(1)

# Split by individual question objects
# Each question object has id: X, section: "...", questionText: "...", options: [...]
q_chunks = re.findall(r'\{\s*id:\s*(\d+),\s*section:\s*"(.*?)",\s*questionText:\s*"(.*?)",\s*options:\s*\[(.*?)\]\s*\}', raw_block, re.DOTALL)

print(f"Parsed {len(q_chunks)} questions from CandidateExamPage.tsx")

questions_data = []
for q_id, section, q_text, opts_raw in q_chunks:
    opt_matches = re.findall(r'\{\s*id:\s*(\d+),\s*optionLabel:\s*"(.*?)",\s*optionText:\s*"(.*?)"\s*\}', opts_raw)
    questions_data.append({
        "id": int(q_id),
        "section": section,
        "questionText": q_text,
        "options": [{"id": int(oid), "label": olbl, "text": otxt} for oid, olbl, otxt in opt_matches]
    })

with open(r'c:\Users\HP\Desktop\Akash\Exam Portal\backend\default_60_questions.json', 'w', encoding='utf-8') as out:
    json.dump(questions_data, out, indent=2, ensure_ascii=False)

print(f"Successfully dumped all {len(questions_data)} questions to default_60_questions.json")
