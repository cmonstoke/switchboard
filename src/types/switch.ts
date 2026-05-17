// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginParams {
  username: string;
  password: string;
}

// ── System / Status ───────────────────────────────────────────────────────────

// GET status.json
export interface StatusResponse {
  des: string;          // device description/name
  hw_ver: string;
  sys_ipv4: string;
  sys_ipv6: string;
  sys_ipv6_ll: string;
  sys_macaddr: string;
}

// GET network_settings.json
export interface NetworkSettings {
  input_ip: string;
  input_mask: string;
  input_gateway: string;
  dhcp: 'on' | 'off';
}

// ── Ports ─────────────────────────────────────────────────────────────────────

// GET port_setting_load.json
// Response: { PortNum: "10", Port_1: { Port_1_state: 1, ... }, ... }
export interface PortInfo {
  state: 1 | 0;             // link up/down
  Port_Status: string;      // e.g. "Link Up"
  Spd_Duplex_Actual: string;
  Spd_Duplex_Cfg: string;
  Flow_Ctrl_Actual: string;
  Flow_Ctrl_Cfg: string;
  Egress_Status: string;
  Ingress_Status: string;
}

export interface PortSettingResponse {
  PortNum: string;
  [key: string]: PortInfo | string; // Port_1 … Port_10
}

// GET port_statistics.json
export interface PortStatEntry {
  Port_Status: string;
  Link_Status: string;
  TxGoodPkt: string;
  TxBadPkt: string;
  RxGoodPkt: string;
  RxBadPkt: string;
}

// ── Port VLAN (port-based VLAN) ───────────────────────────────────────────────

// GET port_vlan_cfg.json
// Response: { totBports: "10", Port_1: { bpEn_1, bpVid_1, tag_1, untag_1 }, ... }
export interface PortVlanEntry {
  bpEn: string;   // "0" | "1"  – bridge-port VLAN enable
  bpVid: string;  // PVID
  tag: string;    // "0" | "1"
  untag: string;  // "0" | "1"
}

// ── Tag VLAN ──────────────────────────────────────────────────────────────────

// GET tag_vlan_cfg.json
// Response: array of bP_N entries
export interface TagVlanEntry {
  bp: number;     // bridge-port index
  TBVEn: string;  // "0" | "1" – VLAN enabled
  tT: string;     // "0" SglTag | "1" DblTag
  pP: string;     // physical port (mapped)
  bR: string;     // bridge
  oVid: string;   // outer VID
  iVid: string;   // inner VID (DblTag only)
}

// ── Port mapping ──────────────────────────────────────────────────────────────

// UI port number (1-10) → hardware port number
// UI 1-8 = hw 1-8, UI 9 = hw 10 (SFP+1), UI 10 = hw 9 (SFP+2)
export const PORT_MAP: Record<number, number> = {
  0: 0,
  1: 1, 2: 2, 3: 3, 4: 4,
  5: 5, 6: 6, 7: 7, 8: 8,
  9: 10, 10: 9,
};

export const PORT_NAMES: Record<number, string> = {
  1: 'Port 1', 2: 'Port 2', 3: 'Port 3', 4: 'Port 4',
  5: 'Port 5', 6: 'Port 6', 7: 'Port 7', 8: 'Port 8',
  9: 'Port 9', 10: 'Port 10',
};
