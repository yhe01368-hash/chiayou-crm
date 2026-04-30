import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import CustomerList from './pages/CustomerList';
import CustomerDetail from './pages/CustomerDetail';
import CustomerForm from './pages/CustomerForm';
import RepairList from './pages/RepairList';
import RepairDetail from './pages/RepairDetail';
import RepairForm from './pages/RepairForm';
import InventoryList from './pages/InventoryList';
import InventoryForm from './pages/InventoryForm';
import ShipmentList from './pages/ShipmentList';
import ShipmentForm from './pages/ShipmentForm';
import ShipmentDetail from './pages/ShipmentDetail';
import ShipmentPrint from './pages/ShipmentPrint';
import KnowledgeList from './pages/KnowledgeList';
import Login from './pages/Login';
import UserList from './pages/UserList';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* 登入頁（公開） */}
          <Route path="/login" element={<Login />} />

          {/* 受保護的頁面：Layout 包住所有子頁面 */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* 客戶管理 */}
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/new" element={<CustomerForm />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="customers/:id/edit" element={<CustomerForm />} />

            {/* 維修管理 */}
            <Route path="repairs" element={<RepairList />} />
            <Route path="repairs/new" element={<RepairForm />} />
            <Route path="repairs/:id" element={<RepairDetail />} />
            <Route path="repairs/:id/edit" element={<RepairForm />} />

            {/* 庫存管理 */}
            <Route path="inventory" element={<InventoryList />} />
            <Route path="inventory/new" element={<InventoryForm />} />
            <Route path="inventory/:id/edit" element={<InventoryForm />} />

            {/* 出貨單 */}
            <Route path="shipments" element={<ShipmentList />} />
            <Route path="shipments/new" element={<ShipmentForm />} />
            <Route path="shipments/:id" element={<ShipmentDetail />} />
            <Route path="shipments/:id/edit" element={<ShipmentForm />} />
            <Route path="shipments/:id/print" element={<ShipmentPrint />} />

            {/* 維修知識庫 */}
            <Route path="knowledge" element={<KnowledgeList />} />

            {/* 使用者管理（管理員） */}
            <Route path="users" element={<UserList />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
