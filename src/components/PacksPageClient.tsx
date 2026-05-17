"use client";

import { useRouter } from "next/navigation";
import { PackOpener } from "@/components/PackOpener";
import { createClient } from "@/lib/supabase/client";
import type { Sticker } from "@/types/database";

type Props = { initialRemaining: number };

export function PacksPageClient({ initialRemaining }: Props) {
  const router = useRouter();
  const supabase = createClient();

  async function openPack() {
    const { data, error } = await supabase.rpc("open_normal_pack");
    if (error) {
      if (error.message.includes("daily_limit")) {
        throw new Error("Ya abriste tus 2 sobres de hoy. Vuelve mañana.");
      }
      throw new Error(error.message);
    }

    const payload = data as {
      sticker_ids: string[];
      packs_remaining_today: number;
    };
    const ids = payload.sticker_ids ?? [];

    const { data: stickers, error: fetchErr } = await supabase
      .from("stickers")
      .select("*")
      .in("id", ids);

    if (fetchErr) throw fetchErr;

    router.refresh();
    return {
      stickers: (stickers ?? []) as Sticker[],
      packsRemaining: payload.packs_remaining_today ?? 0,
    };
  }

  return <PackOpener packsRemaining={initialRemaining} onOpen={openPack} />;
}
