import { Link, useLocation } from 'react-router-dom';
import { 
 LayoutDashboard, Users, Wrench, Package, Truck, 
 Menu, X
} from 'lucide-react';
import { useState } from 'react';

interface LayoutProps {
 children: React.ReactNode;
}

const navItems = [
 { path: '/dashboard', label: '儀表板', icon: LayoutDashboard },
 { path: '/customers', label: '客戶管理', icon: Users },
 { path: '/repairs', label: '維修管理', icon: Wrench },
 { path: '/inventory', label: '庫存管理', icon: Package },
 { path: '/shipments', label: '出貨單', icon: Truck },
];

export default function Layout({ children }: LayoutProps) {
 const location = useLocation();
 const [sidebarOpen, setSidebarOpen] = useState(false);

 return (
 <>
 <style>{`
 @media print {
 aside, header {
 display: none !important;
 }
 }
 `}</style>

 <div className="min-h-screen bg-gray-50 flex">
 {/* Mobile sidebar overlay */}
 {sidebarOpen && (
 <div 
 className="fixed inset-0 bg-black/50 z-40 lg:hidden"
 onClick={() => setSidebarOpen(false)}
 />
 )}

 {/* Sidebar */}
 <aside className={`
 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-200
 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
 `}>
 <div className="h-full flex flex-col">
 {/* Logo */}
 <div className="h-16 flex items-center justify-between px-4 border-b">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
 <span className="text-white font-bold text-sm">嘉</span>
 </div>
 <span className="font-bold text-gray-900">嘉祐資訊 CRM</span>
 </div>
 <button 
 className="lg:hidden p-1 hover:bg-gray-100 rounded"
 onClick={() => setSidebarOpen(false)}
 >
 <X size={20} />
 </button>
 </div>

 {/* Navigation */}
 <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
 {navItems.map((item) => {
 const Icon = item.icon;
 const isActive = location.pathname === item.path || 
 (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
 
 return (
 <Link
 key={item.path}
 to={item.path}
 className={`
 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
 ${isActive 
 ? 'bg-primary-50 text-primary-700' 
 : 'text-gray-700 hover:bg-gray-100'}
 `}
 onClick={() => setSidebarOpen(false)}
 >
 <Icon size={20} />
 <span className="font-medium">{item.label}</span>
 </Link>
 );
 })}
 </nav>

 {/* Footer */}
 <div className="p-4 border-t">
 <div className="text-xs text-gray-500 text-center">
 © 2026 嘉祐資訊企業有限公司
 </div>
 </div>
 </div>
 </aside>

 {/* Main content */}
 <div className="flex-1 flex flex-col min-w-0">
 {/* Top bar */}
 <header className="h-16 bg-white border-b flex items-center justify-between px-4 lg:px-6">
 <button 
 className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
 onClick={() => setSidebarOpen(true)}
 >
 <Menu size={24} />
 </button>
 <div className="hidden lg:block" />
 <div className="flex items-center gap-2">
 <span className="text-sm text-gray-600">電腦工程師</span>
 <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
 <span className="text-primary-700 font-medium text-sm">祐</span>
 </div>
 </div>
 </header>

 {/* Page content */}
 <main className="flex-1 p-4 lg:p-6 overflow-auto">
 {children}
 </main>
 </div>
 </div>
 </>
 );
}
