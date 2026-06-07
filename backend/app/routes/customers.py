from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, Optional
from uuid import UUID
import httpx
import csv
import io

from app.core.supabase_client import get_client
from app.schemas.schemas import CustomerCreate, CustomerUpdate, CustomerResponse
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/customers", tags=["客戶管理"])


@router.get("", response_model=List[CustomerResponse])
def get_customers(
    search: Optional[str] = Query(None, description="搜尋姓名或電話"),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=500),
    _current_user: dict = Depends(get_current_user),
):
    sb = get_client()
    filters = {}

    if search:
        # PostgREST or filter — name.ilike or phone.ilike
        # 用 text search 用 or 串接
        try:
            # Fetch all rows for client-side filtering (limit=500 to cover all customers)
            rows = sb.select(
                "customers",
                select="*",
                order="created_at.desc",
                limit=500,
            )
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))

        # client-side filter（簡單做法，rows 不多時可接受）
        q = search.lower()
        rows = [r for r in rows if q in (r.get("name") or "").lower() or q in (r.get("phone") or "").lower()]
        return rows

    try:
        rows = sb.select(
            "customers",
            select="*",
            order="created_at.desc",
            limit=limit,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return rows


@router.get("/{customer_id}")
def get_customer(customer_id: UUID, _current_user: dict = Depends(get_current_user)):
    sb = get_client()
    try:
        row = sb.select(
            "customers",
            select="*",
            filters={"id": str(customer_id)},
            single=True,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="客戶不存在")
    return row


@router.post("", response_model=CustomerResponse, status_code=201)
def create_customer(customer: CustomerCreate, _current_user: dict = Depends(get_current_user)):
    sb = get_client()
    payload = customer.model_dump()

    try:
        row = sb.insert("customers", payload)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return row


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: UUID, customer: CustomerUpdate, _current_user: dict = Depends(get_current_user)):
    sb = get_client()
    payload = customer.model_dump(exclude_unset=True)
    if not payload:
        # No fields to update, just return the current customer
        return get_customer(customer_id)

    try:
        row = sb.update(
            "customers",
            payload,
            filters={"id": str(customer_id)},
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="客戶不存在")
    return row


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: UUID, _current_user: dict = Depends(get_current_user)):
    sb = get_client()
    try:
        sb.delete("customers", filters={"id": str(customer_id)})
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return None


# ===== CSV 匯出 =====
@router.get("/export/csv")
def export_customers_csv(_current_user: dict = Depends(get_current_user)):
    """匯出所有客戶為 CSV 檔案"""
    sb = get_client()
    try:
        rows = sb.select("customers", select="*", order="created_at.desc", limit=1000)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    # 定義 CSV 欄位順序
    fieldnames = ["名稱", "電話", "行動電話", "統一編號", "地址", "Email", "聯絡人", "傳真", "備註"]

    # 寫入 CSV（使用 BOM 讓 Excel 正確顯示中文）
    output = io.StringIO()
    output.write("\ufeff")  # UTF-8 BOM
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({
            "姓名": row.get("name", ""),
            "電話": row.get("phone", ""),
            "行動電話": row.get("phone2", ""),
            "統一編號": row.get("tax_id", ""),
            "地址": row.get("address", ""),
            "Email": row.get("email", ""),
            "聯絡人": row.get("contact_person", ""),
            "傳真": row.get("fax", ""),
            "備註": row.get("note", ""),
        })

    # 加上 \r\n 換行，Excel 比較友善
    csv_content = output.getvalue()
    response = StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="customers.csv"',
            "Content-Type": "text/csv; charset=utf-8",
        },
    )
    return response


# ===== CSV 範本下載 =====
@router.get("/export/template")
def export_customers_template(_current_user: dict = Depends(get_current_user)):
    """下載空白 CSV 範本（含一筆範例資料）"""
    fieldnames = ["名稱", "電話", "行動電話", "統一編號", "地址", "Email", "聯絡人", "傳真", "備註"]

    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerow({
        "姓名": "範例有限公司",
        "電話": "04-12345678",
        "行動電話": "0912-345-678",
        "統一編號": "12345678",
        "地址": "台中市豐原區中正路123號",
        "Email": "example@email.com",
        "聯絡人": "王小明",
        "傳真": "04-12345679",
        "備註": "這是範例",
    })

    csv_content = output.getvalue()
    response = StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="customers_template.csv"',
            "Content-Type": "text/csv; charset=utf-8",
        },
    )
    return response


