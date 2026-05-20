import { createClient } from "@/lib/supabase/server";
import TradingModule from "@/components/TradingModule";

export default async function TradingPage() {
  const supabase = await createClient();

  // 1. Obtener los departamentos para los filtros de Honduras
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .order("name", { ascending: true });

  // 2. Obtener los cromos cargados con su cantidad real
  const { data: allStickers } = await supabase
    .from("user_stickers")
    .select(`
      id,
      quantity,
      department_id,
      name
    `);

  // 3. Obtener las subastas activas para el stream
  const { data: activeAuctions } = await supabase
    .from("auctions")
    .select("*")
    .eq("status", "active");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 md:px-8">
      <TradingModule 
        departments={departments || []} 
        allStickers={allStickers || []} 
        activeAuctions={activeAuctions || []} 
      />
    </main>
  );
}