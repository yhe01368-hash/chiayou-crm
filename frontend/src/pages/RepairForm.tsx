import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repairApi, customerApi } from '../services/api';
import type { RepairFormData } from '../types';
import { ArrowLeft } from 'lucide-react';

const deviceTypes = ['筆電', '桌機', '螢幕', '印表機', '其他'];
const statusOptions = [
  { value: 'pending', label: '待處理' },
  { value: 'processing', label: '處理中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

export default function RepairForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<RepairFormData>({
    customer_id: '',
    device_type: '筆電',
    device_brand: '',
    device_model: '',
    serial_number: '',
    problem: '',
    status: 'pending',
    repair_detail: '',
    cost: undefined,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerApi.getAll().then(res => res.data),
  });

  const { data: editData } = useQuery({
    queryKey: ['repair', id],
    queryFn: () => repairApi.getById(id!).then(res => res.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (editData) {
      setForm({
        customer_id: editData.customer_id,
        device_type: editData.device_type,
        device_brand: editData.device_brand || '',
        device_model: editData.device_model || '',
        serial_number: editData.serial_number || '',
        problem: editData.problem,
        status: editData.status,
        repair_detail: editData.repair_detail || '',
        cost: editData.cost,
      });
    }
  }, [editData]);

  const mutation = useMutation({
    mutationFn: (data: RepairFormData) => 
      isEdit ? repairApi.update(id!, data) : repairApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
      navigate('/repairs');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link to="/repairs" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? '編輯維修單' : '新增維修單'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">客戶 *</label>
          <select
            className="input"
            value={form.customer_id}
            onChange={(e) => setForm({...form, customer_id: e.target.value})}
            required
          >
            <option value="">請選擇客戶</option>
            {customers.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">裝置類型 *</label>
            <select
              className="input"
              value={form.device_type}
              onChange={(e) => setForm({...form, device_type: e.target.value})}
            >
              {deviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({...form, status: e.target.value as any})}
            >
              {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">品牌</label>
            <input
              type="text"
              className="input"
              value={form.device_brand}
              onChange={(e) => setForm({...form, device_brand: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">型號</label>
            <input
              type="text"
              className="input"
              value={form.device_model}
              onChange={(e) => setForm({...form, device_model: e.target.value})}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">序號</label>
          <input
            type="text"
            className="input"
            value={form.serial_number}
            onChange={(e) => setForm({...form, serial_number: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">問題描述 *</label>
          <textarea
            className="input min-h-[80px]"
            value={form.problem}
            onChange={(e) => setForm({...form, problem: e.target.value})}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">維修過程</label>
          <textarea
            className="input min-h-[80px]"
            value={form.repair_detail}
            onChange={(e) => setForm({...form, repair_detail: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">維修費用</label>
          <input
            type="number"
            className="input"
            value={form.cost || ''}
            onChange={(e) => setForm({...form, cost: e.target.value ? Number(e.target.value) : undefined})}
          />
        </div>
        <div className="flex gap-3 pt-4">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? '儲存中...' : '儲存'}
          </button>
          <Link to="/repairs" className="btn btn-secondary">取消</Link>
        </div>
      </form>
    </div>
  );
}
