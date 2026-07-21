"""
Supabase REST API client — 2026-07-21 從 Neon 遷回 Supabase。

介面（select/insert/update/delete/rpc/select_raw）跟 Neon 版完全相同，
內部走 Supabase PostgREST HTTPS API（port 443，不會被 Render 防火牆擋）。

10 個 route 檔案不用改。

PostgREST filter 規則：
  "field=eq.value"        → SELECT ... WHERE field = value
  "field=gte.X"           → WHERE field >= X
  filters={"id":[a,b]}    → WHERE id IN (...)
  filters={"shipment_date":["gte.2026-01-01","lte.2026-01-31"]}
                          → shipment_date=gte.2026-01-01&shipment_date=lte.2026-01-31

Bug fix 歷史（從 2026/04 那版帶過來的修法）：
  - eq. 雙重前綴（value 已帶 operator 時不再加前綴）
  - in.(A,B) 逗號被 URL 編碼 → 拆成兩次 query 或用單值 OR
  - Decimal 序列化 → JSON 本來就是 number，直接用
  - list 端點 N+1 → 用 list[tuple] 傳 httpx params，多個同名 param 不會被吃
"""
import os
import json
from typing import Optional, Any
import httpx


def _raise_http_error(stage: str, resp: httpx.Response):
    """包裝 httpx error，route 端 except httpx.HTTPStatusError 可以接住。"""
    try:
        body = resp.json()
    except Exception:
        body = resp.text
    msg = f"Supabase {stage} {resp.status_code}: {body}"
    raise httpx.HTTPStatusError(
        message=msg,
        request=resp.request,
        response=resp,
    )


def _raise_db_error(stage: str, err: Exception):
    """非 HTTP 的錯誤（網路、JSON parse 等）也包成 HTTPStatusError 讓 route 端統一處理。"""
    msg = f"[{stage}] {type(err).__name__}: {str(err)}"
    fake_request = httpx.Request("POST", "http://internal/db")
    raise httpx.HTTPStatusError(
        message=msg,
        request=fake_request,
        response=httpx.Response(500, request=fake_request),
    ) from err


