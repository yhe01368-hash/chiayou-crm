import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { shipmentApi, customerApi, inventoryApi } from '../services/api';
import { ArrowLeft, Plus, Trash2, Search, X, Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Link as LinkIcon } from 'lucide-react';

interface ShipmentItemInput {
  product_id: string;
  quantity: number;
}

export default function ShipmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ShipmentItemInput[]>([]);
  const [note, setNote] = useState('');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerApi.getAll().then(res => res.data),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.getAll().then(res => res.data),
  });

  const { data: editData } = useQuery({
    queryKey: ['shipment', id],
    queryFn: () => shipmentApi.getById(id!).then(res => res.data),
    enabled: isEdit,
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
    ],
    content: note,
    onUpdate: ({ editor }) => {
      setNote(editor.getHTML());
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

  useEffect(() => {
    if (editData && editor) {
      setCustomerId(editData.customer_id);
      setItems(editData.items.map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })));
      setNote(editData.note || '');
      editor.commands.setContent(editData.note || '');
      const cust = customers.find((c: any) => c.id === editData.customer_id);
      if (cust) setCustomerSearch(cust.name);
    }
  }, [editData, customers, editor]);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? shipmentApi.update(id!, data) : shipmentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      navigate('/shipments');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return alert('請選擇客戶');
    if (items.length === 0) return alert('請新增商品');
    mutation.mutate({ customer_id: customerId, items, note });
  };

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: 'product_id' | 'quantity', value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const total = items.reduce((sum, item) => {
    const product = products.find((p: any) => p.id === item.product_id);
    return sum + (product ? Number(product.selling_price) * item.quantity : 0);
  }, 0);

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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link to="/shipments" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? '編輯出貨單' : '新增出貨單'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
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
              />
              {customerSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomerSearch('');
                    setCustomerId('');
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
                        setCustomerId(c.id);
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
          {!customerId && <p className="text-xs text-red-500 mt-1">請選擇客戶</p>}
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">商品項目 *</label>
            <button type="button" onClick={addItem} className="btn btn-secondary text-sm flex items-center gap-1">
              <Plus size={16} /> 新增商品
            </button>
          </div>
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
              尚無商品，請點擊「新增商品」
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => {
                const product = products.find((p: any) => p.id === item.product_id);
                return (
                  <div key={index} className="flex gap-3 items-center">
                    <select
                      className="input flex-1"
                      value={item.product_id}
                      onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                    >
                      <option value="">選擇商品</option>
                      {products.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.product_name} (庫存: {p.quantity})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="input w-24"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                      min="1"
                    />
                    <span className="text-sm text-gray-600 w-24 text-right">
                      NT${product ? (Number(product.selling_price) * item.quantity).toLocaleString() : 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 hover:bg-gray-100 rounded text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {items.length > 0 && (
            <div className="mt-4 text-right text-lg font-bold">
              總金額：${total.toLocaleString()}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
          {editor && (
            <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
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
              <EditorContent editor={editor} className="prose prose-sm max-w-none p-3 min-h-[120px]" />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? '處理中...' : '確認出貨'}
          </button>
          <Link to="/shipments" className="btn btn-secondary">取消</Link>
        </div>
      </form>
    </div>
  );
}
