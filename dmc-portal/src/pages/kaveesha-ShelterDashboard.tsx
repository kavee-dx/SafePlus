import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  DoorOpen,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MinusCircle,
  PencilLine,
  Phone,
  ShieldCheck,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";

import { Colors } from "../constants/theme";
import type { AuthUser } from "../types/auth";
import { getStoredDmcToken } from "../services/dmc-authApi";
import {
  type ShelterAllocation,
  type ShelterAnalytics,
  type ShelterAnalyticsRow,
  type ShelterBand,
  type ShelterManager,
  type ShelterRoll,
  type ManagerLiveEvent,
  confirmArrival,
  fetchExpectedArrivals,
  fetchManagerAnalytics,
  fetchManagerProfile,
  fetchMyShelters,
  openManagerStream,
  recordDeparture,
  recordWalkIn,
} from "../services/kaveesha-shelterManagerApi";
import {
  BAND_META,
  STATUS_META,
  bandFor,
  claimedPct,
  occupancyPct,
} from "../utils/kaveesha-shelterFormat";
import { CapacityDonutChart, OccupancyTrendChart } from "../components/kaveesha-charts";
import KaveeshaShelterInsights from "../components/kaveesha-ShelterInsights";
import { relativeTime } from "../utils/kaveesha-dispatchFormat";
import { DISPATCH_CSS, DESK_CSS } from "../styles/kaveesha-dispatchStyles";

/* ------------------------------------------------------------------ *
 * The Shelter Manager dashboard (its own layout, not the officer board).
 *
 * A manager runs one or many shelters and does three things here: confirm an
 * expected arrival — the only action that raises occupancy — log people who
 * walked in without an allocation, and log people leaving. Everything is scoped
 * on the server to the shelters assigned to this account, so a manager can never
 * move a bed they do not own. The live feed keeps the numbers honest; a dropped
 * stream falls back to a slow poll, never to stale figures.
 * ------------------------------------------------------------------ */

interface ShelterDashboardProps {
  manager: AuthUser;
  onLogout: () => void;
}

/** The subset of a shelter the walk-in / departure dialogs need. Accepts both a
 * plain register row and an analytics row (whose status is the four-band type). */
type ShelterTarget = Pick<
  ShelterRoll,
  "id" | "name" | "maxCapacity" | "confirmedOccupancy"
>;

