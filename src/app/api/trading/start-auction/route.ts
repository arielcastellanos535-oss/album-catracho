import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { stickerId, minBet = 10, durationMinutes = 5 } = await req.json();
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

    // Verificar que el usuario tenga el sticker y que sea intercambiable (qty>1 o qty===1 y no pegado)
    const { data: rowsRaw } = await supabase
      .from("user_stickers")
      .select("id, quantity, sticker_id")
      .eq("user_id", user.id)
      .eq("sticker_id", stickerId)
      .limit(1);
    const rows = rowsRaw as { id: string; quantity: number; sticker_id: string }[] | null;
    const row = rows?.[0] ?? null;
    if (!row) return NextResponse.json({ error: "sticker_not_owned" }, { status: 400 });
    if (row.quantity <= 0) return NextResponse.json({ error: "invalid_quantity" }, { status: 400 });
    if (row.quantity === 1) {
      const { data: slotRaw } = await supabase
        .from("user_album_slots")
        .select("id")
        .eq("user_id", user.id)
        .eq("sticker_id", stickerId)
        .limit(1);
      const slot = slotRaw as { id: string }[] | null;
      if ((slot?.length ?? 0) > 0) return NextResponse.json({ error: "sticker_pasted" }, { status: 400 });
    }

    // Evitar subastar el mismo sticker si ya hay subasta activa del mismo usuario
    const { data: existingRaw } = await supabase
      .from("auctions")
      .select("id")
      .eq("seller_id", user.id)
      .eq("sticker_id", stickerId)
      .eq("status", "active")
      .limit(1);
    const existing = existingRaw as { id: string }[] | null;
    if ((existing?.length ?? 0) > 0) return NextResponse.json({ error: "auction_already_active" }, { status: 409 });

    // Reservar el sticker para la subasta
    const { error: reserveErr } = await supabase.from('asset_reservations').insert([
      { user_id: user.id, sticker_id: stickerId, quantity: 1, created_at: new Date().toISOString() }
    ]);
    if (reserveErr) {
      console.error('reserve error', reserveErr);
      return NextResponse.json({ error: 'sticker_already_reserved' }, { status: 409 });
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + Number(durationMinutes));

    const newId = crypto.randomUUID();
    const { error } = await supabase.from("auctions").insert([
      {
        id: newId,
        sticker_id: stickerId,
        seller_id: user.id,
        min_bet: minBet,
        highest_bid: minBet,
        status: "active",
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      },
    ]);
    if (error) {
      // deshacer reserva si falla
      await supabase.from('asset_reservations').delete().eq('user_id', user.id).eq('sticker_id', stickerId);
      throw error;
    }

    return NextResponse.json({ success: true, id: newId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server_error", detail: (err as Error).message }, { status: 500 });
  }
}
