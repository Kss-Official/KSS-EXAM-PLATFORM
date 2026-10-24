import os
import hashlib
import uuid
from typing import Optional, Set
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile, status

from app.core import settings
from app.models import StoredDocument

ALLOWED_EXTENSIONS: Set[str] = {"pdf", "txt", "csv", "doc", "docx"}

class DocumentStorageService:
    @staticmethod
    def _ensure_storage_dir() -> str:
        upload_dir = os.path.abspath(settings.UPLOAD_DIR)
        os.makedirs(upload_dir, exist_ok=True)
        return upload_dir

    @classmethod
    def store_document_sync(
        cls,
        db: Session,
        file: UploadFile,
        exam_id: Optional[int],
        department_id: Optional[int],
        question_set_id: Optional[int],
        document_type: str,
        admin_id: Optional[int]
    ) -> StoredDocument:
        storage_dir = cls._ensure_storage_dir()

        orig_filename = file.filename or "document.pdf"
        if ".." in orig_filename or "/" in orig_filename or "\\" in orig_filename:
            orig_filename = os.path.basename(orig_filename)

        ext = orig_filename.rsplit(".", 1)[-1].lower() if "." in orig_filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '.{ext}' is not permitted. Allowed: {list(ALLOWED_EXTENSIONS)}"
            )

        content = file.file.read()
        if len(content) > settings.MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum 25 MB limit"
            )

        # Compute SHA-256 checksum
        sha256 = hashlib.sha256(content).hexdigest()

        # Save to disk with unique key
        unique_name = f"{uuid.uuid4()}_{int(datetime.now(timezone.utc).timestamp())}.{ext}"
        target_path = os.path.join(storage_dir, unique_name)

        with open(target_path, "wb") as f:
            f.write(content)

        doc = StoredDocument(
            exam_id=exam_id,
            department_id=department_id,
            question_set_id=question_set_id,
            document_type=document_type,
            original_filename=orig_filename,
            storage_path=target_path,
            mime_type=file.content_type,
            file_size=len(content),
            sha256_checksum=sha256,
            uploading_admin_id=admin_id,
            validation_status="VALIDATED",
            version_number=1,
            created_at=datetime.now(timezone.utc)
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc
