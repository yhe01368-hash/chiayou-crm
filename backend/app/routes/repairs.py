from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
import httpx
import json
import ast

from app.core.supabase_client import get_client
from app.schemas.schemas import (
    RepairCreate, RepairUpdate, RepairResponse, RepairStatusUpdate, RepairStatusEnum
)
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/repairs", tags=["維修管理"])


# 只有這些欄位在資料庫是 JSONB 欄位，需要反序列化。
#
# 為什麼不能對「整筆 row」遞迴解析：
# 舊版 _parse_jsonb 會把 row 裡每個字串都丟進 ast.literal_eval，於是純數字字串
# （例如大陸手機號 13361730638、台灣電話 0422911314）會被轉成 int。
# Pydantic 驗證 CustomerResponse.phone: str 時就會炸掉，整筆維修單 GET 回 500，
# 前端編輯頁面載入失敗 → 看起來像「資料打不開」。
# 注意台灣手機號 0910666544 因為有前導 0，literal_eval 會失敗，所以不會觸發；
# 大陸手機號沒有前導 0 就會中招 —— 與簡體中文完全無關。
JSONB_FIELDS = ("parts_used",)


def _parse_jsonb_value(value):
    """單一值：字串嘗試用 JSON / Python repr 反序列化，失敗就原樣回傳。

    只處理「欄位值本身是字串」的情況（舊 Neon 版會把 JSONB 存成字串）。
    如果值已經是原生 list/dict（Supabase REST 版），直接回傳，不碰裡面的字串。
    """
    if not isinstance(value, str):
        return value
    try:
        parsed = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        try:
            parsed = ast.literal_eval(value)
        except (ValueError, SyntaxError):
            return value
    # 只接受解析成容器（list/dict）的結果；純數字之類不該是 JSONB
    return parsed if isinstance(parsed, (list, dict)) else value


