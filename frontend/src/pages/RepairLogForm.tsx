import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { format } from 'date-fns';

import { repairLogApi, repairApi, customerApi } from '../services/api';
import type { RepairLogFormData } from '../types';
import {
  ArrowLeft, Search, X, Bold, Italic, Underline as UnderlineIcon,
  Strikethrough, List, ListOrdered, Link as LinkIcon, FileInput
} from 'lucide-react';

export default function RepairLogForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);
  const editorInitializedRef = useRef(false);

  const [form, setForm] = useState<RepairLogFormData>({
    repair_id: searchParams.get('repair_id') || '',
    customer_id: '',
    customer_name: '',
    device_info: '',
    log_date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    problem: '',
    process: '',
    note: '',
  });

  const [showRepairDropdown, setShowRepairDropdown] = useState(false);
  const [repairSearch, setRepairSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const repairDropdownRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const { data: repairs = [] } = useQuery({
    queryKey: ['repairs'],
    queryFn: () => repairApi.getAll().then(res => res.data),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerApi.getAll().then(res => res.data),
  });

  const { data: editData } = useQuery({
    queryKey: ['repair-log', id],
    queryFn: () => repairLogApi.getById(id!).then(res => res.data),
    enabled: isEdit,
  });

  const problemEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none p-3 min-h-[120px] focus:outline-none',
      },
    },
  });

  const processEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none p-3 min-h-[120px] focus:outline-none',
      },
    },
  });

  // 點外面關閉下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (repairDropdownRef.current && !repairDropdownRef.current.contains(e.target as Node)) {
        setShowRepairDropdown(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 編輯模式初始化
  useEffect(() => {
    if (editData && !editorInitializedRef.current) {
      editorInitializedRef.current = true;
      setForm({
        repair_id: editData.repair_id || '',
        customer_id: editData.customer_id || '',
        customer_name: editData.customer_name || '',
        device_info: editData.device_info || '',
        log_date: editData.log_date,
        title: editData.title || '',
        problem: editData.problem || '',
        process: editData.process || '',
        note: editData.note || '',
      });
      if (problemEditor && editData.problem) {
        problemEditor.commands.setContent(editData.problem);
      }
      if (processEditor && editData.process) {
        processEditor.commands.setContent(editData.process);
      }
      // 帶入搜尋框顯示名稱
      if (editData.customer_name) setCustomerSearch(editData.customer_name);
      const targetRepair = repairs.find((r: any) => r.id === editData.repair_id);
      if (targetRepair) {
        setRepairSearch(`${targetRepair.device_type} - ${targetRepair.device_brand || ''} ${targetRepair.device_model || ''}`);
      }
    }
  }, [editData, repairs, problemEditor, processEditor]);

  // 從網址帶入 repair_id 時，自動帶入該維修單資料
  useEffect(() => {
    const rid = searchParams.get('repair_id');
    if (rid && !isEdit && repairs.length > 0 && !form.problem && !form.process) {
      importRepairData(rid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repairs]);

  /** 從指定維修單帶入資料（問題 / 過程 / 客戶 / 設備 / 標題） */
  const importRepairData = (repairId: string) => {
    const repair: any = repairs.find((r: any) => r.id === repairId);
    if (!repair) return;

    const deviceInfo = [repair.device_type, repair.device_brand, repair.device_model]
      .filter(Boolean).join(' ');
    const cust = repair.customer;
    const custName = cust?.name || '';
    const problemHtml = repair.problem || '';
    const processHtml = repair.repair_detail || '';
    const defaultTitle = `${custName || '客戶'} - ${deviceInfo || '維修'} 日誌`;

    setForm({
      ...form,
      repair_id: repairId,
      customer_id: repair.customer_id || '',
      customer_name: custName,
      device_info: deviceInfo,
      title: form.title || defaultTitle,
      problem: problemHtml,
      process: processHtml,
    });
    setCustomerSearch(custName);
    setRepairSearch(`${repair.device_type} - ${repair.device_brand || ''} ${repair.device_model || ''}`);
    if (problemEditor) problemEditor.commands.setContent(problemHtml);
    if (processEditor) processEditor.commands.setContent(processHtml);
  };

  const filteredRepairs = repairs.filter((r: any) => {
    if (!repairSearch) return true;
    const q = repairSearch.toLowerCase();
    return (
      r.device_type?.toLowerCase().includes(q) ||
      r.device_brand?.toLowerCase().includes(q) ||
      r.device_model?.toLowerCase().includes(q) ||
      r.problem?.toLowerCase().includes(q) ||
      r.customer?.name?.toLowerCase().includes(q)
    );
  });

  const filteredCustomers = customers.filter((c: any) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  const mutation = useMutation({
    mutationFn: (data: RepairLogFormData) =>
      isEdit ? repairLogApi.update(id!, data) : repairLogApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-logs'] });
      navigate('/repair-logs');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: RepairLogFormData = {
      ...form,
      problem: problemEditor?.getHTML() || form.problem || '',
      process: processEditor?.getHTML() || form.process || '',
    };
    // UUID -> string
    if (data.repair_id) data.repair_id = String(data.repair_id);
    if (data.customer_id) data.customer_id = String(data.customer_id);
    mutation.mutate(data);
  };

  const ToolbarButton = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`p-1.5 rounded hover:bg-gray-100 ${active ? 'bg-gray-200 text-blue-600' : 'text-gray-600'}`}
      title={title}
    >
      {children}
    </button>
  );

  const RichTextField = ({ editor, label }: { editor: ReturnType<typeof useEditor>; label: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {editor && (
        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white mb-10">
          <div className="flex items-center gap-0.5 border-b border-gray-200 p-1.5 bg-gray-50 flex-wrap">
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="粗體">
              <Bold size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="斜體">
              <Italic size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="底線">
              <UnderlineIcon size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="刪除線">
              <Strikethrough size={16} />
            </ToolbarButton>
            <span className="w-px h-5 bg-gray-300 mx-1" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="項目符號">
              <List size={16} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="編號">
              <ListOrdered size={16} />
            </ToolbarButton>
            <span className="w-px h-5 bg-gray-300 mx-1" />
            <ToolbarButton onClick={() => {
              const url = window.prompt('輸入連結 URL');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }} active={editor.isActive('link')} title="連結">
              <LinkIcon size={16} />
            </ToolbarButton>
          </div>
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link to="/repair-logs" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? '編輯維修日誌' : '新增維修日誌'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {/* 從維修單帶入 */}
        <div ref={repairDropdownRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            從維修單帶入（選填）
          </label>
          <div className="relative">
            <FileInput className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              className="input pl-9 pr-8"
              placeholder="搜尋維修單（設備、客戶、問題）..."
              value={repairSearch}
              onChange={(e) => {
                setRepairSearch(e.target.value);
                setShowRepairDropdown(true);
              }}
              onFocus={() => setShowRepairDropdown(true)}
            />
            {repairSearch && (
              <button
                type="button"
                onClick={() => {
                  setRepairSearch('');
                  setForm({ ...form, repair_id: '' });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
            {showRepairDropdown && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredRepairs.length === 0 ? (
                  <li className="px-4 py-2 text-gray-500 text-sm">找不到維修單</li>
                ) : (
                  filteredRepairs.slice(0, 30).map((r: any) => (
                    <li
                      key={r.id}
                      className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                      onClick={() => {
                        importRepairData(r.id);
                        setShowRepairDropdown(false);
                      }}
                    >
                      <div className="font-medium">
                        {r.device_type} - {r.device_brand || ''} {r.device_model || ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        客戶：{r.customer?.name || '-'} | {r.status}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          {form.repair_id && (
            <p className="text-xs text-gray-500 mt-1">
              已關聯維修單：{form.repair_id.slice(0, 8)}...
              <Link to={`/repairs/${form.repair_id}`} className="text-primary-600 hover:underline ml-2">
                查看
              </Link>
            </p>
          )}
        </div>

        {/* 客戶 */}
        <div ref={customerDropdownRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">客戶</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              className="input pl-9 pr-8"
              placeholder="搜尋客戶名稱或電話..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setShowCustomerDropdown(true);
              }}
              onFocus={() => setShowCustomerDropdown(true)}
            />
            {customerSearch && (
              <button
                type="button"
                onClick={() => {
                  setCustomerSearch('');
                  setForm({ ...form, customer_id: '', customer_name: '' });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
            {showCustomerDropdown && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <li className="px-4 py-2 text-gray-500 text-sm">找不到客戶</li>
                ) : (
                  filteredCustomers.slice(0, 30).map((c: any) => (
                    <li
                      key={c.id}
                      className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                      onClick={() => {
                        setForm({ ...form, customer_id: c.id, customer_name: c.name });
                        setCustomerSearch(c.name);
                        setShowCustomerDropdown(false);
                      }}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-gray-400 ml-2">{c.phone}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>

        {/* 設備資訊 + 日期 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">設備資訊</label>
            <input
              type="text"
              className="input"
              placeholder="例：筆電 - ASUS X515"
              value={form.device_info || ''}
              onChange={(e) => setForm({ ...form, device_info: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日誌日期</label>
            <input
              type="date"
              className="input"
              value={form.log_date}
              onChange={(e) => setForm({ ...form, log_date: e.target.value })}
            />
          </div>
        </div>

        {/* 標題 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">標題</label>
          <input
            type="text"
            className="input"
            placeholder="簡短描述此次日誌（例如：客戶筆電無法開機維修紀錄）"
            value={form.title || ''}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        {/* 問題描述 + 維修過程 */}
        <RichTextField editor={problemEditor} label="問題描述" />
        <RichTextField editor={processEditor} label="維修過程" />

        {/* 備註 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="其他想記錄的事項..."
            value={form.note || ''}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? '儲存中...' : '儲存'}
          </button>
          <Link to="/repair-logs" className="btn btn-secondary">取消</Link>
        </div>
      </form>
    </div>
  );
}