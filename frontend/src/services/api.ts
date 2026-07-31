import axios from 'axios';

// 設定 API URL - 開發環境用 localhost，生產環境用實際部署的 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── 請求攔截器：自動附加 JWT Token ───────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('chiayou_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── 回應攔截器：401 時清除 Token 並跳轉登入 ─────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('chiayou_token');
      localStorage.removeItem('chiayou_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth API ────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', new URLSearchParams({ username, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ── Users API ────────────────────────────────────────────────────────────────
export const userApi = {
  getAll: () => api.get('/users'),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: { username: string; password: string; full_name: string; role: string }) =>
    api.post('/users', data),
  update: (id: string, data: { full_name?: string; role?: string; is_active?: boolean }) =>
    api.patch(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  resetPassword: (id: string, new_password: string) =>
    api.post(`/users/${id}/reset-password`, { new_password }),
};

// ── 客戶 API ────────────────────────────────────────────────────────────────
export const customerApi = {
  getAll: (search?: string) =>
    api.get('/customers', { params: { search } }),
  getById: (id: string) =>
    api.get(`/customers/${id}`),
  create: (data: any) =>
    api.post('/customers', data),
  update: (id: string, data: any) =>
    api.put(`/customers/${id}`, data),
  delete: (id: string) =>
    api.delete(`/customers/${id}`),
  exportCSV: () =>
    api.get('/customers/export/csv', { responseType: 'blob' }),
  downloadTemplate: () =>
    api.get('/customers/export/template', { responseType: 'blob' }),
  importCSV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/customers/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── 維修 API ────────────────────────────────────────────────────────────────
export const repairApi = {
  getAll: (params?: { status?: string; customer_id?: string }) =>
    api.get('/repairs', { params }),
  getById: (id: string) =>
    api.get(`/repairs/${id}`),
  create: (data: any) =>
    api.post('/repairs', data),
  update: (id: string, data: any) =>
    api.put(`/repairs/${id}`, data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/repairs/${id}/status`, { status }),
  delete: (id: string) =>
    api.delete(`/repairs/${id}`),
};

// ── 庫存 API ────────────────────────────────────────────────────────────────
export const inventoryApi = {
  getAll: (params?: { category?: string; search?: string; low_stock?: boolean }) =>
    api.get('/inventory', { params }),
  getById: (id: string) =>
    api.get(`/inventory/${id}`),
  create: (data: any) =>
    api.post('/inventory', data),
  update: (id: string, data: any) =>
    api.put(`/inventory/${id}`, data),
  adjustStock: (id: string, quantity: number) =>
    api.patch(`/inventory/${id}/stock`, { quantity }),
  delete: (id: string) =>
    api.delete(`/inventory/${id}`),
};

// ── 出貨單 API ──────────────────────────────────────────────────────────────
export const shipmentApi = {
  getAll: (params?: { status?: string; customer_id?: string }) =>
    api.get('/shipments', { params }),
  getById: (id: string) =>
    api.get(`/shipments/${id}`),
  create: (data: any) =>
    api.post('/shipments', data),
  update: (id: string, data: any) =>
    api.put(`/shipments/${id}`, data),
  delete: (id: string) =>
    api.delete(`/shipments/${id}`),
};

// ── 儀表板 API ──────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => api.get('/dashboard'),
  getRevenueDetails: () => api.get('/dashboard/revenue/details'),
};

// ── 維修日誌 API ──────────────────────────────────────────────────────────
export const repairLogApi = {
  getAll: (params?: { customer_id?: string; repair_id?: string; search?: string }) =>
    api.get('/repair-logs', { params }),
  getById: (id: string) =>
    api.get(`/repair-logs/${id}`),
  create: (data: any) =>
    api.post('/repair-logs', data),
  update: (id: string, data: any) =>
    api.put(`/repair-logs/${id}`, data),
  delete: (id: string) =>
    api.delete(`/repair-logs/${id}`),
};

// ── 維修知識庫 API ─────────────────────────────────────────────────────────
export const knowledgeApi = {
  getAll: (params?: { search?: string; category?: string }) =>
    api.get('/knowledge', { params }),
  getById: (id: string) =>
    api.get(`/knowledge/${id}`),
  create: (data: any) =>
    api.post('/knowledge', data),
  update: (id: string, data: any) =>
    api.put(`/knowledge/${id}`, data),
  delete: (id: string) =>
    api.delete(`/knowledge/${id}`),
};

export default api;
