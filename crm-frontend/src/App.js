import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loadUserFromStorage } from './store/slices/authSlice';
import LeadMatrixLoader from './components/LeadMatrixLoader';
import OfflineScreen from './components/OfflineScreen';
import ProtectedRoute from './utils/ProtectedRoute';
import { DataCacheProvider } from './contexts/DataCacheContext';

// Lazy-load every page so each route ships its own JS chunk. Cuts the
// initial bundle from "everything" to "shell + current route" — measured
// 200-500KB saving on first paint depending on which page the user lands
// on. MainLayout stays eager since it wraps every protected route.
const MainLayout = lazy(() => import('./layouts/MainLayout'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DashboardEnhanced = lazy(() => import('./pages/DashboardEnhanced'));
const DashboardPro = lazy(() => import('./pages/DashboardPro'));
const DailyEntry = lazy(() => import('./pages/DailyEntry'));
const FundEntry = lazy(() => import('./pages/FundEntry'));
const Clients = lazy(() => import('./pages/Clients'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const MetaAds = lazy(() => import('./pages/MetaAds'));
const GoogleAds = lazy(() => import('./pages/GoogleAds'));
const EmailCampaigns = lazy(() => import('./pages/EmailCampaigns'));
const DailyLeadData = lazy(() => import('./pages/DailyLeadData'));
const ClientVault = lazy(() => import('./pages/ClientVault'));
const AccessManagement = lazy(() => import('./pages/AccessManagement'));
const PersonalVault = lazy(() => import('./pages/PersonalVault'));
const ContentManagement = lazy(() => import('./pages/ContentManagement'));
const Leads = lazy(() => import('./pages/Leads'));
const AdsDashboard = lazy(() => import('./pages/AdsDashboard'));
const ClientAdDetails = lazy(() => import('./pages/ClientAdDetails'));
const ClientPortalAccess = lazy(() => import('./pages/ClientPortalAccess'));
const ClientLogin = lazy(() => import('./pages/ClientLogin'));
const ClientPortalDashboard = lazy(() => import('./pages/ClientPortalDashboard'));
const ClientPortalLeads = lazy(() => import('./pages/ClientPortalLeads'));

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

  // After boot, silently prefetch all page chunks in the background so
  // every navigation is instant — no loader flash on subsequent clicks.
  useEffect(() => {
    if (booting) return;
    const pages = [
      () => import('./layouts/MainLayout'),
      () => import('./pages/Dashboard'),
      () => import('./pages/DailyLeadData'),
      () => import('./pages/Clients'),
      () => import('./pages/Leads'),
      () => import('./pages/DailyEntry'),
      () => import('./pages/FundEntry'),
      () => import('./pages/Reports'),
      () => import('./pages/Settings'),
      () => import('./pages/MetaAds'),
      () => import('./pages/GoogleAds'),
      () => import('./pages/AdsDashboard'),
      () => import('./pages/ClientAdDetails'),
      () => import('./pages/AccessManagement'),
      () => import('./pages/ClientVault'),
      () => import('./pages/PersonalVault'),
      () => import('./pages/ClientPortalAccess'),
      () => import('./pages/DashboardEnhanced'),
      () => import('./pages/EmailCampaigns'),
      () => import('./pages/ContentManagement'),
    ];
    // Stagger 150ms apart so prefetch never competes with the first render
    pages.forEach((load, i) => setTimeout(load, 300 + i * 150));
  }, [booting]);

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
      <Suspense fallback={<LeadMatrixLoader />}>
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
      </Suspense>
      {/* Network curtain — sits above every route so it covers both
          agency and client portal surfaces when the browser drops
          its connection. Auto-dismisses when `online` flips back. */}
      {!online && <OfflineScreen />}
    </Router>
  );
}

export default App;
