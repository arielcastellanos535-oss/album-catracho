import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { offeredStickerId, wantedStickerId } = body;
    const supabase = await createClient();

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

    // Verificar propiedad y reglas (duplicado o no pegado si qty === 1)
    const { data: usRowsRaw } = await supabase
      .from("user_stickers")
      .select("id, quantity, sticker_id")
      .eq("user_id", user.id)
      .eq("sticker_id", offeredStickerId)
      .limit(1);

    const usRows = usRowsRaw as { id: string; quantity: number; sticker_id: string }[] | null;
    const us = usRows?.[0] ?? null;
    if (!us) return NextResponse.json({ error: "offered_not_owned" }, { status: 400 });

    if (us.quantity <= 0) return NextResponse.json({ error: "invalid_quantity" }, { status: 400 });

    if (us.quantity === 1) {
      // revisar si está pegado en album
      const { data: slotRaw } = await supabase
        .from("user_album_slots")
        .select("id")
        .eq("user_id", user.id)
        .eq("sticker_id", offeredStickerId)
        .limit(1);
      const slot = slotRaw as { id: string }[] | null;
      if ((slot?.length ?? 0) > 0) {
        return NextResponse.json({ error: "sticker_pasted" }, { status: 400 });
      }
    }

    // Evitar duplicar ofertas activas para el mismo cromo por el mismo usuario
    const { data: existingRaw } = await supabase
      .from("trade_offers")
      .select("id")
      .eq("user_id", user.id)
      .eq("sticker_id_offered", offeredStickerId)
      .eq("status", "pending")
      .limit(1);
    const existing = existingRaw as { id: string }[] | null;

    if ((existing?.length ?? 0) > 0) {
      return NextResponse.json({ error: "offer_already_active" }, { status: 409 });
    }

    // Reservar el cromo ofrecido para evitar que se use en otras operaciones
    const { error: reserveErr } = await supabase.from('asset_reservations').insert([
      {
        user_id: user.id,
        sticker_id: offeredStickerId,
        quantity: 1,
        created_at: new Date().toISOString()
      }
    ]);
    if (reserveErr) {
      console.error('reserve error', reserveErr);
      return NextResponse.json({ error: 'sticker_already_reserved' }, { status: 409 });
    }

    const newId = crypto.randomUUID();
    const { error } = await supabase.from("trade_offers").insert([
      {
        id: newId,
        user_id: user.id,
        sticker_id_offered: offeredStickerId,
        sticker_id_wanted: wantedStickerId,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      // deshacer reserva si falla la inserción
      await supabase.from('asset_reservations').delete().eq('user_id', user.id).eq('sticker_id', offeredStickerId);
      throw error;
    }

    return NextResponse.json({ success: true, id: newId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server_error", detail: (err as Error).message }, { status: 500 });
  }
}
