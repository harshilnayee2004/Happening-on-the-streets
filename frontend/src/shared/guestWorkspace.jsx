import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './api/client.js';
import { ensureGuest } from './api/guestSession.js';
import { isOpenHousePath } from './nav.js';

const GuestWorkspaceContext = createContext(null);

export function GuestWorkspaceProvider({ children }) {
  const { pathname } = useLocation();
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');

  const refresh = useCallback(async () => {
    await ensureGuest();
    const { data } = await api.get('/api/buyer/listings');
    setProperties(data.properties);
    setLoadError('');
    return data.properties;
  }, []);

  const refreshRooms = useCallback(async () => {
    await ensureGuest();
    const { data } = await api.get('/api/buyer/workspaces');
    setRooms(data.rooms);
    return data.rooms;
  }, []);

  useEffect(() => {
    if (!isOpenHousePath(pathname)) return undefined;
    let cancelled = false;
    Promise.all([
      refresh(),
      refreshRooms().catch(() => []),
    ])
      .catch(() => {
        if (!cancelled) setLoadError('Saved homes could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, refresh, refreshRooms]);

  useEffect(() => {
    if (properties.length === 0) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [properties.length]);

  const value = useMemo(
    () => ({ properties, rooms, ready, loadError, refresh, refreshRooms }),
    [properties, rooms, ready, loadError, refresh, refreshRooms],
  );

  return (
    <GuestWorkspaceContext.Provider value={value}>
      {children}
    </GuestWorkspaceContext.Provider>
  );
}

export function useGuestWorkspace() {
  const value = useContext(GuestWorkspaceContext);
  if (!value) throw new Error('Guest workspace is unavailable');
  return value;
}
