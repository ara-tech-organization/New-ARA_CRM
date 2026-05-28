import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import api from "../api/axios";

const DataCacheContext = createContext(null);

// Cache TTL: 5 minutes — data stays fresh for 5 min before re-fetching
const CACHE_TTL = 5 * 60 * 1000;

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const DataCacheProvider = ({ children }) => {
  // All-leads cache — loaded lazily, only when a page that needs the full list mounts
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const leadsTimestamp = useRef(0);
  const leadsPromise = useRef(null);

  // Today-leads cache — loaded eagerly on app mount (small, fast, used by Dashboard)
  const [todayLeads, setTodayLeads] = useState([]);
  const [todayLeadsLoading, setTodayLeadsLoading] = useState(false);
  const todayLeadsTimestamp = useRef(0);
  const todayLeadsPromise = useRef(null);
  const todayLeadsDate = useRef(getToday());

  // Clients cache
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const clientsTimestamp = useRef(0);
  const clientsPromise = useRef(null);

  // Fetch today's leads only — small, fast
  const fetchTodayLeads = useCallback(
    async (force = false) => {
      const now = Date.now();
      const today = getToday();
      // If the day rolled over since last fetch, force a refresh
      const dayChanged = todayLeadsDate.current !== today;
      if (dayChanged) todayLeadsDate.current = today;

      if (
        !force &&
        !dayChanged &&
        todayLeads.length > 0 &&
        now - todayLeadsTimestamp.current < CACHE_TTL
      ) {
        return todayLeads;
      }
      if (todayLeadsPromise.current) {
        return todayLeadsPromise.current;
      }

      setTodayLeadsLoading(true);
      todayLeadsPromise.current = api
        .get(`/leads`, { params: { date: today, limit: 10000 } })
        .then((res) => {
          const data = res.data?.data || res.data || [];
          if (Array.isArray(data)) {
            setTodayLeads(data);
            todayLeadsTimestamp.current = Date.now();
          }
          todayLeadsPromise.current = null;
          setTodayLeadsLoading(false);
          return data;
        })
        .catch((err) => {
          console.error("Failed to fetch today leads:", err);
          todayLeadsPromise.current = null;
          setTodayLeadsLoading(false);
          return todayLeads;
        });

      return todayLeadsPromise.current;
    },
    [todayLeads],
  );

  // Fetch ALL leads — lazy, triggered by pages that need the full list
  const fetchLeads = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (
        !force &&
        leads.length > 0 &&
        now - leadsTimestamp.current < CACHE_TTL
      ) {
        return leads;
      }
      if (leadsPromise.current) {
        return leadsPromise.current;
      }

      setLeadsLoading(true);
      leadsPromise.current = api
        .get(`/leads?limit=10`)
        .then((res) => {
          const data = res.data?.data || res.data || [];
          if (Array.isArray(data)) {
            setLeads(data);
            leadsTimestamp.current = Date.now();
          }
          leadsPromise.current = null;
          setLeadsLoading(false);
          return data;
        })
        .catch((err) => {
          console.error("Failed to fetch leads:", err);
          leadsPromise.current = null;
          setLeadsLoading(false);
          return leads;
        });

      return leadsPromise.current;
    },
    [leads],
  );

  // Fetch clients with cache
  const fetchClients = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (
        !force &&
        clients.length > 0 &&
        now - clientsTimestamp.current < CACHE_TTL
      ) {
        return clients;
      }
      if (clientsPromise.current) {
        return clientsPromise.current;
      }

      setClientsLoading(true);
      clientsPromise.current = api
        .get(`/clients?limit=10000`)
        .then((res) => {
          const data = res.data?.data || res.data || [];
          if (Array.isArray(data)) {
            setClients(data);
            clientsTimestamp.current = Date.now();
          }
          clientsPromise.current = null;
          setClientsLoading(false);
          return data;
        })
        .catch((err) => {
          console.error("Failed to fetch clients:", err);
          clientsPromise.current = null;
          setClientsLoading(false);
          return clients;
        });

      return clientsPromise.current;
    },
    [clients],
  );

  // No auto-fetch on mount — pages that need cached data call the
  // corresponding fetcher in their own useEffect (or via the
  // useEnsureClients / useEnsureTodayLeads / useEnsureLeads hooks below).
  // Pages that don't need the cache (Settings, AccessManagement, etc.)
  // pay zero network cost.

  // Force refresh whichever caches are currently populated
  const refreshAll = useCallback(async () => {
    const tasks = [fetchTodayLeads(true), fetchClients(true)];
    if (leads.length > 0) tasks.push(fetchLeads(true));
    await Promise.all(tasks);
  }, [fetchTodayLeads, fetchClients, fetchLeads, leads.length]);

  const invalidateLeads = useCallback(() => {
    leadsTimestamp.current = 0;
    todayLeadsTimestamp.current = 0;
  }, []);

  const invalidateClients = useCallback(() => {
    clientsTimestamp.current = 0;
  }, []);

  return (
    <DataCacheContext.Provider
      value={{
        leads,
        clients,
        todayLeads,
        leadsLoading,
        clientsLoading,
        todayLeadsLoading,
        fetchLeads,
        fetchClients,
        fetchTodayLeads,
        refreshAll,
        invalidateLeads,
        invalidateClients,
      }}
    >
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error("useDataCache must be used within DataCacheProvider");
  }
  return context;
};

// Auto-triggered fetchers — call these in pages that depend on the cache.
// They fire the corresponding fetch on mount (no-op if data is fresh) and
// return the value + loading flag. Replaces the previous app-wide eager
// fetch in DataCacheProvider so non-data pages skip the network entirely.
export const useEnsureClients = () => {
  const { clients, clientsLoading, fetchClients } = useDataCache();
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);
  return { clients, loading: clientsLoading };
};

export const useEnsureTodayLeads = () => {
  const { todayLeads, todayLeadsLoading, fetchTodayLeads } = useDataCache();
  useEffect(() => {
    fetchTodayLeads();
  }, [fetchTodayLeads]);
  return { todayLeads, loading: todayLeadsLoading };
};

export const useEnsureLeads = () => {
  const { leads, leadsLoading, fetchLeads } = useDataCache();
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);
  return { leads, loading: leadsLoading };
};
