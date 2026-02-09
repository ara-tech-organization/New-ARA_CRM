import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import clientReducer from './slices/clientSlice';
import dailyLeadDataReducer from './slices/dailyLeadDataSlice';
import leadReducer from './slices/leadSlice';
import dailyEntryReducer from './slices/dailyEntrySlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    clients: clientReducer,
    dailyLeadData: dailyLeadDataReducer,
    leads: leadReducer,
    dailyEntry: dailyEntryReducer,
  },
});

export default store;
