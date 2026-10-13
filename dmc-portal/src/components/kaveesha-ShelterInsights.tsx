import { useMemo, useState, type CSSProperties } from "react";
import {
  Building2,
  ChevronDown,
  Lock,
  Mail,
  MapPin,
  PencilLine,
  Users,
} from "lucide-react";

import { Colors } from "../constants/theme";
import type {
  ShelterAnalytics,
  ShelterAnalyticsRow,
  ShelterStatus,
} from "../services/kaveesha-shelterApi";
import {
  STATUS_META,
  STATUS_ORDER,
  capacitySegments,
  claimedPct,
  occupancyPct,
} from "../utils/kaveesha-shelterFormat";
import { CapacityDonutChart, OccupancyTrendChart } from "./kaveesha-charts";

/* ------------------------------------------------------------------ *
 * The analytics band shared by both shelter dashboards.
 *
 * Two charts (a 24h occupancy line and the capacity donut), then the status
 * board that groups every in-scope shelter under Critical / Warning / Stable /
 * Available with a Manage button that hands the row back to the parent. The
 * parent owns the detail view and any writes, because an officer edits a shelter
 * only in their own district while a manager acts inside the shelters they run —
 * so this piece stays a pure, reusable read surface.
 * ------------------------------------------------------------------ */

/**
 * A status's colour, handed to the sheet as custom properties so one rule can
 * tint the border, the soft fill, the count pill and the occupancy bar without
 * a colour-mix that leans on the newest browser features. The alpha suffixes are
 * the same hex+alpha convention the rest of the console already uses.
 */
function toneVars(color: string): CSSProperties {
  return {
    "--tone": color,
    "--tone-soft": `${color}14`,
    "--tone-tint": `${color}12`,
    "--tone-ring": `${color}1A`,
    "--tone-bar": `${color}33`,
    "--tone-line": `${color}66`,
  } as CSSProperties;
}

