import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "嘉祐資訊 CRM"
    VERSION: str = "1.0.0"
    
    # Supabase REST API (PostgREST)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", os.getenv("SUPABASE_SERVICE_KEY", ""))
    
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
