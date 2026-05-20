import { createClient } from "@/lib/supabase/server";
import TradingModule from "@/components/TradingModule";

export default async function TradingPage() {
  const supabase = await createClient();

  // 1. Obtener los departamentos reales ordenados
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .order("name", { ascending: true });

  // 2. Traer los cromos del usuario haciendo JOIN con la tabla global de stickers
  // Traemos la cantidad desde user_stickers, y el nombre/departamento desde la tabla sticker vinculada
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

  // 3. Mapeamos y limpiamos el resultado para que coincida exactamente con la interfaz 'Sticker' del componente
  const allStickers = (userStickersRaw || [])
    .map((us: any) => {
      if (!us.stickers) return null;
      return {
        id: us.stickers.id,
        name: us.stickers.name,
        department_id: us.stickers.department_id,
        quantity: us.quantity || 0,
      };
    })
    .filter(Boolean);

  // 4. Obtener las subastas activas
  const { data: activeAuctions } = await supabase
    .from("auctions")
    .select("*")
    .eq("status", "active");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 md:px-8">
      <TradingModule 
        departments={departments || []} 
        allStickers={allStickers as any || []} 
        activeAuctions={activeAuctions || []} 
      />
    </main>
  );
}