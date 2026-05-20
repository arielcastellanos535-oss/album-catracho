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

  const allStickers = typedStickers
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

  // 3. 🔥 ADAPTADO: Leer desde tu tabla real 'trade_offers'
  // Filtramos solo ofertas públicas (target_user_id es nulo) y pendientes
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

  const activeTrades = (activeTradesRaw || []).map((t: any) => ({
    id: t.id,
    offered_name: t.offered?.name || "Cromo Desconocido",
    wanted_name: t.wanted?.name || "Cromo Desconocido",
  }));

  // 4. Obtener las subastas activas adaptadas a tus columnas reales
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
    .eq("status", "active");

  const activeAuctions = (activeAuctionsRaw || []).map((a: any) => ({
    id: a.id,
    sticker_name: a.stickers?.name || "Cromo en Subasta",
    seller_name: "Streamer", 
    highest_bid: a.highest_bid || a.min_bet || 10,
    expires_at: a.expires_at,
    status: a.status
  }));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 md:px-8">
      <TradingModule 
        departments={departments || []} 
        allStickers={allStickers} 
        activeAuctions={activeAuctions}
        activeTrades={activeTrades}
      />
    </main>
  );
}