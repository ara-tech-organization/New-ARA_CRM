import React, { useState, useMemo, useEffect, useContext } from 'react';
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
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Refresh as RefreshIcon,
  Leaderboard as LeaderboardIcon,
  CalendarMonth as CalendarMonthIcon,
} from '@mui/icons-material';
import { PageLoader } from '../components/Loading';
import { useDataCache } from '../contexts/DataCacheContext';

const Leads = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.secondary || '#C08552';
  const secondaryColor = accentColor?.primary || '#3E2723';

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [selectedMonth, setSelectedMonth] = useState(null);
  const { leads, leadsLoading: loading, fetchLeads: refreshLeads } = useDataCache();

  const fetchLeads = () => refreshLeads(true);

  // Get unique clients, dates, and months for the pivot table
  const { clients, dates, pivotData, months } = useMemo(() => {
    // Get unique clients (filter out null/undefined clientIds and unknown names)
    const clientMap = new Map();
    leads.forEach(lead => {
      if (lead.clientId && lead.clientName && !clientMap.has(lead.clientId)) {
        clientMap.set(lead.clientId, lead.clientName);
      }
    });
    const clientList = Array.from(clientMap.entries())
      .map(([id, name]) => ({ id, name }))
      .filter(client => client.name && client.name.toLowerCase() !== 'unknown' && client.name.toLowerCase() !== 'unknown client')
      .sort((a, b) => a.name.localeCompare(b.name));

    // Get unique dates and sort them
    const dateSet = new Set();
    leads.forEach(lead => {
      if (lead.date) {
        const dateStr = lead.date.split('T')[0];
        dateSet.add(dateStr);
      }
    });
    const dateList = Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b));

    // Get unique months from dates
    const monthSet = new Set();
    dateList.forEach(dateStr => {
      const date = new Date(dateStr);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthSet.add(monthKey);
    });
    const monthList = Array.from(monthSet).sort();

    // Build pivot data: { clientId: { date: totalLeads } }
    const pivot = {};
    leads.forEach(lead => {
      const clientId = lead.clientId;
      const dateStr = lead.date ? lead.date.split('T')[0] : null;
      if (!dateStr) return;

      if (!pivot[clientId]) {
        pivot[clientId] = {};
      }

      const totalLeads =
        (lead.metaFormLead || 0) +
        (lead.metaWhatsappLead || 0) +
        (lead.googleCallLead || 0) +
        (lead.googleWebsiteLead || 0);

      pivot[clientId][dateStr] = (pivot[clientId][dateStr] || 0) + totalLeads;
    });

    return {
      clients: clientList,
      dates: dateList,
      pivotData: pivot,
      months: monthList,
    };
  }, [leads]);

  // Set default selected month when months are available
  useEffect(() => {
    if (months.length > 0 && selectedMonth === null) {
      // Select the most recent month by default
      setSelectedMonth(months[months.length - 1]);
    }
  }, [months, selectedMonth]);

  // Filter dates by selected month
  const filteredDates = useMemo(() => {
    if (!selectedMonth) return dates;
    return dates.filter(dateStr => {
      const date = new Date(dateStr);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return monthKey === selectedMonth;
    });
  }, [dates, selectedMonth]);

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

  // Handle month tab change
  const handleMonthChange = (event, newValue) => {
    setSelectedMonth(newValue);
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
        <h1>Total Leads Report - ${formatMonth(selectedMonth)}</h1>
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
        <head><title>Total Leads Report - ${formatMonth(selectedMonth)}</title></head>
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
      `Total Leads Report - ${formatMonth(selectedMonth)}`,
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
  if (loading && leads.length === 0) {
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
              Total Leads
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            View all clients total leads across all dates
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc',
            }}
          >
            <Tabs
              value={selectedMonth}
              onChange={handleMonthChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 40,
                '& .MuiTabs-indicator': {
                  bgcolor: primaryColor,
                  height: 3,
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

        <CardContent sx={{ p: 0 }}>
          {clients.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Typography variant="h6" color="text.secondary">
                No leads data found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Click "Refresh" to fetch leads from Main API
              </Typography>
            </Box>
          ) : filteredDates.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Typography variant="h6" color="text.secondary">
                No data for {selectedMonth ? formatMonth(selectedMonth) : 'selected month'}
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 'calc(100vh - 220px)', overflowX: 'auto' }}>
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
                  {clients.map((client, rowIndex) => (
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
