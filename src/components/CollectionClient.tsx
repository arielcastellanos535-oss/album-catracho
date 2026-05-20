"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Sticker, UserSticker } from "@/types/database";
import { StickerCard } from "@/components/StickerCard";
import { isNewSticker } from "@/lib/sticker-utils";
import { createClient } from "@/lib/supabase/client";

type Row = UserSticker & { sticker: Sticker & { department?: { slug: string } } };
type Tab = "new" | "all" | "dupes";

export function CollectionClient({ items }: { items: Row[] }) {
  const [tab, setTab] = useState<Tab>("new");
  const router = useRouter();
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

  async function pasteAndRedirect(stickerId: string, departmentSlug: string) {
    const { error } = await supabase.rpc("paste_sticker", {
      p_sticker_id: stickerId,
    });
    if (error) {
      alert(error.message);
      return;
    }
    router.push(`/album/${departmentSlug}`);
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
                onPaste={() => {
                  const departmentSlug = row.sticker.department?.slug;
                  if (departmentSlug) {
                    pasteAndRedirect(row.sticker_id, departmentSlug);
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
