import { useMemo, useState } from "react";
import { ChevronDown, Lock, Mail, MapPin, PencilLine, Users } from "lucide-react";

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
            marginBottom: 10,
          }}
        >
          <div className="kdx-panel-title" style={{ fontSize: 14 }}>
            Shelter status
          </div>
          <span style={{ fontSize: 12, color: Colors.muted }}>
            Pick a status to see its shelters · Manage opens a shelter on its own
          </span>
        </div>

        {/* The four small status boxes — a filter for the board below. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 12,
            marginBottom: 14,
          }}
        >
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
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1.5px solid ${active ? meta.color : Colors.border}`,
                  background: active ? `${meta.color}12` : Colors.white,
                  boxShadow: active ? `0 0 0 3px ${meta.color}1A` : "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "border-color 120ms ease, background 120ms ease",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: meta.color,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 800, fontSize: 13, color: active ? meta.color : Colors.navy }}>
                    {meta.label}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontWeight: 800,
                      fontSize: 13,
                      color: meta.color,
                      background: `${meta.color}14`,
                      borderRadius: 999,
                      padding: "1px 9px",
                    }}
                  >
                    {count}
                  </span>
                </span>
                <span style={{ fontSize: 11, color: Colors.muted, lineHeight: 1.4 }}>
                  {meta.hint}
                </span>
              </button>
            );
          })}
        </div>

        {/* The selected status's shelters, rendered big in its own colour. */}
        {activeShelters.length === 0 ? (
          <div
            style={{
              border: `1.5px dashed ${Colors.border}`,
              borderRadius: 12,
              padding: "26px 16px",
              textAlign: "center",
              fontSize: 13,
              color: Colors.muted,
              background: Colors.white,
            }}
          >
            No shelters are {activeMeta.label.toLowerCase()} right now.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 14,
            }}
          >
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

  return (
    <div
      className="kdx-panel"
      style={{ borderTop: `3px solid ${meta.color}`, overflow: "visible" }}
    >
      <div className="kdx-panel-head" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="kdx-panel-title" style={{ fontSize: 14 }}>
            {shelter.name}
          </div>
          <div className="kdx-panel-sub">
            {shelter.shelterCode} · {shelter.district}
          </div>
        </div>
        <span
          className="kdx-chip"
          style={{ color: meta.color, background: `${meta.color}14`, flexShrink: 0 }}
        >
          {meta.label}
        </span>
      </div>

      <div className="kdx-panel-body" style={{ display: "grid", gap: 12 }}>
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              fontWeight: 800,
              color: Colors.muted,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              marginBottom: 5,
            }}
          >
            <span>Occupied {occupancyPct(shelter)}%</span>
            <span>
              {shelter.confirmedOccupancy} / {shelter.maxCapacity}
            </span>
          </div>
          <div className="kdx-bar-track" style={{ position: "relative", height: 10 }}>
            <div
              className="kdx-bar-fill"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${claimedPct(shelter)}%`,
                background: `${meta.color}33`,
              }}
            />
            <div
              className="kdx-bar-fill"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${occupancyPct(shelter)}%`,
                background: meta.color,
              }}
            />
          </div>
        </div>

        <div className="kdx-facts" style={{ marginBottom: 0 }}>
          <div className="kdx-fact">
            <div className="kdx-fact-label">
              <Users size={12} /> Inside
            </div>
            <div className="kdx-fact-value">{shelter.confirmedOccupancy}</div>
          </div>
          <div className="kdx-fact">
            <div className="kdx-fact-label">Inbound</div>
            <div className="kdx-fact-value">{shelter.pendingArrivals}</div>
          </div>
          <div className="kdx-fact">
            <div className="kdx-fact-label">Room left</div>
            <div
              className="kdx-fact-value"
              style={{
                color: shelter.remainingAllocatable > 0 ? Colors.success : Colors.red,
              }}
            >
              {shelter.remainingAllocatable}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {shelter.managers.length === 0 ? (
            <span style={{ fontSize: 12, color: Colors.muted, fontStyle: "italic" }}>
              No manager assigned yet
            </span>
          ) : (
            shelter.managers.slice(0, 2).map((manager) => (
              <span
                key={manager.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: Colors.muted,
                  minWidth: 0,
                }}
              >
                <Mail size={12} style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {manager.fullName}
                  {manager.email ? ` · ${manager.email}` : ""}
                </span>
              </span>
            ))
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="kdx-btn kdx-btn-sm" onClick={onManage}>
            {editable ? <PencilLine size={13} /> : <Lock size={13} />}
            Manage
          </button>
        </div>
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          fontWeight: 700,
          color: Colors.navy,
        }}
      >
        <MapPin size={14} />
        District
        <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <select
            value={current}
            onChange={(e) => onSelect(e.target.value)}
            style={{
              appearance: "none",
              WebkitAppearance: "none",
              padding: "6px 30px 6px 12px",
              borderRadius: 8,
              border: `1px solid ${Colors.border}`,
              background: Colors.white,
              fontSize: 13,
              fontWeight: 700,
              color: Colors.navy,
              cursor: "pointer",
            }}
          >
            <option value="all">All districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            style={{ position: "absolute", right: 9, pointerEvents: "none", color: Colors.muted }}
          />
        </span>
      </label>

      <span style={{ fontSize: 12, color: Colors.muted }}>
        {current === "all"
          ? "Reading every district. You can only change shelters in your own."
          : viewingOwnDefault
            ? `Reading ${current}. Change is limited to your own district.`
            : ""}
      </span>
    </div>
  );
}
