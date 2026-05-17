"use client";

import { useMemo, useState } from "react";
import type { Sticker, UserSticker } from "@/types/database";
import { StickerCard } from "@/components/StickerCard";
import { isNewSticker } from "@/lib/sticker-utils";
import { createClient } from "@/lib/supabase/client";

type Row = UserSticker & { sticker: Sticker };
type Tab = "new" | "all" | "dupes";

export function CollectionClient({ items }: { items: Row[] }) {
  const [tab, setTab] = useState<Tab>("new");
  const supabase = createClient();

  const filtered = useMemo(() => {
    if (tab === "new") {
      return items.filter((i) => isNewSticker(i.first_obtained_at, i.seen_at));
    }
    if (tab === "dupes") {
      return items.filter((i) => i.quantity > 1);
    }
    return items;
  }, [items, tab]);

  async function markSeen(stickerId: string) {
    await supabase
      .from("user_stickers")
      .update({ seen_at: new Date().toISOString() })
      .eq("sticker_id", stickerId);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "new", label: "Nuevos" },
    { id: "all", label: "Todos" },
    { id: "dupes", label: "Duplicados" },
  ];

  return (
    <section>
      <nav className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-surface text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {filtered.length === 0 ? (
        <p className="text-muted">No hay cromos en esta vista. ¡Abre sobres!</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((row) => (
            <li key={row.id}>
              <StickerCard
                sticker={row.sticker}
                owned={row.quantity}
                seenAt={row.seen_at}
                firstObtainedAt={row.first_obtained_at}
                compact
              />
              {tab === "new" && !row.seen_at && (
                <button
                  type="button"
                  className="mt-1 w-full text-xs text-accent underline"
                  onClick={() => markSeen(row.sticker_id)}
                >
                  Marcar como visto
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
