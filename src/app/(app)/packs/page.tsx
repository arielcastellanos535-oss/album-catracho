import { PacksPageClient } from "@/components/PacksPageClient";
import { getUserProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { DAILY_NORMAL_PACKS } from "@/lib/constants";

export default async function PacksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let profile;
  try {
    profile = await getUserProfile(user.id);
  } catch {
    profile = {
      packs_opened_today: 0,
      last_pack_date: null,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const packsToday =
    profile.last_pack_date === today ? profile.packs_opened_today : 0;
  const remaining = Math.max(0, DAILY_NORMAL_PACKS - packsToday);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Sobres</h1>
        <p className="text-muted">
          2 sobres normales al día · 2 cromos por sobre (solo comunes del MVP).
        </p>
      </header>
      <PacksPageClient initialRemaining={remaining} />
      <aside className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-silver/50 bg-surface/80 p-4 opacity-70">
          <h2 className="font-semibold text-silver">Sobre plata</h2>
          <p className="text-sm text-muted">Próximamente · monedas o video</p>
        </article>
        <article className="rounded-xl border border-gold/50 bg-surface/80 p-4 opacity-70">
          <h2 className="font-semibold text-gold">Sobre oro</h2>
          <p className="text-sm text-muted">Próximamente · retos y monedas</p>
        </article>
      </aside>
    </section>
  );
}
