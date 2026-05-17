"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Sticker } from "@/types/database";
import { StickerCard } from "@/components/StickerCard";

type Props = {
  packsRemaining: number;
  onOpen: () => Promise<{ stickers: Sticker[]; packsRemaining: number }>;
};

export function PackOpener({ packsRemaining, onOpen }: Props) {
  const [phase, setPhase] = useState<"idle" | "shaking" | "open" | "reveal">("idle");
  const [revealed, setRevealed] = useState<Sticker[]>([]);
  const [remaining, setRemaining] = useState(packsRemaining);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    if (remaining <= 0 || loading) return;
    setError(null);
    setLoading(true);
    setPhase("shaking");
    try {
      await new Promise((r) => setTimeout(r, 600));
      setPhase("open");
      const result = await onOpen();
      setRemaining(result.packsRemaining);
      setRevealed(result.stickers);
      await new Promise((r) => setTimeout(r, 400));
      setPhase("reveal");
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "No se pudo abrir el sobre");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPhase("idle");
    setRevealed([]);
  }

  return (
    <section className="flex flex-col items-center gap-6">
      <p className="text-muted">
        Sobres normales hoy: <strong className="text-primary-foreground">{remaining}</strong> / 2
      </p>

      <AnimatePresence mode="wait">
        {phase !== "reveal" ? (
          <motion.button
            key="pack"
            type="button"
            disabled={remaining <= 0 || loading}
            onClick={handleOpen}
            animate={
              phase === "shaking"
                ? { rotate: [0, -8, 8, -6, 6, 0], scale: [1, 1.05, 1] }
                : phase === "open"
                  ? { scaleY: [1, 0.2, 1.1], scaleX: [1, 1.15, 1] }
                  : {}
            }
            transition={{ duration: 0.5 }}
            className="relative flex h-44 w-32 cursor-pointer flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-accent to-primary shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-4xl">📦</span>
            <span className="mt-2 text-sm font-bold">Sobre Catracho</span>
            {remaining <= 0 && (
              <span className="mt-1 text-xs text-muted">Vuelve mañana</span>
            )}
          </motion.button>
        ) : (
          <motion.section
            key="cards"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid w-full max-w-md grid-cols-2 gap-4"
          >
            {revealed.map((s) => (
              <StickerCard key={s.id} sticker={s} shine />
            ))}
          </motion.section>
        )}
      </AnimatePresence>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {phase === "reveal" && (
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-border px-6 py-2 text-sm hover:bg-surface"
        >
          {remaining > 0 ? "Abrir otro sobre" : "Listo"}
        </button>
      )}
    </section>
  );
}
