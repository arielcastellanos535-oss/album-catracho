import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { tradeId } = await req.json();
    const supabase = await createClient();

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    // Verificar que la oferta exista y pertenezca al usuario
    const { data: tradesRaw } = await supabase
      .from('trade_offers')
      .select('id, user_id, sticker_id_offered')
      .eq('id', tradeId)
      .limit(1);
    const trades = tradesRaw as { id: string; user_id: string; sticker_id_offered: string }[] | null;
    const trade = trades?.[0] ?? null;
    if (!trade) return NextResponse.json({ error: 'trade_not_found' }, { status: 404 });
    if (trade.user_id !== user.id) return NextResponse.json({ error: 'not_owner' }, { status: 403 });

    // Borrar oferta y liberar reserva
    const { error } = await supabase.from('trade_offers').delete().eq('id', tradeId);
    if (error) throw error;

    await supabase.from('asset_reservations').delete().eq('user_id', user.id).eq('sticker_id', trade.sticker_id_offered);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'server_error', detail: (err as Error).message }, { status: 500 });
  }
}
