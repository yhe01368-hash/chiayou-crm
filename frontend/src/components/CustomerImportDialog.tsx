import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi } from '../services/api';
import { X, Upload, Download, FileText, CheckCircle2, AlertCircle, SkipForward, Loader2 } from 'lucide-react';

interface ImportResult {
  row: number;
  name: string;
  phone: string;
  status: 'success' | 'failed' | 'skipped';
  error: string | null;
}

interface Props {
  onClose: () => void;
}

type Step = 'select' | 'preview' | 'importing' | 'result';

export default function CustomerImportDialog({ onClose }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // 用 PapaParse 即時解析（瀏覽器端解析，不上傳）
  const handleFileSelect = async (selected: File) => {
    setFile(selected);
    setPreviewError(null);

    try {
      const Papa = (await import('papaparse')).default;
      const text = await selected.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0) {
        console.warn('CSV 解析警告:', parsed.errors);
      }
      const data = parsed.data as any[];
      if (data.length === 0) {
        setPreviewError('CSV 檔案沒有資料');
        return;
      }
      setPreviewData(data);
      setStep('preview');
    } catch (err: any) {
      setPreviewError(`讀取檔案失敗: ${err.message || err}`);
    }
  };

  const importMutation = useMutation({
    mutationFn: () => customerApi.importCSV(file!),
    onSuccess: (res) => {
      setResults(res.data.results);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => {
      setPreviewError(err.response?.data?.detail || err.message || '匯入失敗');
    },
  });

  const handleStartImport = () => {
    setStep('importing');
    importMutation.mutate();
  };

  // 統計結果
  const successCount = results?.filter((r) => r.status === 'success').length || 0;
  const skippedCount = results?.filter((r) => r.status === 'skipped').length || 0;
  const failedCount = results?.filter((r) => r.status === 'failed').length || 0;

  // 預覽時檢查格式
  const previewIssues = previewData.map((row) => {
    const issues: string[] = [];
    if (!row['姓名']?.trim()) issues.push('缺少姓名');
    if (!row['電話']?.trim()) issues.push('缺少電話');
    return issues;
  });
  const previewErrorCount = previewIssues.filter((i) => i.length > 0).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Upload size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">CSV 批次匯入客戶</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
            disabled={step === 'importing'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Step 1: 選擇檔案 */}
          {step === 'select' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <p className="font-medium mb-1">CSV 格式說明</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                  <li>第一列為標題，需包含：姓名、電話（必填）</li>
                  <li>選填欄位：行動電話、統一編號、地址、Email、聯絡人、傳真、備註</li>
                  <li>電話或統編已存在時會自動跳過該列</li>
                </ul>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition"
              >
                <Upload className="mx-auto mb-2 text-gray-400" size={40} />
                <p className="text-gray-700 font-medium">點擊選擇 CSV 檔案</p>
                <p className="text-sm text-gray-500 mt-1">支援 .csv 格式</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
              </div>

              {previewError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{previewError}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <button
                  onClick={async () => {
                    try {
                      const res = await customerApi.downloadTemplate();
                      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'customers_template.csv';
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      console.error('下載範本失敗:', err);
                    }
                  }}
                  className="btn btn-secondary flex items-center gap-2 text-sm"
                >
                  <Download size={16} /> 下載空白範本
                </button>
              </div>
            </div>
          )}

          {/* Step 2: 預覽 */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <FileText size={18} className="text-gray-500" />
                <span className="text-sm text-gray-700 font-medium">{file?.name}</span>
                <span className="text-xs text-gray-500">({previewData.length} 筆資料)</span>
              </div>

              {previewErrorCount > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{previewErrorCount} 筆資料缺少必填欄位</p>
                    <p className="text-xs mt-0.5">匯入時這些列會被跳過（缺少姓名或電話）</p>
                  </div>
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">姓名</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">電話</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">統編</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">問題</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 100).map((row, i) => {
                        const issues = previewIssues[i] || [];
                        return (
                          <tr key={i} className={`border-t border-gray-100 ${issues.length > 0 ? 'bg-red-50' : ''}`}>
                            <td className="px-3 py-2 text-gray-500">{i + 2}</td>
                            <td className="px-3 py-2">{row['姓名'] || <span className="text-red-500">—</span>}</td>
                            <td className="px-3 py-2">{row['電話'] || <span className="text-red-500">—</span>}</td>
                            <td className="px-3 py-2 text-gray-600">{row['統一編號'] || '—'}</td>
                            <td className="px-3 py-2 text-xs text-red-600">{issues.join('、') || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {previewData.length > 100 && (
                  <div className="p-2 text-xs text-gray-500 text-center bg-gray-50 border-t border-gray-200">
                    顯示前 100 筆，總共 {previewData.length} 筆
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: 匯入中 */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="animate-spin text-primary-600" size={48} />
              <p className="text-gray-700 font-medium">正在匯入 {previewData.length} 筆客戶...</p>
              <p className="text-sm text-gray-500">請勿關閉視窗</p>
            </div>
          )}

          {/* Step 4: 結果 */}
          {step === 'result' && results && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle2 className="mx-auto text-green-600 mb-1" size={24} />
                  <div className="text-2xl font-bold text-green-700">{successCount}</div>
                  <div className="text-xs text-green-600">成功</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <SkipForward className="mx-auto text-yellow-600 mb-1" size={24} />
                  <div className="text-2xl font-bold text-yellow-700">{skippedCount}</div>
                  <div className="text-xs text-yellow-600">跳過（重複）</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <AlertCircle className="mx-auto text-red-600 mb-1" size={24} />
                  <div className="text-2xl font-bold text-red-700">{failedCount}</div>
                  <div className="text-xs text-red-600">失敗</div>
                </div>
              </div>

              {(skippedCount > 0 || failedCount > 0) && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">列</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">姓名</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">電話</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">狀態</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">說明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.filter((r) => r.status !== 'success').map((r, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-500">{r.row}</td>
                            <td className="px-3 py-2">{r.name || '—'}</td>
                            <td className="px-3 py-2">{r.phone || '—'}</td>
                            <td className="px-3 py-2">
                              {r.status === 'skipped' ? (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">跳過</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">失敗</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600">{r.error || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          {step === 'select' && (
            <button onClick={onClose} className="btn btn-secondary">取消</button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => { setStep('select'); setFile(null); setPreviewData([]); }} className="btn btn-secondary">
                重新選擇
              </button>
              <button
                onClick={handleStartImport}
                disabled={previewData.length === 0}
                className="btn btn-primary"
              >
                確認匯入 {previewData.length} 筆
              </button>
            </>
          )}
          {step === 'result' && (
            <button onClick={onClose} className="btn btn-primary">完成</button>
          )}
        </div>
      </div>
    </div>
  );
}
