"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { Sticker } from "@/types/database";
import {
  isNewSticker,
  rarityBorderClass,
  rarityLabel,
  stickerPlaceholderGradient,
} from "@/lib/sticker-utils";

type Props = {
  sticker: Sticker;
  owned?: number;
  pasted?: boolean;
  seenAt?: string | null;
  firstObtainedAt?: string;
  shine?: boolean;
  compact?: boolean;
  onPaste?: () => void;
};

export function StickerCard({
  sticker,
  owned = 0,
  pasted = false,
  seenAt,
  firstObtainedAt,
  shine = false,
  compact = false,
  onPaste,
}: Props) {
  const isNew =
    !!firstObtainedAt && isNewSticker(firstObtainedAt, seenAt ?? null);
  const showShine = shine || isNew;

  return (
    <motion.article
      layout
      className={`relative overflow-hidden rounded-xl bg-surface ${rarityBorderClass(sticker.rarity)} ${
        compact ? "p-2" : "p-3"
      }`}
    >
      {showShine ? (
        <div className="pointer-events-none absolute inset-0 z-10 sticker-shine rounded-xl" />
      ) : null}
      <div
        className={`relative mx-auto aspect-[5/7] w-full max-w-[140px] overflow-hidden rounded-lg bg-gradient-to-br ${stickerPlaceholderGradient(sticker.rarity)}`}
      >
        {sticker.image_url ? (
          <Image
            src={sticker.image_url}
            alt={sticker.name}
            fill
            className="object-cover"
            sizes="140px"
          />
        ) : (
          <span className="flex h-full flex-col items-center justify-center p-2 text-center text-xs font-bold text-white">
            #{sticker.number}
          </span>
        )}
        {owned > 1 ? (
          <span className="absolute right-1 top-1 rounded bg-background/80 px-1.5 text-xs font-bold">
            x{owned}
          </span>
        ) : null}
      </div>
      <section className={`mt-2 space-y-1 ${compact ? "text-xs" : "text-sm"}`}>
        <p className="font-semibold leading-tight">{sticker.name}</p>
        <p className="text-muted">{rarityLabel(sticker.rarity)}</p>
        {sticker.fact_text && !compact ? (
          <p className="line-clamp-2 text-xs text-muted">{sticker.fact_text}</p>
        ) : null}
        {pasted ? (
          <span className="inline-block rounded bg-primary/30 px-2 py-0.5 text-xs">
            Pegado
          </span>
        ) : null}
        {onPaste && owned > 0 && !pasted ? (
          <button
            type="button"
            onClick={onPaste}
            className="mt-1 w-full rounded-lg bg-accent py-1.5 text-xs font-semibold text-accent-foreground"
          >
            Pegar en álbum
          </button>
        ) : null}
      </section>
    </motion.article>
  );
}
