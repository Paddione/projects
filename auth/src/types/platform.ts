export interface Profile {
  userId: number;
  displayName: string | null;
  selectedCharacter: string;
  selectedGender: string;
  selectedPowerUp: string | null;
  respectBalance: number;
  xpTotal: number;
  level: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItem {
  id: number;
  userId: number;
  itemId: string;
  itemType: 'skin' | 'emote' | 'title' | 'border' | 'power_up';
  acquiredAt: Date;
  acquisitionSource: 'respect_purchase' | 'stripe' | 'achievement' | 'level_unlock';
}

export interface Loadout {
  userId: number;
  equippedSkin: string | null;
  equippedEmote1: string | null;
  equippedEmote2: string | null;
  equippedEmote3: string | null;
  equippedEmote4: string | null;
  equippedTitle: string | null;
  equippedBorder: string | null;
  equippedPowerUp: string | null;
  updatedAt: Date;
}

export interface CatalogItem {
  itemId: string;
  itemType: string;
  name: string;
  description: string | null;
  respectCost: number;
  unlockLevel: number | null;
  gender: string | null;
  character: string | null;
  previewAssetUrl: string | null;
  active: boolean;
}

export interface Transaction {
  id: number;
  userId: number;
  type: 'respect_purchase' | 'item_purchase' | 'xp_bet' | 'respect_earned' | 'xp_refund';
  currency: 'respect' | 'xp';
  amount: number;
  itemId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface MatchEscrow {
  id: number;
  token: string;
  playerIds: number[];
  escrowedXp: Record<string, number>;
  matchConfig: Record<string, unknown> | null;
  status: 'pending' | 'active' | 'settled' | 'refunded';
  expiresAt: Date;
  createdAt: Date;
  settledAt: Date | null;
}

export interface ProfileWithLoadout extends Profile {
  loadout: Loadout;
  inventory: InventoryItem[];
}

export interface PurchaseResult {
  success: boolean;
  item: InventoryItem;
  newBalance: number;
}
