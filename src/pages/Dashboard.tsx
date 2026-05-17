import { useEffect, useState, useCallback, useRef } from 'react';
import { getStatus, getPortStatistics, clearStatistics } from '../api/switch';
import type { StatusResponse, PortStatEntry } from '../types/switch';
import { PORT_NAMES } from '../types/switch';
import { useApiCall } from '../contexts/auth';
import { RefreshCw, Trash2 } from 'lucide-react';
import clsx from 'clsx';

const INTERVALS = [
  { label: 'Off', value: 0 },
  { label: '1s',  value: 1000 },
  { label: '3s',  value: 3000 },
  { label: '5s',  value: 5000 },
  { label: '10s', value: 10000 },
];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-semibold text-white truncate">{value || '—'}</p>
    </div>
  );
}

function fmt(n: string | undefined): string {
  const v = parseInt(n ?? '0', 10);
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function PortCard({ portNum, stat }: { portNum: number; stat?: PortStatEntry }) {
  const up = !!stat?.Link_Status && stat.Link_Status !== 'Link Down';
  const speedLabel = up ? stat!.Link_Status : 'No link';
  return (
    <div
      className={clsx(
        'rounded-lg border p-3 flex flex-col gap-1.5 text-xs',
        up ? 'border-green-700 bg-green-950' : 'border-red-900 bg-red-950/40'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-200">{PORT_NAMES[portNum]}</span>
        <span className={clsx('w-2 h-2 rounded-full shrink-0', up ? 'bg-green-400' : 'bg-red-500')} />
      </div>
      <span className={clsx('font-mono', up ? 'text-green-400' : 'text-red-400')}>
        {stat ? speedLabel : '…'}
      </span>
      {stat && (
        <div className="grid grid-cols-2 gap-x-2 pt-1 border-t border-white/5 text-gray-500 font-mono">
          <span>Tx {fmt(stat.TxGoodPkt)}</span>
          <span>Rx {fmt(stat.RxGoodPkt)}</span>
          {(parseInt(stat.TxBadPkt ?? '0') > 0 || parseInt(stat.RxBadPkt ?? '0') > 0) && (
            <>
              <span className="text-red-500">Err {fmt(stat.TxBadPkt)}</span>
              <span className="text-red-500">Err {fmt(stat.RxBadPkt)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const apiCall = useApiCall();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [stats, setStats] = useState<Record<string, PortStatEntry>>({});
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);
  const [interval, setIntervalMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    apiCall(async () => {
      const [s, p] = await Promise.all([getStatus(), getPortStatistics()]);
      setStatus(s);
      setStats(p);
    }).catch((e: unknown) => setError((e as Error).message));
  }, [apiCall]);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Auto-refresh interval
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (interval > 0) {
      timerRef.current = setInterval(load, interval);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [interval, load]);

  async function handleClear() {
    setClearing(true);
    await apiCall(() => clearStatistics()).catch((e: unknown) => setError((e as Error).message));
    load();
    setClearing(false);
  }

  const portNums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const upCount = portNums.filter((n) => {
    const s = stats[`Port_${n}`];
    return !!s?.Link_Status && s.Link_Status !== 'Link Down';
  }).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">
            {status?.des || 'SL-8T2XS-WEB'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {status?.sys_ipv4 || '—'} · {status?.sys_macaddr || '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-refresh selector */}
          <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            <span className="pl-2.5 pr-1.5 text-xs text-gray-500 flex items-center gap-1">
              <RefreshCw size={11} className={clsx(interval > 0 && 'animate-spin')} style={interval > 0 ? { animationDuration: `${interval}ms` } : {}} />
              Auto
            </span>
            <select
              value={interval}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              className="bg-transparent text-xs text-gray-300 pr-2 py-1.5 focus:outline-none cursor-pointer"
            >
              {INTERVALS.map((o) => (
                <option key={o.value} value={o.value} className="bg-gray-800">
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            onClick={handleClear}
            disabled={clearing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 size={12} /> {clearing ? 'Clearing…' : 'Clear stats'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="IP Address" value={status?.sys_ipv4 ?? '…'} />
        <StatCard label="MAC Address" value={status?.sys_macaddr ?? '…'} />
        <StatCard label="Ports Active" value={status ? `${upCount} / ${portNums.length}` : '…'} />
        <StatCard label="Firmware" value={status?.hw_ver ?? '…'} />
      </div>

      <div>
        <h2 className="text-sm font-medium text-gray-400 mb-3">Port Status</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {portNums.map((n) => (
            <PortCard key={n} portNum={n} stat={stats[`Port_${n}`]} />
          ))}
        </div>
      </div>
    </div>
  );
}
