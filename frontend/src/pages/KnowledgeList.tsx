import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { knowledgeApi } from '../services/api';
import { Plus, Search, X, BookOpen, Trash2, Edit, ArrowLeft } from 'lucide-react';

const categories = ['硬體問題', '軟體問題', '網路問題', 'Windows設定', '週邊設備', '其他'];

export default function KnowledgeList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: knowledgeList = [], isLoading } = useQuery({
    queryKey: ['knowledge', search, categoryFilter],
    queryFn: () => knowledgeApi.getAll({ search, category: categoryFilter || undefined }).then(res => res.data),
  });

  const filteredList = knowledgeList.filter((item: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return item.title.toLowerCase().includes(s) || item.problem.toLowerCase().includes(s);
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => knowledgeApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge'] }),
  });

  const handleDelete = (id: string) => {
    if (confirm('確定要刪除嗎？')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setShowForm(true);
  };

  const handleBack = () => {
    setShowForm(false);
    setEditingId(null);
  };

  if (showForm) {
    return <KnowledgeForm id={editingId} onBack={handleBack} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="text-primary-600" size={28} />
          維修知識庫
        </h1>
        <button onClick={handleNew} className="btn btn-primary flex items-center gap-2">
          <Plus size={20} /> 新增
        </button>
      </div>

      {/* 搜尋與篩選 */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            className="input pl-10"
            placeholder="搜尋標題或問題..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <select
          className="input w-48"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">全部分類</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">載入中...</div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {search || categoryFilter ? '找不到符合的項目' : '尚無知識庫項目，點擊「新增」來建立第一筆'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item: any) => (
            <div key={item.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                      {item.category}
                    </span>
                    <h3 className="font-bold text-gray-900">{item.title}</h3>
                  </div>
                  <div className="mb-2">
                    <p className="text-sm text-gray-500 mb-1">
                      <span className="font-medium text-gray-700">問題：</span>
                      {item.problem.length > 100 ? item.problem.slice(0, 100) + '...' : item.problem}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-gray-700">解決方案：</span>
                      {item.solution.length > 100 ? item.solution.slice(0, 100) + '...' : item.solution}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(item.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                    title="編輯"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                    title="刪除"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 維修知識庫表單元件
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function KnowledgeForm({ id, onBack }: { id: string | null; onBack: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    title: '',
    category: '其他',
    problem: '',
    solution: '',
  });

  const { data: editData } = useQuery({
    queryKey: ['knowledge', id],
    queryFn: () => knowledgeApi.getById(id!).then(res => res.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (editData) {
      setForm({
        title: editData.title || '',
        category: editData.category || '其他',
        problem: editData.problem || '',
        solution: editData.solution || '',
      });
    }
  }, [editData]);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? knowledgeApi.update(id!, data) : knowledgeApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      onBack();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return alert('請輸入標題');
    if (!form.problem.trim()) return alert('請輸入問題描述');
    if (!form.solution.trim()) return alert('請輸入解決方案');
    mutation.mutate(form);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? '編輯知識庫' : '新增知識庫'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">標題 *</label>
          <input
            type="text"
            className="input"
            placeholder="例：印表機無法連線"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">分類 *</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">問題描述 *</label>
          <textarea
            className="input min-h-[100px]"
            placeholder="詳細描述遇到的問題..."
            value={form.problem}
            onChange={(e) => setForm({ ...form, problem: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">解決方案 *</label>
          <textarea
            className="input min-h-[100px]"
            placeholder="詳細描述如何解決..."
            value={form.solution}
            onChange={(e) => setForm({ ...form, solution: e.target.value })}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? '儲存中...' : '儲存'}
          </button>
          <button type="button" onClick={onBack} className="btn btn-secondary">
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
