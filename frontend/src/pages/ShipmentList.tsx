import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { shipmentApi } from '../services/api';
import type { Shipment } from '../types';
import { Plus, Edit2, Trash2, Truck, Eye, Search } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-600' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-600' },
};

export default function ShipmentList() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['shipments', statusFilter],
    queryFn: () => shipmentApi.getAll(statusFilter ? { status: statusFilter } : undefined).then(res => res.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => shipmentApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipments'] }),
  });

  // Client-side search filter
  const filteredShipments = shipments.filter((shipment: Shipment) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      shipment.shipment_number?.toLowerCase().includes(q) ||
      shipment.customer?.name?.toLowerCase().includes(q) ||
      shipment.customer?.phone?.includes(q) ||
      String(shipment.total_amount ?? '').includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">出貨單管理</h1>
        <Link to="/shipments/new" className="btn btn-primary flex items-center gap-2">
          <Plus size={20} /> 新增出貨單
        </Link>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="搜尋出貨單（單號、客戶名稱、電話、金額）..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {['', 'draft', 'completed', 'cancelled'].map((status) => (
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

      {/* Shipment list */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          {searchQuery ? '無符合「' + searchQuery + '」的出貨記錄' : '尚無出貨記錄'}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredShipments.map((shipment: Shipment) => (
            <div key={shipment.id} className="card p-4">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Truck className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{shipment.shipment_number}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusLabels[shipment.status]?.color}`}>
                        {statusLabels[shipment.status]?.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      客戶：{shipment.customer?.name} | 
                      日期：{shipment.shipment_date ? format(new Date(shipment.shipment_date), 'yyyy/MM/dd', { locale: zhTW }) : '-'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">總金額</div>
                    <div className="text-lg font-bold text-gray-900">
                      ${Number(shipment.total_amount).toLocaleString()}
                      {shipment.tax_included === false && <span className="text-xs text-gray-400 ml-1">(未稅)</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link to={`/shipments/${shipment.id}`} className="btn btn-secondary text-sm">
                      <Eye size={16} />
                    </Link>
                    <Link to={`/shipments/${shipment.id}/edit`} className="btn btn-secondary text-sm">
                      <Edit2 size={16} />
                    </Link>
                    <button
                      onClick={() => deleteMutation.mutate(shipment.id)}
                      className="btn btn-danger text-sm"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
