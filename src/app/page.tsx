import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { createClient } from "@/lib/supabase/server";
import { brand } from "@/lib/theme";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/album");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <BrandLogo size="lg" />
      <p className="max-w-md text-muted">{brand.tagline}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/login"
          className="rounded-xl bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
        >
          Entrar con Google
        </Link>
        <Link
          href="/about"
          className="rounded-xl border border-border bg-surface px-8 py-3 font-medium transition hover:border-accent"
        >
          Sobre nosotros
        </Link>
      </div>
    </main>
  );
}
