import os
import secrets
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "嘉祐資訊 CRM"
    VERSION: str = "1.0.0"

    # Supabase（2026-07-21 從 Neon 遷回）
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "chiayou-crm-dev-secret-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24小時

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://chiayou-crm.vercel.app",
        "https://chiayou-crm.onrender.com",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
