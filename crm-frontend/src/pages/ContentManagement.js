import React, { useState, useEffect, useMemo, useContext, useCallback, useRef } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  CircularProgress,
  Tabs,
  Tab,
  Tooltip,
  InputAdornment,
  Menu,
  ListItemText,
  ListItemIcon,
  Divider,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ChevronLeft,
  ChevronRight,
  Today as TodayIcon,
  ViewList as ViewListIcon,
  CalendarMonth as CalendarMonthIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  CalendarToday as CalendarTodayIcon,
  Check as CheckIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import html2canvas from 'html2canvas';
import contentEntryApi from '../api/contentEntryApi';
import api from '../api/axios';
import userApi from '../api/userApi';

const statusColors = {
  Planned: '#6366F1',
  Scheduled: '#F59E0B',
  Published: '#10B981',
  Missed: '#EF4444',
};

const contentTypeColors = {
  Reel: '#EC4899',
  Static: '#0EA5E9',
  Carousel: '#8B5CF6',
};

// Light pastel colors for calendar view based on content type
const calendarPastelColors = {
  Reel: { bg: '#FFF9C4', border: '#F9A825', text: '#7B6B00' },
  Static: { bg: '#E1F5FE', border: '#4FC3F7', text: '#01579B' },
  Carousel: { bg: '#F3E5F5', border: '#CE93D8', text: '#6A1B9A' },
};

const platformColors = {
  Instagram: '#E4405F',
  Facebook: '#1877F2',
  YouTube: '#FF0000',
};

const approvalColors = {
  Pending: '#F59E0B',
  Approved: '#10B981',
  Rejected: '#EF4444',
  'Revisions Needed': '#8B5CF6',
};

const CONTENT_TYPES = ['Reel', 'Static', 'Carousel'];
const PLATFORMS = ['Instagram', 'Facebook', 'YouTube'];
const STATUSES = ['Planned', 'Scheduled', 'Published', 'Missed'];
const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected', 'Revisions Needed'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  clientName: '',
  contentType: '',
  postTitle: '',
  platform: '',
  description: '',
  referenceVideo: '',
  status: 'Planned',
  assignedSME: '',
  approvalStatus: '',
  remarks: '',
};

