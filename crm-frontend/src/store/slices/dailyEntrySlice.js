import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import dailyEntryApi from '../../api/dailyEntryApi';

// Async thunks
export const fetchDailyEntries = createAsyncThunk(
  'dailyEntry/fetchDailyEntries',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await dailyEntryApi.getDailyEntries(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch entries');
    }
  }
);

export const fetchTodayStats = createAsyncThunk(
  'dailyEntry/fetchTodayStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await dailyEntryApi.getTodayStats();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch today stats');
    }
  }
);

export const createDailyEntryAsync = createAsyncThunk(
  'dailyEntry/createDailyEntry',
  async (data, { rejectWithValue }) => {
    try {
      const response = await dailyEntryApi.createDailyEntry(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create entry');
    }
  }
);

export const updateDailyEntryAsync = createAsyncThunk(
  'dailyEntry/updateDailyEntry',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await dailyEntryApi.updateDailyEntry(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update entry');
    }
  }
);

export const deleteDailyEntryAsync = createAsyncThunk(
  'dailyEntry/deleteDailyEntry',
  async (id, { rejectWithValue }) => {
    try {
      await dailyEntryApi.deleteDailyEntry(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete entry');
    }
  }
);

const initialState = {
  entries: [],
  todayStats: {
    todayLeads: 0,
    todaySpend: 0,
    entriesCount: 0,
    activeClients: 0,
  },
  loading: false,
  error: null,
  total: 0,
  totalPages: 0,
  currentPage: 1,
};

const dailyEntrySlice = createSlice({
  name: 'dailyEntry',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch entries
      .addCase(fetchDailyEntries.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailyEntries.fulfilled, (state, action) => {
        state.loading = false;
        state.entries = action.payload.data || [];
        state.total = action.payload.total || 0;
        state.totalPages = action.payload.totalPages || 0;
        state.currentPage = action.payload.currentPage || 1;
      })
      .addCase(fetchDailyEntries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch today stats
      .addCase(fetchTodayStats.fulfilled, (state, action) => {
        state.todayStats = action.payload.data || initialState.todayStats;
      })
      // Create entry
      .addCase(createDailyEntryAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createDailyEntryAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.entries.unshift(action.payload.data);
      })
      .addCase(createDailyEntryAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update entry
      .addCase(updateDailyEntryAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateDailyEntryAsync.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.entries.findIndex((e) => e._id === action.payload.data._id);
        if (index !== -1) {
          state.entries[index] = action.payload.data;
        }
      })
      .addCase(updateDailyEntryAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Delete entry
      .addCase(deleteDailyEntryAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteDailyEntryAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.entries = state.entries.filter((e) => e._id !== action.payload);
      })
      .addCase(deleteDailyEntryAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = dailyEntrySlice.actions;

export default dailyEntrySlice.reducer;