export default function KaveeshaShelterDashboard({
  manager,
  onLogout,
}: ShelterDashboardProps) {
  const token = getStoredDmcToken();

  const [profile, setProfile] = useState<ShelterManager | null>(null);
  const [analytics, setAnalytics] = useState<ShelterAnalytics | null>(null);
  const [shelters, setShelters] = useState<
    (ShelterRoll & { status: ShelterBand })[]
  >([]);
  const [arrivals, setArrivals] = useState<ShelterAllocation[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [streamLive, setStreamLive] = useState(false);
  const [reload, setReload] = useState(0);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ShelterAllocation | null>(null);
  const [walkInTarget, setWalkInTarget] = useState<ShelterTarget | null>(null);
  const [departureTarget, setDepartureTarget] = useState<ShelterTarget | null>(null);

  const refresh = () => setReload((key) => key + 1);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    Promise.all([
      fetchManagerProfile(token),
      fetchMyShelters(token),
      fetchExpectedArrivals(token),
      fetchManagerAnalytics(token),
    ])
      .then(([who, myShelters, expected, figures]) => {
        if (cancelled) return;
        setProfile(who);
        setShelters(myShelters);
        setArrivals(expected);
        setAnalytics(figures);
        setError(null);
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        setError(cause.message || "Your shelter workspace could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, reload]);

  useEffect(() => {
    if (!token) return;

    const handle = openManagerStream({
      token,
      onState: (state) => setStreamLive(state === "live"),
      onEvent: (event: ManagerLiveEvent) => {
        if (event.kind === "shelter" || event.kind === "dispatch") refresh();
      },
    });

    const poll = setInterval(() => refresh(), 20_000);

    return () => {
      handle.close();
      clearInterval(poll);
    };
  }, [token]);

  const summary = useMemo(() => {
    const inside = shelters.reduce((sum, s) => sum + s.confirmedOccupancy, 0);
    const beds = shelters.reduce((sum, s) => sum + s.maxCapacity, 0);
    const inbound = arrivals.reduce((sum, a) => sum + (a.allocatedCount - a.arrivedCount), 0);

    return { inside, beds, inbound, count: shelters.length };
  }, [shelters, arrivals]);

  const afterAction = (message: string) => {
    setNotice(message);
    setConfirmTarget(null);
    setWalkInTarget(null);
    setDepartureTarget(null);
    refresh();
  };

  if (!token) {
    return (
      <div style={pageStyle}>
        <div className="kdx-error" style={{ maxWidth: 520 }}>
          <TriangleAlert size={18} />
          <div>
            <h3 style={{ margin: 0 }}>Session not found</h3>
            <p style={{ margin: "4px 0 0" }}>Please sign out and sign in again.</p>
          </div>
          <button type="button" className="kdx-btn" style={{ marginTop: 10 }} onClick={onLogout}>
            Sign out
          </button>
        </div>
        <style>{DISPATCH_CSS}</style>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={brandMarkStyle}>
            <ShieldCheck size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: Colors.white, letterSpacing: "-0.01em" }}>
              Safe<span style={{ color: "#7FB3FF" }}>Plus</span>
              <span style={{ opacity: 0.5, fontWeight: 600 }}> · Shelter Operations</span>
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.72)", fontWeight: 600 }}>
              {profile?.fullName ?? manager.fullName}
              {profile?.district ? ` · ${profile.district} District` : ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`kdx-chip ${streamLive ? "kdx-chip-good" : "kdx-chip"}`} style={{ background: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.3)", color: Colors.white }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: streamLive ? Colors.success : "#D9A23C",
                display: "inline-block",
              }}
            />
            {streamLive ? "Live" : "Polling"}
          </span>
          <button type="button" onClick={onLogout} style={signOutStyle}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1180, width: "100%", margin: "0 auto", padding: "22px 22px 48px", display: "grid", gap: 18 }}>
        <div className="kqd-head">
          <div>
            <div className="kqd-head-title">
              <Building2 size={18} />
              Your shelters
            </div>
            <p className="kqd-head-sub">
              Confirming an arrival is the only thing that moves occupancy. The pale
              band is reserved seats not yet confirmed; the solid band is people you
              have checked in.
            </p>
          </div>
          <div className="kqd-head-stats">
            <div className="kqd-stat">
              <strong>{summary.count}</strong>
              <span>Shelters</span>
            </div>
            <div className="kqd-stat">
              <strong>{summary.inside}</strong>
              <span>Confirmed in</span>
            </div>
            <div className="kqd-stat kqd-stat-live">
              <strong>{summary.inbound}</strong>
              <span>Inbound</span>
            </div>
            <div className="kqd-stat">
              <strong>{summary.beds}</strong>
              <span>Total beds</span>
            </div>
          </div>
        </div>

        {analytics && analytics.shelters.length > 0 && (
          <KaveeshaShelterInsights
            analytics={analytics}
            canEdit={() => true}
            onManage={(shelter) => setDetailId(shelter.id)}
          />
        )}

        {notice && (
          <div className="kdx-success">
            <CheckCircle2 size={16} />
            <span>{notice}</span>
            <button type="button" className="kdx-x" style={{ marginLeft: "auto" }} onClick={() => setNotice(null)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )}

        {error && (
          <div className="kdx-error">
            <TriangleAlert size={17} />
            <span>{error}</span>
          </div>
        )}

        {!ready ? (
          <div className="kdx-loading" style={{ background: Colors.white, borderRadius: 16, border: `1px solid ${Colors.border}` }}>
            Opening your shelters…
          </div>
        ) : shelters.length === 0 ? (
          <div className="kdx-panel">
            <div className="kdx-empty">
              <Building2 size={30} />
              <div>No shelters are assigned to you yet. A District Officer assigns the shelters you run.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
            {shelters.map((shelter) => (
              <ManagerShelterCard
                key={shelter.id}
                shelter={shelter}
                onWalkIn={() => setWalkInTarget(shelter)}
                onDeparture={() => setDepartureTarget(shelter)}
              />
            ))}
          </div>
        )}

        <section className="kdx-panel">
          <div className="kdx-panel-head">
            <div className="kdx-panel-title">
              <Clock size={15} />
              Expected arrivals
              {arrivals.length > 0 && <span className="kdx-chip kdx-chip-info">{arrivals.length}</span>}
            </div>
            <div className="kdx-panel-sub">Reserved by the district desk, waiting for you to confirm.</div>
          </div>

          <div className="kdx-panel-body">
            {arrivals.length === 0 ? (
              <div className="kdx-muted-line">Nothing is inbound right now.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {arrivals.map((allocation) => (
                  <div key={allocation.id} className="kdx-team" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
                    <div className="kdx-rank">
                      <Users size={15} />
                    </div>
                    <div>
                      <div className="kdx-team-name">
                        {allocation.shelterName}
                        <span className="kdx-team-type">{allocation.shelterCode}</span>
                      </div>
                      <div className="kdx-team-line">
                        {allocation.allocatedCount} reserved · allocated by {allocation.allocatedByName ?? "the desk"} · {relativeTime(allocation.createdAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="kdx-btn kdx-btn-task kdx-btn-sm"
                      onClick={() => setConfirmTarget(allocation)}
                    >
                      <CheckCircle2 size={14} />
                      Confirm arrival
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {confirmTarget && (
        <ConfirmArrivalModal
          token={token}
          allocation={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onDone={afterAction}
        />
      )}

      {walkInTarget && (
        <CountModal
          token={token}
          mode="walk-in"
          shelter={walkInTarget}
          onClose={() => setWalkInTarget(null)}
          onDone={afterAction}
        />
      )}

      {departureTarget && (
        <CountModal
          token={token}
          mode="departure"
          shelter={departureTarget}
          onClose={() => setDepartureTarget(null)}
          onDone={afterAction}
        />
      )}

      {detailId && analytics && (
        <ManagerShelterDetail
          shelter={analytics.shelters.find((s) => s.id === detailId) ?? null}
          trend={analytics.perShelterTrend[detailId] ?? []}
          arrivals={arrivals.filter((a) => a.shelterId === detailId)}
          onClose={() => setDetailId(null)}
          onWalkIn={(shelter) => {
            setDetailId(null);
            setWalkInTarget(shelter);
          }}
          onDeparture={(shelter) => {
            setDetailId(null);
            setDepartureTarget(shelter);
          }}
          onConfirm={setConfirmTarget}
        />
      )}

      <style>{`${DISPATCH_CSS}${DESK_CSS}`}</style>
    </div>
  );
}

/* ------------------------------ shell styles ------------------------------ */

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: Colors.background,
  fontFamily: "Inter, system-ui, sans-serif",
  color: Colors.text,
};

const headerStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  padding: "14px 22px",
  background: Colors.navy,
  borderBottom: `1px solid ${Colors.navyLight}`,
};

const brandMarkStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 11,
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.22)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: Colors.white,
  flexShrink: 0,
};

const signOutStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "8px 13px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.3)",
  background: "rgba(255,255,255,0.1)",
  color: Colors.white,
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

/* ---------------------------- shelter card ---------------------------- */

function ManagerShelterCard({
  shelter,
  onWalkIn,
  onDeparture,
}: {
  shelter: ShelterRoll;
  onWalkIn: () => void;
  onDeparture: () => void;
}) {
  const band = bandFor(shelter);
  const meta = BAND_META[band];

  return (
    <div className="kdx-panel" style={{ overflow: "visible" }}>
      <div className="kdx-panel-head" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="kdx-panel-title" style={{ fontSize: 14 }}>
            {shelter.name}
          </div>
          <div className="kdx-panel-sub">
            {shelter.shelterCode} · {shelter.district}
          </div>
        </div>
        <span className={`kdx-chip ${meta.chip}`}>{meta.label}</span>
      </div>

      <div className="kdx-panel-body" style={{ display: "grid", gap: 12 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, color: Colors.muted, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 5 }}>
            <span>Occupied {occupancyPct(shelter)}%</span>
            <span>{shelter.confirmedOccupancy} / {shelter.maxCapacity}</span>
          </div>
          <div className="kdx-bar-track" style={{ position: "relative", height: 10 }}>
            <div className="kdx-bar-fill" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${claimedPct(shelter)}%`, background: `${Colors.blue}40` }} />
            <div className="kdx-bar-fill" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${occupancyPct(shelter)}%`, background: meta.color }} />
          </div>
        </div>

        <div className="kdx-facts" style={{ marginBottom: 0 }}>
          <div className="kdx-fact">
            <div className="kdx-fact-label">Inside</div>
            <div className="kdx-fact-value">{shelter.confirmedOccupancy}</div>
          </div>
          <div className="kdx-fact">
            <div className="kdx-fact-label">Room left</div>
            <div className="kdx-fact-value" style={{ color: shelter.remainingAllocatable > 0 ? Colors.success : Colors.red }}>
              {shelter.remainingAllocatable}
            </div>
          </div>
        </div>

        {shelter.address && (
          <div className="kdx-muted-line" style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
            <MapPin size={13} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>{shelter.address}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="kdx-btn kdx-btn-sm" onClick={onWalkIn}>
            <DoorOpen size={14} />
            Record walk-in
          </button>
          <button type="button" className="kdx-btn kdx-btn-sm" onClick={onDeparture}>
            <MinusCircle size={14} />
            Record departure
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- manager shelter detail ---------------------------- */

function ManagerShelterDetail({
  shelter,
  trend,
  arrivals,
  onClose,
  onWalkIn,
  onDeparture,
  onConfirm,
}: {
  shelter: ShelterAnalyticsRow | null;
  trend: { hour: string; occupancy: number }[];
  arrivals: ShelterAllocation[];
  onClose: () => void;
  onWalkIn: (shelter: ShelterTarget) => void;
  onDeparture: (shelter: ShelterTarget) => void;
  onConfirm: (allocation: ShelterAllocation) => void;
}) {
  if (!shelter) return null;

  const meta = STATUS_META[shelter.status];

  return (
    <div className="kdx-modal-back" onClick={onClose}>
      <div className="kdx-modal kdx-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="kdx-modal-head">
          <div style={{ minWidth: 0 }}>
            <div className="kdx-modal-title">
              {shelter.name}
              <span className={`kdx-chip ${meta.chip}`} style={{ marginLeft: 10 }}>
                {meta.label}
              </span>
            </div>
            <div className="kdx-modal-sub">
              {shelter.shelterCode} · {shelter.district} · {meta.hint}
            </div>
          </div>
          <button type="button" className="kdx-x" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="kdx-modal-body">
          <div className="kdx-facts" style={{ marginBottom: 6 }}>
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
            <div className="kdx-fact">
              <div className="kdx-fact-label">Capacity</div>
              <div className="kdx-fact-value">{shelter.maxCapacity}</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
              margin: "8px 0 4px",
            }}
          >
            <div>
              <div className="kdx-panel-title" style={{ fontSize: 13, marginBottom: 8 }}>
                Occupancy trend (24h)
              </div>
              <OccupancyTrendChart
                points={trend}
                stroke={meta.color}
                tint={meta.color}
                emptyLabel="No movement recorded in the last 24 hours."
              />
            </div>
            <div>
              <div className="kdx-panel-title" style={{ fontSize: 13, marginBottom: 8 }}>
                Capacity split
              </div>
              <CapacityDonutChart
                segments={[
                  { label: "Inside now", value: shelter.confirmedOccupancy, color: Colors.blue },
                  { label: "Reserved (inbound)", value: shelter.pendingArrivals, color: Colors.amber },
                  { label: "Free", value: shelter.remainingAllocatable, color: Colors.success },
                ]}
                centerLabel={`${occupancyPct(shelter)}%`}
              />
            </div>
          </div>

          <div className="kdx-panel" style={{ marginTop: 8 }}>
            <div className="kdx-panel-head">
              <div className="kdx-panel-title" style={{ fontSize: 13 }}>
                Run by
              </div>
            </div>
            <div className="kdx-panel-body">
              {shelter.managers.length === 0 ? (
                <div className="kdx-muted-line">No manager is listed for this shelter.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {shelter.managers.map((manager) => (
                    <div key={manager.id} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <strong style={{ color: Colors.navy, fontSize: 13 }}>{manager.fullName}</strong>
                      {manager.email && (
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: Colors.muted }}>
                          <Mail size={12} /> {manager.email}
                        </span>
                      )}
                      {manager.phone && (
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: Colors.muted }}>
                          <Phone size={12} /> {manager.phone}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {arrivals.length > 0 && (
            <div>
              <div className="kdx-panel-title" style={{ fontSize: 13, margin: "4px 0 8px" }}>
                <Clock size={14} /> Expected at this shelter
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {arrivals.map((allocation) => (
                  <div key={allocation.id} className="kdx-team" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                    <div>
                      <div className="kdx-team-name">{allocation.allocatedCount} reserved</div>
                      <div className="kdx-team-line">
                        by {allocation.allocatedByName ?? "the desk"} · {relativeTime(allocation.createdAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="kdx-btn kdx-btn-task kdx-btn-sm"
                      onClick={() => onConfirm(allocation)}
                    >
                      <CheckCircle2 size={14} />
                      Confirm arrival
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="kdx-modal-foot">
          <button type="button" className="kdx-btn" style={{ marginRight: "auto" }} onClick={() => onDeparture(shelter)}>
            <MinusCircle size={14} />
            Record departure
          </button>
          <button type="button" className="kdx-btn" onClick={onClose}>
            Close
          </button>
          <button type="button" className="kdx-btn kdx-btn-primary" onClick={() => onWalkIn(shelter)}>
            <PencilLine size={14} />
            Record walk-in
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- confirm modal ---------------------------- */

function ConfirmArrivalModal({
  token,
  allocation,
  onClose,
  onDone,
}: {
  token: string;
  allocation: ShelterAllocation;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [arrived, setArrived] = useState(String(allocation.allocatedCount));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const count = Number(arrived);

    if (!Number.isInteger(count) || count < 0 || count > allocation.allocatedCount) {
      setError(`Enter an arrived count between 0 and ${allocation.allocatedCount}.`);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await confirmArrival(token, allocation.id, count, note.trim() || undefined);
      onDone(
        count === allocation.allocatedCount
          ? `${count} confirmed at ${result.shelter.name}. It now holds ${result.shelter.confirmedOccupancy}.`
          : `Recorded ${count} of ${allocation.allocatedCount}. ${result.shelter.name} now holds ${result.shelter.confirmedOccupancy}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "The arrival could not be confirmed.");
      setBusy(false);
    }
  };

  const short = allocation.allocatedCount - Number(arrived || 0);

  return (
    <ModalShell title="Confirm arrival" sub={`${allocation.shelterName} · ${allocation.shelterCode}`} onClose={onClose} busy={busy}>
      {error && (
        <div className="kdx-error">
          <TriangleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="kdx-form">
        <label className="kdx-label">
          People who arrived (allocated {allocation.allocatedCount})
        </label>
        <input
          className="kdx-input"
          value={arrived}
          onChange={(e) => setArrived(e.target.value)}
          inputMode="numeric"
        />
        {Number.isFinite(short) && short > 0 && (
          <div className="kdx-warn" style={{ marginTop: 4 }}>
            <Users size={15} />
            <span>{short} of the allocated people did not arrive. Add a note so the desk can follow up.</span>
          </div>
        )}
      </div>

      <div className="kdx-form">
        <label className="kdx-label">Discrepancy note (optional)</label>
        <textarea
          className="kdx-area"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why fewer arrived, where the rest are, etc."
        />
      </div>

      <div className="kdx-hint">
        This adds {Number(arrived || 0)} to confirmed occupancy. Nothing changes until
        you confirm.
      </div>

      <ModalFoot onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Confirm arrival" />
    </ModalShell>
  );
}

/* ---------------------------- count modal (walk-in / departure) ---------------------------- */

function CountModal({
  token,
  mode,
  shelter,
  onClose,
  onDone,
}: {
  token: string;
  mode: "walk-in" | "departure";
  shelter: ShelterTarget;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [people, setPeople] = useState("");
  const [vulnerable, setVulnerable] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWalkIn = mode === "walk-in";
  const limit = isWalkIn ? shelter.maxCapacity - shelter.confirmedOccupancy : shelter.confirmedOccupancy;

  const submit = async () => {
    const count = Number(people);

    if (!Number.isInteger(count) || count < 1) {
      setError("Enter a whole number of at least 1.");
      return;
    }

    if (count > limit) {
      setError(
        isWalkIn
          ? `Only ${limit} beds are free here right now.`
          : `Only ${limit} people are currently inside.`
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (isWalkIn) {
        const result = await recordWalkIn(
          token,
          shelter.id,
          count,
          vulnerable.trim() === "" ? undefined : Number(vulnerable)
        );
        onDone(`Logged ${count} walk-in${count === 1 ? "" : "s"}. ${result.shelter.name} now holds ${result.shelter.confirmedOccupancy}.`);
      } else {
        const updated = await recordDeparture(token, shelter.id, count, reason.trim() || undefined);
        onDone(`Logged ${count} departing. ${updated.name} now holds ${updated.confirmedOccupancy}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The record could not be saved.");
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={isWalkIn ? "Record a walk-in" : "Record a departure"}
      sub={`${shelter.name} · ${shelter.confirmedOccupancy}/${shelter.maxCapacity} inside`}
      onClose={onClose}
      busy={busy}
    >
      {error && (
        <div className="kdx-error">
          <TriangleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="kdx-form">
        <label className="kdx-label">
          {isWalkIn ? "People walking in" : "People leaving"} (limit {limit})
        </label>
        <input
          className="kdx-input"
          value={people}
          onChange={(e) => setPeople(e.target.value)}
          inputMode="numeric"
          placeholder="0"
        />
      </div>

      {isWalkIn ? (
        <div className="kdx-form">
          <label className="kdx-label">Of which vulnerable (optional)</label>
          <input
            className="kdx-input"
            value={vulnerable}
            onChange={(e) => setVulnerable(e.target.value)}
            inputMode="numeric"
            placeholder="0"
          />
        </div>
      ) : (
        <div className="kdx-form">
          <label className="kdx-label">Reason (optional)</label>
          <input
            className="kdx-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Relocated, returned home, transferred"
          />
        </div>
      )}

      <div className="kdx-hint">
        {isWalkIn
          ? "A walk-in is counted immediately — no allocation existed for them."
          : "Departure only reduces the people confirmed inside, never below zero."}
      </div>

      <ModalFoot
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        submitLabel={isWalkIn ? "Record walk-in" : "Record departure"}
      />
    </ModalShell>
  );
}

/* ---------------------------- modal primitives ---------------------------- */

function ModalShell({
  title,
  sub,
  busy,
  onClose,
  children,
}: {
  title: string;
  sub: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="kdx-modal-back" onClick={busy ? undefined : onClose}>
      <div className="kdx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kdx-modal-head">
          <div>
            <div className="kdx-modal-title">{title}</div>
            <div className="kdx-modal-sub">{sub}</div>
          </div>
          <button type="button" className="kdx-x" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="kdx-modal-body">{children}</div>
      </div>
    </div>
  );
}

function ModalFoot({
  onClose,
  onSubmit,
  busy,
  submitLabel,
}: {
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  return (
    <div className="kdx-modal-foot">
      <button type="button" className="kdx-btn" onClick={onClose} disabled={busy}>
        Cancel
      </button>
      <button type="button" className="kdx-btn kdx-btn-primary" onClick={onSubmit} disabled={busy}>
        {busy && <Loader2 className="kdx-spin" size={14} />}
        {submitLabel}
      </button>
    </div>
  );
}
