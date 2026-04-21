from fastapi import APIRouter, HTTPException
from typing import List, Optional, Union
from ..schemas import KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse
from app.core.supabase_client import get_client

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

@router.get("", response_model=List[KnowledgeBaseResponse])
def list_knowledge(search: str = None, category: str = None):
    sb = get_client()
    
    filters = {}
    if category:
        filters["category"] = category
    
    result = sb.select("knowledge", filters=filters if filters else None)
    return result or []

@router.get("/{knowledge_id}", response_model=KnowledgeBaseResponse)
def get_knowledge(knowledge_id: Union[int, str]):
    sb = get_client()
    result = sb.select("knowledge", filters={"id": str(knowledge_id)}, single=True)
    
    if not result:
        raise HTTPException(status_code=404, detail="找不到這個知識庫項目")
    
    return result

@router.post("", response_model=KnowledgeBaseResponse)
def create_knowledge(knowledge: KnowledgeBaseCreate):
    sb = get_client()
    payload = knowledge.model_dump()
    result = sb.insert("knowledge", payload)
    return result

@router.put("/{knowledge_id}", response_model=KnowledgeBaseResponse)
def update_knowledge(knowledge_id: Union[int, str], knowledge: KnowledgeBaseUpdate):
    sb = get_client()
    payload = {k: v for k, v in knowledge.model_dump(exclude_unset=True).items() if v is not None}
    
    if not payload:
        return get_knowledge(knowledge_id)
    
    result = sb.update("knowledge", payload, filters={"id": str(knowledge_id)})
    
    if not result:
        raise HTTPException(status_code=404, detail="更新失敗")
    
    return result

@router.delete("/{knowledge_id}")
def delete_knowledge(knowledge_id: Union[int, str]):
    sb = get_client()
    sb.delete("knowledge", filters={"id": str(knowledge_id)})
    return {"message": "刪除成功"}