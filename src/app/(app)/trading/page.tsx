import { createClient } from "@/lib/supabase/server";
import TradingModule from "@/components/TradingModule";

interface SupabaseStickerJoin {
  id: string;
  quantity: number;
  stickers: {
    id: string;
    name: string;
    department_id: string;
  } | null;
}

interface StickerCatalogRow {
  id: string;
  name: string;
  department_id: string;
}

// Interfaces de tipado estricto para evitar el uso de 'any'
interface SupabaseTradeRow {
  id: string;
  status: string | null;
  offered: { name: string } | { name: string }[] | null;
  wanted: { name: string } | { name: string }[] | null;
}

interface SupabaseAuctionRow {
  id: string;
  min_bet: number | null;
  highest_bid: number | null;
  expires_at: string;
  status: string | null;
  stickers: { name: string } | { name: string }[] | null;
}

export default async function TradingPage() {
  const supabase = await createClient();

  // 1. Obtener los departamentos reales ordenados
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .order("name", { ascending: true });

  // 2. Traer los cromos del usuario haciendo JOIN con la tabla global de stickers
  const { data: userStickersRaw } = await supabase
    .from("user_stickers")
    .select(`
      id,
      quantity,
      stickers (
        id,
        name,
        department_id
      )
    `);

  const typedStickers = (userStickersRaw as unknown as SupabaseStickerJoin[]) || [];

  const ownedStickers = typedStickers
    .map((us) => {
      if (!us.stickers) return null;
      return {
        id: us.stickers.id,
        name: us.stickers.name,
        department_id: us.stickers.department_id,
        quantity: us.quantity || 0,
      };
    })
    .filter((s): s is { id: string; name: string; department_id: string; quantity: number } => s !== null);

  const { data: stickerCatalogRaw } = await supabase
    .from("stickers")
    .select("id, name, department_id");

  const stickerCatalog = (stickerCatalogRaw as unknown as StickerCatalogRow[])?.map((sticker) => ({
    id: sticker.id,
    name: sticker.name,
    department_id: sticker.department_id,
    quantity: ownedStickers.find((owned) => owned.id === sticker.id)?.quantity || 0,
  })) || [];

  // 3. Leer desde tu tabla real 'trade_offers' con tipado explícito
  const { data: activeTradesRaw } = await supabase
    .from("trade_offers")
    .select(`
      id,
      status,
      offered:stickers!trade_offers_sticker_id_offered_fkey(name),
      wanted:stickers!trade_offers_sticker_id_wanted_fkey(name)
    `)
    .eq("status", "pending")
    .is("target_user_id", null)
    .order("created_at", { ascending: false });

  const typedTrades = (activeTradesRaw as unknown as SupabaseTradeRow[]) || [];

  const activeTrades = typedTrades.map((t) => {
    const offeredName = Array.isArray(t.offered) ? t.offered[0]?.name : t.offered?.name;
    const wantedName = Array.isArray(t.wanted) ? t.wanted[0]?.name : t.wanted?.name;
    return {
      id: t.id,
      offered_name: offeredName || "Cromo Desconocido",
      wanted_name: wantedName || "Cromo Desconocido",
    };
  });

  // 4. Obtener las subastas activas con tipado explícito
  const { data: activeAuctionsRaw } = await supabase
    .from("auctions")
    .select(`
      id,
      min_bet,
      highest_bid,
      expires_at,
      status,
      stickers(name)
    `)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString());

  const typedAuctions = (activeAuctionsRaw as unknown as SupabaseAuctionRow[]) || [];

  const activeAuctions = typedAuctions.map((a) => {
    const stickerName = Array.isArray(a.stickers) ? a.stickers[0]?.name : a.stickers?.name;
    return {
      id: a.id,
      sticker_name: stickerName || "Cromo en Subasta",
      seller_name: "Streamer", 
      highest_bid: a.highest_bid || a.min_bet || 10,
      expires_at: a.expires_at,
      status: a.status || "active"
    };
  });

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 md:px-8">
      <TradingModule 
        departments={departments || []} 
        ownedStickers={ownedStickers}
        stickerCatalog={stickerCatalog}
        activeAuctions={activeAuctions}
        activeTrades={activeTrades}
      />
    </main>
  );
}