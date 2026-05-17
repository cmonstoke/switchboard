import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Logo from '../components/Logo';
import { login, setActiveIp } from '../api/switch';
import {
  getSwitches, addSwitch, removeSwitch,
  getLastSelectedId, setLastSelectedId,
  type SwitchConfig,
} from '../stores/switches';

interface Props {
  onLogin: () => void;
}

export default function Login({ onLogin }: Props) {
  const [switches, setSwitches] = useState<SwitchConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Add-switch form
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIp, setNewIp] = useState('');

  useEffect(() => {
    getSwitches().then((list) => {
      setSwitches(list);
      if (list.length > 0) {
        const last = getLastSelectedId();
        setSelectedId(last && list.find((s) => s.id === last) ? last : list[0].id);
      }
    });
  }, []);

  const selected = switches.find((s) => s.id === selectedId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    setLoading(true);
    try {
      setActiveIp(selected.ip);
      const ok = await login({ username, password });
      if (ok) {
        setLastSelectedId(selectedId);
        onLogin();
      } else {
        setError('Invalid username or password.');
      }
    } catch {
      setError(`Could not reach ${selected.ip}. Check the IP address.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newIp.trim()) return;
    const sw = await addSwitch(newName.trim(), newIp.trim());
    const updated = await getSwitches();
    setSwitches(updated);
    setSelectedId(sw.id);
    setNewName('');
    setNewIp('');
    setAdding(false);
  }

  async function handleRemove(id: string) {
    await removeSwitch(id);
    const updated = await getSwitches();
    setSwitches(updated);
    if (selectedId === id) {
      setSelectedId(updated[0]?.id ?? '');
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm space-y-4">

        {/* Brand */}
        <div className="text-center mb-2">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Logo size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white">Switchboard</h1>
          <p className="text-sm text-gray-500 mt-1">Select a switch to manage</p>
        </div>

        {/* Switch selector */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Switches</span>
            <button
              onClick={() => setAdding((v) => !v)}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          {/* Add form */}
          {adding && (
            <form onSubmit={handleAdd} className="flex gap-2 mb-2">
              <input
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <input
                placeholder="IP address"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                className="w-36 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors"
              >
                Add
              </button>
            </form>
          )}

          {/* Switch list */}
          <div className="space-y-1">
            {switches.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-2">No switches configured</p>
            )}
            {switches.map((sw) => (
              <div
                key={sw.id}
                onClick={() => setSelectedId(sw.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedId === sw.id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-800 text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    selectedId === sw.id ? 'bg-white' : 'bg-gray-600'
                  }`} />
                  <span className="text-sm font-medium truncate">{sw.name}</span>
                  <span className={`text-xs font-mono shrink-0 ${
                    selectedId === sw.id ? 'text-blue-200' : 'text-gray-500'
                  }`}>{sw.ip}</span>
                </div>
                {switches.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(sw.id); }}
                    className={`ml-2 p-0.5 rounded transition-colors shrink-0 ${
                      selectedId === sw.id
                        ? 'hover:bg-blue-500 text-blue-200'
                        : 'hover:bg-gray-700 text-gray-600 hover:text-gray-400'
                    }`}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Login form */}
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4"
        >
          <div>
            <label className="block text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
              Credentials for {selected?.name ?? '…'}
            </label>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5" htmlFor="username">Username</label>
            <input
              id="username" type="text" autoComplete="username"
              value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5" htmlFor="password">Password</label>
            <input
              id="password" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !selected}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Signing in…' : `Sign in to ${selected?.name ?? '…'}`}
          </button>
        </form>
      </div>
    </div>
  );
}
