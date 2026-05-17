import { DepartmentGrid } from "@/components/DepartmentGrid";
import { getDepartments } from "@/lib/data";

export default async function AlbumIndexPage() {
  const departments = await getDepartments();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Álbum de Honduras</h1>
        <p className="text-muted">
          18 departamentos — MVP con Cortés, Francisco Morazán y edición especial.
        </p>
      </header>
      <DepartmentGrid departments={departments} />
    </section>
  );
}
