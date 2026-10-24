import os
import sys
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from app.core.database import SessionLocal
from app.models.department import Department
from app.models.exam import Exam, ExamSlot
from app.models.question import QuestionSet, Question, QuestionOption
from app.models.candidate import Candidate
from app.models.audit import AuditLog

# 60 Realistic, high-quality questions with answer keys across 4 sections
MASTER_QUESTIONS = [
    # Section A: Quantitative Aptitude (1-15)
    {
        "text": "Which principle of object-oriented programming allows one class to acquire properties and methods from another class?",
        "options": [
            ("Encapsulation", False),
            ("Inheritance", True),
            ("Polymorphism", False),
            ("Abstraction", False),
        ]
    },
    {
        "text": "A train running at 54 km/hr crosses a bridge of length 250 meters in 30 seconds. What is the length of the train?",
        "options": [
            ("150 meters", False),
            ("200 meters", True),
            ("250 meters", False),
            ("180 meters", False),
        ]
    },
    {
        "text": "If 12 men or 18 women can complete a engineering project in 14 days, in how many days can 8 men and 16 women complete the same project?",
        "options": [
            ("9 days", True),
            ("10 days", False),
            ("12 days", False),
            ("8 days", False),
        ]
    },
    {
        "text": "Two numbers are in the ratio 3 : 5. If 6 is added to both, the ratio becomes 2 : 3. What is the smaller number?",
        "options": [
            ("12", False),
            ("18", True),
            ("24", False),
            ("30", False),
        ]
    },
    {
        "text": "A data store offers a discount of 20% on software licenses. If a team pays $480 after discount, what was the original list price?",
        "options": [
            ("$560", False),
            ("$600", True),
            ("$620", False),
            ("$640", False),
        ]
    },
    {
        "text": "What is the compound interest on $10,000 for 2 years at 10% per annum compounded annually?",
        "options": [
            ("$2,000", False),
            ("$2,100", True),
            ("$2,200", False),
            ("$1,800", False),
        ]
    },
    {
        "text": "A pipe can fill a reservoir in 6 hours and another pipe can empty it in 8 hours. If both are opened together, how long to fill?",
        "options": [
            ("12 hours", False),
            ("18 hours", False),
            ("24 hours", True),
            ("16 hours", False),
        ]
    },
    {
        "text": "The average of five consecutive even integers is 34. What is the value of the largest integer?",
        "options": [
            ("36", False),
            ("38", True),
            ("40", False),
            ("34", False),
        ]
    },
    {
        "text": "In how many distinct ways can the letters of the word 'SYSTEM' be arranged?",
        "options": [
            ("720", False),
            ("360", True),
            ("180", False),
            ("120", False),
        ]
    },
    {
        "text": "A bag contains 5 red, 4 blue, and 3 green marbles. What is the probability of picking a blue marble at random?",
        "options": [
            ("1/4", False),
            ("1/3", True),
            ("5/12", False),
            ("1/2", False),
        ]
    },
    {
        "text": "If x + 1/x = 4, what is the value of x^2 + 1/(x^2)?",
        "options": [
            ("16", False),
            ("14", True),
            ("18", False),
            ("12", False),
        ]
    },
    {
        "text": "A car travels the first 100 km at 50 km/h and the next 100 km at 25 km/h. What is the average speed for the whole journey?",
        "options": [
            ("37.5 km/h", False),
            ("33.33 km/h", True),
            ("35.0 km/h", False),
            ("30.0 km/h", False),
        ]
    },
    {
        "text": "A sum of money doubles itself in 5 years at simple interest. What is the annual interest rate?",
        "options": [
            ("15%", False),
            ("20%", True),
            ("25%", False),
            ("10%", False),
        ]
    },
    {
        "text": "If 15% of a number is 45, what is 40% of that number?",
        "options": [
            ("100", False),
            ("120", True),
            ("140", False),
            ("150", False),
        ]
    },
    {
        "text": "What is the greatest common divisor (GCD) of 72 and 120?",
        "options": [
            ("12", False),
            ("24", True),
            ("36", False),
            ("18", False),
        ]
    },

    # Section B: Logical Reasoning (16-30)
    {
        "text": "Look at this series: 2, 6, 12, 20, 30, ... What number should come next?",
        "options": [
            ("40", False),
            ("42", True),
            ("44", False),
            ("46", False),
        ]
    },
    {
        "text": "Which word does NOT belong with the others: TCP, UDP, HTTP, CPU?",
        "options": [
            ("TCP", False),
            ("UDP", False),
            ("HTTP", False),
            ("CPU", True),
        ]
    },
    {
        "text": "If 'ALGORITHM' is coded as 'BMHPSJUIO' (+1 shift), how is 'BYTE' coded in the same pattern?",
        "options": [
            ("CZUF", True),
            ("CYTE", False),
            ("AZSD", False),
            ("DXVG", False),
        ]
    },
    {
        "text": "Pointing to a photograph, John said, 'His mother is the only daughter of my mother.' Whose photograph was it?",
        "options": [
            ("John's son", False),
            ("John's nephew", True),
            ("John's brother", False),
            ("John's father", False),
        ]
    },
    {
        "text": "Statements: All routers are network devices. Some network devices are wireless. Conclusion: Some routers are wireless.",
        "options": [
            ("Definitely True", False),
            ("Definitely False", False),
            ("Cannot be determined with certainty", True),
            ("None of the above", False),
        ]
    },
    {
        "text": "Find the missing number in the sequence: 7, 10, 8, 11, 9, 12, ...?",
        "options": [
            ("10", True),
            ("13", False),
            ("11", False),
            ("14", False),
        ]
    },
    {
        "text": "In a coding exam ranking, Priya is 7th from the top and 28th from the bottom. How many total candidates are ranked?",
        "options": [
            ("34", True),
            ("35", False),
            ("33", False),
            ("36", False),
        ]
    },
    {
        "text": "Which of the following diagrams best represents the relationship between: Engineers, Programmers, and Humans?",
        "options": [
            ("Concentric circles: Programmers inside Engineers inside Humans", True),
            ("Three disjoint circles", False),
            ("Two overlapping circles inside a third", False),
            ("Three intersecting circles of equal radius", False),
        ]
    },
    {
        "text": "If NORTH is replaced by SOUTH-WEST, what will EAST become?",
        "options": [
            ("NORTH-WEST", True),
            ("SOUTH-EAST", False),
            ("NORTH-EAST", False),
            ("SOUTH", False),
        ]
    },
    {
        "text": "If Monday falls on January 1st of a non-leap year, which day of the week will January 31st be?",
        "options": [
            ("Tuesday", False),
            ("Wednesday", True),
            ("Thursday", False),
            ("Friday", False),
        ]
    },
    {
        "text": "A cube has six faces painted with different colors. Red is opposite Blue. Green is between Red and Blue. What is opposite Green?",
        "options": [
            ("Yellow or White", False),
            ("Red", False),
            ("Blue", False),
            ("Cannot be determined without additional constraints", True),
        ]
    },
    {
        "text": "Five nodes A, B, C, D, E are in a cluster. B is faster than A but slower than C. D is faster than E but slower than A. Which is fastest?",
        "options": [
            ("C", True),
            ("B", False),
            ("D", False),
            ("A", False),
        ]
    },
    {
        "text": "Choose the correct analogy: Compiler : Bytecode :: Interpreter : ?",
        "options": [
            ("Machine Code / Direct Execution", True),
            ("Assembly", False),
            ("High Level Syntax", False),
            ("Linker", False),
        ]
    },
    {
        "text": "Select the pair that exhibits the same relationship as 'ENCRYPT : DECRYPT':",
        "options": [
            ("Compress : Decompress", True),
            ("Store : Read", False),
            ("Compile : Link", False),
            ("Lock : Secure", False),
        ]
    },
    {
        "text": "In a binary matrix of size 3x3, if each cell has either 0 or 1, what is the total number of distinct matrix configurations?",
        "options": [
            ("512 (2^9)", True),
            ("256 (2^8)", False),
            ("1024 (2^10)", False),
            ("64", False),
        ]
    },

    # Section C: Technical Core (31-45)
    {
        "text": "Which SQL command is commonly used to retrieve records from a database table without mutating state?",
        "options": [
            ("SELECT", True),
            ("FETCH ONLY", False),
            ("OPEN TABLE", False),
            ("PULL ROWS", False),
        ]
    },
    {
        "text": "What is the primary characteristic of an idempotent HTTP method such as GET, PUT, or DELETE?",
        "options": [
            ("It produces the exact same server state regardless of whether executed once or multiple times", True),
            ("It executes in O(1) constant time", False),
            ("It always requires request body payloads", False),
            ("It cannot be cached by intermediate proxies", False),
        ]
    },
    {
        "text": "In relational database design, what does the 'ACID' acronym stand for?",
        "options": [
            ("Atomicity, Consistency, Isolation, Durability", True),
            ("Accuracy, Concurrency, Integrity, Distribution", False),
            ("Authentication, Cryptography, Identity, Directory", False),
            ("Availability, Computation, Indexing, Delivery", False),
        ]
    },
    {
        "text": "Which data structure uses LIFO (Last-In, First-Out) ordering for its elements?",
        "options": [
            ("Stack", True),
            ("Queue", False),
            ("Heap", False),
            ("Binary Search Tree", False),
        ]
    },
    {
        "text": "What is the worst-case time complexity of QuickSort when a naive pivot is chosen on sorted input?",
        "options": [
            ("O(n log n)", False),
            ("O(n^2)", True),
            ("O(n)", False),
            ("O(log n)", False),
        ]
    },
    {
        "text": "In Python, which built-in data type is immutable?",
        "options": [
            ("tuple", True),
            ("list", False),
            ("dict", False),
            ("set", False),
        ]
    },
    {
        "text": "Which OSI model layer is responsible for end-to-end reliability and flow control?",
        "options": [
            ("Transport Layer", True),
            ("Network Layer", False),
            ("Data Link Layer", False),
            ("Session Layer", False),
        ]
    },
    {
        "text": "In Git version control, which command creates a new branch and immediately switches to it?",
        "options": [
            ("git checkout -b <branch>", True),
            ("git branch -m <branch>", False),
            ("git switch -c <branch>", False),
            ("git merge -b <branch>", False),
        ]
    },
    {
        "text": "What is the function of an index on a database column?",
        "options": [
            ("Speeds up data retrieval queries at the cost of slower writes and additional storage", True),
            ("Enforces primary key nullability", False),
            ("Encrypts sensitive column values", False),
            ("Prevents database deadlocks", False),
        ]
    },
    {
        "text": "What is the key advantage of using connection pooling in backend database drivers?",
        "options": [
            ("Reuses existing TCP connections to reduce handshake overhead", True),
            ("Encrypts all SQL tables automatically", False),
            ("Replaces database constraints", False),
            ("Prevents duplicate primary key inserts", False),
        ]
    },
    {
        "text": "Which HTTP request method is inherently idempotent according to RFC specifications?",
        "options": [
            ("GET and PUT", True),
            ("POST only", False),
            ("PATCH only", False),
            ("CONNECT", False),
        ]
    },
    {
        "text": "What type of join in SQL returns all records from the left table and matched records from the right table?",
        "options": [
            ("LEFT OUTER JOIN", True),
            ("INNER JOIN", False),
            ("RIGHT OUTER JOIN", False),
            ("CROSS JOIN", False),
        ]
    },
    {
        "text": "In Java memory management, where are object instances allocated at runtime?",
        "options": [
            ("Heap Memory", True),
            ("Call Stack", False),
            ("Register File", False),
            ("Metaspace only", False),
        ]
    },
    {
        "text": "Which transport protocol guarantees ordered, reliable, and error-checked delivery of a stream of octets?",
        "options": [
            ("TCP (Transmission Control Protocol)", True),
            ("UDP (User Datagram Protocol)", False),
            ("IP (Internet Protocol)", False),
            ("ICMP", False),
        ]
    },
    {
        "text": "What is the primary function of a reverse proxy like NGINX in production architectures?",
        "options": [
            ("Load balancing, SSL termination, and routing requests to internal servers", True),
            ("Executing SQL transactions", False),
            ("Compiling JavaScript files", False),
            ("Managing database migrations", False),
        ]
    },

    # Section D: Verbal Ability (46-60)
    {
        "text": "Choose the word most nearly opposite in meaning (antonym) to 'EXPEDITE':",
        "options": [
            ("Delay / Impede", True),
            ("Accelerate", False),
            ("Promote", False),
            ("Dispatch", False),
        ]
    },
    {
        "text": "Choose the word most similar in meaning (synonym) to 'CANDID':",
        "options": [
            ("Frank and Outspoken", True),
            ("Secretive", False),
            ("Diplomatic", False),
            ("Hesitant", False),
        ]
    },
    {
        "text": "Identify the grammatically correct sentence:",
        "options": [
            ("Neither the developer nor the testers were aware of the production bug.", True),
            ("Neither the developer nor the testers was aware of the production bug.", False),
            ("Neither the developer or the testers were aware of the production bug.", False),
            ("Neither the developer nor the testers is aware of the production bug.", False),
        ]
    },
    {
        "text": "Select the correctly spelled word:",
        "options": [
            ("Hierarchy", True),
            ("Heirarchy", False),
            ("Hierarcy", False),
            ("Hierachy", False),
        ]
    },
    {
        "text": "Choose the appropriate idiom: 'He decided to _____ and tell the engineering team the bad news directly.'",
        "options": [
            ("bite the bullet", True),
            ("break the ice", False),
            ("burn the midnight oil", False),
            ("hit the sack", False),
        ]
    },
    {
        "text": "Which sentence contains an error in subject-verb agreement?",
        "options": [
            ("The cluster of high-performance servers have failed the health check.", True),
            ("The cluster of high-performance servers has failed the health check.", False),
            ("Each of the microservices reports its telemetry.", False),
            ("Every candidate was verified at check-in.", False),
        ]
    },
    {
        "text": "Choose the word that best completes the sentence: 'The team worked _____ to meet the sprint deadline.'",
        "options": [
            ("diligently", True),
            ("diligent", False),
            ("diligence", False),
            ("diligentness", False),
        ]
    },
    {
        "text": "Choose the word most nearly opposite in meaning to 'EPHEMERAL':",
        "options": [
            ("Permanent / Enduring", True),
            ("Transitory", False),
            ("Brief", False),
            ("Fleeting", False),
        ]
    },
    {
        "text": "What does the Latin phrase 'DE FACTO' mean in technical standards?",
        "options": [
            ("In practice or reality, though not necessarily formally ordained by law", True),
            ("According to statutory law", False),
            ("Null and void", False),
            ("Without any consequence", False),
        ]
    },
    {
        "text": "Choose the correct preposition: 'The microservice is compliant _____ enterprise security guidelines.'",
        "options": [
            ("with", True),
            ("to", False),
            ("for", False),
            ("by", False),
        ]
    },
    {
        "text": "Identify the sentence that uses a semicolon correctly:",
        "options": [
            ("The latency was high; therefore, we enabled response caching.", True),
            ("The latency was high; because we had no cache.", False),
            ("Although the latency was high; we finished on time.", False),
            ("We enabled caching; and latency dropped.", False),
        ]
    },
    {
        "text": "Fill in the blank: 'The architect was praised for her _____ approach to distributed cloud reliability.'",
        "options": [
            ("innovative", True),
            ("innovatively", False),
            ("innovation", False),
            ("innovate", False),
        ]
    },
    {
        "text": "Choose the word most similar in meaning (synonym) to 'ROBUST':",
        "options": [
            ("Resilient and sturdy", True),
            ("Fragile", False),
            ("Incomplete", False),
            ("Volatile", False),
        ]
    },
    {
        "text": "Identify the part of speech of the word 'EFFICIENTLY' in: 'The caching layer serves requests efficiently.'",
        "options": [
            ("Adverb", True),
            ("Adjective", False),
            ("Noun", False),
            ("Conjunction", False),
        ]
    },
    {
        "text": "What is the logical conclusion of the passage: 'Automated testing reduces human regression errors, enabling faster release cadences.'?",
        "options": [
            ("Automated testing contributes to higher software deployment velocity", True),
            ("Human testers should be completely abolished", False),
            ("Release cadences are independent of testing", False),
            ("Manual testing is faster than automated testing", False),
        ]
    },
]

