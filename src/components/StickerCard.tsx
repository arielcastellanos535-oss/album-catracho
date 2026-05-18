"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import type { Sticker } from "@/types/database";
import {
  isNewSticker,
  rarityBorderClass,
  rarityLabel,
  stickerPlaceholderGradient,
  ownedHighlightClass,
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
  departmentName?: string;
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
  departmentName,
}: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const isNew =
    !!firstObtainedAt && isNewSticker(firstObtainedAt, seenAt ?? null);
  const showShine = shine || isNew;

  return (
    <motion.article
      layout
      className={`relative overflow-hidden rounded-xl bg-surface ${rarityBorderClass(
        sticker.rarity,
      )} ${compact ? "p-2" : "p-3"} ${
        owned > 0 && !pasted ? ownedHighlightClass(sticker.rarity) : ""
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
            className="object-contain"
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
        {owned > 0 && !pasted ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onPaste}
              className="w-full rounded-lg bg-accent py-1.5 text-xs font-semibold text-accent-foreground"
            >
              Pegar en álbum
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary-foreground"
            >
              👁 Ver completo
            </button>
          </div>
        ) : null}
      </section>
      <AnimatePresence>
        {previewOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6"
            onClick={() => setPreviewOpen(false)}
          >
            <motion.article
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-[28px] border border-border bg-surface shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm text-muted">Sticker completo</p>
                  <h2 className="text-lg font-semibold">{sticker.name}</h2>
                  {departmentName ? (
                    <p className="text-sm text-muted">Departamento: {departmentName}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-full border border-border bg-background px-3 py-2 text-sm text-muted transition hover:border-primary hover:text-primary-foreground"
                >
                  Cerrar
                </button>
              </div>
              <div className="p-6">
                <div className="relative mx-auto aspect-[5/7] w-full max-w-[400px] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800">
                  {sticker.image_url ? (
                    <Image
                      src={sticker.image_url}
                      alt={sticker.name}
                      fill
                      className="object-contain"
                      sizes="400px"
                    />
                  ) : (
                    <span className="flex h-full flex-col items-center justify-center p-4 text-center text-sm font-bold text-white">
                      #{sticker.number}
                    </span>
                  )}
                </div>
                <div className="mt-5 space-y-3 text-sm text-muted">
                  <p>
                    <span className="font-semibold text-primary-foreground">Raridad:</span>{" "}
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                        sticker.rarity === "silver"
                          ? "bg-silver/20 text-silver"
                          : sticker.rarity === "special"
                          ? "bg-special/20 text-special"
                          : "bg-green-800/10 text-green-400"
                      }`}
                    >
                      {rarityLabel(sticker.rarity)}
                    </span>
                  </p>
                  {sticker.fact_text ? (
                    <p className="leading-relaxed">{sticker.fact_text}</p>
                  ) : (
                    <p className="text-muted">Sin descripción disponible.</p>
                  )}
                </div>
              </div>
            </motion.article>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
