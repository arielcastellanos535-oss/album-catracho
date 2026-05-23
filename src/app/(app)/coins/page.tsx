import { CoinsPageClient } from "@/components/CoinsPageClient";
import { createClient } from "@/lib/supabase/server";
import type { CoinDashboard } from "@/types/database";

export default async function CoinsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase.rpc("get_coin_dashboard");
  if (error) {
    throw error;
  }

  const dashboard = data as CoinDashboard;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Monedas</h1>
        <p className="text-muted">
          3 monedas gratis cada día. No son acumulables: si no las reclamas hoy,
          se pierden y podrás obtener otras mañana. También verás tus sobres
          gratis y el próximo reinicio diario.
        </p>
      </header>

      <CoinsPageClient initialDashboard={dashboard} />
    </section>
  );
}
