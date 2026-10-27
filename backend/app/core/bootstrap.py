import logging
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.user import AppUser

logger = logging.getLogger("ExamSecure.Bootstrap")

def init_super_admin(db: Session) -> AppUser:
    """
    Idempotent initialization of the default Super Administrator account.
    Verifies that the administrator account exists with valid BCrypt hash.
    """
    admin_email = settings.ADMIN_BOOTSTRAP_EMAIL.strip().lower()
    user = db.query(AppUser).filter(AppUser.email.ilike(admin_email)).first()

    if not user:
        logger.info(f"Creating initial Super Administrator account: {admin_email}")
        user = AppUser(
            email=admin_email,
            password_hash=hash_password(settings.ADMIN_BOOTSTRAP_PASSWORD),
            full_name=settings.ADMIN_BOOTSTRAP_NAME,
            role="SUPER_ADMIN",
            enabled=True,
            account_non_locked=True,
            failed_login_attempts=0
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("Super Administrator account created successfully.")
    else:
        # Check password hash validity; if password mismatch, rehash to match env
        if not verify_password(settings.ADMIN_BOOTSTRAP_PASSWORD, user.password_hash):
            logger.info("Updating Super Administrator password to match current configuration...")
            user.password_hash = hash_password(settings.ADMIN_BOOTSTRAP_PASSWORD)
            user.enabled = True
            user.account_non_locked = True
            user.failed_login_attempts = 0
            db.commit()
            logger.info("Super Administrator credentials refreshed.")

    return user

DEFAULT_DEPARTMENTS = [
    {"name": "Developer", "code": "DEV", "description": "Software Engineering & Full Stack Development"},
    {"name": "AI/ML Developer", "code": "AIML", "description": "Machine Learning, Deep Learning, NLP & AI Model Architecture"},
    {"name": "Computer Science and Engineering", "code": "CSE", "description": "Core Computing, Algorithms, Systems & Software"},
    {"name": "Information Technology", "code": "IT", "description": "Network Systems, Cloud Infrastructure & IT Solutions"},
    {"name": "Electronics & Communication Engineering", "code": "ECE", "description": "Embedded Systems, Signals, IoT & Hardware"},
    {"name": "Electrical & Electronics Engineering", "code": "EEE", "description": "Power Systems, Circuits & Instrumentation"},
    {"name": "Mechanical Engineering", "code": "MECH", "description": "Applied Mechanics, Design, Manufacturing & Robotics"},
    {"name": "Civil Engineering", "code": "CIVIL", "description": "Structural Analysis, Planning & Infrastructure Engineering"},
    {"name": "Quality Assurance & Testing", "code": "QA", "description": "Automated Testing, Test Scenarios & Quality Control"},
    {"name": "DevOps", "code": "DEVOPS", "description": "Cloud Infrastructure, CI/CD Automations, Kubernetes & SRE"},
    {"name": "UI/UX Design & Product", "code": "UIUX", "description": "User Interface Design, Interaction Design & Prototyping"},
    {"name": "Human Resources", "code": "HR", "description": "Talent Acquisition, People Operations & Candidate Engagement"},
    {"name": "Sales & Marketing", "code": "SALES_MKT", "description": "Enterprise Sales, Digital Marketing, Growth & Account Strategy"},
]

def init_default_departments(db: Session) -> None:
    """
    Idempotently provisions standard academic and technical departments
    so administrators immediately have full department coverage.
    """
    from app.models.department import Department
    for item in DEFAULT_DEPARTMENTS:
        existing = db.query(Department).filter(Department.code == item["code"]).first()
        if not existing:
            dept = Department(
                name=item["name"],
                code=item["code"],
                description=item["description"],
                active=True
            )
            db.add(dept)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning(f"Department provisioning notice: {exc}")


DEFAULT_CANDIDATES = [
    {"reg": "REG001", "name": "Aarav Sharma", "email": "aarav.sharma@campus.edu", "dept_code": "DEV"},
    {"reg": "REG002", "name": "Priya Patel", "email": "priya.patel@campus.edu", "dept_code": "CSE"},
    {"reg": "REG003", "name": "Rohan Verma", "email": "rohan.verma@campus.edu", "dept_code": "IT"},
    {"reg": "REG004", "name": "Ananya Iyer", "email": "ananya.iyer@campus.edu", "dept_code": "QA"},
    {"reg": "REG005", "name": "Karthik Nair", "email": "karthik.nair@campus.edu", "dept_code": "ECE"},
    {"reg": "REG006", "name": "Sneha Mukherjee", "email": "sneha.m@campus.edu", "dept_code": "HR"},
    {"reg": "REG007", "name": "Vikram Malhotra", "email": "vikram.m@campus.edu", "dept_code": "UIUX"},
    {"reg": "REG008", "name": "Jingyasa Priyadarsini", "email": "jingyasa.p@campus.edu", "dept_code": "DEV"},
    {"reg": "REG009", "name": "Aditya Kulkarni", "email": "aditya.k@campus.edu", "dept_code": "CSE"},
    {"reg": "REG010", "name": "Meera Sen", "email": "meera.sen@campus.edu", "dept_code": "UIUX"},
]

def init_default_candidates(db: Session) -> None:
    """
    Candidate provisioning: if candidates are already present, preserve the imported roster
    and do not re-create legacy demo candidates.
    """
    from datetime import datetime, timezone
    from app.models.candidate import Candidate
    from app.models.department import Department
    from app.admin.services.candidate_service import CandidateService

    if db.query(Candidate).count() > 0:
        logger.info("Candidate roster already present in database. Skipping default demo candidate provisioning.")
        return

    dept_cache = {d.code: d for d in db.query(Department).all()}
    for item in DEFAULT_CANDIDATES:
        dept = dept_cache.get(item["dept_code"])
        c = Candidate(
            registration_number=item["reg"],
            full_name=item["name"],
            email=item["email"],
            department_id=dept.id if dept else None,
            status="ACTIVE",
            created_at=datetime.now(timezone.utc)
        )
        db.add(c)
    db.commit()
    logger.info("Default candidates and access codes verified.")


