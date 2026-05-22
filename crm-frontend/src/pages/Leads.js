import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ThemeContext } from '../contexts/ThemeContext';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Snackbar,
  Button,
  Paper,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Refresh as RefreshIcon,
  Leaderboard as LeaderboardIcon,
  CalendarMonth as CalendarMonthIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { PageLoader } from '../components/Loading';
import api from '../api/axios';

const Leads = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.secondary || '#C08552';
  const secondaryColor = accentColor?.primary || '#3E2723';

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [selectedMonth, setSelectedMonth] = useState(null);
  // Free-text client filter — narrows visible rows by clientName.
  // Case-insensitive substring match.
  const [clientSearch, setClientSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState([]);
  const [clients, setClients] = useState([]);
  const [dates, setDates] = useState([]);
  const [pivotData, setPivotData] = useState({});

  // URL is the source of truth for the selected month. /leads → current
  // month; /leads?month=2026-02 → February; tab clicks update the URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawUrlMonth = searchParams.get('month');
  const monthFromUrl = rawUrlMonth && /^\d{4}-\d{2}$/.test(rawUrlMonth) ? rawUrlMonth : null;

  // The "active" month — today's YYYY-MM. When the user lands on
  // /leads with no `?month=` param, we default to this so the tab
  // for the current month is selected immediately instead of
  // whatever the backend's "latest" picks.
  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // displayMonth reflects the user's intent immediately (from URL) — used for
  // the active tab + loader label so the UI feels responsive while data loads.
  // Falls back to currentMonth so the highlighted tab matches before any
  // fetch resolves.
  const displayMonth = monthFromUrl || selectedMonth || currentMonth;

  const loadMonth = useCallback(async (month, force = false) => {
    setLoading(true);
    try {
      const params = {};
      if (month) params.month = month;
      if (force) params.refresh = 1;
      const res = await api.get('/leads/monthly-meta-by-client', { params });
      const data = res.data?.data || {};
      const respClients = Array.isArray(data.clients) ? data.clients : [];

      setMonths(Array.isArray(data.months) ? data.months : []);
      setDates(Array.isArray(data.dates) ? data.dates : []);
      setClients(respClients.map(c => ({ id: c.clientId, name: c.clientName })));

      const pivot = {};
      respClients.forEach(c => { pivot[c.clientId] = c.daily || {}; });
      setPivotData(pivot);

      if (data.month) setSelectedMonth(data.month);
    } catch (err) {
      console.error('Failed to fetch monthly meta leads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // URL → state: load whatever month the URL says, defaulting to
  // the current month when the URL is empty. Skips redundant fetch
  // when the URL already matches the rendered month.
  useEffect(() => {
    const target = monthFromUrl || currentMonth;
    if (target === selectedMonth) return;
    loadMonth(target);
  }, [monthFromUrl, currentMonth, selectedMonth, loadMonth]);

  // State → URL: when the URL is empty on first visit, pin it to the
  // current month so refresh/share carries the user's actual view.
  useEffect(() => {
    if (!rawUrlMonth) {
      setSearchParams({ month: currentMonth }, { replace: true });
    }
  }, [rawUrlMonth, currentMonth, setSearchParams]);

  const fetchLeads = () => loadMonth(selectedMonth, true);

  // Narrow the rendered client rows by the search box. Empty search
  // returns the full list. We don't refetch — just slice client-side
  // so typing feels instant.
  const visibleClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => String(c.name || '').toLowerCase().includes(q));
  }, [clients, clientSearch]);

  // Auto-scroll the month-tab strip so the active month is visible.
  // MUI's `variant="scrollable"` only enables scrolling — it doesn't
  // recenter the active tab. Without this, opening /leads with the
  // current month pinned could leave the highlighted tab off-screen
  // because new months render past the visible width.
  const monthTabsRef = useRef(null);
  useEffect(() => {
    if (!displayMonth) return;
    const root = monthTabsRef.current;
    if (!root) return;
    // Two-tick wait: first the tab strip has to paint with the new
    // month list, then the active tab DOM node has to exist for us
    // to centre it. requestAnimationFrame x2 is the cheapest safe wait.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const active = root.querySelector('button[aria-selected="true"]');
        if (active && typeof active.scrollIntoView === 'function') {
          // `inline: 'center'` keeps the active tab in the middle of
          // the visible strip — `'end'` pushed it under MUI's right
          // scroll-arrow button and clipped the label. Centre gives
          // breathing room on both sides and the underline indicator
          // is always fully visible.
          active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [displayMonth, months]);

  // Tab click: just push the new month into the URL. The URL→state effect
  // above handles the actual load, and pushes a history entry so back/forward
  // navigates between months.
  const handleMonthChange = (event, newValue) => {
    if (newValue && newValue !== selectedMonth) {
      setSearchParams({ month: newValue });
    }
  };

  const filteredDates = dates;

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  // Format month for tab display
  const formatMonth = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };

  // Export to PDF (exports current month's data)
  const handleExportPDF = () => {
    const printStyles = `
      <style>
        @media print {
          body { font-family: Arial, sans-serif; padding: 10px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: center; }
          th { background-color: ${primaryColor}; color: white; }
          .client-cell { text-align: left; font-weight: 600; background-color: #f9fafb; }
          .header { text-align: center; margin-bottom: 15px; }
          .header h1 { color: #333; margin-bottom: 5px; font-size: 18px; }
          @page { size: landscape; margin: 5mm; }
        }
      </style>
    `;

    const printHTML = `
      ${printStyles}
      <div class="header">
        <h1>Total Leads (Meta) - ${formatMonth(selectedMonth)}</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Client</th>
            ${filteredDates.map(date => `<th>${formatDate(date)}</th>`).join('')}
            <th style="background-color: #059669;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${clients.map(client => {
            const rowTotal = filteredDates.reduce((sum, date) => sum + (pivotData[client.id]?.[date] || 0), 0);
            return `
            <tr>
              <td class="client-cell">${client.name}</td>
              ${filteredDates.map(date => `<td>${pivotData[client.id]?.[date] || '-'}</td>`).join('')}
              <td style="font-weight: bold; background-color: #ecfdf5;">${rowTotal > 0 ? rowTotal : '-'}</td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Total Leads (Meta) - ${formatMonth(selectedMonth)}</title></head>
        <body>${printHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Export to Excel (CSV) - exports current month's data
  const handleExportExcel = () => {
    const headers = ['Client', ...filteredDates.map(formatDate), 'Total'];

    const rows = clients.map(client => {
      const dailyValues = filteredDates.map(date => pivotData[client.id]?.[date] || 0);
      const rowTotal = dailyValues.reduce((sum, val) => sum + val, 0);
      return [client.name, ...dailyValues, rowTotal];
    });

    const csvContent = [
      `Total Leads (Meta) - ${formatMonth(selectedMonth)}`,
      `Generated on: ${new Date().toLocaleString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `total_leads_report_${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSnackbar({ open: true, message: 'Excel file downloaded successfully!', severity: 'success' });
  };

  // Show loader during initial fetch
  if (loading && clients.length === 0) {
    return <PageLoader message="Loading leads..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <LeaderboardIcon sx={{ fontSize: 22, color: primaryColor }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Total Leads <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>(Meta)</Box>
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            View all clients total leads across all dates
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search clients — narrows the table rows by client name.
              Clears in one click via the trailing X icon. */}
          <TextField
            size="small"
            placeholder="Search clients…"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.85rem', bgcolor: 'background.paper' } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: clientSearch ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setClientSearch('')} edge="end">
                      <ClearIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
          />
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={fetchLeads}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<PdfIcon />}
            onClick={handleExportPDF}
            disabled={clients.length === 0}
            sx={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              fontWeight: 600,
              '&:hover': {
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              },
            }}
          >
            Export PDF
          </Button>
          <Button
            variant="contained"
            startIcon={<ExcelIcon />}
            onClick={handleExportExcel}
            disabled={clients.length === 0}
            sx={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              fontWeight: 600,
              '&:hover': {
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              },
            }}
          >
            Export Excel
          </Button>
        </Box>
      </Box>

      {/* Excel-like Table with Month Tabs */}
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {/* Month Tabs - Excel Style at Bottom */}
        {months.length > 0 && (
          <Box
            ref={monthTabsRef}
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc',
            }}
          >
            <Tabs
              value={displayMonth}
              onChange={handleMonthChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 40,
                '& .MuiTabs-indicator': {
                  bgcolor: primaryColor,
                  height: 3,
                },
                // Hide a scroll arrow entirely when it can't scroll
                // any further. MUI tags the disabled scroll button
                // with both `Mui-disabled` and an `aria-disabled`
                // attribute — we target both with `!important` so the
                // arrow truly vanishes (the previous rule was being
                // overridden by MUI's own disabled-state styling on
                // this version, leaving a faint greyed-out arrow).
                '& .MuiTabScrollButton-root.Mui-disabled, & .MuiTabs-scrollButtons.Mui-disabled, & .MuiTabScrollButton-root[aria-disabled="true"], & .MuiTabs-scrollButtons[aria-disabled="true"]': {
                  display: 'none !important',
                  width: '0 !important',
                  minWidth: '0 !important',
                  opacity: '0 !important',
                  visibility: 'hidden !important',
                  pointerEvents: 'none !important',
                },
                '& .MuiTab-root': {
                  minHeight: 40,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: '#64748b',
                  '&.Mui-selected': {
                    color: primaryColor,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'white',
                  },
                  '&:hover': {
                    bgcolor: `${primaryColor}14`,
                  },
                },
              }}
            >
              {months.map((month) => (
                <Tab
                  key={month}
                  value={month}
                  icon={<CalendarMonthIcon sx={{ fontSize: 16 }} />}
                  iconPosition="start"
                  label={formatMonth(month)}
                />
              ))}
            </Tabs>
          </Box>
        )}

        <CardContent sx={{ p: 0, position: 'relative' }}>
          {/* Loading overlay — keeps the existing table visible but fades it
              and shows a centered spinner so the user knows new data is on the way. */}
          {loading && clients.length > 0 && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                bgcolor: (theme) => theme.palette.mode === 'dark'
                  ? 'rgba(0,0,0,0.55)'
                  : 'rgba(255,255,255,0.75)',
                backdropFilter: 'blur(2px)',
              }}
            >
              <CircularProgress size={36} sx={{ color: primaryColor }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Loading {displayMonth ? formatMonth(displayMonth) : 'leads'}…
              </Typography>
            </Box>
          )}

          {clients.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              {loading ? (
                <>
                  <CircularProgress size={32} sx={{ color: primaryColor, mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Loading leads…
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="h6" color="text.secondary">
                    No leads data found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Click "Refresh" to fetch leads from Main API
                  </Typography>
                </>
              )}
            </Box>
          ) : filteredDates.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Typography variant="h6" color="text.secondary">
                No data for {displayMonth ? formatMonth(displayMonth) : 'selected month'}
              </Typography>
            </Box>
          ) : (
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                maxHeight: 'calc(100vh - 220px)',
                overflowX: 'auto',
                opacity: loading ? 0.5 : 1,
                transition: 'opacity 150ms ease',
                // Always-visible thin grey scrollbar — the table runs
                // wider than the viewport when many dates are loaded,
                // and the default macOS/some Windows scrollbars are
                // invisible until you start scrolling, so users miss
                // that there's more data off-screen.
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 transparent',
                '&::-webkit-scrollbar': { height: 10, width: 10 },
                '&::-webkit-scrollbar-track': {
                  bgcolor: '#f1f5f9',
                  borderRadius: 5,
                },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: '#cbd5e1',
                  borderRadius: 5,
                  border: '2px solid #f1f5f9',
                  '&:hover': { bgcolor: '#94a3b8' },
                },
                '&::-webkit-scrollbar-corner': { bgcolor: 'transparent' },
              }}
            >
              <Table stickyHeader size="small" sx={{ minWidth: filteredDates.length * 70 + 270 }}>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        background: `${primaryColor} !important`,
                        color: 'white !important',
                        position: 'sticky',
                        left: 0,
                        zIndex: 3,
                        minWidth: 180,
                        borderRight: `2px solid ${secondaryColor}`,
                      }}
                    >
                      Client
                    </TableCell>
                    {filteredDates.map((date) => (
                      <TableCell
                        key={date}
                        align="center"
                        sx={{
                          fontWeight: 600,
                          background: `${primaryColor} !important`,
                          color: 'white !important',
                          minWidth: 60,
                          fontSize: '0.75rem',
                          py: 1,
                          borderRight: `1px solid ${secondaryColor}`,
                        }}
                      >
                        {formatDate(date)}
                      </TableCell>
                    ))}
                    <TableCell
                      align="center"
                      sx={{
                        fontWeight: 700,
                        background: '#059669 !important',
                        color: 'white !important',
                        minWidth: 70,
                        fontSize: '0.8rem',
                        py: 1,
                        position: 'sticky',
                        right: 0,
                        zIndex: 3,
                      }}
                    >
                      Total
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleClients.length === 0 && clients.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={filteredDates.length + 2} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        No clients match "<strong>{clientSearch}</strong>"
                      </TableCell>
                    </TableRow>
                  )}
                  {visibleClients.map((client, rowIndex) => (
                    <TableRow
                      key={client.id}
                      sx={{
                        '&:nth-of-type(odd)': { bgcolor: `${primaryColor}05` },
                        '&:hover': { bgcolor: `${primaryColor}14` },
                      }}
                    >
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          position: 'sticky',
                          left: 0,
                          bgcolor: rowIndex % 2 === 0 ? '#f8fafc' : '#f1f5f9',
                          zIndex: 1,
                          borderRight: '2px solid #e2e8f0',
                        }}
                      >
                        {client.name}
                      </TableCell>
                      {filteredDates.map((date) => {
                        const value = pivotData[client.id]?.[date] || 0;
                        return (
                          <TableCell
                            key={date}
                            align="center"
                            sx={{
                              fontWeight: value > 0 ? 600 : 400,
                              color: value > 0 ? '#1e293b' : '#94a3b8',
                              fontSize: '0.85rem',
                              borderRight: '1px solid #f1f5f9',
                              bgcolor: value > 10 ? 'rgba(16, 185, 129, 0.1)' : value > 5 ? `${primaryColor}14` : 'inherit',
                            }}
                          >
                            {value > 0 ? value : '-'}
                          </TableCell>
                        );
                      })}
                      {(() => {
                        const rowTotal = filteredDates.reduce((sum, date) => sum + (pivotData[client.id]?.[date] || 0), 0);
                        return (
                          <TableCell
                            align="center"
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              color: '#059669',
                              bgcolor: rowIndex % 2 === 0 ? '#ecfdf5' : '#d1fae5',
                              position: 'sticky',
                              right: 0,
                              zIndex: 1,
                              borderLeft: '2px solid #e2e8f0',
                            }}
                          >
                            {rowTotal > 0 ? rowTotal : '-'}
                          </TableCell>
                        );
                      })()}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Leads;
