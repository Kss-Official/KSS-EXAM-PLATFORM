from fastapi import APIRouter

router = APIRouter(tags=["Health"])

@router.get("/actuator/health")
@router.get("/health")
@router.get("/api/health")
def health_check():
    return {"status": "UP", "service": "ExamSecure FastAPI Backend"}
