import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { tradeId } = await req.json();
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

    // Obtener el trade
    const { data: tradesRaw } = await supabase
      .from("trade_offers")
      .select("id, user_id, sticker_id_offered, sticker_id_wanted, status")
      .eq("id", tradeId)
      .limit(1);

    const trades = tradesRaw as { id: string; user_id: string; sticker_id_offered: string; sticker_id_wanted: string; status: string }[] | null;
    const trade = trades?.[0] ?? null;
    if (!trade) return NextResponse.json({ error: "trade_not_found" }, { status: 404 });
    if (trade.status !== "pending") return NextResponse.json({ error: "trade_not_pending" }, { status: 400 });
    if (trade.user_id === user.id) return NextResponse.json({ error: "cannot_accept_own_trade" }, { status: 403 });

    const sellerId = trade.user_id;
    const offeredStickerId = trade.sticker_id_offered;
    const wantedStickerId = trade.sticker_id_wanted;

    // Verificaciones: comprador (user) debe poseer wantedSticker y no estar pegado si qty ===1
    const { data: buyerRowsRaw } = await supabase
      .from("user_stickers")
      .select("id, quantity, sticker_id")
      .eq("user_id", user.id)
      .eq("sticker_id", wantedStickerId)
      .limit(1);
    const buyerRows = buyerRowsRaw as { id: string; quantity: number; sticker_id: string }[] | null;
    const buyerRow = buyerRows?.[0] ?? null;
    if (!buyerRow || buyerRow.quantity <= 0) return NextResponse.json({ error: "buyer_lacks_wanted" }, { status: 400 });
    if (buyerRow.quantity === 1) {
      const { data: slotRaw } = await supabase
        .from("user_album_slots")
        .select("id")
        .eq("user_id", user.id)
        .eq("sticker_id", wantedStickerId)
        .limit(1);
      const slot = slotRaw as { id: string }[] | null;
      if ((slot?.length ?? 0) > 0) return NextResponse.json({ error: "buyer_wanted_pasted" }, { status: 400 });
    }

    // Verificar que el vendedor aún tenga el ofrecido
    const { data: sellerRowsRaw } = await supabase
      .from("user_stickers")
      .select("id, quantity, sticker_id")
      .eq("user_id", sellerId)
      .eq("sticker_id", offeredStickerId)
      .limit(1);
    const sellerRows = sellerRowsRaw as { id: string; quantity: number; sticker_id: string }[] | null;
    const sellerRow = sellerRows?.[0] ?? null;
    if (!sellerRow || sellerRow.quantity <= 0) return NextResponse.json({ error: "seller_no_longer_has" }, { status: 400 });
    if (sellerRow.quantity === 1) {
      const { data: slotRaw } = await supabase
        .from("user_album_slots")
        .select("id")
        .eq("user_id", sellerId)
        .eq("sticker_id", offeredStickerId)
        .limit(1);
      const slot = slotRaw as { id: string }[] | null;
      if ((slot?.length ?? 0) > 0) return NextResponse.json({ error: "seller_offered_pasted" }, { status: 400 });
    }

    // Ejecutar RPC atómico en la base de datos (ejecuta la transferencia y marca accepted)
    const { data: rpcData, error: rpcError } = await supabase.rpc('execute_trade', { p_trade_id: tradeId });
    if (rpcError) {
      console.error('RPC error', rpcError);
      return NextResponse.json({ error: rpcError.message || 'rpc_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, detail: rpcData });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server_error", detail: (err as Error).message }, { status: 500 });
  }
}
