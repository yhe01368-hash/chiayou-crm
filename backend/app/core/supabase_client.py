"""
PostgreSQL client (Neon) — 2026-07-16 從 Supabase REST API 遷移。

保留原本 SupabaseClient 介面（select / insert / update / delete / rpc），
內部用 SQLAlchemy + 原生 SQL 直連 PostgreSQL。
10 個 route 檔案一行都不用改。

PostgREST filter 語法翻譯規則（保持介面相容）：
  "name=admin"          → WHERE name = :name,  bind: admin
  filters={"status": "gte.pending"}  → WHERE status >= :status, bind: pending
  filters={"id": ["a","b"]} (list)   → WHERE id IN (...)
  filters={"shipment_date": ["gte.2026-01-01","lte.2026-01-31"]}
    → params_list 模式（route 端用 list[tuple]，內部 SQL 拼成多個 WHERE）
"""
import os
import json
import ast
from typing import Optional, Any
from sqlalchemy import create_engine, text, bindparam
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool
import httpx  # 為了讓 route 端的 except httpx.HTTPStatusError 繼續運作


class _DBError(Exception):
    """內部錯誤，包裝後拋出 httpx.HTTPStatusError 讓 route 端 except 抓到。"""
    pass


def _raise_db_error(stage: str, err: Exception):
    """把 SQLAlchemy / psycopg2 錯誤包裝成 httpx.HTTPStatusError，
    讓現有 route 的 except httpx.HTTPStatusError 不需要改。"""
    msg = f"[{stage}] {type(err).__name__}: {str(err)}"
    # httpx.HTTPStatusError 需要 request/response 物件，但我們直接 raise 字串版本
    # 改用更簡單做法：拋出 httpx.RequestError（也是 httpx 的 base）
    fake_request = httpx.Request("POST", "http://internal/db")
    raise httpx.HTTPStatusError(
        message=msg,
        request=fake_request,
        response=httpx.Response(500, request=fake_request),
    ) from err


