import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { inventoryApi } from '../services/api';
import type { InventoryItem } from '../types';
import { Plus, Search, Edit2, Trash2, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';

const categories = ['全部', 'CPU', '硬碟', '記憶體', '顯示卡', '主機板', '電源供應器', '機殼', '其他'];

export default function InventoryList() {
  const [searchParams] = useSearchParams();
  const [category, setCategory] = useState(searchParams.get('low_stock') === 'true' ? '' : '全部');
  const [search, setSearch] = useState('');
  const [showLowStock, setShowLowStock] = useState(searchParams.get('low_stock') === 'true');
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory', category, search, showLowStock],
    queryFn: () => inventoryApi.getAll({ 
      category: category !== '全部' ? category : undefined,
      search: search || undefined,
      low_stock: showLowStock || undefined,
    }).then(res => res.data),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => 
      inventoryApi.adjustStock(id, quantity),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">庫存管理</h1>
        <Link to="/inventory/new" className="btn btn-primary flex items-center gap-2">
          <Plus size={20} /> 新增商品
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="搜尋商品..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowLowStock(!showLowStock)}
            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 ${
              showLowStock ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <AlertTriangle size={16} /> 低庫存
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              category === cat
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Inventory list */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">尚無商品資料</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3 font-medium">商品編號</th>
                <th className="pb-3 font-medium">商品名稱</th>
                <th className="pb-3 font-medium">類別</th>
                <th className="pb-3 font-medium text-right">庫存</th>
                <th className="pb-3 font-medium text-right">成本</th>
                <th className="pb-3 font-medium text-right">售價</th>
                <th className="pb-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item: InventoryItem) => (
                <tr key={item.id} className="text-sm">
                  <td className="py-3 font-mono text-gray-600">{item.product_code}</td>
                  <td className="py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {item.is_low_stock && <AlertTriangle size={16} className="text-red-500" />}
                      {item.product_name}
                    </div>
                  </td>
                  <td className="py-3 text-gray-500">{item.category}</td>
                  <td className="py-3 text-right">
                    <span className={item.is_low_stock ? 'text-red-600 font-medium' : ''}>
                      {item.quantity} {item.unit}
                    </span>
                  </td>
                  <td className="py-3 text-right text-gray-500">
                    {item.cost_price ? `$${Number(item.cost_price).toLocaleString()}` : '-'}
                  </td>
                  <td className="py-3 text-right font-medium">${Number(item.selling_price).toLocaleString()}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => adjustMutation.mutate({ id: item.id, quantity: -1 })}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="減少庫存"
                      >
                        <ArrowDown size={16} className="text-red-500" />
                      </button>
                      <button
                        onClick={() => adjustMutation.mutate({ id: item.id, quantity: 1 })}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="增加庫存"
                      >
                        <ArrowUp size={16} className="text-green-500" />
                      </button>
                      <Link to={`/inventory/${item.id}/edit`} className="p-1.5 hover:bg-gray-100 rounded">
                        <Edit2 size={16} />
                      </Link>
                      <button
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="p-1.5 hover:bg-gray-100 rounded text-red-500"
                        disabled={deleteMutation.isPending}
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
      )}
    </div>
  );
}
