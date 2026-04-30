import { Navigate, Outlet } from 'react-router-dom';
import { authApi } from '../services/api';
import { useState, useEffect } from 'react';

export default function ProtectedRoute() {
  const [checking, setChecking] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('chiayou_token');
    if (!token) {
      setIsAuth(false);
      setChecking(false);
      return;
    }
    // 驗證 Token 有效性
    authApi.me()
      .then(() => setIsAuth(true))
      .catch(() => {
        localStorage.removeItem('chiayou_token');
        localStorage.removeItem('chiayou_user');
        setIsAuth(false);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">驗證中...</div>
      </div>
    );
  }

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  // Outlet 渲染巢狀路由的內容（Dashboard 等頁面）
  return <Outlet />;
}
