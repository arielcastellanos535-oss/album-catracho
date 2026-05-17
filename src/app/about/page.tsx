import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { brand } from "@/lib/theme";

export default function AboutPage() {
  const { about } = brand;

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <BrandLogo size="lg" />
      <h1 className="font-display text-3xl font-bold">{about.headline}</h1>
      <section className="space-y-4 text-muted">
        <p>
          <strong className="text-primary-foreground">{about.author}</strong>
        </p>
        <p>{about.bio}</p>
        <p>
          Contacto:{" "}
          <a className="text-accent underline" href={`mailto:${about.contactEmail}`}>
            {about.contactEmail}
          </a>
        </p>
      </section>
      <p className="text-sm text-muted">
        Para cambiar logo, colores y este texto: edita{" "}
        <code className="rounded bg-surface px-1">src/lib/theme.ts</code> y{" "}
        <code className="rounded bg-surface px-1">src/app/globals.css</code>.
      </p>
      <Link href="/login" className="inline-block text-accent underline">
        Entrar al álbum
      </Link>
    </main>
  );
}
