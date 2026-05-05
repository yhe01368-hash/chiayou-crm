import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../services/api';
import { Plus, Trash2, RefreshCw, Shield } from 'lucide-react';

export default function UserList() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'user' });
  const [resetPwId, setResetPwId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAll().then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => userApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      setForm({ username: '', password: '', full_name: '', role: 'user' });
    },
    onError: (err: any) => setError(err.response?.data?.detail || '新增失敗'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => userApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setEditingId(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => userApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const resetPwMut = useMutation({
    mutationFn: ({ id, new_password }: { id: string; new_password: string }) =>
      userApi.resetPassword(id, new_password),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setResetPwId(null);
      setNewPassword('');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate(form);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">使用者管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理系統使用者帳號</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={18} />
          新增使用者
        </button>
      </div>

      {/* 新增表單 */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">新增使用者</h3>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">帳號</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="user">一般使用者</option>
                <option value="admin">系統管理員</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
              <button
                type="submit"
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                確認新增
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(''); }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 重設密碼表單 */}
      {resetPwId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">重設密碼</h3>
          <div className="flex gap-3">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="請輸入新密碼"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={() => resetPwMut.mutate({ id: resetPwId, new_password: newPassword })}
              className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              確認
            </button>
            <button
              onClick={() => { setResetPwId(null); setNewPassword(''); }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 錯誤訊息 */}
      {error && !showForm && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
          {error}
        </div>
      )}

      {/* 列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide px-6 py-3">姓名</th>
              <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide px-6 py-3">帳號</th>
              <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide px-6 py-3">角色</th>
              <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide px-6 py-3">狀態</th>
              <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wide px-6 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 py-8">載入中...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 py-8">尚無使用者資料</td>
              </tr>
            ) : users.map((user: any) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {user.full_name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {user.username}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    user.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {user.role === 'admin' && <Shield size={12} />}
                    {user.role === 'admin' ? '系統管理員' : '一般使用者'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                    user.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {user.is_active ? '啟用中' : '已停用'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* 重設密碼 */}
                    <button
                      onClick={() => setResetPwId(user.id)}
                      className="text-gray-400 hover:text-primary-600 transition-colors"
                      title="重設密碼"
                    >
                      <RefreshCw size={16} />
                    </button>
                    {/* 啟用/停用 */}
                    <button
                      onClick={() => updateMut.mutate({
                        id: user.id,
                        data: { is_active: !user.is_active }
                      })}
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        user.is_active
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-green-600 hover:bg-green-50'
                      } transition-colors`}
                    >
                      {user.is_active ? '停用' : '啟用'}
                    </button>
                    {/* 編輯角色 */}
                    <select
                      value={user.role}
                      onChange={(e) => updateMut.mutate({
                        id: user.id,
                        data: { role: e.target.value }
                      })}
                      className="text-xs border border-gray-300 rounded px-1.5 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="user">一般使用者</option>
                      <option value="admin">系統管理員</option>
                    </select>
                    {/* 刪除 */}
                    <button
                      onClick={() => {
                        if (confirm(`確定要刪除帳號「${user.username}」嗎？`)) {
                          deleteMut.mutate(user.id);
                        }
                      }}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="刪除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
