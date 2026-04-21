from fastapi import APIRouter, HTTPException
from typing import List
from uuid import UUID
from ..schemas import KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse
from app.core.supabase_client import get_client

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

@router.get("", response_model=List[KnowledgeBaseResponse])
def list_knowledge(search: str = None, category: str = None):
    sb = get_client()
    query = sb.table("knowledge").select("*")
    
    if category:
        query = query.eq("category", category)
    
    result = query.execute()
    
    if search:
        # Filter by title or problem contains search keyword (client-side filtering for simplicity)
        pass
    
    return result.data

@router.get("/{knowledge_id}", response_model=KnowledgeBaseResponse)
def get_knowledge(knowledge_id: UUID):
    sb = get_client()
    result = sb.table("knowledge").select("*").eq("id", str(knowledge_id)).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="找不到這個知識庫項目")
    
    return result.data[0]

@router.post("", response_model=KnowledgeBaseResponse)
def create_knowledge(knowledge: KnowledgeBaseCreate):
    sb = get_client()
    payload = knowledge.model_dump()
    result = sb.table("knowledge").insert(payload).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="建立失敗")
    
    return result.data[0]

@router.put("/{knowledge_id}", response_model=KnowledgeBaseResponse)
def update_knowledge(knowledge_id: UUID, knowledge: KnowledgeBaseUpdate):
    sb = get_client()
    payload = {k: v for k, v in knowledge.model_dump(exclude_unset=True).items() if v is not None}
    
    if not payload:
        return get_knowledge(knowledge_id)
    
    result = sb.table("knowledge").update(payload).eq("id", str(knowledge_id)).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="更新失敗")
    
    return result.data[0]

@router.delete("/{knowledge_id}")
def delete_knowledge(knowledge_id: UUID):
    sb = get_client()
    sb.table("knowledge").delete().eq("id", str(knowledge_id)).execute()
    return {"message": "刪除成功"}
