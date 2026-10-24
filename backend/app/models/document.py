from datetime import datetime, timezone
from sqlalchemy import Column, BigInteger, Integer, String, DateTime, ForeignKey, Index
from app.core.database import Base, ID_TYPE

class StoredDocument(Base):
    __tablename__ = "stored_documents"
    __table_args__ = (
        Index("ix_stored_documents_exam_id", "exam_id"),
    )

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    exam_id = Column(BigInteger, ForeignKey("exams.id", ondelete="CASCADE"), nullable=True)
    department_id = Column(BigInteger, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    question_set_id = Column(BigInteger, ForeignKey("question_sets.id", ondelete="SET NULL"), nullable=True)
    document_type = Column(String(50), nullable=False)  # QUESTION_PAPER, ANSWER_KEY
    original_filename = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=False)
    sha256_checksum = Column(String(64), nullable=True)
    uploading_admin_id = Column(BigInteger, nullable=True)
    validation_status = Column(String(50), default="PENDING")
    version_number = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<StoredDocument id={self.id} type='{self.document_type}' filename='{self.original_filename}'>"
