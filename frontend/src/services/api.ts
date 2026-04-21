import axios from 'axios';

// 設定 API URL - 開發環境用 localhost，生產環境用實際部署的 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ===== 客戶 API =====
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
};

// ===== 維修 API =====
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

// ===== 庫存 API =====
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

// ===== 出貨單 API =====
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

// ===== 儀表板 API =====
export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

// ===== 維修知識庫 API =====
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
