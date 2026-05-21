import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { auctionId, bid } = await req.json();
    const supabase = await createClient();

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    const { data, error } = await supabase.rpc('place_bid', { p_auction_id: auctionId, p_bid: bid });
    if (error) {
      console.error('place_bid rpc error', error);
      return NextResponse.json({ error: error.message || 'bid_failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true, detail: data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'server_error', detail: (err as Error).message }, { status: 500 });
  }
}
