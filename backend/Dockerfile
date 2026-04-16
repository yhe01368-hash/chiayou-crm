# Python 3.10
FROM python:3.10-slim

WORKDIR /app

# 複製依賴檔案先安裝
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程式
COPY . .

# 環境變數
ENV PYTHONUNBUFFERED=1

# 啟動
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$PORT"]
