"""
認證 API：登入、登出、当前用戶
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from jose import jwt, JWTError

from app.core.config import settings
from app.core.supabase_client import get_client
from app.core.security import verify_password

router = APIRouter(prefix="/api/auth", tags=["認證"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# ── Pydantic models ──────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    is_active: bool

# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None

# ── Dependencies ─────────────────────────────────────────────────────────────

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """解析 JWT，回傳當前登入用戶資訊。未登入拋 401。"""
    if not token:
        raise HTTPException(status_code=401, detail="未登入", headers={"WWW-Authenticate": "Bearer"})
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="無效的 Token", headers={"WWW-Authenticate": "Bearer"})
    # 取出用戶資料
    db = get_client()
    user = db.select("users", select="id,username,full_name,role,is_active", filters={"id": payload["sub"]}, single=True)
    if not user:
        raise HTTPException(status_code=401, detail="用戶不存在")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="帳號已停用")
    return user

def get_current_user_optional(token: str = Depends(oauth2_scheme)) -> dict | None:
    """解析 JWT，回傳當前用戶資訊或 None（可不登入）。"""
    if not token:
        return None
    try:
        return get_current_user(token)
    except HTTPException:
        return None

# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """帳號密碼登入，成功回傳 JWT access_token。"""
    db = get_client()
    user = db.select("users", select="id,username,password_hash,full_name,role,is_active", filters={"username": form_data.username}, single=True)
    if not user:
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    # 密碼驗證
    if not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="帳號已停用，請聯絡管理員")
    token = create_access_token({"sub": user["id"], "username": user["username"], "role": user["role"]})
    return TokenResponse(
        access_token=token,
        user={
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
            "is_active": user.get("is_active", True),
        }
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """取得當前登入用戶資訊。"""
    return UserResponse(**current_user)

@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    """登出（前端刪除 Token 即可，此端點僅回傳成功）。"""
    return {"message": "已登出"}
