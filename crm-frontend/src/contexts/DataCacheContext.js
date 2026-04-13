import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';

const DataCacheContext = createContext(null);

// Cache TTL: 5 minutes — data stays fresh for 5 min before re-fetching
const CACHE_TTL = 5 * 60 * 1000;

export const DataCacheProvider = ({ children }) => {
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);

  const leadsTimestamp = useRef(0);
  const clientsTimestamp = useRef(0);
  const leadsPromise = useRef(null);
  const clientsPromise = useRef(null);

  // Fetch leads with cache
  const fetchLeads = useCallback(async (force = false) => {
    const now = Date.now();
    // Return cached if still fresh
    if (!force && leads.length > 0 && now - leadsTimestamp.current < CACHE_TTL) {
      return leads;
    }
    // If already fetching, return the in-flight promise
    if (leadsPromise.current) {
      return leadsPromise.current;
    }

    setLeadsLoading(true);
    leadsPromise.current = api.get('/leads?limit=10000')
      .then(res => {
        const data = res.data.data || res.data;
        setLeads(data);
        leadsTimestamp.current = Date.now();
        leadsPromise.current = null;
        setLeadsLoading(false);
        return data;
      })
      .catch(err => {
        console.error('Failed to fetch leads:', err);
        leadsPromise.current = null;
        setLeadsLoading(false);
        return leads; // Return stale data on error
      });

    return leadsPromise.current;
  }, [leads]);

  // Fetch clients with cache
  const fetchClients = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && clients.length > 0 && now - clientsTimestamp.current < CACHE_TTL) {
      return clients;
    }
    if (clientsPromise.current) {
      return clientsPromise.current;
    }

    setClientsLoading(true);
    clientsPromise.current = api.get('/clients?limit=10000')
      .then(res => {
        const data = res.data.data || res.data;
        setClients(data);
        clientsTimestamp.current = Date.now();
        clientsPromise.current = null;
        setClientsLoading(false);
        return data;
      })
      .catch(err => {
        console.error('Failed to fetch clients:', err);
        clientsPromise.current = null;
        setClientsLoading(false);
        return clients;
      });

    return clientsPromise.current;
  }, [clients]);

  // Fetch both on first mount
  useEffect(() => {
    fetchLeads();
    fetchClients();
  }, []);

  // Force refresh both
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchLeads(true), fetchClients(true)]);
  }, [fetchLeads, fetchClients]);

  // Invalidate leads cache (call after creating/updating a lead)
  const invalidateLeads = useCallback(() => {
    leadsTimestamp.current = 0;
  }, []);

  const invalidateClients = useCallback(() => {
    clientsTimestamp.current = 0;
  }, []);

  return (
    <DataCacheContext.Provider value={{
      leads,
      clients,
      leadsLoading,
      clientsLoading,
      fetchLeads,
      fetchClients,
      refreshAll,
      invalidateLeads,
      invalidateClients,
    }}>
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('useDataCache must be used within DataCacheProvider');
  }
  return context;
};
