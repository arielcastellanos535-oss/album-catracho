export type StickerRarity = "common" | "silver" | "special";
export type PackType = "normal" | "silver" | "gold";

export type Department = {
  id: string;
  name: string;
  slug: string;
  page_order: number;
  slots_count: number;
  municipalities_count?: number;
  is_mvp_active: boolean;
  fact_title: string | null;
};

export type Sticker = {
  id: string;
  department_id: string;
  slot_index: number;
  number: number;
  name: string;
  fact_text: string | null;
  image_url: string | null;
  rarity: StickerRarity;
  is_mvp: boolean;
};

export type UserProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  coins: number;
  packs_opened_today: number;
  last_pack_date: string | null;
  coins_claimed_today: number;
  last_coin_date: string | null;
};

export type CoinDashboard = {
  current_balance: number;
  initial_coins: number;
  coins_earned: number;
  coins_spent: number;
  frozen_coins: number;
  coins_available: number;
  daily_coins_today: number;
  daily_claimable: boolean;
  next_claim_at: string;
};

export type UserSticker = {
  id: string;
  user_id: string;
  sticker_id: string;
  quantity: number;
  first_obtained_at: string;
  seen_at: string | null;
  sticker?: Sticker;
};

export type UserAlbumSlot = {
  id: string;
  user_id: string;
  sticker_id: string;
  pasted_at: string;
};
