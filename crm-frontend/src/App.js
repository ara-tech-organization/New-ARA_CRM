import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loadUserFromStorage } from './store/slices/authSlice';
import LeadMatrixLoader from './components/LeadMatrixLoader';
import OfflineScreen from './components/OfflineScreen';
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
import PersonalVault from './pages/PersonalVault';
import ContentManagement from './pages/ContentManagement';
import Leads from './pages/Leads';
import AdsDashboard from './pages/AdsDashboard';
import ClientAdDetails from './pages/ClientAdDetails';
import ClientPortalAccess from './pages/ClientPortalAccess';
import ClientLogin from './pages/ClientLogin';
import ClientPortalDashboard from './pages/ClientPortalDashboard';
import ClientPortalLeads from './pages/ClientPortalLeads';
import { DataCacheProvider } from './contexts/DataCacheContext';

function App() {
  const dispatch = useDispatch();

  // Show the brand loader for ~700ms on first paint. Long enough for
  // the bundle + session hydration to settle so the first frame the
  // user sees isn't a half-rendered shell, short enough that it never
  // feels gratuitous. Tune by editing the timeout below.
  const [booting, setBooting] = useState(true);
  // Track browser online/offline state. We trust navigator.onLine for
  // the initial value and listen for the two window events to flip.
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    dispatch(loadUserFromStorage());
    const t = setTimeout(() => setBooting(false), 700);
    return () => clearTimeout(t);
  }, [dispatch]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (booting) return <LeadMatrixLoader />;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/client-login" element={<ClientLogin />} />
        <Route path="/client-portal" element={<ClientPortalDashboard />} />
        <Route path="/client-portal/leads" element={<ClientPortalLeads />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DataCacheProvider>
                <MainLayout />
              </DataCacheProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="ads-dashboard" element={<AdsDashboard />} />
          <Route path="client-ads/:clientId" element={<ClientAdDetails />} />
          <Route path="dashboard-v2" element={<DashboardEnhanced />} />
          <Route path="dashboard-old" element={<DashboardPro />} />
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
          <Route path="client-portal-access" element={<ClientPortalAccess />} />
          <Route path="access-management" element={<AccessManagement />} />
          <Route path="personal-vault" element={<PersonalVault />} />
          <Route path="content-management" element={<ContentManagement />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      {/* Network curtain — sits above every route so it covers both
          agency and client portal surfaces when the browser drops
          its connection. Auto-dismisses when `online` flips back. */}
      {!online && <OfflineScreen />}
    </Router>
  );
}

export default App;
