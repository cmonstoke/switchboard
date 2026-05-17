import md5 from './md5';
import type {
  StatusResponse,
  NetworkSettings,
  PortSettingResponse,
  PortStatEntry,
  PortVlanEntry,
  TagVlanEntry,
  LoginParams,
} from '../types/switch';
import { PORT_MAP as portMap } from '../types/switch';

// Dynamic base URL — set to /switch/{ip} when a switch is selected.
// Vite's configureServer middleware proxies /switch/{ip}/* → http://{ip}/*
let _activeIp = '';
export function setActiveIp(ip: string) { _activeIp = ip; }
export function getActiveIp() { return _activeIp; }
function BASE() { return `/switch/${_activeIp}`; }

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE()}/${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { credentials: 'include' });
  const text = await res.text();
  if (text.includes('login.html')) throw new SessionExpiredError();
  return JSON.parse(text) as T;
}

async function post<T>(path: string, data: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${BASE()}/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (text.includes('login.html')) throw new SessionExpiredError();
  return (text ? JSON.parse(text) : {}) as T;
}

export class SessionExpiredError extends Error {
  constructor() { super('Session expired'); }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login({ username, password }: LoginParams): Promise<boolean> {
  const url = `${BASE()}/authorize?loginusr=${md5(username)}&loginpwd=${md5(password)}`;
  const r = await fetch(url, { credentials: 'include' });
  const text = await r.text();
  return !text.includes('login.html');
}

export async function logout(): Promise<void> {
  await get('logout.json');
}

// ── System ────────────────────────────────────────────────────────────────────

export async function getStatus(): Promise<StatusResponse> {
  return get<StatusResponse>('status.json');
}

export async function setDeviceName(name: string): Promise<void> {
  await post('set_des.json', { input_des: name });
}

export async function getNetworkSettings(): Promise<NetworkSettings> {
  return get<NetworkSettings>('network_settings.json');
}

export async function setNetworkSettings(s: NetworkSettings): Promise<void> {
  await post('network_settings_ipv4.json', s as unknown as Record<string, unknown>);
}

export async function getUserAccount(): Promise<{ username: string }> {
  return get('user_ac_cfg.json');
}

export async function setUserAccount(username: string, password: string): Promise<void> {
  await post('user_ac_cfg.json', {
    usr: md5(username),
    pwd: md5(password),
  });
}

export async function reboot(): Promise<void> {
  await post('system_reboot.json');
}

export async function factoryReset(): Promise<void> {
  await post('factory_reset.json');
}

// ── Ports ─────────────────────────────────────────────────────────────────────

export async function getPortSettings(): Promise<PortSettingResponse> {
  return get<PortSettingResponse>('port_setting_load.json');
}

export async function savePortSettings(data: Record<string, unknown>): Promise<void> {
  await post('save_user_port_setting.json', data);
  await post('apply_user_port_setting.json', {});
}

export async function getPortStatistics(): Promise<Record<string, PortStatEntry>> {
  return get('port_statistics.json');
}

export async function clearStatistics(): Promise<void> {
  await get('clear_statistics.json');
}

// ── Port VLAN ─────────────────────────────────────────────────────────────────

// Returns { totBports: "10", Port_1: { bpEn_1, bpVid_1, tag_1, untag_1 }, ... }
export async function getPortVlan(): Promise<{ totBports: string; [k: string]: unknown }> {
  return get('port_vlan_cfg.json');
}

export function parsePortVlan(raw: Record<string, unknown>): PortVlanEntry[] {
  const total = parseInt(raw['totBports'] as string, 10);
  const result: PortVlanEntry[] = [];
  for (let i = 1; i <= total; i++) {
    const hw = portMap[i];
    const p = raw[`Port_${hw}`] as Record<string, string>;
    result.push({
      bpEn:  p[`bpEn_${hw}`],
      bpVid: p[`bpVid_${hw}`],
      tag:   p[`tag_${hw}`],
      untag: p[`untag_${hw}`],
    });
  }
  return result;
}

export async function setPortVlan(data: Record<string, unknown>): Promise<void> {
  await post('port_vlan_cfg.json', data);
  await post('save_port_vlan_map.json', {});
}

// ── Tag VLAN ──────────────────────────────────────────────────────────────────

// BP (bridge-port) indices are hardware-limited to 0–63.
export const MAX_BP = 63;

export async function getTagVlan(): Promise<Record<string, unknown>> {
  return get('tag_vlan_cfg.json');
}

// Parse raw tag_vlan_cfg.json into a flat array, one entry per BP slot.
// Only returns slots that exist in the response (hardware may stop early).
export function parseTagVlan(raw: Record<string, unknown>): TagVlanEntry[] {
  const result: TagVlanEntry[] = [];
  for (let i = 0; i <= MAX_BP; i++) {
    const bp = raw[`bP_${i}`] as Record<string, string> | undefined;
    if (!bp) break;
    result.push({
      bp:    i,
      TBVEn: bp[`TBVEn_${i}`] ?? '0',
      tT:    bp[`tT_${i}`]    ?? '0',
      pP:    String(portMap[Number(bp[`pP_${i}`])] ?? bp[`pP_${i}`]),
      bR:    bp[`bR_${i}`]    ?? '0',
      oVid:  bp[`oVid_${i}`]  ?? '1',
      iVid:  bp[`iVid_${i}`]  ?? '0',
    });
  }
  return result;
}

// Serialise a TagVlanEntry array back into the form the switch expects.
export function serializeTagVlan(entries: TagVlanEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  entries.forEach((e) => {
    const i = e.bp;
    // Reverse the port mapping before sending back to hardware
    const hwPort = Object.entries(portMap).find(([, v]) => v === Number(e.pP))?.[0] ?? e.pP;
    out[`bpCboxName_${i}`]  = e.TBVEn === '1' ? 'on' : '';
    out[`vtypeName_${i}`]   = e.tT;
    out[`ppName_${i}`]      = String(hwPort);
    out[`brName_${i}`]      = e.bR;
    out[`oVidName_${i}`]    = e.oVid;
    out[`iVidName_${i}`]    = e.iVid;
  });
  return out;
}

export async function setTagVlan(data: Record<string, unknown>): Promise<void> {
  await post('tag_vlan_cfg.json', data);
  await post('save_tag_vlan_map.json', {});
}
