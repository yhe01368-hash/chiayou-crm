import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
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
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Customer routes */}
            <Route path="/customers" element={<CustomerList />} />
            <Route path="/customers/new" element={<CustomerForm />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/customers/:id/edit" element={<CustomerForm />} />
            
            {/* Repair routes */}
            <Route path="/repairs" element={<RepairList />} />
            <Route path="/repairs/new" element={<RepairForm />} />
            <Route path="/repairs/:id" element={<RepairDetail />} />
            <Route path="/repairs/:id/edit" element={<RepairForm />} />
            
            {/* Inventory routes */}
            <Route path="/inventory" element={<InventoryList />} />
            <Route path="/inventory/new" element={<InventoryForm />} />
            <Route path="/inventory/:id/edit" element={<InventoryForm />} />
            
            {/* Shipment routes */}
            <Route path="/shipments" element={<ShipmentList />} />
            <Route path="/shipments/new" element={<ShipmentForm />} />
            <Route path="/shipments/:id" element={<ShipmentDetail />} />
            <Route path="/shipments/:id/edit" element={<ShipmentForm />} />
            <Route path="/shipments/:id/print" element={<ShipmentPrint />} />

            {/* Knowledge routes */}
            <Route path="/knowledge" element={<KnowledgeList />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
