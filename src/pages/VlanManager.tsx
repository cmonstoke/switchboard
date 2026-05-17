import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Download, Upload } from 'lucide-react';
import clsx from 'clsx';
import {
  getPortVlan, parsePortVlan, setPortVlan,
  getTagVlan, parseTagVlan, serializeTagVlan, setTagVlan,
  MAX_BP, getActiveIp,
} from '../api/switch';
import type { PortVlanEntry, TagVlanEntry } from '../types/switch';
import { PORT_NAMES, PORT_MAP } from '../types/switch';
import { useApiCall } from '../contexts/auth';
import { getSwitches } from '../stores/switches';

const PORT_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const BP_OFFSET = 17;

async function activeSwitchName(): Promise<string> {
  const ip = getActiveIp();
  const switches = await getSwitches();
  const sw = switches.find((s) => s.ip === ip);
  return (sw?.name ?? ip ?? '').replace(/[^a-z0-9_-]/gi, '_');
}

// ── CSV utilities ─────────────────────────────────────────────────────────────

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsvRows(text: string): string[][] {
  return text.trim().split('\n').slice(1).map((line) =>
    line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
  );
}

function boolVal(s: string): '1' | '0' {
  return ['1', 'yes', 'true', 'on'].includes(s.toLowerCase()) ? '1' : '0';
}

// ── Port VLAN CSV ─────────────────────────────────────────────────────────────

function portVlanToCsv(ports: PortVlanEntry[]): string {
  const header = 'Port,Name,BP Enable,PVID,Untagged,Tagged';
  const rows = ports.map((p, i) => {
    const n = i + 1;
    return `${n},${PORT_NAMES[n]},${p.bpEn},${p.bpVid},${p.untag},${p.tag}`;
  });
  return [header, ...rows].join('\n');
}

function csvToPortVlan(text: string): PortVlanEntry[] | string {
  const rows = parseCsvRows(text);
  if (rows.length !== 10) return `Expected 10 data rows, got ${rows.length}`;
  return rows.map((cols) => {
    if (cols.length < 6) return null;
    return {
      bpEn:  boolVal(cols[2]),
      bpVid: cols[3],
      untag: boolVal(cols[4]),
      tag:   boolVal(cols[5]),
    };
  }).filter(Boolean) as PortVlanEntry[];
}

// ── Tag VLAN CSV ──────────────────────────────────────────────────────────────

function tagVlanToCsv(entries: TagVlanEntry[]): string {
  const header = 'Bridge Port,Enable,Port,Tag Type,Bridge ID,External VLAN,Internal VLAN';
  const rows = entries.map((e) => {
    const tagType = e.tT === '1' ? 'DT' : 'S';
    return `BP_${e.bp + BP_OFFSET},${e.TBVEn},${e.pP},${tagType},${e.bR},${e.oVid},${e.iVid}`;
  });
  return [header, ...rows].join('\n');
}

function csvToTagVlan(text: string, existing: TagVlanEntry[]): TagVlanEntry[] | string {
  const rows = parseCsvRows(text);
  const result = existing.map((e) => ({ ...e }));

  for (const cols of rows) {
    if (cols.length < 7) return `Malformed row: ${cols.join(',')}`;
    const bpMatch = cols[0].match(/^BP_(\d+)$/i);
    if (!bpMatch) return `Invalid Bridge Port "${cols[0]}" — expected e.g. BP_17`;
    const bp = parseInt(bpMatch[1], 10) - BP_OFFSET;
    if (bp < 0 || bp > MAX_BP) return `Bridge Port BP_${parseInt(bpMatch[1], 10)} is out of range`;

    const portNum = parseInt(cols[2], 10);
    if (!PORT_NAMES[portNum]) return `Invalid port number "${cols[2]}" at ${cols[0]}`;

    const bR = cols[4];
    const oVid = cols[5];
    const brVal = parseInt(bR, 10);
    const oVidVal = parseInt(oVid, 10);
    if (isNaN(brVal) || brVal < 0 || brVal > 63)
      return `Bridge ID out of range at ${cols[0]} (must be 0–63)`;
    if (isNaN(oVidVal) || oVidVal < 1 || oVidVal > 4094)
      return `External VLAN out of range at ${cols[0]} (must be 1–4094)`;

    const entry: TagVlanEntry = {
      bp,
      TBVEn: boolVal(cols[1]),
      pP:    String(portNum),
      tT:    cols[3].toUpperCase() === 'DT' ? '1' : '0',
      bR,
      oVid,
      iVid:  cols[6] ?? '0',
    };
    const idx = result.findIndex((e) => e.bp === bp);
    if (idx >= 0) result[idx] = entry; else result.push(entry);
  }
  return result.sort((a, b) => a.bp - b.bp);
}

