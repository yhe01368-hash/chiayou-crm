import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { customerApi } from '../services/api';
import type { Customer } from '../types';
import { Plus, Search, Edit2, Trash2, Phone, MapPin, Download, Upload } from 'lucide-react';
import CustomerImportDialog from '../components/CustomerImportDialog';

export default function CustomerList() {
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => customerApi.getAll(search || undefined).then(res => res.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customerApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await customerApi.exportCSV();
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      a.href = url;
      a.download = `customers_${yyyy}${mm}${dd}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err.response?.data?.detail || err.message || '匯出失敗');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">客戶管理</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download size={18} />
            {isExporting ? '匯出中...' : '匯出 CSV'}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Upload size={18} />
            匯入 CSV
          </button>
          <Link to="/customers/new" className="btn btn-primary flex items-center gap-2">
            <Plus size={20} /> 新增客戶
          </Link>
        </div>
      </div>

      {exportError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          匯出失敗：{exportError}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="搜尋名稱或電話..."
          className="input pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Customer list */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
      ) : customers.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          {search ? '找不到符合的客戶' : '尚無客戶資料'}
        </div>
      ) : (
        <div className="grid gap-4">
          {customers.map((customer: Customer) => (
            <div key={customer.id} className="card p-4 flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-medium">{customer.name[0]}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                    <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Phone size={14} /> {customer.phone}</span>
                      {customer.address && <span className="flex items-center gap-1"><MapPin size={14} /> {customer.address}</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/customers/${customer.id}`} className="btn btn-secondary text-sm">詳情</Link>
                <Link to={`/customers/${customer.id}/edit`} className="btn btn-secondary text-sm"><Edit2 size={16} /></Link>
                <button
                  onClick={() => {
                    if (window.confirm(`確定要刪除「${customer.name}」嗎？`)) {
                      deleteMutation.mutate(customer.id);
                    }
                  }}
                  className="btn btn-danger text-sm"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showImport && <CustomerImportDialog onClose={() => setShowImport(false)} />}
    </div>
  );
}
