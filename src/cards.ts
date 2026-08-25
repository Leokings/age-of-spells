export type ElementKind =
  | "fire"
  | "water"
  | "air"
  | "earth"
  | "steam"
  | "ice"
  | "lightning"
  | "lava"
  | "storm"
  | "nature"
  | "light"
  | "metal"
  | "shadow"
  | "mythic"
  | "arcane";

export type IngredientAffinity =
  | "damage"
  | "piercing"
  | "heal"
  | "shield"
  | "drain"
  | "equalize";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "mythic";

export type IngredientDefinition = {
  id: string;
  name: string;
  element: ElementKind;
  glyph: string;
  art: string;
  rarity: Rarity;
  pullRate: string;
  affinities: IngredientAffinity[];
  description: string;
  catalyst: boolean;
};

export const ELEMENT_GLYPHS: Readonly<Record<ElementKind, string>> = {
  fire: "✦",
  water: "◒",
  air: "≈",
  earth: "◆",
  steam: "♨",
  ice: "❄",
  lightning: "ϟ",
  lava: "▲",
  storm: "☈",
  nature: "❖",
  light: "✚",
  metal: "⬡",
  shadow: "◐",
  mythic: "Ⅰ",
  arcane: "✧",
};

export const BASE_INGREDIENT_IDS = new Set(["fire", "water", "air", "earth"]);

export const INGREDIENTS: readonly IngredientDefinition[] = [
  {
    id: "fire",
    name: "Fire",
    element: "fire",
    glyph: ELEMENT_GLYPHS.fire,
    art: "/art/cards/fire-element-v1.webp",
    rarity: "common",
    pullRate: "21%",
    affinities: ["damage"],
    description: "Heat and force. Reliable fuel for aggressive fusions.",
    catalyst: false,
  },
  {
    id: "water",
    name: "Water",
    element: "water",
    glyph: ELEMENT_GLYPHS.water,
    art: "/art/cards/water-element-v1.webp",
    rarity: "common",
    pullRate: "20.5%",
    affinities: ["damage", "heal", "shield"],
    description: "Adaptable flow that can strike, restore, or absorb.",
    catalyst: false,
  },
  {
    id: "air",
    name: "Air",
    element: "air",
    glyph: ELEMENT_GLYPHS.air,
    art: "/art/cards/air-element-v1.webp",
    rarity: "common",
    pullRate: "20.5%",
    affinities: ["damage", "piercing"],
    description: "Speed and precision. Enables shield-piercing intent.",
    catalyst: false,
  },
  {
    id: "earth",
    name: "Earth",
    element: "earth",
    glyph: ELEMENT_GLYPHS.earth,
    art: "/art/cards/earth-element-v1.webp",
    rarity: "common",
    pullRate: "20.5%",
    affinities: ["damage", "shield"],
    description: "Weight and stability for impact and protection.",
    catalyst: false,
  },
  {
    id: "light",
    name: "Light Catalyst",
    element: "light",
    glyph: ELEMENT_GLYPHS.light,
    art: "/art/cards/light-catalyst-v1.webp",
    rarity: "uncommon",
    pullRate: "8%",
    affinities: ["heal", "shield"],
    description: "Rare restorative energy that strengthens healing and wards.",
    catalyst: true,
  },
  {
    id: "metal",
    name: "Metal Catalyst",
    element: "metal",
    glyph: ELEMENT_GLYPHS.metal,
    art: "/art/cards/metal-catalyst-v1.webp",
    rarity: "rare",
    pullRate: "6%",
    affinities: ["damage", "piercing", "shield"],
    description: "A rigid catalyst for armour, blades, and reinforced impact.",
    catalyst: true,
  },
  {
    id: "shadow",
    name: "Shadow Catalyst",
    element: "shadow",
    glyph: ELEMENT_GLYPHS.shadow,
    art: "/art/cards/shadow-catalyst-v1.webp",
    rarity: "epic",
    pullRate: "3%",
    affinities: ["damage", "drain"],
    description: "Forbidden essence that enables life-draining fusions.",
    catalyst: true,
  },
  {
    id: "one-man-stand",
    name: "One Man Stand",
    element: "mythic",
    glyph: ELEMENT_GLYPHS.mythic,
    art: "/art/cards/one-man-stand-v1.webp",
    rarity: "mythic",
    pullRate: "0.5%",
    affinities: ["equalize"],
    description: "A mythic catalyst that requires two companions and rewrites both mages to 10 health.",
    catalyst: true,
  },
] as const;

export const INGREDIENT_BY_ID = new Map(INGREDIENTS.map((card) => [card.id, card]));
