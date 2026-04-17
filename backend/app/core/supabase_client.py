"""
Supabase REST API client — 不走 psycopg2 direct connection，
改用 HTTP 請求走 Supabase REST API (PostgREST)。
"""
import os
import httpx
from typing import Optional, Any

class SupabaseClient:
    def __init__(self, supabase_url: str, supabase_key: str):
        self.url = supabase_url.rstrip("/")
        # anon key 用於不需認證的讀取；service role key 可寫入
        self.headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        self._client: Optional[httpx.Client] = None

    @property
    def client(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(base_url=self.url, timeout=30.0)
        return self._client

    def close(self):
        if self._client:
            self._client.close()
            self._client = None

    # ── 通用 CRUD helpers ──────────────────────────────────────────

    def select(
        self,
        table: str,
        *,
        select: str = "*",
        filters: dict[str, Any] | None = None,
        order: str | None = None,
        range_start: int | None = None,
        range_end: int | None = None,
        limit: int | None = None,
        single: bool = False,
    ) -> list[dict] | dict | None:
        """
        GET /{table}?select=...&eq.field=value&order=...&limit=...
        filters: { "field": value }  →  field=eq.{value}
        """
        params = {"select": select}
        if filters:
            for field, value in filters.items():
                if isinstance(value, list):
                    # in 查詢
                    params[f"{field}"] = f"in.({','.join(str(v) for v in value)})"
                else:
                    params[f"{field}"] = f"eq.{value}"
        if order:
            params["order"] = order
        if limit:
            params["limit"] = limit
        headers = dict(self.headers)
        if range_start is not None and range_end is not None:
            headers["Range"] = f"{range_start}-{range_end}"

        resp = self.client.get(f"/rest/v1/{table}", params=params, headers=headers)
        resp.raise_for_status()

        if single:
            data = resp.json()
            # single=true 時 PostgREST 仍回 [] 或 [{...}]，取第一筆
            return data[0] if isinstance(data, list) and data else (data if data else None)

        # 陣列
        result = resp.json()
        return result if isinstance(result, list) else []

    def insert(self, table: str, row: dict, *, upsert: bool = False) -> dict:
        """
        POST /{table}  (或 PUT with upsert=true)
        """
        headers = dict(self.headers)
        if upsert:
            headers["Prefer"] = "return=representation,resolution=merge-duplicates"
            resp = self.client.post(
                f"/rest/v1/{table}",
                json=[row],
                headers=headers,
            )
        else:
            resp = self.client.post(f"/rest/v1/{table}", json=[row], headers=headers)
        resp.raise_for_status()
        result = resp.json()
        # 可能回傳 [] 或單一物件，取第一筆
        if isinstance(result, list):
            return result[0] if result else row
        return result

    def update(
        self,
        table: str,
        row: dict,
        *,
        filters: dict[str, Any],
    ) -> dict | None:
        """
        PATCH /{table}?field=eq.value
        """
        params = {}
        for field, value in filters.items():
            params[field] = f"eq.{value}"

        headers = dict(self.headers)
        resp = self.client.patch(
            f"/rest/v1/{table}",
            params=params,
            json=row,
            headers=headers,
        )
        resp.raise_for_status()
        result = resp.json()
        if isinstance(result, list):
            return result[0] if result else None
        return result

    def delete(self, table: str, *, filters: dict[str, Any]) -> bool:
        """
        DELETE /{table}?field=eq.value
        """
        params = {}
        for field, value in filters.items():
            params[field] = f"eq.{value}"

        resp = self.client.delete(f"/rest/v1/{table}", params=params, headers=self.headers)
        resp.raise_for_status()
        return resp.status_code in (200, 204, 404)

    def rpc(self, function: str, params: dict[str, Any] | None = None) -> Any:
        """
        呼叫 PostgREST RPC (stored procedure)
        """
        headers = dict(self.headers)
        headers["Content-Type"] = "application/json"
        body = {"args": params or {}}
        resp = self.client.post(f"/rest/v1/rpc/{function}", json=body, headers=headers)
        resp.raise_for_status()
        return resp.json()


# ── singleton ────────────────────────────────────────────────────────────────

def _build_client() -> SupabaseClient:
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_KEY", os.getenv("SUPABASE_SERVICE_KEY", ""))
    if not supabase_url:
        raise RuntimeError("SUPABASE_URL is not set")
    if not supabase_key:
        raise RuntimeError("SUPABASE_KEY is not set")
    return SupabaseClient(supabase_url, supabase_key)


# 延遲初始化（等到第一次使用才建立），避免 launch 時還沒設定 env
_client: Optional[SupabaseClient] = None

def get_client() -> SupabaseClient:
    global _client
    if _client is None:
        _client = _build_client()
    return _client
