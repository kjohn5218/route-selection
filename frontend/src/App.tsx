import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { TerminalProvider } from './contexts/TerminalContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import RouteManagement from './pages/RouteManagement';
import Periods from './pages/Periods';
import Selections from './pages/Selections';
import ImportExport from './pages/ImportExport';
import SelectionManagement from './pages/SelectionManagement';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Users from './pages/Users';
import Terminals from './pages/Terminals';
import ManualSelections from './pages/ManualSelections';
import PrintForms from './pages/PrintForms';
import ProcessSelections from './pages/ProcessSelections';
import SelectionResults from './pages/SelectionResults';
import DriverSelectionResults from './pages/DriverSelectionResults';
import DriverSelectionForm from './pages/DriverSelectionForm';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TerminalProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="employees" element={<Employees />} />
              <Route path="routes" element={<RouteManagement />} />
              <Route path="periods" element={<Periods />} />
              <Route path="periods/:periodId/manage" element={<SelectionManagement />} />
              <Route path="selections" element={<Selections />} />
              <Route path="import-export" element={<ImportExport />} />
              <Route path="users" element={<Users />} />
              <Route path="terminals" element={<Terminals />} />
              <Route path="manual-selections" element={<ManualSelections />} />
              <Route path="print-forms" element={<PrintForms />} />
              <Route path="process-selections/:periodId" element={<ProcessSelections />} />
              <Route path="selection-results/:periodId" element={<SelectionResults />} />
              <Route path="driver-results/:periodId" element={<DriverSelectionResults />} />
              <Route path="submit-selection/:periodId" element={<DriverSelectionForm />} />
            </Route>
          </Routes>
          </TerminalProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;