"""
Supabase 直接使用模式 - 當沒有本地 PostgreSQL 時使用
透過 Supabase REST API 操作資料
"""
import os
from typing import Optional, List, Dict, Any
from uuid import UUID
import supabase
from supabase import create_client, Client

class SupabaseDB:
    def __init__(self):
        self.url: Optional[str] = os.getenv("SUPABASE_URL")
        self.key: Optional[str] = os.getenv("SUPABASE_KEY")
        self._client: Optional[Client] = None
    
    @property
    def client(self) -> Client:
        if self._client is None and self.url and self.key:
            self._client = create_client(self.url, self.key)
        return self._client
    
    def is_connected(self) -> bool:
        try:
            if self.client:
                self.client.table("customers").select("id").limit(1).execute()
                return True
        except Exception:
            pass
        return False

supabase_db = SupabaseDB()

def get_supabase() -> Client:
    if not supabase_db.is_connected():
        raise Exception("Supabase 未連接，請檢查環境變數 SUPABASE_URL 和 SUPABASE_KEY")
    return supabase_db.client
