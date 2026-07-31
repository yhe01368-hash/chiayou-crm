import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repairLogApi } from '../services/api';
import type { RepairLog } from '../types';
import { Plus, Edit2, Trash2, NotebookPen, Search } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export default function RepairLogList() {
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['repair-logs'],
    queryFn: () => repairLogApi.getAll().then(res => res.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repairLogApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repair-logs'] }),
  });

  // Client-side search filter
  const filteredLogs = logs.filter((log: RepairLog) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.title?.toLowerCase().includes(q) ||
      log.customer_name?.toLowerCase().includes(q) ||
      log.device_info?.toLowerCase().includes(q) ||
      log.problem?.toLowerCase().includes(q) ||
      log.process?.toLowerCase().includes(q) ||
      log.note?.toLowerCase().includes(q)
    );
  });

  const stripHtml = (html?: string) => {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">維修日誌</h1>
        <Link to="/repair-logs/new" className="btn btn-primary flex items-center gap-2">
          <Plus size={20} /> 新增日誌
        </Link>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="搜尋日誌（標題、客戶、設備、問題、過程）..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Logs list */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          {searchQuery ? '無符合「' + searchQuery + '」的日誌' : '尚無日誌'}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredLogs.map((log: RepairLog) => (
            <div key={log.id} className="card p-4">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <NotebookPen className="text-purple-600" size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {log.title || '(無標題)'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        日期：{log.log_date} | 客戶：{log.customer_name || '-'} {log.device_info && `| ${log.device_info}`}
                      </div>
                      {log.created_by && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          建立者：{log.created_by}
                        </div>
                      )}
                    </div>
                  </div>
                  {(log.problem || log.process || log.note) && (
                    <div className="text-sm text-gray-600 ml-13 space-y-1">
                      {log.problem && (
                        <div>
                          <span className="font-medium">問題：</span>
                          {stripHtml(log.problem).slice(0, 120)}
                          {stripHtml(log.problem).length > 120 && '...'}
                        </div>
                      )}
                      {log.process && (
                        <div>
                          <span className="font-medium">過程：</span>
                          {stripHtml(log.process).slice(0, 120)}
                          {stripHtml(log.process).length > 120 && '...'}
                        </div>
                      )}
                    </div>
                  )}
                  {log.repair_id && (
                    <div className="text-xs text-gray-400 mt-1 ml-13">
                      關聯維修單：
                      <Link to={`/repairs/${log.repair_id}`} className="text-primary-600 hover:underline ml-1">
                        {log.repair_id.slice(0, 8)}...
                      </Link>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/repair-logs/${log.id}/edit`} className="btn btn-secondary text-sm">
                    <Edit2 size={16} />
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm('確定要刪除這筆日誌？')) deleteMutation.mutate(log.id);
                    }}
                    className="btn btn-danger text-sm"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}