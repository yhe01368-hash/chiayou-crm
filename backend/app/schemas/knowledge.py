from pydantic import BaseModel
from typing import Optional
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
    created_at: str
    updated_at: str
