import { DepartmentGrid } from "@/components/DepartmentGrid";
import { getDepartments } from "@/lib/data";

export default async function AlbumIndexPage() {
  const departments = await getDepartments();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Álbum de Honduras</h1>
        <p className="text-muted">
          {departments.length} departamentos — desbloquea nuevas páginas por
          municipio y sigue avanzando hacia Heroes y Salón de la fama.
        </p>
      </header>
      <DepartmentGrid departments={departments} />
    </section>
  );
}
