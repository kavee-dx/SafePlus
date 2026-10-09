import { useId, type CSSProperties, type ReactNode } from "react";

import { Colors } from "../constants/theme";

/* ------------------------------------------------------------------ *
 * Hand-drawn charts for the shelter dashboards.
 *
 * Kept dependency-free and drawn as inline SVG the same way the dispatch desk
 * already draws its own graphics, so no charting library is added and nothing
 * about an offline build changes. A parent loads the numbers and passes plain
 * data down; these components only draw. Styled with inline CSS to match the
 * portal (which uses no utility-class framework).
 * ------------------------------------------------------------------ */

export interface TrendPoint {
  hour: string;
  occupancy: number;
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/** "14:00" from an ISO hour stamp, for the axis ticks under the line. */
function hourLabel(iso: string): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? "" : `${date.getHours()}:00`;
}

/** Round a peak up to a friendly axis maximum (…, 10, 20, 50, 100, 250, …). */
function niceMax(raw: number): number {
  if (raw <= 4) return 4;

  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = pow / 2;

  return Math.ceil(raw / step) * step;
}

/* ------------------------------ line chart ------------------------------ */

/**
 * The 24h occupancy trend. The plot is a fixed coordinate space scaled to the
 * container width, so the line and its soft fill stay crisp; the axis labels are
 * ordinary HTML so text never distorts.
 */
export function OccupancyTrendChart({
  points,
  stroke = Colors.blue,
  tint = Colors.blue,
  emptyLabel = "No occupancy recorded in the last 24 hours.",
}: {
  points: TrendPoint[];
  stroke?: string;
  tint?: string;
  emptyLabel?: string;
}) {
  const gradientId = useId();

  const W = 640;
  const H = 180;
  const padX = 8;
  const padTop = 14;
  const padBottom = 12;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;

  const values = points.map((p) => p.occupancy);
  const count = points.length;

  if (count === 0) {
    return <ChartFrame height={H}>{emptyLabel}</ChartFrame>;
  }

  const max = niceMax(Math.max(...values, 1));
  const x = (i: number): number =>
    count === 1 ? padX + plotW / 2 : padX + (i / (count - 1)) * plotW;
  const y = (v: number): number => padTop + plotH - (v / max) * plotH;

  const line = points.map((p, i) => `${x(i)},${y(p.occupancy)}`).join(" ");
  const area =
    `M${x(0)},${padTop + plotH} ` +
    points.map((p, i) => `L${x(i)},${y(p.occupancy)}`).join(" ") +
    ` L${x(count - 1)},${padTop + plotH} Z`;

  const ticks = pickTicks(points.map((p) => hourLabel(p.hour)));

  return (
    <div>
      <div style={captionRow}>
        <span>peak {max}</span>
        <span>now {values[count - 1] ?? 0}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        preserveAspectRatio="none"
        role="img"
        aria-label="Shelter occupancy over the last 24 hours"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tint} stopOpacity={0.22} />
            <stop offset="100%" stopColor={tint} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={padX}
            x2={W - padX}
            y1={padTop + plotH * g}
            y2={padTop + plotH * g}
            stroke="#EEF2F7"
            strokeWidth={1}
          />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={x(count - 1)}
          cy={y(values[count - 1] ?? 0)}
          r={3.5}
          fill={stroke}
        />
      </svg>
      <div style={tickRow}>
        {ticks.map((tick, i) => (
          <span key={i}>{tick}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ donut chart ------------------------------ */

/**
 * The capacity distribution as a donut: occupied / reserved / free beds, drawn
 * from the same capacity trio the whole feature is built on. Slices use stroke
 * dash-offsets on one circle, so no arc math is needed and it stays resolution
 * independent.
 */
export function CapacityDonutChart({
  segments,
  centerLabel,
  emptyLabel = "Nothing to show yet.",
}: {
  segments: DonutSegment[];
  centerLabel?: string;
  emptyLabel?: string;
}) {
  const size = 160;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((n, s) => n + s.value, 0);

  if (total <= 0) {
    return <ChartFrame height={size}>{emptyLabel}</ChartFrame>;
  }

  // Slice the donut ahead of render: each segment's dash length and where it
  // starts are folded from the running arc, so the JSX below only reads a list
  // (no mutable cursor captured during render).
  let running = 0;
  const arcs: { seg: DonutSegment; dash: string; dashoffset: number }[] = [];
  for (const seg of segments) {
    if (seg.value <= 0) continue;

    const len = (seg.value / total) * c;
    arcs.push({ seg, dash: `${len} ${c - len}`, dashoffset: -running });
    running += len;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Capacity distribution"
        style={{ flexShrink: 0 }}
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#EEF2F7"
            strokeWidth={stroke}
          />
          {arcs.map(({ seg, dash, dashoffset }) => (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={dashoffset}
            />
          ))}
        </g>
        {centerLabel !== undefined && (
          <text
            x="50%"
            y="50%"
            dominantBaseline="central"
            textAnchor="middle"
            fontSize={20}
            fontWeight={700}
            fill={Colors.navy}
          >
            {centerLabel}
          </text>
        )}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, minWidth: 190, flex: 1 }}>
        {segments.map((seg) => (
          <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: seg.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ color: Colors.navy }}>{seg.label}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700, color: Colors.navy }}>
              {seg.value.toLocaleString()}
            </span>
            <span style={{ width: 40, textAlign: "right", fontSize: 11, color: Colors.muted }}>
              {Math.round((seg.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- shared ------------------------------- */

const captionRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 11,
  color: Colors.muted,
  marginBottom: 4,
};

const tickRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 10,
  color: Colors.muted,
  marginTop: 4,
};

function ChartFrame({ height, children }: { height: number; children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: Colors.background,
        borderRadius: 10,
        padding: "0 16px",
        textAlign: "center",
        fontSize: 13,
        color: Colors.muted,
      }}
    >
      {children}
    </div>
  );
}

/** Up to five evenly spread axis labels from a longer list. */
function pickTicks(labels: string[]): string[] {
  if (labels.length <= 5) return labels;

  const out: string[] = [];
  const step = (labels.length - 1) / 4;

  for (let i = 0; i < 5; i += 1) {
    out.push(labels[Math.round(i * step)]);
  }

  return out;
}
