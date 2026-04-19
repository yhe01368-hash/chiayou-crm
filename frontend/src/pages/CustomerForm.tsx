import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { customerApi } from '../services/api';
import type { CustomerFormData } from '../types';
import { ArrowLeft, Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Link as LinkIcon } from 'lucide-react';

export default function CustomerForm() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existingCustomer } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.getById(id!).then(res => res.data),
    enabled: isEditMode,
  });

  const [form, setForm] = useState<CustomerFormData>({
    name: '',
    phone: '',
    phone2: '',
    tax_id: '',
    address: '',
    email: '',
    note: '',
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
    content: form.note,
    onUpdate: ({ editor }) => {
      setForm(prev => ({ ...prev, note: editor.getHTML() }));
    },
  });

  // Sync initial content when editing
  useEffect(() => {
    if (existingCustomer && editor) {
      setForm({
        name: existingCustomer.name || '',
        phone: existingCustomer.phone || '',
        phone2: existingCustomer.phone2 || '',
        tax_id: existingCustomer.tax_id || '',
        address: existingCustomer.address || '',
        email: existingCustomer.email || '',
        note: existingCustomer.note || '',
      });
      editor.commands.setContent(existingCustomer.note || '');
    }
  }, [existingCustomer, editor]);

  const mutation = useMutation({
    mutationFn: (data: CustomerFormData) =>
      isEditMode ? customerApi.update(id!, data) : customerApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate('/customers');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
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
        <Link to="/customers" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? '編輯客戶' : '新增客戶'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
          <input
            type="text"
            className="input"
            value={form.name}
            onChange={(e) => setForm({...form, name: e.target.value})}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">電話 *</label>
          <input
            type="tel"
            className="input"
            value={form.phone}
            onChange={(e) => setForm({...form, phone: e.target.value})}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">行動電話</label>
          <input
            type="tel"
            className="input"
            value={form.phone2}
            onChange={(e) => setForm({...form, phone2: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">統一編號</label>
          <input
            type="text"
            className="input"
            value={form.tax_id}
            onChange={(e) => setForm({...form, tax_id: e.target.value})}
            maxLength={8}
            placeholder="8碼"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
          <input
            type="text"
            className="input"
            value={form.address}
            onChange={(e) => setForm({...form, address: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => setForm({...form, email: e.target.value})}
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
          <Link to="/customers" className="btn btn-secondary">取消</Link>
        </div>
      </form>
    </div>
  );
}
