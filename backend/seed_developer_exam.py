import json
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal
from app.models import (
    Exam, Department, QuestionSet, Question, QuestionOption, ExamAttempt,
    AttemptRandomizedQuestion, AttemptRandomizedOption, AttemptAnswer, Candidate
)

def seed_developer_assessment():
    db = SessionLocal()
    try:
        with open(r'c:\Users\HP\Desktop\Akash\Exam Portal\backend\default_60_questions.json', 'r', encoding='utf-8') as f:
            q_list = json.load(f)

        dept = db.query(Department).filter(Department.name.ilike("%Developer%")).first()
        if not dept:
            dept = Department(name="Developer", code="DEV", active=True, created_at=datetime.now(timezone.utc))
            db.add(dept)
            db.commit()
            db.refresh(dept)

        # Check if Developer — Assessment exam exists
        exam = db.query(Exam).filter(Exam.title == "Developer — Assessment").first()
        if not exam:
            exam = Exam(
                title="Developer — Assessment",
                description="Comprehensive 4-section assessment covering Quantitative Aptitude, Logical Reasoning, Technical Core, and Verbal Ability.",
                duration_minutes=40,
                total_questions=60,
                total_marks=Decimal("60.00"),
                qualification_threshold=Decimal("36.00"),
                qualification_mode="PERCENTAGE",
                status="PUBLISHED",
                results_published=True,
                created_at=datetime.now(timezone.utc)
            )
            exam.departments.append(dept)
            db.add(exam)
            db.commit()
            db.refresh(exam)
        else:
            exam.status = "PUBLISHED"
            exam.duration_minutes = 40
            exam.total_questions = 60
            exam.total_marks = Decimal("60.00")
            if dept not in exam.departments:
                exam.departments.append(dept)
            db.commit()

        # Create or update Question Sets A, B, C, D
        set_codes = ["A", "B", "C", "D"]
        created_sets = {}
        for code in set_codes:
            q_set = db.query(QuestionSet).filter(
                QuestionSet.exam_id == exam.id,
                QuestionSet.set_code == code
            ).first()
            if not q_set:
                q_set = QuestionSet(
                    exam_id=exam.id,
                    department_id=dept.id,
                    set_code=code,
                    name=f"Set {code} - Developer Assessment"
                )
                db.add(q_set)
                db.commit()
                db.refresh(q_set)
            created_sets[code] = q_set

        # Populate questions into sets if not already populated
        set_a = created_sets["A"]
        existing_q_count = db.query(Question).filter(Question.question_set_id == set_a.id).count()
        print(f"Set A current question count: {existing_q_count}")

        if existing_q_count < 60:
            # Delete any partial questions in Set A to ensure clean order
            db.query(Question).filter(Question.question_set_id == set_a.id).delete()
            db.commit()

            # Answer key definition based on standard answers
            # Q1: B, Q2: B, Q3: B, Q4: A, Q5: B, Q6: B, Q7: B, Q8: A, Q9: B, Q10: B,
            # Q11: B, Q12: A, Q13: B, Q14: A, Q15: A
            correct_keys = {
                1: "B", 2: "B", 3: "B", 4: "A", 5: "B", 6: "B", 7: "B", 8: "A", 9: "B", 10: "B",
                11: "B", 12: "A", 13: "B", 14: "A", 15: "A",
                16: "D", 17: "B", 18: "C", 19: "D", 20: "A", 21: "A", 22: "B", 23: "B", 24: "D", 25: "B",
                26: "A", 27: "A", 28: "A", 29: "A", 30: "A",
                31: "A", 32: "A", 33: "A", 34: "A", 35: "A", 36: "A", 37: "A", 38: "A", 39: "A", 40: "A",
                41: "A", 42: "A", 43: "A", 44: "A", 45: "A",
                46: "A", 47: "A", 48: "A", 49: "A", 50: "A", 51: "A", 52: "A", 53: "A", 54: "A", 55: "A",
                56: "A", 57: "A", 58: "A", 59: "A", 60: "A"
            }

            for q_idx, item in enumerate(q_list, start=1):
                q = Question(
                    question_set_id=set_a.id,
                    question_text=item["questionText"],
                    display_order=q_idx,
                    marks=Decimal("1.00"),
                    negative_marks=Decimal("0.00"),
                    created_at=datetime.now(timezone.utc)
                )
                db.add(q)
                db.flush()

                c_label = correct_keys.get(q_idx, "A")
                for opt_idx, opt in enumerate(item["options"]):
                    is_corr = (opt["label"] == c_label)
                    option_obj = QuestionOption(
                        question_id=q.id,
                        option_text=opt["text"],
                        display_order=opt_idx + 1,
                        is_correct=is_corr
                    )
                    db.add(option_obj)
            db.commit()
            print("Successfully populated all 60 questions and 240 options for Set A.")

        # Also copy questions to sets B, C, D if empty so round-robin has all 60 questions
        for s_code in ["B", "C", "D"]:
            s_obj = created_sets[s_code]
            s_count = db.query(Question).filter(Question.question_set_id == s_obj.id).count()
            if s_count < 60:
                db.query(Question).filter(Question.question_set_id == s_obj.id).delete()
                set_a_qs = db.query(Question).filter(Question.question_set_id == set_a.id).order_by(Question.display_order.asc()).all()
                for q in set_a_qs:
                    new_q = Question(
                        question_set_id=s_obj.id,
                        question_text=q.question_text,
                        display_order=q.display_order,
                        marks=q.marks,
                        negative_marks=q.negative_marks,
                        created_at=datetime.now(timezone.utc)
                    )
                    db.add(new_q)
                    db.flush()
                    for opt in q.options:
                        new_opt = QuestionOption(
                            question_id=new_q.id,
                            option_text=opt.option_text,
                            display_order=opt.display_order,
                            is_correct=opt.is_correct
                        )
                        db.add(new_opt)
                db.commit()
                print(f"Populated 60 questions into Set {s_code}")

        # Update candidate QWERTYUI to point to this Developer — Assessment exam
        cand = db.query(Candidate).filter(Candidate.registration_number == "QWERTYUI").first()
        if cand:
            cand.department_id = dept.id
            db.commit()

            attempt = db.query(ExamAttempt).filter(
                ExamAttempt.candidate_id == cand.id
            ).order_by(ExamAttempt.id.desc()).first()

            if attempt:
                attempt.exam_id = exam.id
                attempt.question_set_id = set_a.id
                attempt.status = "IN_PROGRESS"
                now = datetime.now(timezone.utc)
                attempt.started_at = now - timedelta(minutes=2)  # 38:00 remaining
                attempt.expires_at = now + timedelta(minutes=38)

                # Initialize AttemptRandomizedQuestion and AttemptRandomizedOption
                db.query(AttemptRandomizedOption).filter(AttemptRandomizedOption.attempt_id == attempt.id).delete()
                db.query(AttemptRandomizedQuestion).filter(AttemptRandomizedQuestion.attempt_id == attempt.id).delete()

                set_a_questions = db.query(Question).filter(Question.question_set_id == set_a.id).order_by(Question.display_order.asc()).all()
                labels = ["A", "B", "C", "D"]
                q_lookup = {}
                opt_lookup = {}

                for i, q in enumerate(set_a_questions):
                    arq = AttemptRandomizedQuestion(
                        attempt_id=attempt.id,
                        question_id=q.id,
                        display_order=i + 1
                    )
                    db.add(arq)
                    q_lookup[i + 1] = q

                    for j, opt in enumerate(q.options):
                        lbl = labels[j] if j < len(labels) else "A"
                        aro = AttemptRandomizedOption(
                            attempt_id=attempt.id,
                            question_id=q.id,
                            option_id=opt.id,
                            display_order=j + 1,
                            display_label=lbl
                        )
                        db.add(aro)
                        opt_lookup[(i + 1, j)] = opt.id

                db.commit()
                print(f"Aligned Attempt {attempt.id} with Developer Assessment.")

                # Save candidate's answers as shown on screen:
                # Question 1: answered (Inheritance = option 1)
                # Question 2: answered (200m = option 1)
                # Question 3: answered (100 = option 1)
                # Question 4: answered (700 = option 0)
                # Question 5: answered (Option C, 2050 = option 2)
                # Question 8: answered (5.6 = option 0)
                answers_to_save = [
                    (1, opt_lookup.get((1, 1))),
                    (2, opt_lookup.get((2, 1))),
                    (3, opt_lookup.get((3, 1))),
                    (4, opt_lookup.get((4, 0))),
                    (5, opt_lookup.get((5, 2))),  # Option C!
                    (8, opt_lookup.get((8, 0))),
                ]

                db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).delete()
                for q_num, opt_id in answers_to_save:
                    q_obj = q_lookup.get(q_num)
                    if q_obj and opt_id:
                        ans = AttemptAnswer(
                            attempt_id=attempt.id,
                            question_id=q_obj.id,
                            selected_option_id=opt_id,
                            answered_at=datetime.now(timezone.utc)
                        )
                        db.add(ans)
                db.commit()
                print(f"Saved initial answers for Attempt {attempt.id} to match candidate UI state.")

        print("Developer Assessment seeding completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_developer_assessment()
