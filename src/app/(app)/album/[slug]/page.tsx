import { notFound } from "next/navigation";
import { AlbumPageClient } from "@/components/AlbumPageClient";
import {
  getActiveAd,
  getDepartmentBySlug,
  getStickersForDepartment,
  getUserAlbumSlots,
  getUserStickers,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };

export default async function DepartmentAlbumPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  let department;
  try {
    department = await getDepartmentBySlug(slug);
  } catch {
    notFound();
  }

  if (!department.is_mvp_active) notFound();

  const stickers = await getStickersForDepartment(department.id);
  const [userStickers, albumSlots, ad] = await Promise.all([
    getUserStickers(user.id),
    getUserAlbumSlots(user.id),
    getActiveAd(slug),
  ]);

  const pastedIds = new Set(albumSlots.map((s) => s.sticker_id));
  const owned = new Map(
    userStickers.map((us) => [
      us.sticker_id,
      {
        quantity: us.quantity,
        seen_at: us.seen_at,
        first_obtained_at: us.first_obtained_at,
      },
    ]),
  );

  return (
    <AlbumPageClient
      department={department}
      stickers={stickers}
      pastedIds={pastedIds}
      owned={owned}
      adImage={ad?.image_url}
      adLink={ad?.link_url}
    />
  );
}
