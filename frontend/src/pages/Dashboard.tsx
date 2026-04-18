import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/api';
import { Wrench, DollarSign, Truck, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then(res => res.data),
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const stats = [
    { label: '待處理維修', value: data?.pending_repairs ?? 0, icon: Wrench, color: 'bg-orange-500', textColor: 'text-orange-600' },
    { label: '低庫存商品', value: data?.low_stock_items ?? 0, icon: AlertTriangle, color: 'bg-red-500', textColor: 'text-red-600', link: '/inventory?low_stock=true' },
    { label: '本月營收', value: `$${Number(data?.monthly_revenue ?? 0).toLocaleString()}`, icon: DollarSign, color: 'bg-green-500', textColor: 'text-green-600' },
    { label: '近期出貨', value: data?.recent_shipments?.length ?? 0, icon: Truck, color: 'bg-blue-500', textColor: 'text-blue-600', link: '/shipments' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">儀表板</h1>
        <p className="text-gray-500 mt-1">歡迎回來，張嘉祐</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const card = (
            <div key={stat.label} className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${stat.textColor}`}>{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="text-white" size={24} />
                </div>
              </div>
            </div>
          );
          return stat.link ? (
            <Link key={stat.label} to={stat.link} className="block">{card}</Link>
          ) : (
            <div key={stat.label}>{card}</div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low stock alert */}
        {data?.low_stock_items > 0 && (
          <div className="card p-5 border-red-200 bg-red-50">
            <div className="flex items-center gap-2 text-red-700 font-medium mb-3">
              <AlertTriangle size={20} />
              <span>庫存警示</span>
            </div>
            <p className="text-red-600 text-sm">
              有 {data.low_stock_items} 項商品庫存低於警示值，請盡快補貨。
            </p>
            <Link to="/inventory?low_stock=true" className="text-sm text-red-700 font-medium mt-2 inline-block hover:underline">
              查看庫存 →
            </Link>
          </div>
        )}

        {/* Recent shipments */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">近期出貨</h2>
            <Link to="/shipments" className="text-sm text-primary-600 hover:underline">查看全部</Link>
          </div>
          {data?.recent_shipments?.length === 0 ? (
            <p className="text-gray-500 text-sm">暫無出貨記錄</p>
          ) : (
            <div className="space-y-3">
              {data?.recent_shipments?.slice(0, 5).map((shipment: any) => (
                <div key={shipment.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{shipment.shipment_number}</span>
                    <span className="text-gray-500 ml-2">{shipment.customer?.name}</span>
                  </div>
                  <span className="text-gray-600">${Number(shipment.total_amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending repairs panel */}
      {data?.pending_repairs > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">待處理維修</h2>
            <Link to="/repairs?status=pending" className="text-sm text-primary-600 hover:underline">查看待處理</Link>
          </div>
          <p className="text-gray-500 text-sm">目前有 {data.pending_repairs} 筆待處理維修</p>
        </div>
      )}
    </div>
  );
}
