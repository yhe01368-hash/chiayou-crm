from pydantic import BaseModel, field_validator
from typing import Optional, Union
from datetime import datetime
from uuid import UUID

class KnowledgeBaseCreate(BaseModel):
    title: str
    category: str
    problem: str
    solution: str

class KnowledgeBaseUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    problem: Optional[str] = None
    solution: Optional[str] = None

class KnowledgeBaseResponse(BaseModel):
    id: int | str
    title: str
    category: str
    problem: str
    solution: str
    created_at: Union[str, datetime]
    updated_at: Union[str, datetime]

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def datetime_to_str(cls, v):
        """SQLAlchemy/PostgreSQL 回傳 datetime 物件，Pydantic schema 寫 str，
        需要在驗證前先把 datetime 轉成 ISO 字串。"""
        if isinstance(v, datetime):
            return v.isoformat()
        return v
