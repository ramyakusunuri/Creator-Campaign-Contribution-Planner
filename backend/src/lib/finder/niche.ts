// Neither API returns a "niche" field, so we infer one from public text (channel title/description, topic tags, bio).
const RULES: [string, RegExp][] = [
  ["Photography & Travel", /photo|travel|trip|tour|wanderlust|backpack/i],
  ["Beauty & Skincare", /beauty|skincare|skin care|makeup|grwm|cosmetic/i],
  ["Tech & Gadgets", /tech|gadget|smartphone|laptop|coding|software|android|iphone/i],
  ["Fitness & Health", /fitness|workout|gym|yoga|health|nutrition|wellness/i],
  ["Food & Cooking", /food|recipe|cooking|chef|kitchen|restaurant|baking/i],
  ["Fashion & Lifestyle", /fashion|outfit|ootd|streetwear|lifestyle|style/i],
  ["Gaming", /gaming|gamer|esports|gameplay|video game|minecraft|bgmi/i],
  ["Finance & Business", /financ|invest|stock|crypto|business|startup|money/i],
  ["Education", /educat|learn|tutorial|study|exam|course|upsc|jee/i],
  ["Music & Entertainment", /music|song|dance|comedy|entertain|movie|cinema/i],
];
export const NICHES = [...RULES.map(([n]) => n), "General"];

export function detectNiche(...texts: (string | undefined)[]): string {
  const text = texts.filter(Boolean).join(" ");
  for (const [niche, re] of RULES) if (re.test(text)) return niche;
  return "General";
}
