import { createClient } from "@/lib/supabase/server";
import TradingModule from "@/components/TradingModule";

// Definimos la estructura exacta que responde el JOIN de Supabase para evitar el 'any'
interface SupabaseStickerJoin {
  id: string;
  quantity: number;
  stickers: {
    id: string;
    name: string;
    department_id: string;
  } | null;
}

export default async function TradingPage() {
  const supabase = await createClient();

  // 1. Obtener los departamentos reales ordenados
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .order("name", { ascending: true });

  // 2. Traer los cromos del usuario haciendo JOIN con la tabla global de stickers
  const { data: userStickersRaw } = await supabase
    .from("user_stickers")
    .select(`
      id,
      quantity,
      stickers (
        id,
        name,
        department_id
      )
    `);

  // Cast seguro del resultado al tipo de la interfaz que creamos arriba
  const typedStickers = (userStickersRaw as unknown as SupabaseStickerJoin[]) || [];

  // 3. Mapeamos limpiamente sin usar 'any'
  const allStickers = typedStickers
    .map((us) => {
      if (!us.stickers) return null;
      return {
        id: us.stickers.id,
        name: us.stickers.name,
        department_id: us.stickers.department_id,
        quantity: us.quantity || 0,
      };
    })
    .filter((s): s is { id: string; name: string; department_id: string; quantity: number } => s !== null);

  // 4. Obtener las subastas activas
  const { data: activeAuctions } = await supabase
    .from("auctions")
    .select("*")
    .eq("status", "active");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 md:px-8">
      <TradingModule 
        departments={departments || []} 
        allStickers={allStickers} 
        activeAuctions={activeAuctions || []} 
      />
    </main>
  );
}