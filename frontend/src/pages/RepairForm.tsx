import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { repairApi, customerApi, inventoryApi } from '../services/api';
import type { RepairFormData } from '../types';
import { ArrowLeft, Search, X, Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Link as LinkIcon } from 'lucide-react';

const deviceTypes = ['筆電', '桌機', '螢幕', '印表機', '其他'];
const statusOptions = [
  { value: 'pending', label: '待處理' },
  { value: 'processing', label: '處理中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

export default function RepairForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<RepairFormData>({
    customer_id: '',
    device_type: '筆電',
    device_brand: '',
    device_model: '',
    serial_number: '',
    problem: '',
    status: 'pending',
    repair_detail: '',
    cost: undefined,
    parts_used: [],
  });

  // 零件狀態
  const [partsUsed, setPartsUsed] = useState<{ product_id: string; quantity: number }[]>([]);
  const [partSearch, setPartSearch] = useState('');
  const [showPartDropdown, setShowPartDropdown] = useState<number | null>(null);

  // 編輯器是否已初始化過
  const editorInitializedRef = useRef(false);

  const [customerSearch, setCustomerSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerApi.getAll().then(res => res.data),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.getAll().then(res => res.data),
  });

  const { data: editData } = useQuery({
    queryKey: ['repair', id],
    queryFn: () => repairApi.getById(id!).then(res => res.data),
    enabled: isEdit,
  });

  // TipTap 作為非受控組件 - 只在初始化時設定一次內容
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
    onUpdate: ({ editor }) => {
      // 不做任何 state 更新！讓編輯器自己管理內容
    },
  });

  const repairDetailEditor = useEditor({
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
    onUpdate: ({ editor }) => {
      // 不做任何 state 更新！讓編輯器自己管理內容
    },
  });

  const filteredCustomers = customers.filter((c: any) => {
    const term = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term));
  });

  // 點外面關閉下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 初始化表單資料（只在首次載入時執行一次）
  useEffect(() => {
    if (editData && !editorInitializedRef.current) {
      editorInitializedRef.current = true;
      setForm({
        customer_id: editData.customer_id,
        device_type: editData.device_type,
        device_brand: editData.device_brand || '',
        device_model: editData.device_model || '',
        serial_number: editData.serial_number || '',
        problem: editData.problem || '',
        status: editData.status,
        repair_detail: editData.repair_detail || '',
        cost: editData.cost,
      });
      // 初始化編輯器內容（只做一次）
      if (problemEditor && editData.problem) {
        problemEditor.commands.setContent(editData.problem);
      }
      if (repairDetailEditor && editData.repair_detail) {
        repairDetailEditor.commands.setContent(editData.repair_detail);
      }
      const cust = customers.find((c: any) => c.id === editData.customer_id);
      if (cust) setCustomerSearch(cust.name);
      // 初始化使用零件
      if (editData.parts_used) {
        setPartsUsed(editData.parts_used);
      }
    }
  }, [editData, customers, problemEditor, repairDetailEditor]);

  const mutation = useMutation({
    mutationFn: (data: RepairFormData) =>
      isEdit ? repairApi.update(id!, data) : repairApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
      navigate('/repairs');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 直接從編輯器讀取內容，不依賴 state
    const problemText = problemEditor?.getHTML() || form.problem || '';
    const repairDetailText = repairDetailEditor?.getHTML() || form.repair_detail || '';
    const formData = {
      ...form,
      problem: problemText,
      repair_detail: repairDetailText,
      parts_used: partsUsed,
    };
    mutation.mutate(formData);
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
        <Link to="/repairs" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? '編輯維修單' : '新增維修單'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">客戶 *</label>
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                className="input pl-9 pr-8"
                placeholder="搜尋客戶姓名或電話..."
                value={showDropdown || customerSearch ? customerSearch : ''}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                required={!form.customer_id}
              />
              {customerSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomerSearch('');
                    setForm({ ...form, customer_id: '' });
                    setShowDropdown(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {showDropdown && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <li className="px-4 py-2 text-gray-500 text-sm">找不到客戶</li>
                ) : (
                  filteredCustomers.map((c: any) => (
                    <li
                      key={c.id}
                      className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                      onClick={() => {
                        setForm({ ...form, customer_id: c.id });
                        setCustomerSearch(c.name);
                        setShowDropdown(false);
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
          {!form.customer_id && (
            <p className="text-xs text-red-500 mt-1">請選擇客戶</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">裝置類型 *</label>
            <select
              className="input"
              value={form.device_type}
              onChange={(e) => setForm({...form, device_type: e.target.value})}
            >
              {deviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({...form, status: e.target.value as any})}
            >
              {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">品牌</label>
            <input
              type="text"
              className="input"
              value={form.device_brand}
              onChange={(e) => setForm({...form, device_brand: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">型號</label>
            <input
              type="text"
              className="input"
              value={form.device_model}
              onChange={(e) => setForm({...form, device_model: e.target.value})}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">序號</label>
          <input
            type="text"
            className="input"
            value={form.serial_number}
            onChange={(e) => setForm({...form, serial_number: e.target.value})}
          />
        </div>
        <RichTextField editor={problemEditor} label="問題描述 *" />
        <RichTextField editor={repairDetailEditor} label="維修過程" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">維修費用</label>
          <input
            type="number"
            className="input"
            value={form.cost || ''}
            onChange={(e) => setForm({...form, cost: e.target.value ? Number(e.target.value) : undefined})}
          />
        </div>

        {/* 使用零件 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">使用零件</label>
            <button
              type="button"
              onClick={() => setPartsUsed([...partsUsed, { product_id: '', quantity: 1 }])}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              + 新增零件
            </button>
          </div>
          {partsUsed.length === 0 ? (
            <p className="text-sm text-gray-400">尚無使用零件</p>
          ) : (
            <div className="space-y-2">
              {partsUsed.map((part, idx) => {
                const product = inventory.find((p: any) => p.id === part.product_id);
                const filtered = inventory.filter((p: any) =>
                  partSearch[idx] ? p.product_name.includes(partSearch[idx] || '') : true
                );
                return (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="relative flex-1">
                      <select
                        className="input"
                        value={part.product_id}
                        onChange={(e) => {
                          const updated = [...partsUsed];
                          updated[idx] = { ...updated[idx], product_id: e.target.value };
                          setPartsUsed(updated);
                        }}
                      >
                        <option value="">選擇零件...</option>
                        {inventory.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.product_name} (庫存:{p.quantity})
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="number"
                      className="input w-20"
                      min="1"
                      value={part.quantity}
                      onChange={(e) => {
                        const updated = [...partsUsed];
                        updated[idx] = { ...updated[idx], quantity: Number(e.target.value) };
                        setPartsUsed(updated);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setPartsUsed(partsUsed.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? '儲存中...' : '儲存'}
          </button>
          <Link to="/repairs" className="btn btn-secondary">取消</Link>
        </div>
      </form>
    </div>
  );
}
