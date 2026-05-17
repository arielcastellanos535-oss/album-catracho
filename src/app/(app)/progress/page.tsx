import { countMvpProgress } from "@/lib/sticker-utils";
import {
  getUserAlbumSlots,
  getUserProfile,
  getUserStickers,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, stickers, slots] = await Promise.all([
    getUserProfile(user.id),
    getUserStickers(user.id),
    getUserAlbumSlots(user.id),
  ]);

  const commons = stickers.filter((s) => s.sticker?.rarity === "common");
  const pastedCommon = slots.filter((sl) =>
    commons.some((c) => c.sticker_id === sl.sticker_id),
  ).length;
  const progress = countMvpProgress(commons.length, pastedCommon, 10);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Progreso</h1>
        <p className="text-muted">Estadísticas de tu colección MVP.</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        <li className="rounded-xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">Álbum pegado</p>
          <p className="font-display text-4xl font-bold">{progress.percent}%</p>
          <p className="text-sm">
            {progress.pasted} / {progress.total} cromos comunes
          </p>
        </li>
        <li className="rounded-xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">Cromos únicos obtenidos</p>
          <p className="font-display text-4xl font-bold">{progress.owned}</p>
          <p className="text-sm">de 10 comunes en sobres normales</p>
        </li>
        <li className="rounded-xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">Monedas</p>
          <p className="font-display text-4xl font-bold text-gold">{profile.coins}</p>
        </li>
        <li className="rounded-xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">Sobres hoy</p>
          <p className="font-display text-4xl font-bold">
            {profile.packs_opened_today} / 2
          </p>
        </li>
      </ul>
      <p className="text-sm text-muted">
        Cromos plata y especial (2) no salen en sobres normales; se activarán con sobres plata/oro.
      </p>
    </section>
  );
}