def _parse_jsonb(obj):
    """遞迴解析 dict/list（只用在 JSONB 欄位的值上）。"""
    if isinstance(obj, dict):
        return {k: _parse_jsonb(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_parse_jsonb(item) for item in obj]
    return _parse_jsonb_value(obj)


def _parse_jsonb_fields(row: dict) -> dict:
    """只解析 row 裡的 JSONB 欄位，其他欄位（電話、統編、HTML 內容…）原樣保留。"""
    for field in JSONB_FIELDS:
        if row.get(field) is not None:
            row[field] = _parse_jsonb(row[field])
    return row


def _load_repair(row: dict, sb) -> dict:
    """附加 customer 詳細資料，解析 JSONB 欄位"""
    if row.get("customer_id"):
        customer = sb.select(
            "customers",
            select="*",
            filters={"id": row["customer_id"]},
            single=True,
        )
        row["customer"] = customer
    # 只解析 JSONB 欄位（不要對整筆 row 做 literal_eval，理由見 JSONB_FIELDS 註解）
    row = _parse_jsonb_fields(row)
    return row


@router.get("", response_model=List[RepairResponse])
def get_repairs(
    status: Optional[RepairStatusEnum] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _current_user: dict = Depends(get_current_user),
):
    sb = get_client()
    filters = {}
    if status:
        filters["status"] = status.value
    if customer_id:
        filters["customer_id"] = str(customer_id)

    try:
        # Neon 直連 PG，select 不支援 embed 語法（PostgREST 才支援）。
        # 用原本 _load_repair 逐筆補 customer 會 N+1，所以改用「批量查詢」：
        # 1 次撈 repairs + 1 次 in 撈對應 customers + Python 端 join
        offset = skip if skip > 0 else 0
        rows = sb.select(
            "repairs",
            select="*",
            filters=filters if filters else None,
            order="created_at.desc",
            limit=limit,
            range_start=offset,
            range_end=offset + limit - 1,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"[select] {type(e).__name__}: {str(e)}")

    if not rows:
        return []

    try:
        rows = [_parse_jsonb_fields(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"[_parse_jsonb] {type(e).__name__}: {str(e)}")

    # 批量補 customer（解 N+1）
    try:
        customer_ids = list({r["customer_id"] for r in rows if r.get("customer_id")})
        if customer_ids:
            customers = sb.select(
                "customers",
                select="*",
                filters={"id": customer_ids},  # list → IN (...)
            )
            cust_map = {c["id"]: c for c in (customers or [])}
            for r in rows:
                cid = r.get("customer_id")
                r["customer"] = cust_map.get(str(cid)) if cid else None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"[customers batch] {type(e).__name__}: {str(e)}")

    return rows


@router.get("/{repair_id}", response_model=RepairResponse)
def get_repair(repair_id: UUID, _current_user: dict = Depends(get_current_user)):
    sb = get_client()
    try:
        row = sb.select(
            "repairs",
            select="*",
            filters={"id": str(repair_id)},
            single=True,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="維修單不存在")
    return _load_repair(row, sb)


@router.post("", response_model=RepairResponse, status_code=201)
def create_repair(repair: RepairCreate, _current_user: dict = Depends(get_current_user)):
    sb = get_client()

    # Verify customer exists
    try:
        customer = sb.select(
            "customers",
            select="id",
            filters={"id": str(repair.customer_id)},
            single=True,
        )
    except Exception:
        customer = None

    if not customer:
        raise HTTPException(status_code=404, detail="客戶不存在")

    payload = repair.model_dump()
    # 處理 Decimal -> float (Supabase JSON 不接受 Decimal)
    if payload.get("cost") is not None:
        payload["cost"] = float(payload["cost"])
    # UUID -> str；list 保持原樣（parts_used 等）
    for k, v in list(payload.items()):
        if v is not None and not isinstance(v, (str, int, float, bool, list)):
            payload[k] = str(v)

    try:
        row = sb.insert("repairs", payload)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return _load_repair(row, sb)


@router.put("/{repair_id}", response_model=RepairResponse)
def update_repair(repair_id: UUID, repair: RepairUpdate, _current_user: dict = Depends(get_current_user)):
    sb = get_client()
    payload = repair.model_dump(exclude_unset=True)
    if not payload:
        return get_repair(repair_id)

    if "cost" in payload and payload["cost"] is not None:
        payload["cost"] = float(payload["cost"])

    # parts_used 可能是 list → 保持原樣（已是 dict list）
    # UUID -> str (否則 JSON 序列化失敗)
    for k, v in list(payload.items()):
        if v is not None and not isinstance(v, (str, int, float, bool, list)):
            payload[k] = str(v)

    # ── 狀態改為 completed + 有使用零件 → 自動建立出貨單草稿 ──────
    new_status = payload.get("status")
    if new_status == "completed":
        old_repair = sb.select(
            "repairs",
            select="*",
            filters={"id": str(repair_id)},
            single=True,
        )
        if old_repair and old_repair.get("status") != "completed":
            # 編輯頁面會把「狀態 + 使用零件」放在同一次 PUT 送出。
            # 此時資料庫裡仍是舊的 parts_used，必須優先使用本次 payload，
            # 否則新填零件後直接按「已完成」不會建立出貨單草稿。
            parts = payload.get("parts_used", old_repair.get("parts_used", []))
            # old_repair 的 parts_used 可能是字串（舊 Neon 版把 JSONB 存成字串），
            # 統一解析成 list，避免後面 len()/for 迭代時拿到字串
            if isinstance(parts, str):
                parts = _parse_jsonb(parts)
            if isinstance(parts, dict):
                parts = [parts]
            if parts and len(parts) > 0:
                cust = sb.select("customers", select="name", filters={"id": str(old_repair["customer_id"])}, single=True)
                cust_name = cust.get("name", "未知客戶") if cust else "未知客戶"
                shipment_number = f"SH{datetime.now().strftime('%Y%m%d%H%M%S')}"
                shipment_payload = {
                    "shipment_number": shipment_number,
                    "customer_id": old_repair["customer_id"],
                    "shipment_date": date.today().isoformat(),
                    "status": "draft",
                    "note": f"維修單（{cust_name}）完成後自動建立",
                }
                created_shipment = sb.insert("shipments", shipment_payload)
                shipment_id = created_shipment["id"]
                total = 0.0
                for part in parts:
                    pid = part.get("product_id")
                    qty = part.get("quantity", 1)
                    if not pid:
                        continue
                    product = sb.select("inventory", select="*", filters={"id": pid}, single=True)
                    if not product:
                        continue
                    subtotal = qty * float(product["selling_price"])
                    total += subtotal
                    sb.insert("shipment_items", {
                        "shipment_id": shipment_id,
                        "product_id": pid,
                        "product_name": product["product_name"],
                        "quantity": qty,
                        "unit_price": float(product["selling_price"]),
                        "subtotal": subtotal,
                    })
                sb.update("shipments", {"total_amount": total}, filters={"id": shipment_id})

    try:
        row = sb.update(
            "repairs",
            payload,
            filters={"id": str(repair_id)},
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="維修單不存在")
    return _load_repair(row, sb)


@router.patch("/{repair_id}/status", response_model=RepairResponse)
def update_repair_status(repair_id: UUID, status_update: RepairStatusUpdate, _current_user: dict = Depends(get_current_user)):
    sb = get_client()

    # 拿取舊狀態
    old_repair = sb.select(
        "repairs",
        select="*",
        filters={"id": str(repair_id)},
        single=True,
    )
    if not old_repair:
        raise HTTPException(status_code=404, detail="維修單不存在")

    payload = {"status": status_update.status.value}
    if status_update.status == RepairStatusEnum.completed:
        payload["completed_at"] = datetime.utcnow().isoformat()

        # ── 有使用零件 → 自動建立出貨單草稿 ──────────────────────
        # parts_used 可能是字串（舊 Neon 版把 JSONB 存成字串），先解析成 list
        old_parts = old_repair.get("parts_used")
        if isinstance(old_parts, str):
            old_parts = _parse_jsonb(old_parts)
        if isinstance(old_parts, dict):
            old_parts = [old_parts]
        if old_parts and len(old_parts) > 0:
            # 取出客戶名稱
            cust = sb.select("customers", select="name", filters={"id": str(old_repair["customer_id"])}, single=True)
            cust_name = cust.get("name", "未知客戶") if cust else "未知客戶"
            shipment_number = f"SH{datetime.now().strftime('%Y%m%d%H%M%S')}"
            shipment_payload = {
                "shipment_number": shipment_number,
                "customer_id": old_repair["customer_id"],
                "shipment_date": date.today().isoformat(),
                "status": "draft",
                "note": f"維修單（{cust_name}）完成後自動建立",
            }
            created_shipment = sb.insert("shipments", shipment_payload)
            shipment_id = created_shipment["id"]
            total = 0.0

            for part in old_parts:
                pid = part.get("product_id")
                qty = part.get("quantity", 1)
                if not pid:
                    continue
                product = sb.select(
                    "inventory",
                    select="*",
                    filters={"id": pid},
                    single=True,
                )
                if not product:
                    continue
                subtotal = qty * float(product["selling_price"])
                total += subtotal
                sb.insert("shipment_items", {
                    "shipment_id": shipment_id,
                    "product_id": pid,
                    "product_name": product["product_name"],
                    "quantity": qty,
                    "unit_price": float(product["selling_price"]),
                    "subtotal": subtotal,
                })

            # 更新出貨單總金額
            sb.update("shipments", {"total_amount": total}, filters={"id": shipment_id})

    try:
        row = sb.update(
            "repairs",
            payload,
            filters={"id": str(repair_id)},
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="維修單不存在")
    return _load_repair(row, sb)


@router.delete("/{repair_id}", status_code=204)
def delete_repair(repair_id: UUID, _current_user: dict = Depends(get_current_user)):
    sb = get_client()
    try:
        sb.delete("repairs", filters={"id": str(repair_id)})
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return None