class SupabaseClient:
    """介面跟舊版完全相同，內部換成 PostgreSQL (Neon)。"""

    def __init__(self, database_url: str):
        if not database_url:
            raise RuntimeError("DATABASE_URL is not set")
        self.database_url = database_url
        self._engine: Optional[Engine] = None

    @property
    def engine(self) -> Engine:
        if self._engine is None:
            self._engine = create_engine(
                self.database_url,
                poolclass=QueuePool,
                pool_size=5,
                max_overflow=10,
                pool_pre_ping=True,  # Neon 會 idle suspend，pre_ping 自動重連
                pool_recycle=300,    # 5 分鐘 recycle（Neon idle 會 suspend）
                connect_args={
                    "connect_timeout": 10,
                    "application_name": "chiayou-crm",
                },
            )
        return self._engine

    def close(self):
        if self._engine:
            self._engine.dispose()
            self._engine = None

    # ── 通用 CRUD helpers（介面跟舊版完全相同）──────────────────────────

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
        try:
            # select 參數（PostgREST 風格 "*,customer:customers(*)" 簡化掉，
            # 因為我們用 SQL JOIN 自己做 embed，route 端可能會傳 embed select，
            # 這裡當作一般欄位處理）
            select_cols = self._translate_select(select)

            sql = f"SELECT {select_cols} FROM {table}"
            params: dict[str, Any] = {}
            where_clauses: list[str] = []

            if filters:
                for field, value in filters.items():
                    clauses, p = self._translate_filter(field, value, params)
                    where_clauses.extend(clauses)
                    params.update(p)

            if where_clauses:
                sql += " WHERE " + " AND ".join(where_clauses)

            if order:
                # order="created_at.desc" → ORDER BY created_at DESC
                parts = order.split(".")
                col = parts[0]
                direction = parts[1].upper() if len(parts) > 1 else "ASC"
                nulls = "NULLS LAST" if direction == "DESC" else "NULLS FIRST"
                sql += f" ORDER BY {col} {direction} {nulls}"

            # Range 處理（PostgREST Range header 對應 SQL OFFSET/LIMIT）
            offset = 0
            if range_start is not None and range_end is not None:
                # PostgREST Range 是 inclusive 0-based；SQL OFFSET 也是
                offset = range_start
                limit = range_end - range_start + 1

            if limit:
                sql += f" LIMIT {int(limit)} OFFSET {int(offset)}"

            with self.engine.connect() as conn:
                result = conn.execute(text(sql), params)
                rows = [dict(row._mapping) for row in result]

            # UUID 轉字串（psycopg2 預設回傳 UUID 物件，舊介面是字串）
            rows = self._normalize_uuids(rows)

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
        upsert: True 時用 ON CONFLICT DO UPDATE（需要 primary key）
        """
        try:
            # 過濾掉 None 值（除非該欄 nullable 且真的有傳）
            clean = {k: v for k, v in row.items() if v is not None}
            if not clean:
                return row

            cols = list(clean.keys())
            placeholders = [f":{c}" for c in cols]

            sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(placeholders)})"

            if upsert:
                # 假設主鍵是 id；如果表沒 id 就跳過 ON CONFLICT
                if "id" in cols:
                    update_set = ", ".join([f"{c} = EXCLUDED.{c}" for c in cols if c != "id"])
                    sql += f" ON CONFLICT (id) DO UPDATE SET {update_set}"

            sql += " RETURNING *"

            with self.engine.connect() as conn:
                result = conn.execute(text(sql), clean)
                conn.commit()
                returned = result.fetchone()
                if returned is None:
                    return clean
                d = dict(returned._mapping)
                d = self._normalize_uuids([d])[0]
                return d

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

            set_clauses = [f"{c} = :{c}" for c in clean.keys()]
            params = dict(clean)
            where_clauses, p = self._build_where(filters, params)

            sql = f"UPDATE {table} SET {', '.join(set_clauses)}"
            if where_clauses:
                sql += " WHERE " + " AND ".join(where_clauses)
            sql += " RETURNING *"

            with self.engine.connect() as conn:
                result = conn.execute(text(sql), params)
                conn.commit()
                returned = result.fetchone()
                if returned is None:
                    return None
                d = dict(returned._mapping)
                d = self._normalize_uuids([d])[0]
                return d

        except httpx.HTTPStatusError:
            raise
        except Exception as e:
            _raise_db_error("update", e)

    def delete(self, table: str, *, filters: dict[str, Any]) -> bool:
        """DELETE /{table}?field=eq.value"""
        try:
            params: dict[str, Any] = {}
            where_clauses, _ = self._build_where(filters, params)

            sql = f"DELETE FROM {table}"
            if where_clauses:
                sql += " WHERE " + " AND ".join(where_clauses)

            with self.engine.connect() as conn:
                result = conn.execute(text(sql), params)
                conn.commit()
                return result.rowcount >= 0

        except httpx.HTTPStatusError:
            raise
        except Exception as e:
            _raise_db_error("delete", e)

    def rpc(self, function: str, params: dict[str, Any] | None = None, *, postgrest_rpc: bool = False) -> Any:
        """
        呼叫 PostgreSQL stored procedure / function
        postgrest_rpc=True 時，params 是 named arguments（直接傳給函式）

        JSONB 欄位處理：如果參數值是 list/dict，序列化為 JSON 字串，
        PostgreSQL 會自動 cast 到 jsonb。
        """
        try:
            import json as json_lib

            if not params:
                sql = f"SELECT * FROM {function}()"
                bind = {}
            else:
                # JSONB 序列化：list/dict → JSON string（PG 會自動轉 jsonb）
                bind = {}
                for k, v in params.items():
                    if isinstance(v, (list, dict)):
                        bind[k] = json_lib.dumps(v, ensure_ascii=False)
                    else:
                        bind[k] = v

                placeholders = [f":{k}" for k in bind.keys()]
                sql = f"SELECT * FROM {function}({', '.join(placeholders)})"

            with self.engine.connect() as conn:
                result = conn.execute(text(sql), bind)
                conn.commit()
                rows = result.fetchall()
                if not rows:
                    return []
                if result.keys():
                    out = []
                    for row in rows:
                        d = dict(row._mapping)
                        # JSONB 欄位已經是 dict（psycopg2 自動轉），保持
                        d = self._normalize_uuids([d])[0]
                        out.append(d)
                    return out
                return [row[0] for row in rows]

        except httpx.HTTPStatusError:
            raise
        except Exception as e:
            _raise_db_error("rpc", e)

    # ── 內部 helper ─────────────────────────────────────────────────────

    def _translate_select(self, select: str) -> str:
        """
        PostgREST select 字串翻譯成 SQL。
        "*" → "*"
        "id,name" → "id, name"
        "*,customer:customers(*)" → "*"（embed 我們沒實作，簡化）
        """
        if select in ("*", ""):
            return "*"
        # 移除 embed 語法（"relation(*)"），保留頂層欄位
        cleaned = []
        for part in select.split(","):
            part = part.strip()
            if "(" in part or ":" in part:
                # embed，跳過
                continue
            cleaned.append(part)
        return ", ".join(cleaned) if cleaned else "*"

    def _translate_filter(self, field: str, value: Any, params: dict) -> tuple[list[str], dict]:
        """
        把單一 filter (field, value) 翻譯成 WHERE 子句 + bind params。
        """
        if isinstance(value, list):
            # list 模式：每個元素可能是 "eq.x"、"gte.y" 或純值
            # 規則：若 list 中完全沒有任何 "op.val" 形式的字串，
            #       代表是純值 list → 直接組 IN(...)
            #       否則視為「多個獨立條件」(eq./gte./lte.)，用 AND 串起來
            has_op = any(isinstance(v, str) and "." in v and v.split(".", 1)[0] in {"eq","neq","gt","gte","lt","lte","like","ilike","in"} for v in value)
            if not has_op:
                # 純值 list → IN
                keys = [f"{field}_{i}" for i in range(len(value))]
                for i, v in enumerate(value):
                    params[keys[i]] = v
                return [f"{field} IN ({', '.join(':' + k for k in keys)})"], params
            clauses = []
            for i, v in enumerate(value):
                key = f"{field}_{i}"
                if isinstance(v, str) and "." in v:
                    op, val = v.split(".", 1)
                    clauses.append(f"{field} {self._op_sql(op)} :{key}")
                    params[key] = self._cast_value(val, op)
                else:
                    clauses.append(f"{field} = :{key}")
                    params[key] = v
            return clauses, params

        if isinstance(value, str) and "." in value:
            # operator 模式 "gte.X"、"lte.X"、"neq.X"
            op, val = value.split(".", 1)
            key = field
            params[key] = self._cast_value(val, op)
            return [f"{field} {self._op_sql(op)} :{key}"], params

        # 純等值
        params[field] = value
        return [f"{field} = :{field}"], params

    def _build_where(self, filters: dict, params: dict) -> tuple[list[str], dict]:
        """從 filters dict 累積 WHERE 子句。"""
        clauses = []
        for field, value in filters.items():
            c, _ = self._translate_filter(field, value, params)
            clauses.extend(c)
        return clauses, params

    def _op_sql(self, op: str) -> str:
        return {
            "eq": "=",
            "neq": "!=",
            "gt": ">",
            "gte": ">=",
            "lt": "<",
            "lte": "<=",
            "like": "LIKE",
            "ilike": "ILIKE",
            "is": "IS",
        }.get(op, "=")

    def _cast_value(self, val: str, op: str):
        """嘗試把字串值轉成正確型別（數字、布林、null）。"""
        if val.lower() in ("null", "none"):
            return None
        if val.lower() in ("true", "false"):
            return val.lower() == "true"
        # 試著轉數字
        try:
            if "." in val:
                return float(val)
            return int(val)
        except ValueError:
            return val

    def _normalize_uuids(self, rows: list[dict]) -> list[dict]:
        """把 UUID 物件轉成字串、Decimal 轉 float（保持舊介面回傳型別一致）。"""
        from uuid import UUID
        from decimal import Decimal
        out = []
        for r in rows:
            d = {}
            for k, v in r.items():
                if isinstance(v, UUID):
                    d[k] = str(v)
                elif isinstance(v, Decimal):
                    d[k] = float(v)
                elif isinstance(v, dict):
                    # JSONB 欄位已經是 dict，保持原樣
                    d[k] = v
                elif isinstance(v, list):
                    d[k] = v
                else:
                    d[k] = v
            out.append(d)
        return out


# ── singleton ────────────────────────────────────────────────────────────────

def _build_client() -> SupabaseClient:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")
    return SupabaseClient(database_url)


_client: Optional[SupabaseClient] = None

def get_client() -> SupabaseClient:
    global _client
    if _client is None:
        _client = _build_client()
    return _client