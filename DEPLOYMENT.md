# 嘉祐資訊 CRM 部署指南

## 一、Supabase 設定
1. 前往 supabase.com，用 GitHub 登入
2. 點「New project」，名稱設 `chiayou-crm`
3. 等待建立完成

## 二、執行 SQL 建立資料表
在 Supabase > SQL Editor 新增 query，貼上 `backend/supabase-schema.sql` 內容並執行

## 三、部署後端（Railway）
1. railway.app 用 GitHub 登入
2. New Project > 從 GitHub 部署
3. 設定環境變數：
   - DATABASE_URL=postgresql://postgres:[密碼]@db.[專案].supabase.co:5432/postgres
4. Start Command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## 四、部署前端（Vercel）
1. vercel.com 用 GitHub 登入
2. Add New Project > 選擇 chiayou-crm
3. Root Directory: frontend
4. Deploy 完成

## 完成後
- 前端: https://chiayou-crm.vercel.app
- 後端 API: https://chiayou-crm.up.railway.app
