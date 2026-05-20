"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";

const links = [
  { href: "/album", label: "Álbum" },
  { href: "/packs", label: "Sobres" },
  { href: "/collection", label: "Mis cromos" },
  { href: "/trading", label: "Intercambios" }, // 🔄 ¡El nuevo motor del mercado añadido aquí!
  { href: "/progress", label: "Progreso" },
  { href: "/about", label: "Nosotros" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <BrandLogo size="sm" linked />
        <nav className="flex flex-wrap gap-1 text-sm">
          {links.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted hover:bg-surface hover:text-primary-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}