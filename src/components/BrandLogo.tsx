import Image from "next/image";
import Link from "next/link";
import { brand } from "@/lib/theme";

type Props = {
  size?: "sm" | "md" | "lg";
  linked?: boolean;
};

const sizes = {
  sm: { img: 32, text: "text-lg" },
  md: { img: 40, text: "text-xl" },
  lg: { img: 56, text: "text-3xl" },
};

export function BrandLogo({ size = "md", linked = false }: Props) {
  const s = sizes[size];
  const inner = (
    <div className="flex items-center gap-3">
      {!brand.useTextLogo && (
        <Image
          src={brand.logoSrc}
          alt={brand.logoAlt}
          width={s.img}
          height={s.img}
          className="rounded-lg"
          priority
        />
      )}
      <span className={`font-display font-bold tracking-tight ${s.text}`}>
        {brand.name}
      </span>
    </div>
  );

  if (linked) {
    return (
      <Link href="/album" className="transition hover:opacity-90">
        {inner}
      </Link>
    );
  }

  return inner;
}
