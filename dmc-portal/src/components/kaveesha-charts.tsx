import { useId, useState, type CSSProperties, type ReactNode } from "react";

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

/* --------------------------- coverage bar chart --------------------------- */

const MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

/** One disaster type, and how much of the roster can answer it. */
export interface CoverageRow {
  key: string;
  label: string;
  icon?: ReactNode;
  teams: number;
  available: number;
  deployed: number;
  resting: number;
  organizations: number;
  members: number;
}

/**
 * Horizontal stacked bars — one per disaster type — saying how many teams answer
 * to it, how many of those are free, and how many organizations stand behind them.
 *
 * Drawn in HTML rather than SVG because every row is text beside a bar of a
 * liquid width: the two columns of figures never need measuring or reflowing, and
 * the bars stay crisp at any container width. Length is proportional to the
 * strongest discipline rather than to each row's own full, so the eye compares
 * cover across types instead of reading numbers, and a discipline with no team at
 * all is drawn as a dashed gap rather than left out — the missing cover is the
 * thing an officer has to spot fastest.
 *
 * The three states are the caller's colours, not the chart's: wherever these bars
 * sit beside a readiness meter of the same data, both have to be painted from one
 * palette or the legend stops meaning anything.
 */
export function DisasterCoverageChart({
  rows,
  availableColor = "#0E9A94",
  deployedColor = "#5B4FD6",
  restingColor = "#8C99AD",
  emptyLabel = "No disaster types to compare yet.",
}: {
  rows: CoverageRow[];
  availableColor?: string;
  deployedColor?: string;
  restingColor?: string;
  emptyLabel?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (rows.length === 0) {
    return <ChartFrame height={140}>{emptyLabel}</ChartFrame>;
  }

  /* Length is compared, not read, so the axis maximum is the strongest
     discipline itself whenever the counts are small: rounding 3 teams up to 4
     would shrink every bar a quarter for nothing, and an officer scanning a
     district with a handful of teams should see the difference between 2 and 3
     as a real difference in length. */
  const peak = Math.max(...rows.map((row) => row.teams), 1);
  const max = peak <= 5 ? peak : niceMax(peak);

  /* Bars are separated by a hairline gap, and a gap costs width the way a
     percentage cannot see: three segments asking for 100% plus two gaps would
     run past the track. So each segment is shortened in proportion to the gap
     total it is part of, which makes the whole bar land exactly on its length
     against the axis. */
  const gap = 2;

  const segment = (color: string, value: number, gapTotal: number): CSSProperties => {
    const fraction = max > 0 ? value / max : 0;

    return {
      height: "100%",
      borderRadius: 999,
      background: color,
      width: `calc(${fraction * 100}% - ${gapTotal * fraction}px)`,
      flexShrink: 0,
      transition: "width 520ms cubic-bezier(0.22, 0.61, 0.36, 1)",
    };
  };

  /* One column model shared by every row and by the axis under them, so the
     scale always lines up with the bars it belongs to. The label is allowed to
     break onto a second line rather than be cut: a truncated disaster name is a
     wrong name, and the bar beside it still measures the same. */
  const columns = "clamp(118px, 38%, 186px) minmax(0, 1fr) 56px";

  return (
    <div>
      {rows.map((row) => {
        const covered = row.teams > 0;
        const active = hovered === row.key;
        const drawn = [row.available, row.deployed, row.resting].filter(
          (value) => value > 0
        ).length;
        const gapTotal = gap * Math.max(drawn - 1, 0);

        return (
          <div
            key={row.key}
            onMouseEnter={() => setHovered(row.key)}
            onMouseLeave={() =>
              setHovered((current) => (current === row.key ? null : current))
            }
            title={
              covered
                ? `${row.available} of ${row.teams} teams available · ${row.organizations} organization${row.organizations === 1 ? "" : "s"} · ${row.members} rescuers`
                : `No team registered for ${row.label} in this district`
            }
            style={{
              display: "grid",
              gridTemplateColumns: columns,
              alignItems: "center",
              gap: 12,
              padding: "7px 8px",
              borderRadius: 10,
              background: active ? "#f7f9fc" : "transparent",
              transition: "background 150ms ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  background: covered ? "#eef4ff" : "#f4f6f9",
                  color: covered ? Colors.blue : "#98a2b3",
                }}
              >
                {row.icon}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.25,
                  color: covered ? Colors.navy : "#8a94a6",
                }}
              >
                {row.label}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap,
                /* An uncovered row grows tall enough to hold its words: the
                   dashed gap is both the bar and the explanation, and text
                   spilling out of a 14px track would sit over the row below. */
                height: covered ? 14 : 26,
                padding: covered ? 2 : "0 10px",
                borderRadius: 999,
                overflow: "hidden",
                background: covered ? "#edf1f6" : "transparent",
                border: covered ? "1px solid transparent" : "1px dashed #dbe2ea",
                boxShadow: covered ? "inset 0 1px 2px rgba(16, 24, 40, 0.08)" : "none",
              }}
            >
              {covered ? (
                <>
                  <span
                    style={segment(availableColor, row.available, gapTotal)}
                  />
                  {row.deployed > 0 && (
                    <span style={segment(deployedColor, row.deployed, gapTotal)} />
                  )}
                  {row.resting > 0 && (
                    <span style={segment(restingColor, row.resting, gapTotal)} />
                  )}
                </>
              ) : (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    lineHeight: 1,
                    color: "#98a2b3",
                    whiteSpace: "nowrap",
                  }}
                >
                  No team
                </span>
              )}
            </div>

            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 13.5,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  color: covered ? Colors.navy : "#a4adb9",
                }}
              >
                {row.teams}
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "#98a2b3",
                }}
              >
                {row.organizations} org{row.organizations === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        );
      })}

      {/* One axis under the bars, so a length means something without reading a
          single number. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: columns,
          gap: 12,
          marginTop: 4,
          padding: "0 8px",
          alignItems: "end",
        }}
      >
        <span />
        {/* The midpoint has to sit at the half of the scale, not in the middle
            of the three labels: with space-between the centre token drifts by
            half the width of its neighbours, which on a short track is enough
            to make "15" read as though it were 9. */}
        <span
          style={{
            position: "relative",
            height: 12,
            fontFamily: MONO,
            fontSize: 9.5,
            color: "#a4adb9",
          }}
        >
          <span style={{ position: "absolute", left: 0, top: 0 }}>0</span>
          {max % 2 === 0 && (
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                transform: "translateX(-50%)",
              }}
            >
              {max / 2}
            </span>
          )}
          <span style={{ position: "absolute", right: 0, top: 0 }}>
            {max} teams
          </span>
        </span>
        <span
          style={{
            textAlign: "right",
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#a4adb9",
          }}
        >
          teams · orgs
        </span>
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
