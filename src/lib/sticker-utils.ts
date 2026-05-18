import type { Sticker, StickerRarity } from "@/types/database";

export function rarityLabel(rarity: StickerRarity): string {
  switch (rarity) {
    case "silver":
      return "Plata";
    case "special":
      return "Especial";
    default:
      return "Común";
  }
}

export function rarityBorderClass(rarity: StickerRarity): string {
  switch (rarity) {
    case "silver":
      return "ring-2 ring-silver";
    case "special":
      return "ring-2 ring-special";
    default:
      return "ring-1 ring-border";
  }
}

export function stickerPlaceholderGradient(rarity: StickerRarity): string {
  switch (rarity) {
    case "silver":
      return "from-slate-400 to-slate-600";
    case "special":
      return "from-violet-500 to-indigo-700";
    default:
      return "from-primary to-accent";
  }
}

export function isNewSticker(firstObtainedAt: string, seenAt: string | null): boolean {
  if (seenAt) return false;
  const hours = (Date.now() - new Date(firstObtainedAt).getTime()) / 36e5;
  return hours < 48;
}

export function countMvpProgress(
  ownedCommon: number,
  pastedCommon: number,
  totalCommon = 10,
) {
  return {
    owned: ownedCommon,
    pasted: pastedCommon,
    total: totalCommon,
    percent: Math.round((pastedCommon / totalCommon) * 100),
  };
}

export type StickerWithMeta = Sticker & { owned?: number; pasted?: boolean };

export function ownedHighlightClass(rarity: StickerRarity): string {
  switch (rarity) {
    case "silver":
      return "ring-2 ring-silver/40 shadow-[0_8px_30px_rgba(156,168,184,0.12)]";
    case "special":
      return "ring-2 ring-special/40 shadow-[0_10px_38px_rgba(107,76,230,0.14)]";
    default:
      return "ring-2 ring-green-600/25 shadow-[0_8px_30px_rgba(13,92,61,0.18)]";
  }
}
