import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi } from '../services/api';
import type { CustomerFormData } from '../types';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CustomerForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CustomerFormData>({
    name: '',
    phone: '',
    phone2: '',
    address: '',
    email: '',
    note: '',
  });

  const mutation = useMutation({
    mutationFn: (data: CustomerFormData) => customerApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate('/customers');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link to="/customers" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">新增客戶</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
          <input
            type="text"
            className="input"
            value={form.name}
            onChange={(e) => setForm({...form, name: e.target.value})}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">電話 *</label>
          <input
            type="tel"
            className="input"
            value={form.phone}
            onChange={(e) => setForm({...form, phone: e.target.value})}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">第二電話</label>
          <input
            type="tel"
            className="input"
            value={form.phone2}
            onChange={(e) => setForm({...form, phone2: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
          <input
            type="text"
            className="input"
            value={form.address}
            onChange={(e) => setForm({...form, address: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => setForm({...form, email: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
          <textarea
            className="input min-h-[100px]"
            value={form.note}
            onChange={(e) => setForm({...form, note: e.target.value})}
          />
        </div>
        <div className="flex gap-3 pt-4">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? '儲存中...' : '儲存'}
          </button>
          <Link to="/customers" className="btn btn-secondary">取消</Link>
        </div>
      </form>
    </div>
  );
}
