import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shipmentApi, customerApi, inventoryApi } from '../services/api';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface ShipmentItemInput {
  product_id: string;
  quantity: number;
}

export default function ShipmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<ShipmentItemInput[]>([]);
  const [note, setNote] = useState('');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerApi.getAll().then(res => res.data),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.getAll().then(res => res.data),
  });

  const { data: editData } = useQuery({
    queryKey: ['shipment', id],
    queryFn: () => shipmentApi.getById(id!).then(res => res.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (editData) {
      setCustomerId(editData.customer_id);
      setItems(editData.items.map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })));
      setNote(editData.note || '');
    }
  }, [editData]);

  const mutation = useMutation({
    mutationFn: (data: any) => 
      isEdit ? shipmentApi.update(id!, data) : shipmentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      navigate('/shipments');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return alert('請選擇客戶');
    if (items.length === 0) return alert('請新增商品');
    mutation.mutate({ customer_id: customerId, items, note });
  };

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: 'product_id' | 'quantity', value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const total = items.reduce((sum, item) => {
    const product = products.find((p: any) => p.id === item.product_id);
    return sum + (product ? Number(product.selling_price) * item.quantity : 0);
  }, 0);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link to="/shipments" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? '編輯出貨單' : '新增出貨單'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">客戶 *</label>
          <select
            className="input"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
          >
            <option value="">請選擇客戶</option>
            {customers.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
            ))}
          </select>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">商品項目 *</label>
            <button type="button" onClick={addItem} className="btn btn-secondary text-sm flex items-center gap-1">
              <Plus size={16} /> 新增商品
            </button>
          </div>
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
              尚無商品，請點擊「新增商品」
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => {
                const product = products.find((p: any) => p.id === item.product_id);
                return (
                  <div key={index} className="flex gap-3 items-center">
                    <select
                      className="input flex-1"
                      value={item.product_id}
                      onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                    >
                      <option value="">選擇商品</option>
                      {products.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.product_name} (庫存: {p.quantity})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="input w-24"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                      min="1"
                    />
                    <span className="text-sm text-gray-600 w-24 text-right">
                      ${product ? (Number(product.selling_price) * item.quantity).toLocaleString() : 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 hover:bg-gray-100 rounded text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {items.length > 0 && (
            <div className="mt-4 text-right text-lg font-bold">
              總金額：${total.toLocaleString()}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
          <textarea
            className="input min-h-[80px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? '處理中...' : '確認出貨'}
          </button>
          <Link to="/shipments" className="btn btn-secondary">取消</Link>
        </div>
      </form>
    </div>
  );
}
