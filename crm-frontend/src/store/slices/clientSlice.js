import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import clientApi from '../../api/clientApi';

// Async thunks
export const fetchClients = createAsyncThunk(
  'clients/fetchClients',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await clientApi.getClients(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch clients');
    }
  }
);

export const createClient = createAsyncThunk(
  'clients/createClient',
  async (clientData, { rejectWithValue }) => {
    try {
      const response = await clientApi.createClient(clientData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create client');
    }
  }
);

export const updateClientAsync = createAsyncThunk(
  'clients/updateClient',
  async ({ id, clientData }, { rejectWithValue }) => {
    try {
      const response = await clientApi.updateClient(id, clientData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update client');
    }
  }
);

export const deleteClientAsync = createAsyncThunk(
  'clients/deleteClient',
  async (id, { rejectWithValue }) => {
    try {
      await clientApi.deleteClient(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete client');
    }
  }
);

export const updateClientStatusAsync = createAsyncThunk(
  'clients/updateClientStatus',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const response = await clientApi.updateClientStatus(id, status);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update client status');
    }
  }
);

const initialState = {
  clients: [],
  currentClient: null,
  loading: false,
  error: null,
  totalPages: 0,
  currentPage: 1,
  total: 0,
};

const clientSlice = createSlice({
  name: 'clients',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentClient: (state) => {
      state.currentClient = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch clients
      .addCase(fetchClients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchClients.fulfilled, (state, action) => {
        state.loading = false;
        state.clients = action.payload.data;
        state.totalPages = action.payload.totalPages;
        state.currentPage = action.payload.currentPage;
        state.total = action.payload.total;
      })
      .addCase(fetchClients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Create client
      .addCase(createClient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createClient.fulfilled, (state, action) => {
        state.loading = false;
        state.clients.unshift(action.payload);
      })
      .addCase(createClient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update client
      .addCase(updateClientAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateClientAsync.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.clients.findIndex(c => c._id === action.payload._id);
        if (index !== -1) {
          state.clients[index] = action.payload;
        }
      })
      .addCase(updateClientAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Delete client
      .addCase(deleteClientAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteClientAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.clients = state.clients.filter(c => c._id !== action.payload);
      })
      .addCase(deleteClientAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update client status
      .addCase(updateClientStatusAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateClientStatusAsync.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.clients.findIndex(c => c._id === action.payload._id);
        if (index !== -1) {
          state.clients[index] = action.payload;
        }
      })
      .addCase(updateClientStatusAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearCurrentClient } = clientSlice.actions;
export default clientSlice.reducer;