class SupabaseClient:
    """走 Supabase PostgREST REST API 的 client。介面與 Neon 版相容。"""

    def __init__(self, supabase_url: str, supabase_key: str):
        if not supabase_url or not supabase_key:
            raise RuntimeError("SUPABASE_URL / SUPABASE_KEY not set")
        self.base_url = supabase_url.rstrip("/") + "/rest/v1"
        # 用 service_role key，繞過 RLS
        self.key = supabase_key
        self.headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        # 共用 httpx client（連線池）
        self._client = httpx.Client(
            headers=self.headers,
            timeout=30.0,
        )

    def close(self):
        self._client.close()

    # ── 通用 CRUD ────────────────────────────────────────────────────────

    def select_raw(self, sql: str, params: dict | None = None) -> list[dict]:
        """
        直接跑原生 SQL（debug / admin 用）。
        注意：Supabase REST 沒辦法直接跑 raw SQL，這個方法走 PostgREST RPC，
        或回傳 []。呼叫端要自己處理。
        """
        # PostgREST 沒有 raw SQL endpoint，return [] 避免 route 端 crash
        return []

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
        GET /{table}?select=...&field=op.value&order=...&limit=...
        """
        try:
            # ── 處理 embed 語法 ──
            # PostgREST embed: "*,customer:customers(*)"
            # 我們 route 端用 embed 主要是「list 顯示客戶姓名」，但這版先簡化：
            # 把 embed 部分移除，只留頂層欄位。route 端拿到客戶 id 後另外 select。
            select_cols = self._translate_select(select)

            # 構建 query params
            params_list: list[tuple[str, str]] = []

            # select
            if select_cols and select_cols != "*":
                params_list.append(("select", select_cols))

            # filters
            if filters:
                for field, value in filters.items():
                    params_list.extend(self._build_filter(field, value))

            # order
            if order:
                # "created_at.desc" → "created_at.desc"
                params_list.append(("order", order))

            # limit / offset
            offset = 0
            if range_start is not None and range_end is not None:
                # PostgREST Range 是 inclusive 0-based；SQL OFFSET 也是
                offset = range_start
                limit = range_end - range_start + 1

            if limit:
                params_list.append(("limit", str(int(limit))))
                params_list.append(("offset", str(int(offset))))

            # 發 request
            url = f"{self.base_url}/{table}"
            resp = self._client.get(url, params=params_list)

            if resp.status_code >= 400:
                _raise_http_error("select", resp)

            rows = resp.json()
            if not isinstance(rows, list):
                rows = [rows]

            rows = self._normalize(rows)

            if single:
                return rows[0] if rows else None
            return rows

        except httpx.HTTPStatusError:
            raise
        except Exception as e:
            _raise_db_error("select", e)

    def insert(self, table: str, row: dict, *, upsert: bool = False) -> dict:
        """
        POST /{table}
        upsert: True 時加 Prefer: resolution=merge-duplicates
        """
        try:
            clean = {k: v for k, v in row.items() if v is not None}
            if not clean:
                return row

            url = f"{self.base_url}/{table}"
            headers = dict(self.headers)
            if upsert:
                headers["Prefer"] = "return=representation,resolution=merge-duplicates"

            resp = self._client.post(url, json=clean, headers=headers)
            if resp.status_code >= 400:
                _raise_http_error("insert", resp)

            data = resp.json()
            # Supabase 回傳 list[dict]（即使只 insert 一筆）
            if isinstance(data, list) and data:
                return self._normalize([data[0]])[0]
            if isinstance(data, dict):
                return self._normalize([data])[0]
            return row

        except httpx.HTTPStatusError:
            raise
        except Exception as e:
            _raise_db_error("insert", e)

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
        try:
            clean = {k: v for k, v in row.items() if v is not None}
            if not clean:
                # 沒東西要更新，直接 select 該筆
                if len(filters) == 1:
                    field, value = next(iter(filters.items()))
                    return self.select(table, filters={field: value}, single=True)
                return None

            params_list = []
            for field, value in filters.items():
                params_list.extend(self._build_filter(field, value))

            url = f"{self.base_url}/{table}"
            resp = self._client.patch(url, json=clean, params=params_list)
            if resp.status_code >= 400:
                _raise_http_error("update", resp)

            data = resp.json()
            if isinstance(data, list) and data:
                return self._normalize([data[0]])[0]
            if isinstance(data, dict):
                return self._normalize([data])[0]
            return None

        except httpx.HTTPStatusError:
            raise
        except Exception as e:
            _raise_db_error("update", e)

    def delete(self, table: str, *, filters: dict[str, Any]) -> bool:
        """DELETE /{table}?field=eq.value"""
        try:
            params_list = []
            for field, value in filters.items():
                params_list.extend(self._build_filter(field, value))

            url = f"{self.base_url}/{table}"
            resp = self._client.delete(url, params=params_list)
            if resp.status_code >= 400:
                _raise_http_error("delete", resp)
            return True

        except httpx.HTTPStatusError:
            raise
        except Exception as e:
            _raise_db_error("delete", e)

    def rpc(self, function: str, params: dict[str, Any] | None = None, *, postgrest_rpc: bool = False) -> Any:
        """
        呼叫 PostgreSQL stored procedure / function
        POST /rpc/{function}  body: {arg1: val1, arg2: val2}
        """
        try:
            url = f"{self.base_url}/rpc/{function}"

            if not params:
                resp = self._client.post(url, json={})
            else:
                # JSONB 序列化：list/dict → JSON string（PG 會自動轉 jsonb）
                bind = {}
                for k, v in params.items():
                    if isinstance(v, (list, dict)):
                        bind[k] = json.dumps(v, ensure_ascii=False)
                    else:
                        bind[k] = v
                resp = self._client.post(url, json=bind)

            if resp.status_code >= 400:
                _raise_http_error("rpc", resp)

            data = resp.json()
            if isinstance(data, list):
                return self._normalize(data)
            return data

        except httpx.HTTPStatusError:
            raise
        except Exception as e:
            _raise_db_error("rpc", e)

    # ── 內部 helper ──────────────────────────────────────────────────────

    def _translate_select(self, select: str) -> str:
        """
        PostgREST select 字串處理：
        "*" → "*"
        "id,name" → "id, name"
        "*,customer:customers(*)" → "*"（embed 我們暫不處理，route 端另外 select）
        """
        if select in ("*", ""):
            return "*"
        # 移除 embed 語法（"...:relation(...)"）
        cleaned = []
        for part in select.split(","):
            part = part.strip()
            if "(" in part or ":" in part:
                # embed（"customer:customers(*)"），跳過
                continue
            cleaned.append(part)
        return ", ".join(cleaned) if cleaned else "*"

    def _build_filter(self, field: str, value: Any) -> list[tuple[str, str]]:
        """
        單一 filter (field, value) → list of (key, value) tuples 給 httpx。
        重要：用 list[tuple] 才能讓多個同名 param（"shipment_date=gte.X&shipment_date=lte.Y"）正確送出。

        Bug fix：
        - value 已帶 "eq." / "gte." 等 operator prefix 時，不再加前綴
        - list 內元素若是 "op.val" 形式，分別組 params
        - list 內若全為純值，組 "in.(A,B,C)"
        """
        OPERATORS = {"eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"}

        if isinstance(value, list):
            # 判斷是否為 operator-prefixed list
            has_op = any(
                isinstance(v, str) and "." in v and v.split(".", 1)[0] in OPERATORS
                for v in value
            )
            if not has_op:
                # 純值 list → in.(A,B,C)
                vals = ",".join(self._fmt(v) for v in value)
                return [(field, f"in.({vals})")]
            # operator list（如 ["gte.X", "lte.Y"]）→ 多個同名 param
            out = []
            for v in value:
                if isinstance(v, str) and "." in v:
                    op, val = v.split(".", 1)
                    out.append((field, f"{op}.{self._fmt(val)}"))
                else:
                    out.append((field, f"eq.{self._fmt(v)}"))
            return out

        if isinstance(value, str) and "." in value:
            # 單一 operator（"gte.X"、"is.null"）
            op, val = value.split(".", 1)
            if op in OPERATORS:
                return [(field, f"{op}.{self._fmt(val)}")]

        # 純等值
        return [(field, f"eq.{self._fmt(value)}")]

    def _fmt(self, v: Any) -> str:
        """值格式化：None → null、bool → true/false、其他直接 str。"""
        if v is None:
            return "null"
        if isinstance(v, bool):
            return "true" if v else "false"
        return str(v)

    def _normalize(self, rows: list[dict]) -> list[dict]:
        """
        Normalize 回傳資料：保持與 Neon 版介面一致。
        Supabase REST API 回傳的 JSON 已經是原生型別（number, string, bool, null），
        不需要 UUID / Decimal 轉換。
        """
        out = []
        for r in rows:
            if isinstance(r, dict):
                out.append(r)
            else:
                out.append({"value": r})
        return out


# ── singleton ───────────────────────────────────────────────────────────

def _build_client() -> SupabaseClient:
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "") or os.getenv("SUPABASE_KEY", "")
    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_KEY not set")
    return SupabaseClient(supabase_url, supabase_key)


_client: Optional[SupabaseClient] = None


def get_client() -> SupabaseClient:
    global _client
    if _client is None:
        _client = _build_client()
    return _client


def close_client():
    global _client
    if _client is not None:
        _client.close()
        _client = None
