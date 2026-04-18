import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerApi, repairApi } from '../services/api';
import { ArrowLeft, Phone, MapPin, Mail, Wrench, FileText } from 'lucide-react';

export default function CustomerDetail() {
  const { id } = useParams();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.getById(id!).then(res => res.data),
  });

  const { data: repairs = [] } = useQuery({
    queryKey: ['repairs', id],
    queryFn: () => repairApi.getAll({ customer_id: id }).then(res => res.data),
  });

  if (isLoading) {
    return <div className="animate-pulse">載入中...</div>;
  }

  if (!customer) {
    return <div className="text-gray-500">找不到客戶資料</div>;
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: '待處理', color: 'bg-yellow-100 text-yellow-700' },
    processing: { label: '處理中', color: 'bg-blue-100 text-blue-700' },
    completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
    cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-600' },
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link to="/customers" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">客戶資料</h1>
      </div>

      {/* Customer info */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-700 font-bold text-2xl">{customer.name[0]}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Phone size={14} /> {customer.phone}</span>
              {customer.phone2 && <span>{customer.phone2}</span>}
            </div>
          </div>
          <div className="ml-auto">
            <Link to={`/customers/${id}/edit`} className="btn btn-primary">編輯</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {customer.address && (
            <div className="flex items-start gap-2">
              <MapPin size={18} className="text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm text-gray-500">地址</div>
                <div>{customer.address}</div>
              </div>
            </div>
          )}
          {customer.email && (
            <div className="flex items-start gap-2">
              <Mail size={18} className="text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm text-gray-500">Email</div>
                <div>{customer.email}</div>
              </div>
            </div>
          )}
        </div>
        {customer.note && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-start gap-2">
              <FileText size={18} className="text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm text-gray-500">備註</div>
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: customer.note }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Repair history */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wrench size={20} /> 維修記錄
          </h2>
          <Link to={`/repairs/new?customer_id=${id}`} className="btn btn-secondary text-sm">新增維修</Link>
        </div>
        {repairs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">尚無維修記錄</div>
        ) : (
          <div className="space-y-3">
            {repairs.map((repair: any) => (
              <div key={repair.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">
                    {repair.device_type} - {repair.device_brand || ''} {repair.device_model || ''}
                  </div>
                  <div className="text-sm text-gray-500">{repair.problem}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusLabels[repair.status]?.color}`}>
                  {statusLabels[repair.status]?.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
