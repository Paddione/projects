export interface OnlinePlayersData {
  history_id: number;
  num_online_players: number;
  timestamp: number;
}

export interface OnlinePlayersResponse {
  current: number;
  history: OnlinePlayersData[];
}

export interface OnlinePlayersLastResponse {
  online: number;
  timestamp: number;
}

// Player history item (for charts, subset of OnlinePlayersData)
export interface PlayerHistoryItem {
  timestamp: number;
  num_online_players: number;
}

// Navbar stats
export interface NavbarStats {
  players: number | null;
  serverOnline: boolean | null;
  characters: number | null;
}

// Home page stats
export interface HomeStats {
  totalCharacters: number;
  totalTrackedItems?: number;
  totalEconomyItems: number;
  totalExports: number;
  totalListings: number;
}

// Terror zone types
export interface CurrentZone {
  zone: string;
  secondsUntilNext: number;
}

export interface NextZone {
  zone: string;
  secondsUntilActive: number;
}

export interface TerrorZoneDisplay {
  zone: string;
  min: string;
}

export interface NextZoneDisplay {
  zone: string;
  minutesUntil: string;
}
