export interface SwitchConfig {
  id: string;
  name: string;
  ip: string;
}

const API = '/api/switches';

export async function getSwitches(): Promise<SwitchConfig[]> {
  try {
    const res = await fetch(API);
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

export async function addSwitch(name: string, ip: string): Promise<SwitchConfig> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ip }),
  });
  return res.json();
}

export async function removeSwitch(id: string): Promise<void> {
  await fetch(`${API}/${id}`, { method: 'DELETE' });
}

// Last-selected switch ID stays in localStorage — it's just a UI preference, not sensitive
export function getLastSelectedId(): string | null {
  return localStorage.getItem('sodola_last_switch');
}

export function setLastSelectedId(id: string): void {
  if (id) localStorage.setItem('sodola_last_switch', id);
  else localStorage.removeItem('sodola_last_switch');
}
