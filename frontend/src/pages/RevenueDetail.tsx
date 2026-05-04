import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, DollarSign } from 'lucide-react';
import api from '../services/api';

export default function RevenueDetail() {
  const { data, isLoading } = useQuery({
    queryKey: ['revenue-details'],
    queryFn: () => api.get('/dashboard/revenue/details').then(res => res.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="btn btn-ghost p-2">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">本月營收明細</h1>
      </div>

      {/* 總計卡片 */}
      <div className="card p-6 bg-green-50 border-green-200">
        <div className="flex items-center gap-4">
          <div className="bg-green-500 p-3 rounded-lg">
            <DollarSign className="text-white" size={28} />
          </div>
          <div>
            <p className="text-sm text-green-700">本月營收總計</p>
            <p className="text-3xl font-bold text-green-800">
              ${Number(data?.total ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-green-600">共 {data?.count ?? 0} 筆完成訂單</p>
          </div>
        </div>
      </div>

      {/* 明細列表 */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">載入中...</div>
        ) : data?.items?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">本月尚無已完成訂單</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">單號</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">日期</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">客戶</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">金額</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.items?.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.shipment_number}</td>
                  <td className="px-4 py-3 text-gray-600">{item.shipment_date}</td>
                  <td className="px-4 py-3 text-gray-600">{item.customer_name}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">
                    ${Number(item.total_amount ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