// ── Port VLAN tab ─────────────────────────────────────────────────────────────

function PortVlanTab() {
  const apiCall = useApiCall();
  const [ports, setPorts] = useState<PortVlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setMsg(null);
    const raw = await apiCall(() => getPortVlan());
    if (raw) setPorts(parsePortVlan(raw as Record<string, unknown>));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function updatePort(idx: number, field: keyof PortVlanEntry, value: string) {
    setPorts((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const data: Record<string, string> = {};
      ports.forEach((p, i) => {
        const hw = PORT_MAP[i + 1];
        data[`checkbox_${hw}`]      = p.bpEn === '1' ? 'on' : '';
        data[`fidName_${hw}`]       = p.bpVid;
        data[`checkboxUntag_${hw}`] = p.untag === '1' ? 'on' : '';
        data[`checkboxTag_${hw}`]   = p.tag === '1' ? 'on' : '';
      });
      await apiCall(() => setPortVlan(data as Record<string, unknown>));
      setMsg({ ok: true, text: 'Saved.' });
    } catch (e: unknown) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = csvToPortVlan(ev.target?.result as string);
      if (typeof result === 'string') {
        setMsg({ ok: false, text: `Import error: ${result}` });
      } else {
        setPorts(result);
        setMsg({ ok: true, text: 'CSV imported — review and click Apply & Save to push to switch.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Per-port PVID, tag and untag membership</p>
        <div className="flex gap-2">
          <button onClick={async () => downloadCsv(`${await activeSwitchName()}_port-vlan.csv`, portVlanToCsv(ports))} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">
            <Upload size={14} /> Import CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Apply & Save'}
          </button>
        </div>
      </div>

      {msg && <StatusBanner ok={msg.ok} text={msg.text} />}

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Port</th>
              <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">PVID</th>
              <th className="px-4 py-3 text-center text-xs text-gray-500 font-medium">BP Enable</th>
              <th className="px-4 py-3 text-center text-xs text-gray-500 font-medium">Untagged</th>
              <th className="px-4 py-3 text-center text-xs text-gray-500 font-medium">Tagged</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600 text-sm">Loading…</td></tr>
            ) : ports.map((p, i) => (
              <tr key={i + 1} className="border-b border-gray-800 last:border-0 hover:bg-gray-900/40">
                <td className="px-4 py-3 text-gray-200 font-medium">{PORT_NAMES[i + 1]}</td>
                <td className="px-4 py-3">
                  <input type="number" min={1} max={4094}
                    value={p.bpVid} disabled={p.bpEn !== '1'}
                    onChange={(e) => updatePort(i, 'bpVid', e.target.value)}
                    className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-blue-500 disabled:opacity-40" />
                </td>
                <td className="px-4 py-3 text-center">
                  <input type="checkbox" checked={p.bpEn === '1'}
                    onChange={(e) => updatePort(i, 'bpEn', e.target.checked ? '1' : '0')}
                    className="w-4 h-4 accent-blue-500" />
                </td>
                <td className="px-4 py-3 text-center">
                  <input type="checkbox" checked={p.untag === '1'}
                    onChange={(e) => updatePort(i, 'untag', e.target.checked ? '1' : '0')}
                    className="w-4 h-4 accent-blue-500" />
                </td>
                <td className="px-4 py-3 text-center">
                  <input type="checkbox" checked={p.tag === '1'}
                    onChange={(e) => updatePort(i, 'tag', e.target.checked ? '1' : '0')}
                    className="w-4 h-4 accent-amber-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tag VLAN tab ──────────────────────────────────────────────────────────────

function TagVlanTab() {
  const apiCall = useApiCall();
  const [entries, setEntries] = useState<TagVlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setMsg(null);
    const raw = await apiCall(() => getTagVlan());
    if (raw) setEntries(parseTagVlan(raw as Record<string, unknown>));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function updateEntry(bp: number, field: keyof TagVlanEntry, value: string) {
    setEntries((prev) => prev.map((e) => e.bp === bp ? { ...e, [field]: value } : e));
  }

  function validate(e: TagVlanEntry): string | null {
    const vid = parseInt(e.oVid, 10);
    if (isNaN(vid) || vid < 1 || vid > 4094) return 'External VLAN must be 1–4094';
    const br = parseInt(e.bR, 10);
    if (isNaN(br) || br < 0 || br > 63) return 'Bridge ID must be 0–63';
    return null;
  }

  async function handleSave() {
    for (const e of entries.filter((e) => e.TBVEn === '1')) {
      const err = validate(e);
      if (err) { setMsg({ ok: false, text: `BP_${e.bp + BP_OFFSET}: ${err}` }); return; }
    }
    setSaving(true);
    setMsg(null);
    try {
      const data = serializeTagVlan(entries);
      await apiCall(() => setTagVlan(data as Record<string, unknown>));
      setMsg({ ok: true, text: 'Saved.' });
    } catch (e: unknown) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = csvToTagVlan(ev.target?.result as string, entries);
      if (typeof result === 'string') {
        setMsg({ ok: false, text: `Import error: ${result}` });
      } else {
        setEntries(result);
        setMsg({ ok: true, text: 'CSV imported — review and click Apply & Save to push to switch.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const enabled = entries.filter((e) => e.TBVEn === '1');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          802.1Q · BP_{BP_OFFSET}–BP_{BP_OFFSET + MAX_BP} · Bridge ID 0–63 · {enabled.length} active
        </p>
        <div className="flex gap-2">
          <button onClick={async () => downloadCsv(`${await activeSwitchName()}_tag-vlan.csv`, tagVlanToCsv(entries))} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">
            <Upload size={14} /> Import CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Apply & Save'}
          </button>
        </div>
      </div>

      {msg && <StatusBanner ok={msg.ok} text={msg.text} />}

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="px-3 py-3 text-left text-xs text-gray-500 font-medium w-20">Bridge Port</th>
              <th className="px-3 py-3 text-center text-xs text-gray-500 font-medium w-16">Enable</th>
              <th className="px-3 py-3 text-left text-xs text-gray-500 font-medium">Port</th>
              <th className="px-3 py-3 text-left text-xs text-gray-500 font-medium w-24">Tag Type</th>
              <th className="px-3 py-3 text-left text-xs text-gray-500 font-medium w-24">Bridge ID</th>
              <th className="px-3 py-3 text-left text-xs text-gray-500 font-medium w-28">External VLAN</th>
              <th className="px-3 py-3 text-left text-xs text-gray-500 font-medium w-28">Internal VLAN</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600 text-sm">Loading…</td></tr>
            ) : entries.map((e) => {
              const isOn = e.TBVEn === '1';
              return (
                <tr key={e.bp}
                  className={clsx(
                    'border-b border-gray-800 last:border-0',
                    isOn ? 'hover:bg-gray-900/40' : 'opacity-40 hover:opacity-60'
                  )}>
                  <td className="px-3 py-2 font-mono text-gray-300 text-xs font-medium">
                    BP_{e.bp + BP_OFFSET}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={isOn}
                      onChange={(ev) => updateEntry(e.bp, 'TBVEn', ev.target.checked ? '1' : '0')}
                      className="w-4 h-4 accent-blue-500" />
                  </td>
                  <td className="px-3 py-2">
                    <select value={e.pP} disabled={!isOn}
                      onChange={(ev) => updateEntry(e.bp, 'pP', ev.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-40">
                      {PORT_NUMS.map((n) => (
                        <option key={n} value={String(n)}>{PORT_NAMES[n]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select value={e.tT} disabled={!isOn}
                      onChange={(ev) => updateEntry(e.bp, 'tT', ev.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-40">
                      <option value="0">S</option>
                      <option value="1">DT</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} max={63}
                      value={e.bR} disabled={!isOn}
                      onChange={(ev) => updateEntry(e.bp, 'bR', ev.target.value)}
                      className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-blue-500 disabled:opacity-40" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={1} max={4094}
                      value={e.oVid} disabled={!isOn}
                      onChange={(ev) => updateEntry(e.bp, 'oVid', ev.target.value)}
                      className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-blue-500 disabled:opacity-40" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} max={4094}
                      value={e.iVid} disabled={!isOn || e.tT !== '1'}
                      onChange={(ev) => updateEntry(e.bp, 'iVid', ev.target.value)}
                      className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-blue-500 disabled:opacity-40" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function StatusBanner({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p className={clsx(
      'text-sm rounded-lg px-3 py-2 border',
      ok ? 'text-green-400 bg-green-950/40 border-green-900'
         : 'text-red-400 bg-red-950/40 border-red-900'
    )}>{text}</p>
  );
}

type Tab = 'port' | 'tag';

export default function VlanManager() {
  const [tab, setTab] = useState<Tab>('port');

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-semibold text-white">VLAN Management</h1>

      <div className="flex gap-1 border-b border-gray-800 pb-0">
        {([['port', 'Port VLAN'], ['tag', 'Tag VLAN (802.1Q)']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx(
              'px-4 py-2 text-sm rounded-t-lg border border-b-0 transition-colors',
              tab === id
                ? 'bg-gray-900 border-gray-700 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'port' ? <PortVlanTab /> : <TagVlanTab />}
    </div>
  );
}
