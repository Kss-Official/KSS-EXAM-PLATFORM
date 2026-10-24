from app.core.database import SessionLocal
from app.models import Exam, QuestionSet, Question, QuestionOption, ExamAttempt, Candidate

db = SessionLocal()
print("=== All Exams in Database ===")
for e in db.query(Exam).all():
    sets = db.query(QuestionSet).filter(QuestionSet.exam_id == e.id).all()
    q_counts = [len(s.questions) for s in sets]
    print(f"Exam id={e.id}, title='{e.title}', status={e.status}, sets={len(sets)}, questions_per_set={q_counts}")

print("\n=== Attempts ===")
for a in db.query(ExamAttempt).all():
    cand = db.query(Candidate).filter(Candidate.id == a.candidate_id).first()
    cand_reg = cand.registration_number if cand else "Unknown"
    print(f"Attempt id={a.id}, cand={cand_reg}, exam_id={a.exam_id}, status={a.status}, answers_in_db={len(a.answers)}")
    if a.id == 18:
        for ans in a.answers:
            q = ans.question
            opt = ans.selected_option
            opt_txt = opt.option_text.encode('ascii', 'replace').decode() if opt else 'N/A'
            print(f"   [Attempt 18 Detail] Q{q.display_order if q else ans.question_id}: Opt ID={ans.selected_option_id} Text='{opt_txt}' (Correct={opt.is_correct if opt else 'N/A'})")

db.close()
