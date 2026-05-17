import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/auth';
import { setLastSelectedId } from './stores/switches';
import { getStatus } from './api/switch';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import VlanManager from './pages/VlanManager';
import SystemSettings from './pages/SystemSettings';
import Login from './pages/Login';

export default function App() {
  const [authed, setAuthed] = useState(false);

  const handleSessionExpired = useCallback(() => setAuthed(false), []);

  // Keepalive: ping status.json every 45s to prevent session expiry
  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => {
      getStatus().catch(() => {});
    }, 45_000);
    return () => clearInterval(id);
  }, [authed]);

  // Pre-select a switch and drop back to login
  const handleSwitchChange = useCallback((switchId: string) => {
    setLastSelectedId(switchId);
    setAuthed(false);
  }, []);

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return (
    <AuthProvider value={{ onSessionExpired: handleSessionExpired, onSwitchChange: handleSwitchChange }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="vlans" element={<VlanManager />} />
            <Route path="system" element={<SystemSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
