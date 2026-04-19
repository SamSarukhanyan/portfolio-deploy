export type Locale = "en" | "ru" | "hy";

export type MessageMap = Record<string, string>;

export type Bundles = Record<Locale, MessageMap>;