# ===== CSV 批次匯入 =====
@router.post("/import/csv")
async def import_customers_csv(
    file: UploadFile = File(...),
    _current_user: dict = Depends(get_current_user),
):
    """
    批次匯入客戶 CSV
    預期欄位（標題列）：名稱, 電話, [行動電話, 統一編號, 地址, Email, 聯絡人, 傳真, 備註]
    回傳：{success, total, success_count, failed_count, results: [{row, status, error?}]}
    """
    sb = get_client()

    # 讀取檔案
    try:
        content = await file.read()
        # 去除 BOM
        if content.startswith(b"\xef\xbb\xbf"):
            content = content[3:]
        text = content.decode("utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"讀取檔案失敗: {e}")

    # 解析 CSV
    reader = csv.DictReader(io.StringIO(text))
    # 正規化欄位名稱（去除空白、全形空白）
    rows = []
    for raw_row in reader:
        normalized = {}
        for k, v in raw_row.items():
            if k is None:
                continue
            clean_key = k.strip().replace("\u3000", "")
            normalized[clean_key] = (v or "").strip() if v else ""
        rows.append(normalized)

    if not rows:
        raise HTTPException(status_code=400, detail="CSV 檔案沒有資料")

    # 取得現有客戶清單（用於重複偵測）
    try:
        existing = sb.select("customers", select="id,name,phone,tax_id", limit=1000)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    existing_phones = {r.get("phone", "").strip() for r in (existing or []) if r.get("phone")}
    existing_tax_ids = {str(r.get("tax_id", "")).strip() for r in (existing or []) if r.get("tax_id")}

    # 批次寫入
    results = []
    success_count = 0
    failed_count = 0

    for idx, row in enumerate(rows, start=2):  # 第2列開始（第1列是標題）
        name = row.get("名稱", "").strip()
        phone = row.get("電話", "").strip()

        result = {
            "row": idx,
            "name": name,
            "phone": phone,
            "status": "pending",
            "error": None,
        }

        # 驗證必填欄位
        if not name or not phone:
            result["status"] = "failed"
            result["error"] = "名稱與電話為必填"
            results.append(result)
            failed_count += 1
            continue

        # 檢查重複
        if phone in existing_phones:
            result["status"] = "skipped"
            result["error"] = f"電話「{phone}」已存在"
            results.append(result)
            continue

        tax_id = row.get("統一編號", "").strip()
        if tax_id and tax_id in existing_tax_ids:
            result["status"] = "skipped"
            result["error"] = f"統編「{tax_id}」已存在"
            results.append(result)
            continue

        # 準備 payload
        payload = {
            "name": name,
            "phone": phone,
            "phone2": row.get("行動電話", "").strip() or None,
            "tax_id": tax_id or None,
            "address": row.get("地址", "").strip() or None,
            "email": row.get("Email", "").strip() or None,
            "contact_person": row.get("聯絡人", "").strip() or None,
            "fax": row.get("傳真", "").strip() or None,
            "note": row.get("備註", "").strip() or None,
        }

        try:
            sb.insert("customers", payload)
            result["status"] = "success"
            success_count += 1
            # 把新加入的加到現有清單，避免同一批 CSV 內部重複
            existing_phones.add(phone)
            if tax_id:
                existing_tax_ids.add(tax_id)
        except httpx.HTTPStatusError as e:
            result["status"] = "failed"
            result["error"] = f"Supabase 錯誤: {e.response.text[:200]}"
            failed_count += 1
        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)[:200]
            failed_count += 1

        results.append(result)

    return {
        "success": True,
        "total": len(rows),
        "success_count": success_count,
        "skipped_count": len(rows) - success_count - failed_count,
        "failed_count": failed_count,
        "results": results,
    }
