"use client";

import { useRouter } from "next/navigation";
import type { Department, Sticker } from "@/types/database";
import { StickerCard } from "@/components/StickerCard";
import { createClient } from "@/lib/supabase/client";

type Owned = {
  quantity: number;
  seen_at: string | null;
  first_obtained_at: string;
};

type Props = {
  department: Department;
  stickers: Sticker[];
  pastedIds: Set<string>;
  owned: Map<string, Owned>;
  adImage?: string | null;
  adLink?: string | null;
};

export function AlbumPageClient({
  department,
  stickers,
  pastedIds,
  owned,
  adImage,
  adLink,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  async function paste(stickerId: string) {
    const { error } = await supabase.rpc("paste_sticker", {
      p_sticker_id: stickerId,
    });
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  const isSpecial = department.slug === "edicion-especial";

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">{department.name}</h1>
        {department.fact_title && (
          <p className="text-muted">{department.fact_title}</p>
        )}
      </header>

      {adImage && (
        <aside className="overflow-hidden rounded-xl border border-border bg-surface">
          {adLink ? (
            <a href={adLink} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={adImage} alt="Publicidad" className="max-h-24 w-full object-cover" />
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={adImage} alt="Publicidad" className="max-h-24 w-full object-cover" />
          )}
        </aside>
      )}

      {isSpecial && (
        <p className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm">
          Cromos plata y especial: próximamente sobres plata y oro. Por ahora solo en catálogo.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {stickers.map((s) => {
          const o = owned.get(s.id);
          const pasted = pastedIds.has(s.id);
          return (
            <li key={s.id}>
              {pasted || o ? (
                    <StickerCard
                      sticker={s}
                      owned={o?.quantity ?? 0}
                      pasted={pasted}
                      seenAt={o?.seen_at ?? null}
                      firstObtainedAt={o?.first_obtained_at}
                      onPaste={o && !pasted ? () => paste(s.id) : undefined}
                      departmentName={department.name}
                    />
                  ) : (
                <article className="flex aspect-[5/7] items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 text-muted">
                  #{s.number}
                </article>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
