import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Settings, Network, LayoutDashboard, ChevronDown, Check } from 'lucide-react';
import Logo from './Logo';
import clsx from 'clsx';
import { getActiveIp } from '../api/switch';
import { getSwitches, type SwitchConfig } from '../stores/switches';
import { useAuth } from '../contexts/auth';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/vlans', label: 'VLANs', icon: Network },
  { to: '/system', label: 'System', icon: Settings },
];

function SwitchSelector() {
  const { onSwitchChange } = useAuth();
  const [open, setOpen] = useState(false);
  const [switches, setSwitches] = useState<SwitchConfig[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const ip = getActiveIp();
  const active = switches.find((s) => s.ip === ip);

  useEffect(() => {
    getSwitches().then(setSwitches);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative px-3 py-3 border-b border-gray-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-800 transition-colors group"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <Logo size={15} className="text-white" />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold text-white truncate leading-tight">
            {active?.name ?? ip}
          </p>
          <p className="text-xs text-gray-500 font-mono truncate leading-tight">{ip}</p>
        </div>
        <ChevronDown
          size={14}
          className={clsx('text-gray-500 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {switches.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500">No switches configured</p>
          )}
          {switches.map((sw) => {
            const isCurrent = sw.ip === ip;
            return (
              <button
                key={sw.id}
                onClick={() => { setOpen(false); if (!isCurrent) onSwitchChange(sw.id); }}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
                  isCurrent ? 'bg-blue-600/20' : 'hover:bg-gray-700'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{sw.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{sw.ip}</p>
                </div>
                {isCurrent && <Check size={14} className="text-blue-400 shrink-0" />}
              </button>
            );
          })}
          <div className="border-t border-gray-700 px-3 py-2">
            <button
              onClick={() => { setOpen(false); onSwitchChange(''); }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Manage switches…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <SwitchSelector />

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-600">
          MXL WebUI v0.1.0
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
