from fastapi import APIRouter, HTTPException
from typing import List, Optional, Union
from ..schemas import KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse
from app.core.supabase_client import get_client
import traceback

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

@router.get("/debug/tables")
def debug_tables():
    """列出 Neon 裡所有 public schema 的 table 和欄位"""
    sb = get_client()
    try:
        rows = sb.select_raw(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' ORDER BY table_name"
        )
        tables = [r["table_name"] for r in (rows or [])]
        knowledge_cols = []
        if "knowledge" in tables:
            col_rows = sb.select_raw(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='knowledge' ORDER BY ordinal_position"
            )
            knowledge_cols = col_rows or []
        return {"tables": tables, "knowledge_columns": knowledge_cols}
    except Exception as e:
        return {"error": f"{type(e).__name__}: {str(e)}", "tb": traceback.format_exc()}

@router.get("", response_model=List[KnowledgeBaseResponse])
def list_knowledge(search: str = None, category: str = None):
    sb = get_client()
    
    filters = {}
    if category:
        filters["category"] = category
    
    result = sb.select("knowledge", filters=filters if filters else None, order="created_at.desc")
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

@router.post("/_migrate")
def migrate_knowledge_table():
    """一次性 migration：建立 knowledge table（idempotent，重跑無害）"""
    sb = get_client()
    try:
        # knowledge 沒建過。CREATE TABLE IF NOT EXISTS + 加索引
        sb.select_raw("""
            CREATE TABLE IF NOT EXISTS knowledge (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(50) NOT NULL DEFAULT '其他',
                problem TEXT NOT NULL DEFAULT '',
                solution TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        sb.select_raw("CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category)")
        sb.select_raw("CREATE INDEX IF NOT EXISTS idx_knowledge_created_at ON knowledge(created_at DESC)")
        # 順便驗證：列出 columns
        cols = sb.select_raw(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='knowledge' ORDER BY ordinal_position"
        )
        return {"status": "ok", "knowledge_columns": cols}
    except Exception as e:
        return {"status": "error", "error": f"{type(e).__name__}: {str(e)}", "tb": traceback.format_exc()}