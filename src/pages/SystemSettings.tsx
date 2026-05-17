import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Save, RefreshCw, Info } from 'lucide-react';
import { getStatus, getNetworkSettings, setDeviceName, setNetworkSettings, reboot } from '../api/switch';
import type { NetworkSettings, StatusResponse } from '../types/switch';
import { useApiCall } from '../contexts/auth';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 items-center gap-4">
      <label className="text-sm text-gray-400">{label}</label>
      <p className="col-span-2 text-sm font-mono text-gray-400">{value || '—'}</p>
    </div>
  );
}

function FormField({
  label, name, value, type = 'text', disabled = false,
  onChange,
}: {
  label: string; name: string; value: string; type?: string;
  disabled?: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="grid grid-cols-3 items-center gap-4">
      <label htmlFor={name} className="text-sm text-gray-400">{label}</label>
      <div className="col-span-2">
        <input
          id={name} name={name} type={type} value={value}
          onChange={onChange} disabled={disabled} autoComplete="off"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 font-mono"
        />
      </div>
    </div>
  );
}

export default function SystemSettings() {
  const apiCall = useApiCall();
  const [sysInfo, setSysInfo] = useState<StatusResponse | null>(null);
  const [net, setNet] = useState<NetworkSettings>({ input_ip: '', input_mask: '', input_gateway: '', dhcp: 'off' });
  const [deviceName, setDeviceNameState] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    apiCall(async () => {
      const [s, n] = await Promise.all([getStatus(), getNetworkSettings()]);
      setSysInfo(s);
      setDeviceNameState(s.des);
      setNet(n);
    })
      .catch((e: unknown) => setStatus({ ok: false, msg: (e as Error).message }))
      .finally(() => setLoading(false));
  }, []);

  function handleNetChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setNet((n) => ({ ...n, [name]: type === 'checkbox' ? (checked ? 'on' : 'off') : value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await apiCall(() => Promise.all([setDeviceName(deviceName), setNetworkSettings(net)]));
      setStatus({ ok: true, msg: 'Settings saved.' });
    } catch (err: unknown) {
      setStatus({ ok: false, msg: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleReboot() {
    if (!confirm('Reboot the switch now?')) return;
    try {
      await reboot();
      setStatus({ ok: true, msg: 'Rebooting…' });
    } catch (err: unknown) {
      setStatus({ ok: false, msg: (err as Error).message });
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500 text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-white">System Settings</h1>

      {status && (
        <p className={`text-sm rounded-lg px-3 py-2 border ${status.ok ? 'text-green-400 bg-green-950/40 border-green-900' : 'text-red-400 bg-red-950/40 border-red-900'}`}>
          {status.msg}
        </p>
      )}

      {/* Read-only info */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Info size={15} className="text-blue-400" />
          <h2 className="text-sm font-medium text-gray-300">Device Information</h2>
        </div>
        <Field label="MAC Address" value={sysInfo?.sys_macaddr ?? ''} />
        <Field label="Hardware Version" value={sysInfo?.hw_ver ?? ''} />
        <Field label="IPv6 Link-local" value={sysInfo?.sys_ipv6_ll ?? ''} />
      </section>

      <form onSubmit={handleSave} className="space-y-4">
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-300 mb-2">Device Identity</h2>
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="text-sm text-gray-400">Device Name</label>
            <div className="col-span-2">
              <input
                value={deviceName}
                onChange={(e) => setDeviceNameState(e.target.value)}
                maxLength={16}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-300">Network</h2>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox" name="dhcp"
                checked={net.dhcp === 'on'} onChange={handleNetChange}
                className="accent-blue-500"
              />
              DHCP
            </label>
          </div>
          <FormField label="IP Address"   name="input_ip"      value={net.input_ip}      onChange={handleNetChange} disabled={net.dhcp === 'on'} />
          <FormField label="Subnet Mask"  name="input_mask"    value={net.input_mask}    onChange={handleNetChange} disabled={net.dhcp === 'on'} />
          <FormField label="Gateway"      name="input_gateway" value={net.input_gateway} onChange={handleNetChange} disabled={net.dhcp === 'on'} />
        </section>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button" onClick={handleReboot}
            className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/50 rounded-lg transition-colors"
          >
            Reboot Switch
          </button>
        </div>
      </form>
    </div>
  );
}
