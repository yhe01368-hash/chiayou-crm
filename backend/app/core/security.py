"""
密碼工具（使用 PBKDF2，不需額外安裝 bcrypt）
"""
import hashlib
import os

# PBKDF2 參數
PBKDF2_ITERATIONS = 100_000
SALT_LEN = 32
HASH_LEN = 32

def hash_password(password: str) -> str:
    """產生 PBKDF2 hash，回傳格式：base64(salt)$base64(hash)"""
    salt = os.urandom(SALT_LEN)
    h = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, PBKDF2_ITERATIONS)
    import base64
    return f"{base64.b64encode(salt).decode()}${base64.b64encode(h).decode()}"

def verify_password(password: str, stored: str) -> bool:
    """驗證密碼，stored 格式：base64(salt)$base64(hash)"""
    try:
        salt_b64, hash_b64 = stored.split('$')
        import base64
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        actual = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, PBKDF2_ITERATIONS)
        import hmac
        return hmac.compare_digest(expected, actual)
    except Exception:
        return False
