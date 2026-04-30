"""
使用者管理 API（管理員專用）
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from app.routes.auth import get_current_user
from app.core.supabase_client import get_client
from app.core.security import hash_password, verify_password

router = APIRouter(prefix="/api/users", tags=["使用者管理"])

# ── Pydantic models ──────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "user"

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    is_active: bool
    created_at: Optional[str] = None

# ── Admin check ───────────────────────────────────────────────────────────────

def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="需要管理員權限")
    return current_user

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[UserResponse])
def list_users(_admin: dict = Depends(require_admin)):
    """取得所有使用者列表（管理員）。"""
    db = get_client()
    users = db.select("users", select="id,username,full_name,role,is_active,created_at", order="created_at")
    return users

@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, _admin: dict = Depends(require_admin)):
    """取得特定使用者（管理員）。"""
    db = get_client()
    user = db.select("users", select="id,username,full_name,role,is_active,created_at", filters={"id": user_id}, single=True)
    if not user:
        raise HTTPException(status_code=404, detail="找不到該使用者")
    return user

@router.post("/", response_model=UserResponse)
def create_user(data: UserCreate, _admin: dict = Depends(require_admin)):
    """新增使用者（管理員）。"""
    db = get_client()
    # 檢查帳號是否已存在
    existing = db.select("users", select="id", filters={"username": data.username}, single=True)
    if existing:
        raise HTTPException(status_code=409, detail="帳號已存在")
    # 密碼 PBKDF2 雜湊
    pw_hash = hash_password(data.password)
    new_user = db.insert("users", {
        "username": data.username,
        "password_hash": pw_hash,
        "full_name": data.full_name,
        "role": data.role,
        "is_active": True,
    })
    return UserResponse(
        id=new_user["id"],
        username=new_user["username"],
        full_name=new_user["full_name"],
        role=new_user["role"],
        is_active=new_user.get("is_active", True),
        created_at=new_user.get("created_at"),
    )

@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, data: UserUpdate, _admin: dict = Depends(require_admin)):
    """編輯使用者（管理員）：姓名、角色、啟用狀態。"""
    db = get_client()
    existing = db.select("users", select="id,username,full_name,role,is_active,created_at", filters={"id": user_id}, single=True)
    if not existing:
        raise HTTPException(status_code=404, detail="找不到該使用者")
    patch = {}
    if data.full_name is not None:
        patch["full_name"] = data.full_name
    if data.role is not None:
        patch["role"] = data.role
    if data.is_active is not None:
        patch["is_active"] = data.is_active
    if not patch:
        raise HTTPException(status_code=400, detail="沒有要更新的欄位")
    updated = db.update("users", patch, filters={"id": user_id})
    return UserResponse(
        id=updated["id"],
        username=existing["username"],
        full_name=updated.get("full_name", existing["full_name"]),
        role=updated.get("role", existing["role"]),
        is_active=updated.get("is_active", existing.get("is_active", True)),
        created_at=existing.get("created_at"),
    )

@router.delete("/{user_id}")
def delete_user(user_id: str, _admin: dict = Depends(require_admin)):
    """刪除使用者（管理員）。"""
    db = get_client()
    # 防止刪除自己
    current = db.select("users", select="id", filters={"id": user_id}, single=True)
    if not current:
        raise HTTPException(status_code=404, detail="找不到該使用者")
    db.delete("users", filters={"id": user_id})
    return {"message": "使用者已刪除"}

@router.post("/{user_id}/reset-password")
def reset_password(user_id: str, new_password: str, _admin: dict = Depends(require_admin)):
    """重設密碼（管理員）。"""
    db = get_client()
    existing = db.select("users", select="id", filters={"id": user_id}, single=True)
    if not existing:
        raise HTTPException(status_code=404, detail="找不到該使用者")
    db.update("users", {"password_hash": hash_password(new_password)}, filters={"id": user_id})
    return {"message": "密碼已更新"}
