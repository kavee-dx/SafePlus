/**
 * The console palette lifted from the group 30 high fidelity wireframes
 * (Y3S2-WE-30.pdf, pages 17-20): a near-black navy canvas, one step lighter
 * for cards, a further step for inputs, and the accent set the telemetry
 * dashboard uses for its status pills.
 */
export const Console = {
  bg: "#0A1428",
  bgDeep: "#050D1A",
  surface: "#141E32",
  surfaceAlt: "#1E2832",
  surfaceHi: "#1E283C",
  line: "#28324A",
  lineSoft: "#1C2740",
  ink: "#F1F5F9",
  inkDim: "#94A3B8",
  inkFaint: "#64748B",
  blue: "#2563EB",
  blueSoft: "#3B82F6",
  blueInk: "#93C5FD",
  blueTint: "#12233F",
  red: "#DC2626",
  redSoft: "#EF4444",
  redInk: "#FCA5A5",
  redTint: "#2A1017",
  green: "#22C55E",
  greenSoft: "#4ADE80",
  greenInk: "#86EFAC",
  greenTint: "#0F2419",
  amber: "#F59E0B",
  amberInk: "#FCD34D",
  amberTint: "#2A1E08",
  cyan: "#22D3EE",
  cyanTint: "#08222B",
  /** A neutral badge on a dark surface has no light grey to borrow. */
  slateTint: "#1B2436",
} as const;

/** Shared derived tokens so every console surface casts the same depth. */
export const ConsoleTokens = {
  Hairline: Console.line,
  Divider: Console.lineSoft,
  Surface: Console.surface,
  SurfaceAlt: Console.surfaceAlt,
  RedTint: Console.redTint,
  RedText: Console.redInk,
  GreenTint: Console.greenTint,
  GreenText: Console.greenInk,
  AmberTint: Console.amberTint,
  AmberText: Console.amberInk,
  BlueTint: Console.blueTint,
  BlueText: Console.blueInk,
  Mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  ShadowCard: "0 1px 2px rgba(2, 8, 20, 0.5), 0 2px 8px -4px rgba(2, 8, 20, 0.6)",
  ShadowRaised: "0 12px 28px -12px rgba(2, 8, 20, 0.85)",
  FocusRing: "0 0 0 3px rgba(59, 130, 246, 0.42)",
} as const;

/**
 * The `sp-*` vocabulary in dushani-dataStyles.ts reads these variables and
 * falls back to its original light values, so a page that does not opt in -
 * Dildhara's profile panel - keeps rendering exactly as before.
 */
export const CONSOLE_THEME = `
  .dq-console {
    --sp-line: ${Console.line};
    --sp-divider: ${Console.lineSoft};
    --sp-surface: ${Console.surface};
    --sp-surface-alt: ${Console.surfaceAlt};
    --sp-card: ${Console.surface};
    --sp-ink: ${Console.ink};
    --sp-ink-dim: ${Console.inkDim};
    --sp-label: ${Console.inkFaint};
    --sp-bullet: ${Console.blueSoft};
    --sp-pill-bg: ${Console.surfaceAlt};
    --sp-pill-ink: ${Console.inkDim};
    --sp-pill-border: ${Console.line};
    --sp-red-bg: ${Console.redTint};
    --sp-red-ink: ${Console.redInk};
    --sp-red-line: #5F1D22;
    --sp-green-bg: ${Console.greenTint};
    --sp-green-ink: ${Console.greenInk};
    --sp-green-line: #174E2E;
    --sp-amber-bg: ${Console.amberTint};
    --sp-amber-ink: ${Console.amberInk};
    --sp-amber-line: #5C4310;
    --sp-blue-bg: ${Console.blueTint};
    --sp-blue-ink: ${Console.blueInk};
    --sp-blue-line: #1E3A66;
    --sp-meter-track: ${Console.surfaceHi};
    --sp-block-accent: ${Console.blueSoft};
    color-scheme: dark;
  }
`;
