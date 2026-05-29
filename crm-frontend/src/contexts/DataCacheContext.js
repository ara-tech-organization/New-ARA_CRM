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
  // All-leads cache
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const leadsRef = useRef([]);                  // mirrors `leads` for stable closures
  const leadsTimestamp = useRef(0);
  const leadsPromise = useRef(null);

  // Today-leads cache
  const [todayLeads, setTodayLeads] = useState([]);
  const [todayLeadsLoading, setTodayLeadsLoading] = useState(false);
  const todayLeadsRef = useRef([]);
  const todayLeadsTimestamp = useRef(0);
  const todayLeadsPromise = useRef(null);
  const todayLeadsDate = useRef(getToday());

  // Clients cache
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const clientsRef = useRef([]);
  const clientsTimestamp = useRef(0);
  const clientsPromise = useRef(null);

  // Why refs + stable [] deps below: a previous version captured the
  // state arrays (`todayLeads` etc.) in useCallback deps. That made each
  // fetcher's identity change after every successful fetch — which then
  // re-fired every consumer's `useEffect(() => fetchX(), [fetchX])`. The
  // TTL check also gated on `.length > 0`, so an empty response (e.g.
  // no leads today) never counted as a cache hit → infinite network
  // loop. Fix: read latest value via refs, gate TTL on timestamp only,
  // and keep useCallback deps empty so the callback identity is stable.

  const fetchTodayLeads = useCallback(async (force = false) => {
    const now = Date.now();
    const today = getToday();
    const dayChanged = todayLeadsDate.current !== today;
    if (dayChanged) todayLeadsDate.current = today;

    if (
      !force &&
      !dayChanged &&
      todayLeadsTimestamp.current > 0 &&
      now - todayLeadsTimestamp.current < CACHE_TTL
    ) {
      return todayLeadsRef.current;
    }
    if (todayLeadsPromise.current) return todayLeadsPromise.current;

    setTodayLeadsLoading(true);
    todayLeadsPromise.current = api
      .get(`/leads`, { params: { date: today, limit: 10000 } })
      .then((res) => {
        const data = res.data?.data || res.data || [];
        if (Array.isArray(data)) {
          todayLeadsRef.current = data;
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
        return todayLeadsRef.current;
      });

    return todayLeadsPromise.current;
  }, []);

  const fetchLeads = useCallback(async (force = false) => {
    const now = Date.now();
    if (
      !force &&
      leadsTimestamp.current > 0 &&
      now - leadsTimestamp.current < CACHE_TTL
    ) {
      return leadsRef.current;
    }
    if (leadsPromise.current) return leadsPromise.current;

    setLeadsLoading(true);
    leadsPromise.current = api
      .get(`/leads?limit=10`)
      .then((res) => {
        const data = res.data?.data || res.data || [];
        if (Array.isArray(data)) {
          leadsRef.current = data;
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
        return leadsRef.current;
      });

    return leadsPromise.current;
  }, []);

  const fetchClients = useCallback(async (force = false) => {
    const now = Date.now();
    if (
      !force &&
      clientsTimestamp.current > 0 &&
      now - clientsTimestamp.current < CACHE_TTL
    ) {
      return clientsRef.current;
    }
    if (clientsPromise.current) return clientsPromise.current;

    setClientsLoading(true);
    clientsPromise.current = api
      .get(`/clients?limit=10000`)
      .then((res) => {
        const data = res.data?.data || res.data || [];
        if (Array.isArray(data)) {
          clientsRef.current = data;
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
        return clientsRef.current;
      });

    return clientsPromise.current;
  }, []);

  // No auto-fetch on mount — pages that need cached data call the
  // corresponding fetcher in their own useEffect (or via the
  // useEnsureClients / useEnsureTodayLeads / useEnsureLeads hooks below).
  // Pages that don't need the cache (Settings, AccessManagement, etc.)
  // pay zero network cost.

  // Force refresh whichever caches are currently populated. Reads
  // leadsRef.current instead of leads state so deps stay empty (fetchers
  // are already stable from `[]` deps above).
  const refreshAll = useCallback(async () => {
    const tasks = [fetchTodayLeads(true), fetchClients(true)];
    if (leadsRef.current.length > 0) tasks.push(fetchLeads(true));
    await Promise.all(tasks);
  }, [fetchTodayLeads, fetchClients, fetchLeads]);

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
