import { CollectionClient } from "@/components/CollectionClient";
import { getUserAlbumSlots, getUserStickers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function CollectionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [rows, albumSlots] = await Promise.all([
    getUserStickers(user.id),
    getUserAlbumSlots(user.id),
  ]);
  const pastedIds = new Set(albumSlots.map((slot) => slot.sticker_id));

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Mis cromos</h1>
        <p className="text-muted">Nuevos, colección completa y duplicados.</p>
      </header>
      <CollectionClient items={rows} pastedIds={pastedIds} />
    </section>
  );
}
