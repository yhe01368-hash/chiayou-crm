import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { inventoryApi } from '../services/api';
import type { InventoryFormData } from '../types';
import { ArrowLeft, Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Link as LinkIcon } from 'lucide-react';

const categories = ['CPU', '硬碟', '記憶體', '顯示卡', '主機板', '電源供應器', '機殼', '其他'];
const units = ['個', '片', '條', '顆', '台', '盒'];

export default function InventoryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<InventoryFormData>({
    product_code: '',
    product_name: '',
    category: '其他',
    quantity: 0,
    unit: '個',
    cost_price: undefined,
    selling_price: 0,
    supplier: '',
    min_stock: 5,
    note: '',
  });

  // 追蹤是否已初始化
  const editorInitializedRef = useRef(false);

  const { data: editData } = useQuery({
    queryKey: ['inventory', id],
    queryFn: () => inventoryApi.getById(id!).then(res => res.data),
    enabled: isEdit,
  });

  // TipTap 作為非受控組件
  const editor = useEditor({
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
        class: 'prose prose-sm max-w-none p-3 min-h-[100px] focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      // 不做任何 state 更新！
    },
  });

  useEffect(() => {
    if (editData && !editorInitializedRef.current) {
      editorInitializedRef.current = true;
      setForm({
        product_code: editData.product_code,
        product_name: editData.product_name,
        category: editData.category,
        quantity: editData.quantity,
        unit: editData.unit,
        cost_price: editData.cost_price,
        selling_price: editData.selling_price,
        supplier: editData.supplier || '',
        min_stock: editData.min_stock,
        note: editData.note || '',
      });
      if (editor && editData.note) {
        editor.commands.setContent(editData.note);
      }
    }
  }, [editData, editor]);

  const mutation = useMutation({
    mutationFn: (data: InventoryFormData) =>
      isEdit ? inventoryApi.update(id!, data) : inventoryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      navigate('/inventory');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const noteText = editor?.getHTML() || form.note || '';
    const formData = { ...form, note: noteText };
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link to="/inventory" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? '編輯商品' : '新增商品'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">商品編號 *</label>
            <input
              type="text"
              className="input"
              value={form.product_code}
              onChange={(e) => setForm({...form, product_code: e.target.value})}
              required
              disabled={isEdit}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">商品名稱 *</label>
            <input
              type="text"
              className="input"
              value={form.product_name}
              onChange={(e) => setForm({...form, product_name: e.target.value})}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">類別 *</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({...form, category: e.target.value})}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">單位</label>
            <select
              className="input"
              value={form.unit}
              onChange={(e) => setForm({...form, unit: e.target.value})}
            >
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">數量</label>
            <input
              type="number"
              className="input"
              value={form.quantity}
              onChange={(e) => setForm({...form, quantity: Number(e.target.value)})}
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">最低庫存警示</label>
            <input
              type="number"
              className="input"
              value={form.min_stock}
              onChange={(e) => setForm({...form, min_stock: Number(e.target.value)})}
              min="0"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">成本價</label>
            <input
              type="number"
              className="input"
              value={form.cost_price || ''}
              onChange={(e) => setForm({...form, cost_price: e.target.value ? Number(e.target.value) : undefined})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">售價 *</label>
            <input
              type="number"
              className="input"
              value={form.selling_price}
              onChange={(e) => setForm({...form, selling_price: Number(e.target.value)})}
              required
              min="0"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">供應商</label>
          <input
            type="text"
            className="input"
            value={form.supplier}
            onChange={(e) => setForm({...form, supplier: e.target.value})}
          />
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
            {mutation.isPending ? '儲存中...' : '儲存'}
          </button>
          <Link to="/inventory" className="btn btn-secondary">取消</Link>
        </div>
      </form>
    </div>
  );
}
