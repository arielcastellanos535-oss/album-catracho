import Link from "next/link";
import type { Department } from "@/types/database";

type Props = {
  departments: Department[];
};

export function DepartmentGrid({ departments }: Props) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {departments.map((d) => {
        const active = d.is_mvp_active || d.slots_count > 0;
        const label = active
          ? d.municipalities_count && d.municipalities_count > 0
            ? `${d.slots_count} cromos · ${d.municipalities_count} municipios`
            : `${d.slots_count} cromos MVP`
          : "Próximamente";
        const inner = (
          <article
            className={`rounded-xl border p-4 transition ${
              active
                ? "border-primary bg-surface hover:border-accent"
                : "border-border bg-surface/40 opacity-60"
            }`}
          >
            <h2 className="font-display text-lg font-semibold">{d.name}</h2>
            {d.fact_title && (
              <p className="mt-1 text-sm text-muted">{d.fact_title}</p>
            )}
            <p className="mt-2 text-xs">{label}</p>
          </article>
        );

        return (
          <li key={d.id}>
            {active ? (
              <Link href={`/album/${d.slug}`} className="block">
                {inner}
              </Link>
            ) : (
              <div className="cursor-not-allowed">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