def seed_master_exam():
    db = SessionLocal()
    try:
        # Check existing exams
        existing = db.query(Exam).filter(Exam.title.ilike("%Campus Assessment%")).first()
        if existing:
            print(f"Existing master exam found: id={existing.id}, title='{existing.title}', status='{existing.status}'")
            if existing.status != "PUBLISHED":
                existing.status = "PUBLISHED"
                db.commit()
                print("Exam marked as PUBLISHED.")
            return existing.id

        print("Provisioning Master Published Examination...")
        now = datetime.now(timezone.utc)

        # 1. Fetch all departments to link
        departments = db.query(Department).all()
        print(f"Linking exam to all {len(departments)} departments...")

        # 2. Create Master Exam
        exam = Exam(
            title="Comprehensive Campus Assessment 2026 - Master Assessment",
            description="Official 4-section comprehensive assessment covering Quantitative Aptitude, Logical Reasoning, Technical Core, and Verbal Ability.",
            duration_minutes=60,
            total_questions=60,
            status="PUBLISHED",
            qualification_mode="PERCENTAGE",
            qualification_threshold=Decimal("60.00"),
            timing_mode="DURATION_FROM_START",
            total_marks=Decimal("60.00"),
            marks_per_question=Decimal("1.00"),
            negative_marks=Decimal("0.00"),
            scheduled_start_time=now,
            scheduled_end_time=now + timedelta(days=365),
            results_published=False,
            created_at=now
        )
        exam.departments = departments
        db.add(exam)
        db.flush()

        # 3. Create Slot 1
        slot = ExamSlot(
            exam_id=exam.id,
            slot_number=1,
            starts_at=now,
            ends_at=now + timedelta(days=365),
            capacity=1000
        )
        db.add(slot)
        db.flush()

        # 4. Create Question Sets A, B, C, D
        sets = ["A", "B", "C", "D"]
        for set_code in sets:
            qs = QuestionSet(
                exam_id=exam.id,
                set_code=set_code,
                name=f"Assessment Set {set_code}"
            )
            db.add(qs)
            db.flush()

            # Insert all 60 questions into this set
            for idx, q_data in enumerate(MASTER_QUESTIONS, 1):
                q = Question(
                    question_set_id=qs.id,
                    question_text=q_data["text"],
                    marks=Decimal("1.00"),
                    negative_marks=Decimal("0.00"),
                    display_order=idx,
                    created_at=now
                )
                db.add(q)
                db.flush()

                for opt_idx, (opt_text, is_correct) in enumerate(q_data["options"], 1):
                    opt = QuestionOption(
                        question_id=q.id,
                        option_text=opt_text,
                        is_correct=is_correct,
                        display_order=opt_idx
                    )
                    db.add(opt)

            print(f"  Initialized Set {set_code} with {len(MASTER_QUESTIONS)} questions.")

        audit = AuditLog(
            action="SEED_MASTER_EXAM",
            entity_type="Exam",
            entity_id=str(exam.id),
            performed_by="system_provisioner",
            details="Provisioned official 60-question 4-set master examination linked to all departments."
        )
        db.add(audit)
        db.commit()
        db.refresh(exam)
        print(f"SUCCESS: Master Exam provisioned with id={exam.id}, status='{exam.status}'")
        return exam.id

    finally:
        db.close()

if __name__ == "__main__":
    seed_master_exam()
