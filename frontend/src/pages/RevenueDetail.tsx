import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import api from '../services/api';

export default function RevenueDetail() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const getEndDate = (y: number, m: number) => {
    // new Date(y, m, 0).getDate() = m 月的天數（m=3月時等於 31）
    // 再用 local Date 建構，避免 toISOString UTC 時區偏移
    const lastDay = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, '0');
    return `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['revenue-details', year, month],
    queryFn: () => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = getEndDate(year, month);
      return api.get('/dashboard/revenue/details', {
        params: { start_date: startDate, end_date: endDate },
      }).then(res => res.data);
    },
    staleTime: 0,
  });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const revenue = Number(data?.total ?? 0);
  const cost = Number(data?.cost ?? 0);
  const profit = Number(data?.profit ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="btn btn-ghost p-2">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">營收明細</h1>
      </div>

      {/* 年月篩選 */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">年份：</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {years.map(y => (
              <option key={y} value={y}>{y} 年</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">月份：</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {months.map(m => (
              <option key={m} value={m}>{m} 月</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setYear(now.getFullYear());
            setMonth(now.getMonth() + 1);
          }}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          重置為本月
        </button>
      </div>

      {/* 三總計卡：營收 / 成本 / 淨利 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 p-3 rounded-lg">
              <DollarSign className="text-white" size={24} />
            </div>
            <div>
              <p className="text-sm text-green-700">營收總計</p>
              <p className="text-2xl font-bold text-green-800">
                ${revenue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-5 bg-rose-50 border-rose-200">
          <div className="flex items-center gap-3">
            <div className="bg-rose-500 p-3 rounded-lg">
              <TrendingDown className="text-white" size={24} />
            </div>
            <div>
              <p className="text-sm text-rose-700">成本總計</p>
              <p className="text-2xl font-bold text-rose-800">
                ${cost.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className={`card p-5 ${profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`${profit >= 0 ? 'bg-emerald-600' : 'bg-rose-600'} p-3 rounded-lg`}>
              {profit >= 0
                ? <TrendingUp className="text-white" size={24} />
                : <TrendingDown className="text-white" size={24} />}
            </div>
            <div>
              <p className={`text-sm ${profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>淨利總計</p>
              <p className={`text-2xl font-bold ${profit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                ${profit.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 訂單筆數副標 */}
      <p className="text-sm text-gray-500 -mt-2">
        {year} 年 {month} 月，共 {data?.count ?? 0} 筆完成訂單
      </p>

      {/* 明細列表 */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">載入中...</div>
        ) : data?.items?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">該月份尚無已完成訂單</div>
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
                    {item.tax_included === false && <span className="text-xs text-gray-400 ml-1">(未稅)</span>}
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
