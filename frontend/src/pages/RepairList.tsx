import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { repairApi } from '../services/api';
import type { Repair } from '../types';
import { Plus, Edit2, Trash2, Wrench } from 'lucide-react';

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '待處理', color: 'bg-yellow-100 text-yellow-700' },
  processing: { label: '處理中', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-600' },
};

export default function RepairList() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const queryClient = useQueryClient();

  const { data: repairs = [], isLoading } = useQuery({
    queryKey: ['repairs', statusFilter],
    queryFn: () => repairApi.getAll(statusFilter ? { status: statusFilter } : undefined).then(res => res.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repairApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repairs'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">維修管理</h1>
        <Link to="/repairs/new" className="btn btn-primary flex items-center gap-2">
          <Plus size={20} /> 新增維修單
        </Link>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {['', 'pending', 'processing', 'completed', 'cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === '' ? '全部' : statusLabels[status]?.label}
          </button>
        ))}
      </div>

      {/* Repair list */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}
        </div>
      ) : repairs.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">尚無維修記錄</div>
      ) : (
        <div className="grid gap-4">
          {repairs.map((repair: Repair) => (
            <div key={repair.id} className="card p-4">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Wrench className="text-orange-600" size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {repair.device_type} - {repair.device_brand || ''} {repair.device_model || ''}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusLabels[repair.status]?.color}`}>
                          {statusLabels[repair.status]?.label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        客戶：{repair.customer?.name} | 電話：{repair.customer?.phone}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 ml-13">
                    <span className="font-medium">問題：</span>{repair.problem}
                  </div>
                  {repair.cost && (
                    <div className="text-sm text-gray-600 mt-1">
                      費用：${Number(repair.cost).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/repairs/${repair.id}`} className="btn btn-secondary text-sm">詳情</Link>
                  <Link to={`/repairs/${repair.id}/edit`} className="btn btn-secondary text-sm"><Edit2 size={16} /></Link>
                  <button 
                    onClick={() => deleteMutation.mutate(repair.id)}
                    className="btn btn-danger text-sm"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={16} />
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
