import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { shipmentApi } from '../services/api';
import { ArrowLeft, Truck, Package, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-600' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-600' },
};

export default function ShipmentDetail() {
  const { id } = useParams();

  const { data: shipment, isLoading } = useQuery({
    queryKey: ['shipment', id],
    queryFn: () => shipmentApi.getById(id!).then(res => res.data),
  });

  if (isLoading) {
    return <div className="animate-pulse">載入中...</div>;
  }

  if (!shipment) {
    return <div className="text-gray-500">找不到出貨單</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link to="/shipments" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">出貨單詳情</h1>
      </div>

      {/* Header info */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Truck className="text-blue-600" size={24} />
              <span className="text-xl font-bold">{shipment.shipment_number}</span>
              <span className={`px-2 py-0.5 rounded text-sm font-medium ${statusLabels[shipment.status]?.color}`}>
                {statusLabels[shipment.status]?.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                <span>出貨日期：{shipment.shipment_date ? format(new Date(shipment.shipment_date), 'yyyy/MM/dd', { locale: zhTW }) : '-'}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">總金額</div>
            <div className="text-3xl font-bold text-primary-600">${Number(shipment.total_amount).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Customer info */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User size={20} /> 客戶資訊
        </h2>
        {shipment.customer ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">姓名</div>
              <div className="font-medium">{shipment.customer.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">電話</div>
              <div className="font-medium">{shipment.customer.phone}</div>
            </div>
            {shipment.customer.address && (
              <div className="sm:col-span-2">
                <div className="text-sm text-gray-500">地址</div>
                <div className="font-medium">{shipment.customer.address}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500">無客戶資料</div>
        )}
      </div>

      {/* Items */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package size={20} /> 商品項目
        </h2>
        {shipment.items?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">商品名稱</th>
                  <th className="pb-3 font-medium text-right">數量</th>
                  <th className="pb-3 font-medium text-right">單價</th>
                  <th className="pb-3 font-medium text-right">小計</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shipment.items.map((item: any) => (
                  <tr key={item.id} className="text-sm">
                    <td className="py-3 font-medium">{item.product_name}</td>
                    <td className="py-3 text-right">{item.quantity}</td>
                    <td className="py-3 text-right">${Number(item.unit_price).toLocaleString()}</td>
                    <td className="py-3 text-right font-medium">${Number(item.subtotal).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-right">
                  <td colSpan={3} className="pt-4 text-lg font-semibold">總金額</td>
                  <td className="pt-4 text-lg font-bold text-primary-600">
                    ${Number(shipment.total_amount).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-8">無商品資料</div>
        )}
      </div>

      {/* Note */}
      {shipment.note && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-2">備註</h2>
          <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: shipment.note }} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link to="/shipments" className="btn btn-secondary">返回列表</Link>
        <Link to={`/shipments/${id}/edit`} className="btn btn-primary">編輯</Link>
        <Link to={`/shipments/${id}/print`} target="_blank" className="btn btn-secondary">列印出貨單</Link>
      </div>
    </div>
  );
}
