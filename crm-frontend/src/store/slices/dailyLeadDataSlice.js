import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import dailyLeadDataApi from '../../api/dailyLeadDataApi';

// Async thunks
export const fetchDailyLeadData = createAsyncThunk(
  'dailyLeadData/fetchDailyLeadData',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await dailyLeadDataApi.getDailyLeadData(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch daily lead data');
    }
  }
);

export const fetchDailyLeadDataStats = createAsyncThunk(
  'dailyLeadData/fetchStats',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await dailyLeadDataApi.getStats(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch stats');
    }
  }
);

export const createDailyLeadDataEntry = createAsyncThunk(
  'dailyLeadData/create',
  async (data, { rejectWithValue }) => {
    try {
      const response = await dailyLeadDataApi.createDailyLeadData(data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create entry');
    }
  }
);

export const updateDailyLeadDataEntry = createAsyncThunk(
  'dailyLeadData/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await dailyLeadDataApi.updateDailyLeadData(id, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update entry');
    }
  }
);

export const deleteDailyLeadDataEntry = createAsyncThunk(
  'dailyLeadData/delete',
  async (id, { rejectWithValue }) => {
    try {
      await dailyLeadDataApi.deleteDailyLeadData(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete entry');
    }
  }
);

const initialState = {
  entries: [],
  stats: {
    totalLeads: 0,
    totalSpend: 0,
    metaTotalLeads: 0,
    googleTotalLeads: 0,
    entriesCount: 0,
    activeClients: 0,
  },
  loading: false,
  statsLoading: false,
  error: null,
  totalPages: 0,
  currentPage: 1,
  total: 0,
};

const dailyLeadDataSlice = createSlice({
  name: 'dailyLeadData',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch entries
      .addCase(fetchDailyLeadData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailyLeadData.fulfilled, (state, action) => {
        state.loading = false;
        state.entries = action.payload.data;
        state.totalPages = action.payload.totalPages;
        state.currentPage = action.payload.currentPage;
        state.total = action.payload.total;
      })
      .addCase(fetchDailyLeadData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch stats
      .addCase(fetchDailyLeadDataStats.pending, (state) => {
        state.statsLoading = true;
      })
      .addCase(fetchDailyLeadDataStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.stats = action.payload;
      })
      .addCase(fetchDailyLeadDataStats.rejected, (state, action) => {
        state.statsLoading = false;
        state.error = action.payload;
      })
      // Create entry
      .addCase(createDailyLeadDataEntry.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createDailyLeadDataEntry.fulfilled, (state, action) => {
        state.loading = false;
        state.entries.unshift(action.payload);
      })
      .addCase(createDailyLeadDataEntry.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update entry
      .addCase(updateDailyLeadDataEntry.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateDailyLeadDataEntry.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.entries.findIndex(e => e._id === action.payload._id);
        if (index !== -1) {
          state.entries[index] = action.payload;
        }
      })
      .addCase(updateDailyLeadDataEntry.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Delete entry
      .addCase(deleteDailyLeadDataEntry.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteDailyLeadDataEntry.fulfilled, (state, action) => {
        state.loading = false;
        state.entries = state.entries.filter(e => e._id !== action.payload);
      })
      .addCase(deleteDailyLeadDataEntry.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = dailyLeadDataSlice.actions;
export default dailyLeadDataSlice.reducer;
