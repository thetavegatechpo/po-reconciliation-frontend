
import { Routes, Route } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import './styles/OperationalKPICards.css';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

import POListPage from './pages/POListPage';
import POFormPage from './pages/POFormPage';
import PODetailPage from './pages/PODetailPage';

import InvoicesPage from './pages/InvoicesPage';
import PaymentsPage from './pages/PaymentsPage';
import ApprovalsPage from './pages/ApprovalsPage';

import ReportsPage from './pages/ReportsPage';
import WorkFollowUpPage from './pages/WorkFollowUpPage';
import InvoiceDraftsPage from './pages/InvoiceDraftsPage';
import MastersPage from './pages/MastersPage';
import UsersPage from './pages/UsersPage';

export default function App() {
  return (
    <Routes>

      {/* LOGIN */}
      <Route
        path="/login"
        element={<LoginPage />}
      />

      {/* AUTHENTICATED APPLICATION */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >

        {/* DASHBOARD */}
        <Route
          index
          element={<ProtectedRoute permission="dashboard.view"><DashboardPage /></ProtectedRoute>}
        />

        <Route path="work-followups" element={<ProtectedRoute permission="work.view"><WorkFollowUpPage /></ProtectedRoute>} />
        <Route path="invoice-drafts" element={<ProtectedRoute permission="draft.view"><InvoiceDraftsPage /></ProtectedRoute>} />

        {/* CUSTOMER PO */}
        <Route
          path="pos"
          element={<ProtectedRoute permission="po.view"><POListPage /></ProtectedRoute>}
        />

        <Route
          path="pos/new"
          element={
            <ProtectedRoute
              permission="po.create"
            >
              <POFormPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="pos/:id"
          element={<ProtectedRoute permission="po.view"><PODetailPage /></ProtectedRoute>}
        />

        {/* INVOICES */}
        <Route
          path="invoices"
          element={<ProtectedRoute permission="invoice.view"><InvoicesPage /></ProtectedRoute>}
        />

        {/* PAYMENTS */}
        <Route
          path="payments"
          element={<ProtectedRoute permission="payment.view"><PaymentsPage /></ProtectedRoute>}
        />

        {/* APPROVALS */}
        <Route
          path="approvals"
          element={
            <ProtectedRoute
              permission="approval.view"
            >
              <ApprovalsPage />
            </ProtectedRoute>
          }
        />

        {/* REPORTS */}
        <Route
          path="reports"
          element={<ProtectedRoute permission="report.view"><ReportsPage /></ProtectedRoute>}
        />

        {/* ALL MASTERS - SINGLE PAGE */}
        <Route
          path="masters"
          element={<MastersPage />}
        />

        {/* USERS */}
        <Route
          path="users"
          element={
            <ProtectedRoute permission="user.view">
              <UsersPage />
            </ProtectedRoute>
          }
        />

      </Route>
    </Routes>
  );
}
