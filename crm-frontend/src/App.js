import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loadUserFromStorage } from './store/slices/authSlice';
import ProtectedRoute from './utils/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardEnhanced from './pages/DashboardEnhanced';
import DashboardPro from './pages/DashboardPro';
import DailyEntry from './pages/DailyEntry';
import FundEntry from './pages/FundEntry';
import Clients from './pages/Clients';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import MetaAds from './pages/MetaAds';
import GoogleAds from './pages/GoogleAds';
import EmailCampaigns from './pages/EmailCampaigns';
import DailyLeadData from './pages/DailyLeadData';
import ClientVault from './pages/ClientVault';
import AccessManagement from './pages/AccessManagement';
import Leads from './pages/Leads';

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadUserFromStorage());
  }, [dispatch]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPro />} />
          <Route path="dashboard-v2" element={<DashboardEnhanced />} />
          <Route path="dashboard-old" element={<Dashboard />} />
          <Route path="daily-entry" element={<DailyEntry />} />
          <Route path="daily-lead-data" element={<DailyLeadData />} />
          <Route path="client-vault" element={<ClientVault />} />
          <Route path="fund-entry" element={<FundEntry />} />
          <Route path="clients" element={<Clients />} />
          <Route path="leads" element={<Leads />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="campaigns" element={<Dashboard />} />
          <Route path="campaigns/meta-ads" element={<MetaAds />} />
          <Route path="campaigns/google-ads" element={<GoogleAds />} />
          <Route path="campaigns/email" element={<EmailCampaigns />} />
          <Route path="analytics" element={<Reports />} />
          <Route path="tasks" element={<Dashboard />} />
          <Route path="calendar" element={<Dashboard />} />
          <Route path="team" element={<Clients />} />
          <Route path="access-management" element={<AccessManagement />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
