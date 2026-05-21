import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { auctionId } = await req.json();
    const supabase = await createClient();

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    const { data, error } = await supabase.rpc('finalize_auction', { p_auction_id: auctionId });
    if (error) {
      console.error('finalize_auction rpc error', error);
      return NextResponse.json({ error: error.message || 'finalize_failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true, detail: data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'server_error', detail: (err as Error).message }, { status: 500 });
  }
}
