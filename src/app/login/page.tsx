"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { createClient } from "@/lib/supabase/client";
import { brand } from "@/lib/theme";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function loginWithGoogle() {
    setLoading(true);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (error) alert(error.message);
    setLoading(false);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <BrandLogo size="lg" />
      <p className="max-w-sm text-center text-muted">{brand.tagline}</p>
      <button
        type="button"
        disabled={loading}
        onClick={loginWithGoogle}
        className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-gray-900 shadow-lg disabled:opacity-60"
      >
        <span>Continuar con Google</span>
      </button>
    </main>
  );
}
