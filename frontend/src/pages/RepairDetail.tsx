import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repairApi } from '../services/api';
import { ArrowLeft, Wrench, User, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export default function RepairDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: repair, isLoading } = useQuery({
    queryKey: ['repair', id],
    queryFn: () => repairApi.getById(id!).then(res => res.data),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => repairApi.updateStatus(id!, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repair', id] }),
  });

  if (isLoading) {
    return <div className="animate-pulse">載入中...</div>;
  }

  if (!repair) {
    return <div className="text-gray-500">找不到維修單</div>;
  }


  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link to="/repairs" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">維修單詳情</h1>
      </div>

      {/* Status */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Wrench className="text-orange-600" size={24} />
            </div>
            <div>
              <div className="text-lg font-bold">
                {repair.device_type} - {repair.device_brand || ''} {repair.device_model || ''}
              </div>
              <div className="text-sm text-gray-500">
                序號：{repair.serial_number || '-'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="input"
              value={repair.status}
              onChange={(e) => statusMutation.mutate(e.target.value)}
              disabled={statusMutation.isPending}
            >
              <option value="pending">待處理</option>
              <option value="processing">處理中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer info */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User size={20} /> 客戶資訊
        </h2>
        {repair.customer ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">姓名</div>
              <div className="font-medium">{repair.customer.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">電話</div>
              <div className="font-medium flex items-center gap-1">
                <Phone size={14} /> {repair.customer.phone}
              </div>
            </div>
            {repair.customer.address && (
              <div className="sm:col-span-2">
                <div className="text-sm text-gray-500">地址</div>
                <div className="font-medium">{repair.customer.address}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500">無客戶資料</div>
        )}
      </div>

      {/* Problem & Repair info */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">問題與維修</h2>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">問題描述</div>
            <div className="p-3 bg-gray-50 rounded-lg prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: repair.problem }} />
          </div>
          {repair.repair_detail && (
            <div>
              <div className="text-sm text-gray-500 mb-1">維修過程</div>
              <div className="p-3 bg-gray-50 rounded-lg prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: repair.repair_detail }} />
            </div>
          )}
          {repair.cost && (
            <div className="text-lg font-bold text-primary-600">
              維修費用：${Number(repair.cost).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Dates */}
      <div className="card p-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">建立時間</div>
            <div>{format(new Date(repair.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</div>
          </div>
          {repair.completed_at && (
            <div>
              <div className="text-gray-500">完成時間</div>
              <div>{format(new Date(repair.completed_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link to="/repairs" className="btn btn-secondary">返回列表</Link>
        <Link to={`/repairs/${id}/edit`} className="btn btn-primary">編輯</Link>
      </div>
    </div>
  );
}
