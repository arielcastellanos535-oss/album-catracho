"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CoinDashboard } from "@/types/database";

type Props = {
  initialDashboard: CoinDashboard;
};

export function CoinsPageClient({ initialDashboard }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshDashboard() {
    const { data, error } = await supabase.rpc("get_coin_dashboard");
    if (error) {
      setError(error.message);
      return;
    }
    setDashboard(data as CoinDashboard);
  }

  async function claimDailyCoins() {
    if (loading || !dashboard.daily_claimable) return;
    setError(null);
    setLoading(true);
    const { error } = await supabase.rpc("claim_daily_coins");
    if (error) {
      setError(
        error.message.includes("daily_coins_already_claimed")
          ? "Ya reclamaste tus monedas gratis de hoy. Vuelve mañana."
          : error.message,
      );
    } else {
      await refreshDashboard();
      router.refresh();
    }
    setLoading(false);
  }

  const nextClaimDate = new Date(dashboard.next_claim_at);
  const nextClaimLabel = dashboard.daily_claimable
    ? "Disponible ahora"
    : nextClaimDate.toLocaleString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });

  const nextPackDate = new Date(dashboard.next_pack_at);
  const nextPackLabel = dashboard.daily_pack_claimable
    ? "Disponible ahora"
    : nextPackDate.toLocaleString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-3xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">Saldo actual</p>
          <p className="font-display text-4xl font-bold text-gold">{dashboard.current_balance}</p>
        </article>
        <article className="rounded-3xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">Monedas disponibles</p>
          <p className="font-display text-4xl font-bold">{dashboard.coins_available}</p>
        </article>
        <article className="rounded-3xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">Monedas congeladas</p>
          <p className="font-display text-4xl font-bold">{dashboard.frozen_coins}</p>
        </article>
        <article className="rounded-3xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">Próxima moneda gratis</p>
          <p className="font-display text-2xl font-bold">{nextClaimLabel}</p>
          <p className="mt-2 text-sm text-muted">
            Reclamadas hoy: {dashboard.daily_coins_today} / 3
          </p>
        </article>
        <article className="rounded-3xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">Sobres gratis restantes</p>
          <p className="font-display text-4xl font-bold">{dashboard.packs_remaining_today}</p>
          <p className="mt-2 text-sm text-muted">
            Abiertos hoy: {dashboard.daily_packs_today} / 2
          </p>
        </article>
        <article className="rounded-3xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">Próximo sobre gratis</p>
          <p className="font-display text-2xl font-bold">{nextPackLabel}</p>
        </article>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-3xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted">Saldo inicial</p>
          <p className="font-display text-3xl font-bold">{dashboard.initial_coins}</p>
        </article>
        <article className="rounded-3xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted">Monedas ganadas</p>
          <p className="font-display text-3xl font-bold">{dashboard.coins_earned}</p>
        </article>
        <article className="rounded-3xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted">Monedas gastadas</p>
          <p className="font-display text-3xl font-bold">{dashboard.coins_spent}</p>
        </article>
      </div>

      <div className="rounded-3xl border border-border bg-surface p-6">
        <p className="text-sm text-muted">Recompensa diaria</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xl font-semibold">3 monedas gratis</p>
            <p className="text-sm text-muted">No se acumulan si no las reclamas hoy.</p>
          </div>
          <button
            type="button"
            disabled={!dashboard.daily_claimable || loading}
            onClick={claimDailyCoins}
            className="rounded-2xl bg-gold px-5 py-3 font-semibold text-background transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {dashboard.daily_claimable ? "Reclamar ahora" : "Reclamado"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