export default function KaveeshaShelterInsights({
  analytics,
  canEdit,
  onSelectDistrict,
  onManage,
}: {
  analytics: ShelterAnalytics;
  /** Whether the signed-in account may change a given shelter (write scope). */
  canEdit: (shelter: ShelterAnalyticsRow) => boolean;
  /** Present only for an officer: a district switcher above the charts. */
  onSelectDistrict?: (district: string) => void;
  onManage: (shelter: ShelterAnalyticsRow) => void;
}) {
  const current = analytics.district ?? "all";
  const segments = capacitySegments(analytics);

  // Until someone clicks a box, the board sits on the most urgent group that
  // actually has shelters in it, so the first thing under the charts is the
  // thing that needs attention. Recomputed whenever the data reloads.
  const defaultStatus = useMemo<ShelterStatus>(() => {
    const found = STATUS_ORDER.find((status) =>
      analytics.shelters.some((s) => s.status === status)
    );

    return found ?? "CRITICAL";
  }, [analytics]);

  // One status in focus at a time. A manual pick always wins — even on an empty
  // group, which then shows its "no shelters are X" panel — and only the pick
  // itself is scoped: switching districts clears it so the new view re-focuses
  // on its most urgent group, while live reloads within a district never do.
  const [pick, setPick] = useState<{ district: string; status: ShelterStatus } | null>(null);
  const activeStatus = pick?.district === current ? pick.status : defaultStatus;

  const activeShelters = analytics.shelters.filter((s) => s.status === activeStatus);
  const activeMeta = STATUS_META[activeStatus];

  return (
    <div className="kdx-stack">
      {onSelectDistrict && (
        <DistrictSwitcher
          current={current}
          districts={analytics.districts}
          onSelect={onSelectDistrict}
        />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 14,
        }}
      >
        <section className="kdx-panel">
          <div className="kdx-panel-head">
            <div>
              <div className="kdx-panel-title" style={{ fontSize: 14 }}>
                Occupancy trend
              </div>
              <div className="kdx-panel-sub">
                Confirmed people inside, last 24 hours ·{" "}
                {analytics.district ?? "all districts"}
              </div>
            </div>
          </div>
          <div className="kdx-panel-body">
            <OccupancyTrendChart points={analytics.trend} />
          </div>
        </section>

        <section className="kdx-panel">
          <div className="kdx-panel-head">
            <div>
              <div className="kdx-panel-title" style={{ fontSize: 14 }}>
                Capacity distribution
              </div>
              <div className="kdx-panel-sub">
                {analytics.totalBeds.toLocaleString()} beds across{" "}
                {analytics.shelters.length} shelters
              </div>
            </div>
          </div>
          <div className="kdx-panel-body">
            <CapacityDonutChart
              segments={segments}
              centerLabel={`${Math.round(
                analytics.totalBeds > 0
                  ? (analytics.occupiedBeds / analytics.totalBeds) * 100
                  : 0
              )}%`}
            />
          </div>
        </section>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <div className="ksh-band-title">Shelter status</div>
          <span style={{ fontSize: 12, color: Colors.muted }}>
            Pick a status to see its shelters · Manage opens a shelter on its own
          </span>
        </div>

        {/* The four status boxes are a triage line: the chosen one is lit in its
            own colour, so the eye lands on what needs attention first. */}
        <div className="ksh-filters" style={{ marginBottom: 16 }}>
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const count = analytics.shelters.filter((s) => s.status === status).length;
            const active = status === activeStatus;

            return (
              <button
                key={status}
                type="button"
                onClick={() => setPick({ district: current, status })}
                aria-pressed={active}
                className={`ksh-filter${active ? " ksh-filter-on" : ""}`}
                style={toneVars(meta.color)}
              >
                <span className="ksh-filter-top">
                  <span className="ksh-filter-dot" />
                  <span className="ksh-filter-label">{meta.label}</span>
                  <span className="ksh-filter-count">{count}</span>
                </span>
                <span className="ksh-filter-hint">{meta.hint}</span>
              </button>
            );
          })}
        </div>

        {activeShelters.length === 0 ? (
          <div className="ksh-quiet">
            <Building2 size={26} />
            <div>No shelters are {activeMeta.label.toLowerCase()} right now.</div>
          </div>
        ) : (
          <div className="ksh-cards">
            {activeShelters.map((shelter) => (
              <StatusShelterCard
                key={shelter.id}
                shelter={shelter}
                editable={canEdit(shelter)}
                onManage={() => onManage(shelter)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- a shelter card ---------------------------- */

/**
 * A shelter shown under its status box, tinted in that status's colour: the
 * three capacity numbers, the occupancy bar with its inbound overlay, who runs
 * it, and Manage to open the shelter on its own. A lock on the button when the
 * shelter sits outside the officer's district — readable, never changeable.
 */
function StatusShelterCard({
  shelter,
  editable,
  onManage,
}: {
  shelter: ShelterAnalyticsRow;
  editable: boolean;
  onManage: () => void;
}) {
  const meta = STATUS_META[shelter.status];
  const occ = occupancyPct(shelter);
  const claimed = claimedPct(shelter);

  return (
    <div className="ksh-card" style={toneVars(meta.color)}>
      <span className="ksh-card-rail" />

      <div className="ksh-card-head">
        <div style={{ minWidth: 0 }}>
          <div className="ksh-card-name">{shelter.name}</div>
          <div className="ksh-card-code">
            {shelter.shelterCode} · {shelter.district}
          </div>
        </div>
        <span className="ksh-card-chip">{meta.label}</span>
      </div>

      <div>
        <div className="ksh-occ-top">
          <span className="ksh-occ-pct">Occupied {occ}%</span>
          <span className="ksh-occ-frac">
            {shelter.confirmedOccupancy} / {shelter.maxCapacity}
          </span>
        </div>
        {/* The inbound overlay is drawn first and the confirmed fill on top, so
            the darker part is who is genuinely inside and the paler tip is who
            is still on the way. */}
        <div className="ksh-occ-track">
          <div className="ksh-occ-inbound" style={{ width: `${claimed}%` }} />
          <div className="ksh-occ-now" style={{ width: `${occ}%` }} />
        </div>
      </div>

      <div className="ksh-figs">
        <div className="ksh-fig">
          <span className="ksh-fig-label">
            <Users size={11} /> Inside
          </span>
          <span className="ksh-fig-value">{shelter.confirmedOccupancy}</span>
        </div>
        <div className="ksh-fig">
          <span className="ksh-fig-label">Inbound</span>
          <span className="ksh-fig-value">{shelter.pendingArrivals}</span>
        </div>
        <div
          className={`ksh-fig ${
            shelter.remainingAllocatable > 0 ? "ksh-fig-free" : "ksh-fig-full"
          }`}
        >
          <span className="ksh-fig-label">Room left</span>
          <span className="ksh-fig-value">{shelter.remainingAllocatable}</span>
        </div>
      </div>

      <div className="ksh-card-mgr">
        {shelter.managers.length === 0 ? (
          <span className="ksh-mgr-none">No manager assigned yet</span>
        ) : (
          shelter.managers.slice(0, 2).map((manager) => (
            <span key={manager.id} className="ksh-mgr-line">
              <Mail size={12} />
              <span>
                {manager.fullName}
                {manager.email ? ` · ${manager.email}` : ""}
              </span>
            </span>
          ))
        )}
      </div>

      <div className="ksh-card-foot">
        <button type="button" className="kdx-btn kdx-btn-sm" onClick={onManage}>
          {editable ? <PencilLine size={13} /> : <Lock size={13} />}
          Manage
        </button>
      </div>
    </div>
  );
}

/* --------------------------- district switcher --------------------------- */

function DistrictSwitcher({
  current,
  districts,
  onSelect,
}: {
  current: string;
  districts: string[];
  onSelect: (district: string) => void;
}) {
  const viewingOwnDefault = current !== "all";

  return (
    <div className="ksh-switch">
      <label className="ksh-switch-label">
        <MapPin size={14} />
        District
        <span className="ksh-switch-select">
          <select value={current} onChange={(e) => onSelect(e.target.value)}>
            <option value="all">All districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            style={{ position: "absolute", right: 11, pointerEvents: "none", color: Colors.muted }}
          />
        </span>
      </label>

      <span className="ksh-switch-note">
        {current === "all"
          ? "Reading every district. You can only change shelters in your own."
          : viewingOwnDefault
            ? `Reading ${current}. Change is limited to your own district.`
            : ""}
      </span>
    </div>
  );
}