const ContentManagement = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.secondary || '#1F3966';
  const secondaryColor = accentColor?.primary || '#0F172A';

  const [entries, setEntries] = useState([]);
  const [clients, setClients] = useState([]);
  const [smmUsers, setSmmUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [filterClient, setFilterClient] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSME, setFilterSME] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Menu anchors for Notion-like filter dropdowns
  const [clientMenuAnchor, setClientMenuAnchor] = useState(null);
  const [teamMenuAnchor, setTeamMenuAnchor] = useState(null);
  const [smeMenuAnchor, setSmeMenuAnchor] = useState(null);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [datePickerAnchor, setDatePickerAnchor] = useState(null);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());

  // Inline add / edit row
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [editingRowId, setEditingRowId] = useState(null);
  const [inlineFormData, setInlineFormData] = useState({ ...emptyForm });
  const [inlineSaving, setInlineSaving] = useState(false);

  // Compact input style for inline row
  const inlineCellSx = {
    '& .MuiOutlinedInput-root': { fontSize: '0.8rem', height: 32 },
    '& .MuiSelect-select': { fontSize: '0.8rem', py: '4px' },
  };

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarClient, setCalendarClient] = useState('');
  const [isDownloadingCalendar, setIsDownloadingCalendar] = useState(false);
  const calendarRef = useRef(null);

  // Download calendar as image (hide status during capture)
  const handleDownloadCalendar = async () => {
    if (!calendarRef.current) return;
    try {
      setIsDownloadingCalendar(true);
      // Wait for React to re-render (hide status text)
      await new Promise((resolve) => setTimeout(resolve, 150));
      const canvas = await html2canvas(calendarRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const clientLabel = calendarClient ? `${calendarClient}-` : '';
      const link = document.createElement('a');
      link.download = `Content-Calendar-${clientLabel}${format(calendarDate, 'MMMM-yyyy')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showSnackbar('Calendar downloaded successfully');
    } catch (error) {
      console.error('Error downloading calendar:', error);
      showSnackbar('Failed to download calendar', 'error');
    } finally {
      setIsDownloadingCalendar(false);
    }
  };

  // Download table data as Excel
  const handleDownloadExcel = () => {
    if (filteredEntries.length === 0) {
      showSnackbar('No entries to download', 'error');
      return;
    }
    const rows = filteredEntries.map((e) => ({
      'Posting Date': e.date ? new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
      'Client': e.clientName || '',
      'Content Type': e.contentType || '',
      'Post Title': e.postTitle || '',
      'Platform': e.platform || '',
      'Assigned SME': e.assignedSME || '',
      'Description': e.description || '',
      'Reference': e.referenceVideo || '',
      'Status': e.status || '',
      'Approval Status': e.approvalStatus || '',
      'Remarks': e.remarks || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-size columns
    const colWidths = Object.keys(rows[0]).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String(r[key] || '').length)).toString().length > 40 ? 40 : Math.max(key.length + 2, ...rows.map((r) => String(r[key] || '').length)),
    }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    const label = filterClient || filterTeam || 'All';
    XLSX.utils.book_append_sheet(wb, ws, 'Content Entries');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `Content-Entries-${label}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    showSnackbar('Excel downloaded successfully');
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Fetch clients for dropdown (store full objects for SME lookup)
  const fetchClients = useCallback(async () => {
    try {
      const response = await api.get('/clients', { params: { limit: 1000 } });
      const data = response.data?.data || response.data || [];
      setClients(data.filter((c) => c.status === 'active'));
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  }, []);

  // Fetch SMM users for Assigned SME dropdown
  const fetchSMMUsers = useCallback(async () => {
    try {
      const response = await contentEntryApi.getSMMUsers();
      setSmmUsers(response.data || []);
    } catch (error) {
      console.error('Error fetching SMM users:', error);
    }
  }, []);

  // Fetch teams from DB
  const fetchTeams = useCallback(async () => {
    try {
      const response = await userApi.getTeams();
      setTeams(response.data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  }, []);

  // Fetch content entries
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 1000 };
      if (filterClient) params.clientName = filterClient;
      if (filterStatus) params.status = filterStatus;
      if (filterSME) params.assignedSME = filterSME;
      if (filterDate) {
        params.dateFrom = filterDate;
        params.dateTo = filterDate;
      }
      const response = await contentEntryApi.getContentEntries(params);
      setEntries(response.data || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
      showSnackbar('Failed to fetch entries', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterClient, filterStatus, filterSME, filterDate]);

  useEffect(() => {
    fetchClients();
    fetchSMMUsers();
    fetchTeams();
  }, [fetchClients, fetchSMMUsers, fetchTeams]);

  // Clients filtered by team
  const teamClients = useMemo(() => {
    if (!filterTeam) return clients;
    return clients.filter((c) => c.team === filterTeam);
  }, [clients, filterTeam]);

  // SME users filtered by team
  const teamSmeUsers = useMemo(() => {
    if (!filterTeam) return smmUsers;
    return smmUsers.filter((u) => u.team === filterTeam);
  }, [smmUsers, filterTeam]);

  // Sync calendar client with table filter client
  // If table is "All Clients", calendar defaults to first client
  useEffect(() => {
    if (filterClient) {
      setCalendarClient(filterClient);
    } else if (teamClients.length > 0) {
      setCalendarClient(teamClients[0].clientName);
    }
  }, [filterClient, teamClients]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Group entries by date for calendar
  // When filterClient is set, API already returns only that client's entries
  // Only apply calendarClient filter when entries contain multiple clients (filterClient is empty)
  const entriesByDate = useMemo(() => {
    const grouped = {};
    const filtered = (!filterClient && calendarClient)
      ? entries.filter((e) => e.clientName === calendarClient)
      : entries;
    filtered.forEach((entry) => {
      const dateKey = new Date(entry.date).toISOString().split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(entry);
    });
    return grouped;
  }, [entries, calendarClient, filterClient]);

  // Filter entries for table view (team + search)
  const filteredEntries = useMemo(() => {
    let result = entries;
    // Filter by team — match entries whose client OR assignedSME belongs to the selected team
    if (filterTeam) {
      const teamClientNames = new Set(teamClients.map((c) => c.clientName));
      const teamSmeNames = new Set(teamSmeUsers.map((u) => u.name));
      result = result.filter((e) => teamClientNames.has(e.clientName) && (!e.assignedSME || teamSmeNames.has(e.assignedSME)));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.postTitle?.toLowerCase().includes(q) ||
          e.clientName?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, searchQuery, filterTeam, teamClients]);

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarDate);
    const monthEnd = endOfMonth(calendarDate);
    const start = startOfWeek(monthStart);
    const end = endOfWeek(monthEnd);

    const days = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [calendarDate]);

  // Dialog handlers
  const handleOpenDialog = (entry = null, prefilledDate = null) => {
    if (isAddingInline) handleInlineCancel();
    if (editingRowId) setEditingRowId(null);
    if (entry) {
      // Calendar entry click → open inline edit in table view, or dialog for calendar view
      setEditingEntry(entry);
      setFormData({
        date: new Date(entry.date).toISOString().split('T')[0],
        clientName: entry.clientName || '',
        contentType: entry.contentType || '',
        postTitle: entry.postTitle || '',
        platform: entry.platform || '',
        description: entry.description || '',
        referenceVideo: entry.referenceVideo || '',
        status: entry.status || 'Planned',
        assignedSME: entry.assignedSME || '',
        approvalStatus: entry.approvalStatus || '',
        remarks: entry.remarks || '',
      });
    } else {
      setEditingEntry(null);
      setFormData({
        ...emptyForm,
        date: prefilledDate || new Date().toISOString().split('T')[0],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEntry(null);
    setFormData(emptyForm);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (name === 'clientName') {
      // Auto-fill Assigned SME from client's assigned SME
      const client = clients.find((c) => c.clientName === value);
      setFormData((prev) => ({
        ...prev,
        clientName: value,
        assignedSME: client?.assignedSME || prev.assignedSME,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.date || !formData.clientName || !formData.contentType || !formData.postTitle || !formData.platform) {
      showSnackbar('Please fill in all required fields', 'error');
      return;
    }

    setActionLoading(true);
    try {
      if (editingEntry) {
        const response = await contentEntryApi.updateContentEntry(editingEntry._id, formData);
        setEntries((prev) => prev.map((e) => (e._id === editingEntry._id ? response.data : e)));
        showSnackbar('Entry updated successfully');
      } else {
        const response = await contentEntryApi.createContentEntry(formData);
        setEntries((prev) => [response.data, ...prev]);
        showSnackbar('Entry created successfully');
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving entry:', error);
      showSnackbar(error.response?.data?.message || 'Failed to save entry', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Inline row handlers
  const handleInlineAdd = () => {
    if (editingRowId) setEditingRowId(null);
    setIsAddingInline(true);
    setInlineFormData({ ...emptyForm });
  };

  const handleInlineCancel = () => {
    setIsAddingInline(false);
    setEditingRowId(null);
    setInlineFormData({ ...emptyForm });
  };

  const handleInlineFormChange = (e) => {
    const { name, value } = e.target;
    if (name === 'clientName') {
      const client = clients.find((c) => c.clientName === value);
      setInlineFormData((prev) => ({
        ...prev,
        clientName: value,
        assignedSME: client?.assignedSME || prev.assignedSME,
      }));
    } else {
      setInlineFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleInlineSave = async () => {
    if (!inlineFormData.date || !inlineFormData.clientName || !inlineFormData.contentType || !inlineFormData.postTitle || !inlineFormData.platform) {
      showSnackbar('Please fill required fields: Date, Client, Type, Title, Platform', 'error');
      return;
    }
    setInlineSaving(true);
    try {
      const response = await contentEntryApi.createContentEntry(inlineFormData);
      setEntries((prev) => [...prev, response.data]);
      showSnackbar('Entry created successfully');
      handleInlineCancel();
    } catch (error) {
      console.error('Error saving inline entry:', error);
      showSnackbar(error.response?.data?.message || 'Failed to save entry', 'error');
    } finally {
      setInlineSaving(false);
    }
  };

  // Start inline edit on an existing row
  const handleInlineEdit = (entry) => {
    if (isAddingInline) handleInlineCancel();
    setEditingRowId(entry._id);
    setInlineFormData({
      date: new Date(entry.date).toISOString().split('T')[0],
      clientName: entry.clientName || '',
      contentType: entry.contentType || '',
      postTitle: entry.postTitle || '',
      platform: entry.platform || '',
      description: entry.description || '',
      referenceVideo: entry.referenceVideo || '',
      status: entry.status || 'Planned',
      assignedSME: entry.assignedSME || '',
      approvalStatus: entry.approvalStatus || '',
      remarks: entry.remarks || '',
    });
  };

  // Save inline edit (update existing entry)
  const handleInlineUpdate = async () => {
    if (!inlineFormData.date || !inlineFormData.clientName || !inlineFormData.contentType || !inlineFormData.postTitle || !inlineFormData.platform) {
      showSnackbar('Please fill required fields: Date, Client, Type, Title, Platform', 'error');
      return;
    }
    setInlineSaving(true);
    try {
      const response = await contentEntryApi.updateContentEntry(editingRowId, inlineFormData);
      setEntries((prev) => prev.map((e) => (e._id === editingRowId ? response.data : e)));
      showSnackbar('Entry updated successfully');
      handleInlineCancel();
    } catch (error) {
      console.error('Error updating entry:', error);
      showSnackbar(error.response?.data?.message || 'Failed to update entry', 'error');
    } finally {
      setInlineSaving(false);
    }
  };

  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter') {
      editingRowId ? handleInlineUpdate() : handleInlineSave();
    } else if (e.key === 'Escape') {
      handleInlineCancel();
    }
  };

  const handleDeleteClick = (entry) => {
    setEntryToDelete(entry);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;
    setActionLoading(true);
    try {
      await contentEntryApi.deleteContentEntry(entryToDelete._id);
      setEntries((prev) => prev.filter((e) => e._id !== entryToDelete._id));
      showSnackbar('Entry deleted successfully');
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    } catch (error) {
      console.error('Error deleting entry:', error);
      showSnackbar('Failed to delete entry', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Stats
  const totalEntries = entries.length;
  const publishedCount = entries.filter((e) => e.status === 'Published').length;
  const plannedCount = entries.filter((e) => e.status === 'Planned').length;
  const missedCount = entries.filter((e) => e.status === 'Missed').length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Content Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Plan and track social media content across clients and platforms
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Total Entries', value: totalEntries, color: primaryColor },
          { label: 'Published', value: publishedCount, color: '#10B981' },
          { label: 'Planned', value: plannedCount, color: '#6366F1' },
          { label: 'Missed', value: missedCount, color: '#EF4444' },
        ].map((stat) => (
          <Grid size={{ xs: 6, md: 3 }} key={stat.label}>
            <Card>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="body2" color="text.secondary">
                  {stat.label}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: stat.color }}>
                  {stat.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
          }}
        >
          <Tab icon={<ViewListIcon />} iconPosition="start" label="Table View" />
          <Tab icon={<CalendarMonthIcon />} iconPosition="start" label="Calendar View" />
        </Tabs>
      </Box>

      {/* Tab 0: Table View */}
      {activeTab === 0 && (
        <Box>
          {/* Notion-like Filters */}
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {/* Search */}
            <TextField
              size="small"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{
                minWidth: 220,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  height: 36,
                  fontSize: '0.85rem',
                },
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.25, height: 28, alignSelf: 'center' }} />

            {/* Team Filter Chip */}
            <Chip
              icon={<GroupsIcon sx={{ fontSize: 16 }} />}
              label={filterTeam ? filterTeam.replace('SMM ', '') : 'Team'}
              size="small"
              variant={filterTeam ? 'filled' : 'outlined'}
              onClick={(e) => setTeamMenuAnchor(e.currentTarget)}
              onDelete={filterTeam ? () => { setFilterTeam(''); } : undefined}
              deleteIcon={filterTeam ? <CloseIcon sx={{ fontSize: 14 }} /> : undefined}
              sx={{
                borderRadius: 2,
                fontWeight: 500,
                fontSize: '0.82rem',
                height: 34,
                px: 0.5,
                bgcolor: filterTeam ? `${primaryColor}12` : 'transparent',
                borderColor: filterTeam ? primaryColor : 'divider',
                color: filterTeam ? primaryColor : 'text.secondary',
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: `${primaryColor}18`, borderColor: primaryColor },
              }}
            />

            {/* Client Filter Chip */}
            <Chip
              icon={<BusinessIcon sx={{ fontSize: 16 }} />}
              label={filterClient || 'Client'}
              size="small"
              variant={filterClient ? 'filled' : 'outlined'}
              onClick={(e) => setClientMenuAnchor(e.currentTarget)}
              onDelete={filterClient ? () => setFilterClient('') : undefined}
              deleteIcon={filterClient ? <CloseIcon sx={{ fontSize: 14 }} /> : undefined}
              sx={{
                borderRadius: 2,
                fontWeight: 500,
                fontSize: '0.82rem',
                height: 34,
                px: 0.5,
                bgcolor: filterClient ? `${primaryColor}12` : 'transparent',
                borderColor: filterClient ? primaryColor : 'divider',
                color: filterClient ? primaryColor : 'text.secondary',
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: `${primaryColor}18`, borderColor: primaryColor },
              }}
            />

            {/* SME Filter Chip */}
            <Chip
              icon={<PersonIcon sx={{ fontSize: 16 }} />}
              label={filterSME || 'SME'}
              size="small"
              variant={filterSME ? 'filled' : 'outlined'}
              onClick={(e) => setSmeMenuAnchor(e.currentTarget)}
              onDelete={filterSME ? () => setFilterSME('') : undefined}
              deleteIcon={filterSME ? <CloseIcon sx={{ fontSize: 14 }} /> : undefined}
              sx={{
                borderRadius: 2,
                fontWeight: 500,
                fontSize: '0.82rem',
                height: 34,
                px: 0.5,
                bgcolor: filterSME ? `${primaryColor}12` : 'transparent',
                borderColor: filterSME ? primaryColor : 'divider',
                color: filterSME ? primaryColor : 'text.secondary',
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: `${primaryColor}18`, borderColor: primaryColor },
              }}
            />

            {/* Date Filter Chip — opens Notion-style calendar popover */}
            <Chip
              icon={<CalendarTodayIcon sx={{ fontSize: 16 }} />}
              label={filterDate ? format(parseISO(filterDate), 'dd MMM yyyy') : 'Date'}
              size="small"
              variant={filterDate ? 'filled' : 'outlined'}
              onClick={(e) => {
                setDatePickerMonth(filterDate ? parseISO(filterDate) : new Date());
                setDatePickerAnchor(e.currentTarget);
              }}
              onDelete={filterDate ? () => setFilterDate('') : undefined}
              deleteIcon={filterDate ? <CloseIcon sx={{ fontSize: 14 }} /> : undefined}
              sx={{
                borderRadius: 2,
                fontWeight: 500,
                fontSize: '0.82rem',
                height: 34,
                px: 0.5,
                bgcolor: filterDate ? `${primaryColor}12` : 'transparent',
                borderColor: filterDate ? primaryColor : 'divider',
                color: filterDate ? primaryColor : 'text.secondary',
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: `${primaryColor}18`, borderColor: primaryColor },
              }}
            />

            {/* Status Filter Chip */}
            <Chip
              icon={<FilterListIcon sx={{ fontSize: 16 }} />}
              label={filterStatus || 'Status'}
              size="small"
              variant={filterStatus ? 'filled' : 'outlined'}
              onClick={(e) => setStatusMenuAnchor(e.currentTarget)}
              onDelete={filterStatus ? () => setFilterStatus('') : undefined}
              deleteIcon={filterStatus ? <CloseIcon sx={{ fontSize: 14 }} /> : undefined}
              sx={{
                borderRadius: 2,
                fontWeight: 500,
                fontSize: '0.82rem',
                height: 34,
                px: 0.5,
                bgcolor: filterStatus ? (statusColors[filterStatus] || primaryColor) + '12' : 'transparent',
                borderColor: filterStatus ? statusColors[filterStatus] || primaryColor : 'divider',
                color: filterStatus ? statusColors[filterStatus] || primaryColor : 'text.secondary',
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: `${primaryColor}18`, borderColor: primaryColor },
              }}
            />

            {/* Clear All */}
            {(filterClient || filterTeam || filterSME || filterDate || filterStatus || searchQuery) && (
              <Chip
                label="Clear all"
                size="small"
                variant="outlined"
                onClick={() => {
                  setFilterClient('');
                  setFilterTeam('');
                  setFilterSME('');
                  setFilterDate('');
                  setFilterStatus('');
                  setSearchQuery('');
                }}
                sx={{
                  borderRadius: 2,
                  fontWeight: 500,
                  fontSize: '0.78rem',
                  height: 34,
                  borderColor: '#EF4444',
                  color: '#EF4444',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: '#EF444410' },
                }}
              />
            )}

            <Box sx={{ flex: 1 }} />

            {/* Download Excel */}
            <Chip
              icon={<DownloadIcon sx={{ fontSize: 16 }} />}
              label="Download"
              size="small"
              variant="outlined"
              onClick={handleDownloadExcel}
              sx={{
                borderRadius: 2,
                fontWeight: 500,
                fontSize: '0.82rem',
                height: 34,
                px: 0.5,
                borderColor: '#10B981',
                color: '#10B981',
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: '#10B98112' },
              }}
            />
          </Box>

          {/* Client Filter Menu */}
          <Menu
            anchorEl={clientMenuAnchor}
            open={Boolean(clientMenuAnchor)}
            onClose={() => setClientMenuAnchor(null)}
            slotProps={{ paper: { sx: { maxHeight: 320, minWidth: 200, borderRadius: 2 } } }}
          >
            <MenuItem
              selected={!filterClient}
              onClick={() => { setFilterClient(''); setClientMenuAnchor(null); }}
              sx={{ fontSize: '0.85rem' }}
            >
              <ListItemText>All Clients</ListItemText>
            </MenuItem>
            <Divider />
            {teamClients.map((c) => (
              <MenuItem
                key={c._id}
                selected={filterClient === c.clientName}
                onClick={() => { setFilterClient(c.clientName); setClientMenuAnchor(null); }}
                sx={{ fontSize: '0.85rem' }}
              >
                <ListItemText>{c.clientName}</ListItemText>
              </MenuItem>
            ))}
          </Menu>

          {/* Team Filter Menu */}
          <Menu
            anchorEl={teamMenuAnchor}
            open={Boolean(teamMenuAnchor)}
            onClose={() => setTeamMenuAnchor(null)}
            slotProps={{ paper: { sx: { maxHeight: 320, minWidth: 200, borderRadius: 2 } } }}
          >
            <MenuItem
              selected={!filterTeam}
              onClick={() => {
                setFilterTeam('');
                setTeamMenuAnchor(null);
              }}
              sx={{ fontSize: '0.85rem' }}
            >
              <ListItemText>All Teams</ListItemText>
            </MenuItem>
            <Divider />
            {teams.map((team) => (
              <MenuItem
                key={team}
                selected={filterTeam === team}
                onClick={() => {
                  setFilterTeam(team);
                  // Only reset client if the current selection doesn't belong to this team
                  if (filterClient) {
                    const currentClientInTeam = clients.find((c) => c.clientName === filterClient && c.team === team);
                    if (!currentClientInTeam) {
                      const firstTeamClient = clients.find((c) => c.team === team);
                      setFilterClient(firstTeamClient ? firstTeamClient.clientName : '');
                    }
                  }
                  // Reset SME if the current SME doesn't belong to this team
                  if (filterSME) {
                    const currentSmeInTeam = smmUsers.find((u) => u.name === filterSME && u.team === team);
                    if (!currentSmeInTeam) setFilterSME('');
                  }
                  setTeamMenuAnchor(null);
                }}
                sx={{ fontSize: '0.85rem' }}
              >
                <ListItemIcon>
                  <GroupsIcon sx={{ fontSize: 18, color: primaryColor }} />
                </ListItemIcon>
                <ListItemText>{team.replace('SMM ', '')}</ListItemText>
              </MenuItem>
            ))}
          </Menu>

          {/* SME Filter Menu */}
          <Menu
            anchorEl={smeMenuAnchor}
            open={Boolean(smeMenuAnchor)}
            onClose={() => setSmeMenuAnchor(null)}
            slotProps={{ paper: { sx: { maxHeight: 320, minWidth: 200, borderRadius: 2 } } }}
          >
            <MenuItem
              selected={!filterSME}
              onClick={() => { setFilterSME(''); setSmeMenuAnchor(null); }}
              sx={{ fontSize: '0.85rem' }}
            >
              <ListItemText>All SMEs</ListItemText>
            </MenuItem>
            <Divider />
            {teamSmeUsers.map((u) => (
              <MenuItem
                key={u._id}
                selected={filterSME === u.name}
                onClick={() => { setFilterSME(u.name); setSmeMenuAnchor(null); }}
                sx={{ fontSize: '0.85rem' }}
              >
                <ListItemText>{u.name}{u.team ? ` (${u.team})` : ''}</ListItemText>
              </MenuItem>
            ))}
          </Menu>

          {/* Status Filter Menu */}
          <Menu
            anchorEl={statusMenuAnchor}
            open={Boolean(statusMenuAnchor)}
            onClose={() => setStatusMenuAnchor(null)}
            slotProps={{ paper: { sx: { maxHeight: 320, minWidth: 180, borderRadius: 2 } } }}
          >
            <MenuItem
              selected={!filterStatus}
              onClick={() => { setFilterStatus(''); setStatusMenuAnchor(null); }}
              sx={{ fontSize: '0.85rem' }}
            >
              <ListItemText>All Statuses</ListItemText>
            </MenuItem>
            <Divider />
            {STATUSES.map((s) => (
              <MenuItem
                key={s}
                selected={filterStatus === s}
                onClick={() => { setFilterStatus(s); setStatusMenuAnchor(null); }}
                sx={{ fontSize: '0.85rem' }}
              >
                <ListItemIcon>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: statusColors[s] }} />
                </ListItemIcon>
                <ListItemText>{s}</ListItemText>
              </MenuItem>
            ))}
          </Menu>

          {/* Notion-style Date Picker Popover */}
          <Menu
            anchorEl={datePickerAnchor}
            open={Boolean(datePickerAnchor)}
            onClose={() => setDatePickerAnchor(null)}
            slotProps={{ paper: { sx: { borderRadius: 3, p: 0, overflow: 'hidden', width: 280, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' } } }}
          >
            {/* Month navigation header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, bgcolor: `${primaryColor}08` }}>
              <IconButton size="small" onClick={() => setDatePickerMonth((d) => subMonths(d, 1))}>
                <ChevronLeft sx={{ fontSize: 20 }} />
              </IconButton>
              <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', color: 'text.primary' }}>
                {format(datePickerMonth, 'MMMM yyyy')}
              </Typography>
              <IconButton size="small" onClick={() => setDatePickerMonth((d) => addMonths(d, 1))}>
                <ChevronRight sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>

            {/* Day-of-week headers */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', px: 1, pt: 0.5 }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <Box key={d} sx={{ textAlign: 'center', py: 0.5 }}>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {d}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Calendar grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', px: 1, pb: 1 }}>
              {(() => {
                const mStart = startOfMonth(datePickerMonth);
                const mEnd = endOfMonth(datePickerMonth);
                const wStart = startOfWeek(mStart);
                const wEnd = endOfWeek(mEnd);
                const days = [];
                let d = wStart;
                while (d <= wEnd) { days.push(d); d = addDays(d, 1); }
                const selectedDate = filterDate ? parseISO(filterDate) : null;
                return days.map((day, i) => {
                  const inMonth = isSameMonth(day, datePickerMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);
                  return (
                    <Box
                      key={i}
                      onClick={() => {
                        setFilterDate(format(day, 'yyyy-MM-dd'));
                        setDatePickerAnchor(null);
                      }}
                      sx={{
                        textAlign: 'center',
                        py: 0.5,
                        cursor: 'pointer',
                        borderRadius: 2,
                        mx: 0.25,
                        my: 0.15,
                        transition: 'all 0.12s',
                        bgcolor: isSelected
                          ? primaryColor
                          : isTodayDate
                            ? `${primaryColor}14`
                            : 'transparent',
                        '&:hover': {
                          bgcolor: isSelected ? primaryColor : `${primaryColor}20`,
                        },
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.8rem',
                          fontWeight: isSelected || isTodayDate ? 700 : 400,
                          color: isSelected
                            ? '#fff'
                            : inMonth
                              ? 'text.primary'
                              : 'text.disabled',
                          lineHeight: '28px',
                          userSelect: 'none',
                        }}
                      >
                        {format(day, 'd')}
                      </Typography>
                    </Box>
                  );
                });
              })()}
            </Box>

            {/* Footer — Today + Clear */}
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 1 }}>
              <Button
                size="small"
                onClick={() => { setFilterDate(''); setDatePickerAnchor(null); }}
                sx={{ fontSize: '0.75rem', color: 'text.secondary', textTransform: 'none', fontWeight: 500 }}
              >
                Clear
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setFilterDate(format(new Date(), 'yyyy-MM-dd'));
                  setDatePickerAnchor(null);
                }}
                sx={{ fontSize: '0.75rem', color: primaryColor, textTransform: 'none', fontWeight: 600 }}
              >
                Today
              </Button>
            </Box>
          </Menu>

          {/* Table */}
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 0 }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 900 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 700 }}>Posting Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Client</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Post Title</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Platform</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Assigned SME</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Approval Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 100 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {/* Data rows */}
                      {filteredEntries.length === 0 && !isAddingInline && (
                        <TableRow>
                          <TableCell colSpan={12} align="center" sx={{ py: 3 }}>
                            <Typography color="text.secondary">
                              No content entries found. Click <b>+ New</b> below to get started.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {filteredEntries.map((entry) =>
                        editingRowId === entry._id ? (
                          /* Inline edit row */
                          <TableRow key={entry._id} sx={{ bgcolor: `${primaryColor}06`, '& .MuiTableCell-root': { py: 0.75, px: 0.5, verticalAlign: 'middle' } }}>
                            <TableCell>
                              <TextField type="date" name="date" size="small" value={inlineFormData.date} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 120 }} InputLabelProps={{ shrink: true }} />
                            </TableCell>
                            <TableCell>
                              {/* Searchable inline client picker. The
                                  underlying inlineFormData.clientName
                                  string state is unchanged so the row's
                                  save handler keeps working. */}
                              <Autocomplete
                                size="small"
                                value={clients.find((c) => c.clientName === inlineFormData.clientName) || null}
                                onChange={(_, opt) => handleInlineFormChange({ target: { name: 'clientName', value: opt?.clientName || '' } })}
                                options={clients}
                                getOptionLabel={(opt) => opt?.clientName || ''}
                                isOptionEqualToValue={(a, b) => a?._id === b?._id}
                                sx={{ ...inlineCellSx, minWidth: 140 }}
                                renderInput={(params) => (
                                  <TextField {...params} placeholder="Client..." onKeyDown={handleInlineKeyDown} />
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField select name="contentType" size="small" value={inlineFormData.contentType} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 90 }} SelectProps={{ displayEmpty: true }}>
                                <MenuItem value="" disabled><em>Type...</em></MenuItem>
                                {CONTENT_TYPES.map((t) => (
                                  <MenuItem key={t} value={t}>{t}</MenuItem>
                                ))}
                              </TextField>
                            </TableCell>
                            <TableCell>
                              <TextField name="postTitle" size="small" placeholder="Title..." value={inlineFormData.postTitle} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 130 }} />
                            </TableCell>
                            <TableCell>
                              <TextField select name="platform" size="small" value={inlineFormData.platform} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 100 }} SelectProps={{ displayEmpty: true }}>
                                <MenuItem value="" disabled><em>Platform...</em></MenuItem>
                                {PLATFORMS.map((p) => (
                                  <MenuItem key={p} value={p}>{p}</MenuItem>
                                ))}
                              </TextField>
                            </TableCell>
                            <TableCell>
                              <TextField select name="assignedSME" size="small" value={inlineFormData.assignedSME} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 110 }} SelectProps={{ displayEmpty: true }}>
                                <MenuItem value="">None</MenuItem>
                                {smmUsers.map((u) => (
                                  <MenuItem key={u._id} value={u.name}>{u.name}</MenuItem>
                                ))}
                              </TextField>
                            </TableCell>
                            <TableCell>
                              <TextField name="description" size="small" placeholder="Description..." value={inlineFormData.description} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 120 }} />
                            </TableCell>
                            <TableCell>
                              <TextField name="referenceVideo" size="small" placeholder="Reference..." value={inlineFormData.referenceVideo} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 100 }} />
                            </TableCell>
                            <TableCell>
                              <TextField select name="status" size="small" value={inlineFormData.status} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 90 }}>
                                {STATUSES.map((s) => (
                                  <MenuItem key={s} value={s}>{s}</MenuItem>
                                ))}
                              </TextField>
                            </TableCell>
                            <TableCell>
                              <TextField select name="approvalStatus" size="small" value={inlineFormData.approvalStatus} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 100 }} SelectProps={{ displayEmpty: true }}>
                                <MenuItem value="">Not Set</MenuItem>
                                {APPROVAL_STATUSES.map((s) => (
                                  <MenuItem key={s} value={s}>{s}</MenuItem>
                                ))}
                              </TextField>
                            </TableCell>
                            <TableCell>
                              <TextField name="remarks" size="small" placeholder="Remarks..." value={inlineFormData.remarks} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 90 }} />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title="Save (Enter)">
                                  <span>
                                    <IconButton size="small" onClick={handleInlineUpdate} disabled={inlineSaving} sx={{ color: '#10B981' }}>
                                      {inlineSaving ? <CircularProgress size={18} /> : <CheckIcon fontSize="small" />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Tooltip title="Cancel (Esc)">
                                  <IconButton size="small" onClick={handleInlineCancel} sx={{ color: 'text.secondary' }}>
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ) : (
                          /* Display row */
                          <TableRow key={entry._id} hover>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {new Date(entry.date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{entry.clientName}</TableCell>
                            <TableCell>
                              <Chip
                                label={entry.contentType}
                                size="small"
                                sx={{
                                  bgcolor: contentTypeColors[entry.contentType] + '18',
                                  color: contentTypeColors[entry.contentType],
                                  fontWeight: 600,
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ maxWidth: 200 }}>
                              <Typography variant="body2" noWrap>
                                {entry.postTitle}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={entry.platform}
                                size="small"
                                sx={{
                                  bgcolor: platformColors[entry.platform] + '18',
                                  color: platformColors[entry.platform],
                                  fontWeight: 600,
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" noWrap>
                                {entry.assignedSME || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ minWidth: 180, maxWidth: 280 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                                {entry.description || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ maxWidth: 150 }}>
                              {entry.referenceVideo ? (
                                entry.referenceVideo.startsWith('http') ? (
                                  <Typography
                                    variant="body2"
                                    component="a"
                                    href={entry.referenceVideo}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={{ color: primaryColor, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                                    noWrap
                                  >
                                    View Link
                                  </Typography>
                                ) : (
                                  <Typography variant="body2" noWrap color="text.secondary">
                                    {entry.referenceVideo}
                                  </Typography>
                                )
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={entry.status}
                                size="small"
                                sx={{
                                  bgcolor: statusColors[entry.status] + '18',
                                  color: statusColors[entry.status],
                                  fontWeight: 600,
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              {entry.approvalStatus ? (
                                <Chip
                                  label={entry.approvalStatus}
                                  size="small"
                                  sx={{
                                    bgcolor: (approvalColors[entry.approvalStatus] || '#999') + '18',
                                    color: approvalColors[entry.approvalStatus] || '#999',
                                    fontWeight: 600,
                                  }}
                                />
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 150 }}>
                              <Typography variant="body2" noWrap color="text.secondary">
                                {entry.remarks || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title="Edit">
                                  <IconButton size="small" onClick={() => handleInlineEdit(entry)} color="primary">
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton size="small" onClick={() => handleDeleteClick(entry)} color="error">
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )
                      )}

                      {/* Inline add row */}
                      {isAddingInline && (
                        <TableRow sx={{ bgcolor: `${primaryColor}06`, '& .MuiTableCell-root': { py: 0.75, px: 0.5, verticalAlign: 'middle' } }}>
                          <TableCell>
                            <TextField type="date" name="date" size="small" value={inlineFormData.date} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 120 }} InputLabelProps={{ shrink: true }} />
                          </TableCell>
                          <TableCell>
                            {/* Searchable client picker for the second
                                inline editor (mirrors the first one). */}
                            <Autocomplete
                              size="small"
                              value={clients.find((c) => c.clientName === inlineFormData.clientName) || null}
                              onChange={(_, opt) => handleInlineFormChange({ target: { name: 'clientName', value: opt?.clientName || '' } })}
                              options={clients}
                              getOptionLabel={(opt) => opt?.clientName || ''}
                              isOptionEqualToValue={(a, b) => a?._id === b?._id}
                              sx={{ ...inlineCellSx, minWidth: 140 }}
                              renderInput={(params) => (
                                <TextField {...params} placeholder="Client..." onKeyDown={handleInlineKeyDown} />
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField select name="contentType" size="small" value={inlineFormData.contentType} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 90 }} SelectProps={{ displayEmpty: true }}>
                              <MenuItem value="" disabled><em>Type...</em></MenuItem>
                              {CONTENT_TYPES.map((t) => (
                                <MenuItem key={t} value={t}>{t}</MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            <TextField name="postTitle" size="small" placeholder="Title..." value={inlineFormData.postTitle} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 130 }} />
                          </TableCell>
                          <TableCell>
                            <TextField select name="platform" size="small" value={inlineFormData.platform} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 100 }} SelectProps={{ displayEmpty: true }}>
                              <MenuItem value="" disabled><em>Platform...</em></MenuItem>
                              {PLATFORMS.map((p) => (
                                <MenuItem key={p} value={p}>{p}</MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            <TextField select name="assignedSME" size="small" value={inlineFormData.assignedSME} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 110 }} SelectProps={{ displayEmpty: true }}>
                              <MenuItem value="">None</MenuItem>
                              {smmUsers.map((u) => (
                                <MenuItem key={u._id} value={u.name}>{u.name}</MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            <TextField name="description" size="small" placeholder="Description..." value={inlineFormData.description} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 120 }} />
                          </TableCell>
                          <TableCell>
                            <TextField name="referenceVideo" size="small" placeholder="Reference..." value={inlineFormData.referenceVideo} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 100 }} />
                          </TableCell>
                          <TableCell>
                            <TextField select name="status" size="small" value={inlineFormData.status} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 90 }}>
                              {STATUSES.map((s) => (
                                <MenuItem key={s} value={s}>{s}</MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            <TextField select name="approvalStatus" size="small" value={inlineFormData.approvalStatus} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 100 }} SelectProps={{ displayEmpty: true }}>
                              <MenuItem value="">Not Set</MenuItem>
                              {APPROVAL_STATUSES.map((s) => (
                                <MenuItem key={s} value={s}>{s}</MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            <TextField name="remarks" size="small" placeholder="Remarks..." value={inlineFormData.remarks} onChange={handleInlineFormChange} onKeyDown={handleInlineKeyDown} sx={{ ...inlineCellSx, minWidth: 90 }} />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title="Save (Enter)">
                                <span>
                                  <IconButton size="small" onClick={handleInlineSave} disabled={inlineSaving} sx={{ color: '#10B981' }}>
                                    {inlineSaving ? <CircularProgress size={18} /> : <CheckIcon fontSize="small" />}
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Cancel (Esc)">
                                <IconButton size="small" onClick={handleInlineCancel} sx={{ color: 'text.secondary' }}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Notion-style "+ New" trigger row */}
                      {!isAddingInline && (
                        <TableRow
                          onClick={handleInlineAdd}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: `${primaryColor}08` },
                            '& .MuiTableCell-root': { py: 1.5, borderBottom: 'none' },
                          }}
                        >
                          <TableCell colSpan={12}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AddIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                              <Typography variant="body2" sx={{ color: 'text.disabled', fontWeight: 500, userSelect: 'none' }}>
                                New
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Tab 1: Calendar View */}
      {activeTab === 1 && (
        <Card>
          <CardContent>
            {/* Calendar Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={() => setCalendarDate((d) => subMonths(d, 1))}>
                  <ChevronLeft />
                </IconButton>
                <Typography variant="h5" sx={{ fontWeight: 700, minWidth: 200, textAlign: 'center' }}>
                  {format(calendarDate, 'MMMM yyyy')}
                </Typography>
                <IconButton onClick={() => setCalendarDate((d) => addMonths(d, 1))}>
                  <ChevronRight />
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {/* Searchable calendar client picker — keeps both
                    calendarClient and filterClient in sync the same
                    way the old onChange did. */}
                <Autocomplete
                  size="small"
                  value={teamClients.find((c) => c.clientName === calendarClient) || null}
                  onChange={(_, opt) => {
                    const v = opt?.clientName || '';
                    setCalendarClient(v);
                    setFilterClient(v);
                  }}
                  options={teamClients}
                  getOptionLabel={(opt) => opt?.clientName || ''}
                  isOptionEqualToValue={(a, b) => a?._id === b?._id}
                  sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.85rem' } }}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Search client…" />
                  )}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<TodayIcon />}
                  onClick={() => setCalendarDate(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadCalendar}
                  sx={{ color: primaryColor, borderColor: primaryColor }}
                >
                  Download
                </Button>
              </Box>
            </Box>

            {/* Downloadable calendar area */}
            <Box ref={calendarRef} sx={{ bgcolor: 'background.paper', p: 2 }}>
            {/* Month/Year title for downloaded image */}
            <Typography variant="h5" sx={{ fontWeight: 700, textAlign: 'center', mb: 2 }}>
              {calendarClient ? `${calendarClient} — ` : ''}{format(calendarDate, 'MMMM yyyy')}
            </Typography>
            {/* Day Headers */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '1px',
                bgcolor: 'divider',
                border: '1px solid',
                borderColor: 'divider',
                borderBottom: 'none',
              }}
            >
              {DAY_NAMES.map((day) => (
                <Box
                  key={day}
                  sx={{
                    py: 1,
                    textAlign: 'center',
                    bgcolor: 'action.hover',
                    fontWeight: 700,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {day}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Calendar Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '1px',
                bgcolor: 'divider',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {calendarDays.map((day, idx) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEntries = entriesByDate[dateKey] || [];
                const isCurrentMonth = isSameMonth(day, calendarDate);
                const isCurrentDay = isToday(day);

                // Determine cell background from first entry's content type
                const cellPastel = dayEntries.length > 0
                  ? calendarPastelColors[dayEntries[0].contentType] || { bg: '#F5F5F5', border: '#BDBDBD', text: '#424242' }
                  : null;

                return (
                  <Box
                    key={idx}
                    sx={{
                      minHeight: 110,
                      p: 0.75,
                      bgcolor: cellPastel
                        ? cellPastel.bg
                        : isCurrentDay
                          ? `${primaryColor}08`
                          : isCurrentMonth
                            ? 'background.paper'
                            : 'action.hover',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                      '&:hover': { bgcolor: cellPastel ? `${cellPastel.bg}CC` : `${primaryColor}12` },
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                    onClick={() => handleOpenDialog(null, dateKey)}
                  >
                    {/* Date Number */}
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: isCurrentDay ? 700 : 500,
                        color: isCurrentDay
                          ? 'white'
                          : isCurrentMonth
                            ? 'text.primary'
                            : 'text.disabled',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: isCurrentDay ? primaryColor : 'transparent',
                        mb: 0.5,
                      }}
                    >
                      {format(day, 'd')}
                    </Typography>

                    {/* Entries */}
                    <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                      {dayEntries.slice(0, 3).map((entry) => (
                        <Box
                          key={entry._id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDialog(entry);
                          }}
                          sx={{
                            mb: 0.5,
                            px: 0.5,
                            py: 0.25,
                            borderRadius: 0.5,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.5)' },
                            overflow: 'hidden',
                            textAlign: 'center',
                            width: '100%',
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: '#212121',
                              display: 'block',
                              lineHeight: 1.4,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {entry.postTitle}
                          </Typography>
                          {!isDownloadingCalendar && (
                            <Typography
                              sx={{
                                fontSize: '0.65rem',
                                fontWeight: 500,
                                color: statusColors[entry.status],
                                display: 'block',
                                lineHeight: 1.3,
                              }}
                            >
                              {entry.status}
                            </Typography>
                          )}
                        </Box>
                      ))}
                      {dayEntries.length > 3 && (
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', pl: 0.5 }}>
                          +{dayEntries.length - 3} more
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
            </Box>
            {/* End downloadable calendar area */}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingEntry ? 'Edit Content Entry' : 'Add Content Entry'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="date"
                label="Date"
                name="date"
                value={formData.date}
                onChange={handleFormChange}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {/* Searchable client picker for the Add/Edit dialog.
                  Pushes the picked name back into formData.clientName
                  via the same handleFormChange shape Select used. */}
              <Autocomplete
                fullWidth
                value={clients.find((c) => c.clientName === formData.clientName) || null}
                onChange={(_, opt) => handleFormChange({ target: { name: 'clientName', value: opt?.clientName || '' } })}
                options={clients}
                getOptionLabel={(opt) => opt?.clientName || ''}
                isOptionEqualToValue={(a, b) => a?._id === b?._id}
                renderInput={(params) => (
                  <TextField {...params} label="Client Name" placeholder="Type to search…" required />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                select
                label="Content Type"
                name="contentType"
                value={formData.contentType}
                onChange={handleFormChange}
                required
              >
                {CONTENT_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Post Title"
                name="postTitle"
                value={formData.postTitle}
                onChange={handleFormChange}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                select
                label="Platform"
                name="platform"
                value={formData.platform}
                onChange={handleFormChange}
                required
              >
                {PLATFORMS.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                select
                label="Status"
                name="status"
                value={formData.status}
                onChange={handleFormChange}
                required
              >
                {STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                multiline
                rows={2}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                select
                label="Assigned SME"
                name="assignedSME"
                value={formData.assignedSME}
                onChange={handleFormChange}
              >
                <MenuItem value="">None</MenuItem>
                {smmUsers.map((u) => (
                  <MenuItem key={u._id} value={u.name}>
                    {u.name}{u.team ? ` (${u.team})` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                select
                label="Approval Status (from Client)"
                name="approvalStatus"
                value={formData.approvalStatus}
                onChange={handleFormChange}
              >
                <MenuItem value="">Not Set</MenuItem>
                {APPROVAL_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Reference Video (URL or text)"
                name="referenceVideo"
                value={formData.referenceVideo}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Remarks"
                name="remarks"
                value={formData.remarks}
                onChange={handleFormChange}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={actionLoading}
            sx={{
              bgcolor: primaryColor,
              '&:hover': {
                bgcolor: secondaryColor,
              },
            }}
          >
            {actionLoading ? <CircularProgress size={24} /> : editingEntry ? 'Update' : 'Add Entry'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{entryToDelete?.postTitle}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm} disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default ContentManagement;
