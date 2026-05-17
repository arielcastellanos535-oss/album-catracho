/**
 * Tema centralizado — cambia logo, colores y tipografía aquí
 * cuando tengas marca final.
 */
export const brand = {
  name: "Album Catracho",
  tagline: "Tu álbum digital con orgullo hondureño",
  /** Ruta en /public — reemplaza logo.svg cuando lo tengas */
  logoSrc: "/brand/logo-placeholder.svg",
  logoAlt: "Album Catracho",
  /** Si true, muestra texto en lugar de imagen cuando no hay logo */
  useTextLogo: true,
  about: {
    headline: "Sobre nosotros",
    author: "Tu nombre / marca",
    bio: "Presentación breve: quién eres, por qué creaste Album Catracho y qué buscas con el proyecto. Edita este texto en src/lib/theme.ts.",
    contactEmail: "contacto@ejemplo.hn",
    social: {
      web: "",
      instagram: "",
      tiktok: "",
    },
  },
} as const;

export const theme = {
  colors: {
    primary: "var(--color-primary)",
    primaryForeground: "var(--color-primary-foreground)",
    accent: "var(--color-accent)",
    accentForeground: "var(--color-accent-foreground)",
    background: "var(--color-background)",
    surface: "var(--color-surface)",
    muted: "var(--color-muted)",
    border: "var(--color-border)",
    gold: "var(--color-gold)",
    silver: "var(--color-silver)",
    special: "var(--color-special)",
  },
} as const;
