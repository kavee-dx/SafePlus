import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";

import { Colors } from "../constants/theme";
import {
  type EvacueeGroup,
  type ShelterRoll,
  type ShelterRecommendation,
  type AllocationLine,
  type ShelterLiveEvent,
  ShelterApiError,
  allocateGroup,
  cancelGroupAllocation,
  createGroup,
  fetchGroups,
  fetchShelters,
  openShelterStream,
  recommendShelters,
} from "../services/kaveesha-shelterApi";
import {
  BAND_META,
  bandFor,
  formatKm,
  groupStatusMeta,
} from "../utils/kaveesha-shelterFormat";
import { DISPATCH_CSS, DESK_CSS } from "../styles/kaveesha-dispatchStyles";
import { relativeTime } from "../utils/kaveesha-dispatchFormat";

/* ------------------------------------------------------------------ *
 * Allocation desk.
 *
 * A rescued or self-arrived group needs beds. This screen keeps Thathsarani's
 * original GPS-then-nearest answer and layers the two things the brief asked
 * for: a recommended split when nothing nearby can take everyone on its own,
 * and a Capacity-Exceeded call-out that says exactly how many are left with
 * nowhere to go. Allocating only reserves room — occupancy moves when the
 * Shelter Manager confirms, and that queue is the second tab.
 * ------------------------------------------------------------------ */

const OPEN_STATUSES = new Set(["AWAITING_SHELTER", "ALLOCATED", "PARTIAL"]);

export default function KaveeshaShelterAllocation({
  token,
  district,
}: {
  token: string | null;
  district: string;
}) {
  const [tab, setTab] = useState<"waiting" | "pending">("waiting");
  const [groups, setGroups] = useState<EvacueeGroup[]>([]);
  const [shelters, setShelters] = useState<ShelterRoll[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [streamLive, setStreamLive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [reload, setReload] = useState(0);

  const refresh = () => setReload((key) => key + 1);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    Promise.all([
      fetchGroups(token, false),
      fetchShelters(token, { activeOnly: true }),
    ])
      .then(([rows, shelterRows]) => {
        if (cancelled) return;
        setGroups(rows);
        setShelters(shelterRows);
        setError(null);
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        setError(cause.message || "The allocation desk could not load.");
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

    const handle = openShelterStream({
      token,
      onState: (state) => setStreamLive(state === "live"),
      onEvent: (event: ShelterLiveEvent) => {
        if (event.kind === "shelter" || event.kind === "dispatch") refresh();
      },
    });

    const poll = setInterval(() => refresh(), 25_000);

    return () => {
      handle.close();
      clearInterval(poll);
    };
  }, [token]);

  const waiting = useMemo(
    () => groups.filter((g) => OPEN_STATUSES.has(g.status) && g.status !== "ALLOCATED"),
    [groups]
  );
  const allocated = useMemo(
    () => groups.filter((g) => g.status === "ALLOCATED" || g.status === "PARTIAL"),
    [groups]
  );
  const pending = useMemo(
    () =>
      allocated.filter((g) =>
        g.allocations.some((a) => a.status === "PENDING")
      ),
    [allocated]
  );

  const selected = useMemo(
    () => groups.find((g) => g.id === selectedId) ?? null,
    [groups, selectedId]
  );

  if (!token) return null;

  return (
    <div className="kdx-stack">
      <div className="kqd-head">
        <div>
          <div className="kqd-head-title">
            <ArrowRightLeft size={18} />
            Allocation desk
          </div>
          <p className="kqd-head-sub">
            Send waiting groups to the nearest shelter with room. A recommendation
            splits across shelters and flags the shortfall when none can take
            everyone. Allocating reserves space; a Shelter Manager confirms arrival.
          </p>
        </div>
        <div className="kqd-head-stats">
          <div className={`kqd-stat${waiting.length > 0 ? " kqd-stat-hot" : ""}`}>
            <strong>{waiting.length}</strong>
            <span>Awaiting</span>
          </div>
          <div className="kqd-stat kqd-stat-live">
            <strong>{pending.length}</strong>
            <span>Pending arrival</span>
          </div>
          <div className="kqd-stat">
            <strong>{shelters.length}</strong>
            <span>Open shelters</span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div className="kdx-tabs">
          <button
            type="button"
            className={`kdx-tab ${tab === "waiting" ? "kdx-tab-on" : ""}`}
            onClick={() => setTab("waiting")}
          >
            <Users size={14} />
            Waiting groups
            <span className="kdx-tab-count">{waiting.length}</span>
          </button>
          <button
            type="button"
            className={`kdx-tab ${tab === "pending" ? "kdx-tab-on" : ""}`}
            onClick={() => setTab("pending")}
          >
            <Clock size={14} />
            Pending arrivals
            <span className="kdx-tab-count">{pending.length}</span>
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`kdx-chip ${streamLive ? "kdx-chip-good" : "kdx-chip"}`}>
            {streamLive ? "Live" : "Polling"}
          </span>
          <button type="button" className="kdx-btn kdx-btn-sm" onClick={refresh}>
            <RefreshCw size={14} />
          </button>
          {tab === "waiting" && (
            <button
              type="button"
              className="kdx-btn kdx-btn-primary kdx-btn-sm"
              onClick={() => setShowRegister(true)}
            >
              <Plus size={14} />
              Log a group
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="kdx-success">
          {notice}
          <button
            type="button"
            className="kdx-x"
            style={{ marginLeft: "auto" }}
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
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
        <div className="kdx-loading">
          <Loader2 className="kdx-spin" size={17} /> Loading the allocation desk…
        </div>
      ) : tab === "pending" ? (
        <PendingArrivals groups={pending} />
      ) : selected ? (
        <AllocationEditor
          key={selected.id}
          token={token}
          group={selected}
          shelters={shelters}
          district={district}
          onDone={(message) => {
            setSelectedId(null);
            setNotice(message);
            refresh();
          }}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <GroupList
          groups={waiting}
          onSelect={setSelectedId}
          emptyMessage="No groups are waiting for a shelter. Completed rescues appear here automatically, and you can log a self-arrived group."
        />
      )}

      {showRegister && (
        <RegisterGroupModal
          token={token}
          district={district}
          onClose={() => setShowRegister(false)}
          onDone={(message) => {
            setShowRegister(false);
            setNotice(message);
            refresh();
          }}
        />
      )}

      <style>{`${DISPATCH_CSS}${DESK_CSS}`}</style>
    </div>
  );
}

/* ---------------------------- group list ---------------------------- */

function GroupList({
  groups,
  onSelect,
  emptyMessage,
}: {
  groups: EvacueeGroup[];
  onSelect: (id: string) => void;
  emptyMessage: string;
}) {
  if (groups.length === 0) {
    return (
      <div className="kdx-panel">
        <div className="kdx-empty">
          <Users size={30} />
          <div>{emptyMessage}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="kdx-panel">
      <div className="kdx-list">
        {groups.map((group) => {
          const status = groupStatusMeta(group.status);
          const hasOrigin =
            group.originLatitude !== undefined && group.originLongitude !== undefined;

          return (
            <button
              key={group.id}
              type="button"
              className="kdx-incident"
              onClick={() => onSelect(group.id)}
            >
              <div
                className="kdx-shot kdx-shot-bare"
                style={{ color: Colors.blue }}
              >
                <Users size={22} />
              </div>
              <div className="kdx-incident-body">
                <div className="kdx-incident-title">
                  {group.groupCode}
                  <span className={`kdx-chip ${status.chip}`}>{status.label}</span>
                </div>
                <div className="kdx-incident-meta">
                  {group.peopleCount} people
                  {group.vulnerableCount > 0
                    ? ` · ${group.vulnerableCount} vulnerable`
                    : ""}{" "}
                  · {group.arrivalSource === "RESCUE_TEAM" ? "Rescued" : "Self-arrived"}
                  {group.district ? ` · ${group.district}` : ""}
                </div>
                <div className="kdx-incident-place">
                  {hasOrigin ? (
                    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <MapPin size={13} /> Origin captured — allocation opens on the
                      nearest shelters
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <Navigation size={13} /> No origin point — you'll enter one to
                      find nearby shelters
                    </span>
                  )}
                </div>
                <div className="kdx-incident-meta">
                  Updated {relativeTime(group.updatedAt)}
                </div>
              </div>
              <ArrowRightLeft size={16} style={{ color: Colors.muted, alignSelf: "center" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- allocation editor ---------------------------- */

function AllocationEditor({
  token,
  group,
  shelters,
  district,
  onDone,
  onBack,
}: {
  token: string;
  group: EvacueeGroup;
  shelters: ShelterRoll[];
  district: string;
  onDone: (message: string) => void;
  onBack: () => void;
}) {
  const hasOrigin =
    group.originLatitude !== undefined && group.originLongitude !== undefined;

  const [latitude, setLatitude] = useState(
    hasOrigin ? String(group.originLatitude) : ""
  );
  const [longitude, setLongitude] = useState(
    hasOrigin ? String(group.originLongitude) : ""
  );
  const [lines, setLines] = useState<AllocationLine[]>(
    group.allocations
      .filter((a) => a.status === "PENDING")
      .map((a) => ({ shelterId: a.shelterId, count: a.allocatedCount }))
  );
  const [recommendation, setRecommendation] =
    useState<ShelterRecommendation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);

  // Distances come only from the recommendation (the officer's plain shelter
  // list has no point to measure from). Keep them here so a line still shows its
  // km after the officer tweaks counts, not just while a plan is unsuperseded.
  const [distanceByShelter, setDistanceByShelter] = useState<
    Record<string, number>
  >({});

  const shelterById = useMemo(() => {
    const map = new Map<string, ShelterRoll>();
    for (const s of shelters) map.set(s.id, s);
    return map;
  }, [shelters]);

  const rememberDistances = useCallback(
    (plan: ShelterRecommendation["plan"]) => {
      setDistanceByShelter((prev) => {
        const next = { ...prev };
        for (const line of plan) {
          if (typeof line.distanceKm === "number") next[line.shelterId] = line.distanceKm;
        }
        return next;
      });
    },
    []
  );

  const allocatedTotal = lines.reduce((sum, l) => sum + l.count, 0);
  const remainingToPlace = group.peopleCount - allocatedTotal;

  const runRecommend = useCallback(async () => {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Enter a valid origin point to find nearby shelters.");
      return;
    }

    setLoadingRec(true);
    setError(null);

    try {
      const result = await recommendShelters(token, {
        latitude: lat,
        longitude: lng,
        people: group.peopleCount,
      });
      setRecommendation(result);
      rememberDistances(result.plan);
      if (result.plan.length > 0) {
        setLines(result.plan.map((p) => ({ shelterId: p.shelterId, count: p.count })));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No recommendation could be made."
      );
    } finally {
      setLoadingRec(false);
    }
  }, [token, latitude, longitude, group.peopleCount, rememberDistances]);

  // When a rescued group carries its incident coordinates, answer the question
  // the moment the desk opens — the original GPS-first design. It runs once per
  // group mount; the `cancelled` flag is what makes it StrictMode-safe (a ref
  // guard would strand the surviving mount with a cancelled first fetch). State
  // is touched only inside the promise callbacks, so the effect sets none.
  useEffect(() => {
    if (!hasOrigin) return;

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    let cancelled = false;

    recommendShelters(token, {
      latitude: lat,
      longitude: lng,
      people: group.peopleCount,
    })
      .then((result) => {
        if (cancelled) return;
        setRecommendation(result);
        rememberDistances(result.plan);
        if (result.plan.length > 0) {
          setLines(result.plan.map((p) => ({ shelterId: p.shelterId, count: p.count })));
        }
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message || "No recommendation could be made.");
      });

    return () => {
      cancelled = true;
    };
    // Runs once per group; the editor remounts on group change via its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLine = (index: number, next: Partial<AllocationLine>) => {
    setLines((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...next } : row))
    );
    setRecommendation(null);
  };

  const removeLine = (index: number) => {
    setLines((rows) => rows.filter((_, i) => i !== index));
    setRecommendation(null);
  };

  const addLine = () => {
    const free = shelters.find(
      (s) => s.remainingAllocatable > 0 && !lines.some((l) => l.shelterId === s.id)
    );
    setLines((rows) => [
      ...rows,
      { shelterId: free?.id ?? shelters[0]?.id ?? "", count: Math.max(1, remainingToPlace) },
    ]);
    setRecommendation(null);
  };

  const confirm = async () => {
    const cleaned = lines
      .filter((l) => l.shelterId && l.count > 0)
      .map((l) => ({ shelterId: l.shelterId, count: Math.trunc(l.count) }));

    if (cleaned.length === 0) {
      setError("Add at least one shelter to allocate to.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const updated = await allocateGroup(token, group.id, cleaned);
      onDone(
        `${updated.groupCode} is allocated to ${updated.allocations.length} shelter${
          updated.allocations.length === 1 ? "" : "s"
        }.`
      );
    } catch (err) {
      if (err instanceof ShelterApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "The allocation failed.");
      }
      setBusy(false);
    }
  };

  const status = groupStatusMeta(group.status);

  return (
    <>
      <div className="kdx-panel">
        <div className="kdx-panel-head">
          <div>
            <div className="kdx-panel-title" style={{ fontSize: 15 }}>
              {group.groupCode}
              <span className={`kdx-chip ${status.chip}`}>{status.label}</span>
            </div>
            <div className="kdx-panel-sub">
              {group.peopleCount} people ·{" "}
              {group.arrivalSource === "RESCUE_TEAM" ? "rescued" : "self-arrived"} ·{" "}
              {group.district || district}
            </div>
          </div>
          <button type="button" className="kdx-btn kdx-btn-sm" onClick={onBack}>
            <X size={14} />
            Back to list
          </button>
        </div>

        <div className="kdx-panel-body" style={{ display: "grid", gap: 14 }}>
          <div className="kdx-two" style={{ marginBottom: 0 }}>
            <div className="kdx-form">
              <label className="kdx-label">Origin latitude</label>
              <input
                className="kdx-input"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                inputMode="decimal"
                placeholder="6.9271"
              />
            </div>
            <div className="kdx-form">
              <label className="kdx-label">Origin longitude</label>
              <input
                className="kdx-input"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                inputMode="decimal"
                placeholder="79.8612"
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="kdx-btn kdx-btn-primary kdx-btn-sm"
              onClick={runRecommend}
              disabled={loadingRec}
            >
              {loadingRec ? <Loader2 className="kdx-spin" size={14} /> : <Sparkles size={14} />}
              Find nearest shelters
            </button>
            {hasOrigin && (
              <span className="kdx-hint" style={{ margin: 0 }}>
                Pre-filled from the incident location.
              </span>
            )}
          </div>

          {recommendation && (
            <RecommendationBanner recommendation={recommendation} />
          )}

          {error && (
            <div className="kdx-error">
              <TriangleAlert size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <div className="kdx-panel">
        <div className="kdx-panel-head">
          <div className="kdx-panel-title">
            <Users size={15} />
            Allocation plan
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12,
              fontWeight: 800,
              color:
                remainingToPlace === 0
                  ? Colors.success
                  : remainingToPlace > 0
                    ? Colors.muted
                    : Colors.red,
            }}
          >
            <span>
              {allocatedTotal} / {group.peopleCount} placed
            </span>
            {remainingToPlace > 0 && (
              <span className="kdx-chip kdx-chip-warn">{remainingToPlace} unplaced</span>
            )}
            {remainingToPlace < 0 && (
              <span className="kdx-chip kdx-chip-alert">
                {Math.abs(remainingToPlace)} over group size
              </span>
            )}
          </div>
        </div>

        <div className="kdx-panel-body" style={{ display: "grid", gap: 10 }}>
          {lines.length === 0 && (
            <div className="kdx-muted-line">
              No shelters added yet. Run a recommendation or add a line manually.
            </div>
          )}

          {lines.map((line, index) => {
            const shelter = shelterById.get(line.shelterId);
            const band = shelter ? bandFor(shelter, line.count) : null;

            return (
              <div key={index} className="kdx-team">
                <div className="kdx-rank">{index + 1}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <select
                    className="kdx-select"
                    value={line.shelterId}
                    onChange={(e) => updateLine(index, { shelterId: e.target.value })}
                  >
                    <option value="">Choose a shelter…</option>
                    {shelters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.remainingAllocatable} free
                        {distanceByShelter[s.id] !== undefined
                          ? ` · ${formatKm(distanceByShelter[s.id])}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  {shelter && band && (
                    <div className="kdx-chip-row" style={{ marginTop: 0 }}>
                      <span className={`kdx-chip ${BAND_META[band].chip}`}>
                        {BAND_META[band].label}
                      </span>
                      <span className="kdx-chip">{shelter.shelterCode}</span>
                      {distanceByShelter[line.shelterId] !== undefined && (
                        <span className="kdx-chip kdx-chip-info">
                          <Navigation size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
                          {formatKm(distanceByShelter[line.shelterId])}
                        </span>
                      )}
                      {line.count > shelter.remainingAllocatable && (
                        <span className="kdx-chip kdx-chip-alert">
                          Only {shelter.remainingAllocatable} free here
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    className="kdx-input"
                    style={{ width: 90 }}
                    value={line.count}
                    onChange={(e) =>
                      updateLine(index, { count: Number(e.target.value) || 0 })
                    }
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    className="kdx-btn kdx-btn-sm kdx-btn-danger"
                    onClick={() => removeLine(index)}
                    aria-label="Remove line"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
            <button type="button" className="kdx-btn kdx-btn-sm" onClick={addLine}>
              <Plus size={14} />
              Add shelter line
            </button>
            <button
              type="button"
              className="kdx-btn kdx-btn-task kdx-btn-sm"
              onClick={confirm}
              disabled={busy || lines.length === 0}
              style={{ marginLeft: "auto" }}
            >
              {busy && <Loader2 className="kdx-spin" size={14} />}
              Confirm allocation
            </button>
          </div>
        </div>
      </div>

      {group.allocations.some((a) => a.status === "PENDING") && (
        <CancelButton
          token={token}
          group={group}
          onDone={(message) => {
            onDone(message);
          }}
        />
      )}
    </>
  );
}

function RecommendationBanner({
  recommendation,
}: {
  recommendation: ShelterRecommendation;
}) {
  if (!recommendation.complete) {
    return (
      <div className="kdx-danger">
        <TriangleAlert size={16} />
        <div>
          <strong>Capacity exceeded.</strong> Nearby shelters can take{" "}
          {recommendation.plan.reduce((s, p) => s + p.count, 0)} of the group;{" "}
          <strong>{recommendation.unmet}</strong> still have nowhere to go. Split
          across shelters here, then widen the search or hold them for the next
          capacity.
        </div>
      </div>
    );
  }

  if (!recommendation.singleShelterFits) {
    return (
      <div className="kdx-warn">
        <Navigation size={16} />
        <div>
          No single nearby shelter can take the whole group, so this plan splits it
          across {recommendation.plan.length} shelters, nearest first.
        </div>
      </div>
    );
  }

  return (
    <div className="kdx-explain">
      <Sparkles size={16} />
      <div>
        Nearest shelter with enough room picked first. Adjust any line below before
        you confirm.
      </div>
    </div>
  );
}

function CancelButton({
  token,
  group,
  onDone,
}: {
  token: string;
  group: EvacueeGroup;
  onDone: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    setBusy(true);
    try {
      await cancelGroupAllocation(token, group.id);
      onDone(`${group.groupCode} is no longer allocated.`);
    } catch (err) {
      setBusy(false);
      throw err;
    }
  };

  return (
    <div className="kdx-panel">
      <div className="kdx-panel-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="kdx-muted-line">
          This group already has reservations. Releasing them frees the reserved
          space and puts the group back to awaiting a shelter.
        </div>
        <button
          type="button"
          className="kdx-btn kdx-btn-danger"
          onClick={cancel}
          disabled={busy}
        >
          {busy && <Loader2 className="kdx-spin" size={14} />}
          Release reservations
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- pending arrivals ---------------------------- */

function PendingArrivals({ groups }: { groups: EvacueeGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="kdx-panel">
        <div className="kdx-empty">
          <Clock size={30} />
          <div>Nothing is inbound. Allocated groups appear here until a Shelter
            Manager confirms arrival.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="kdx-panel">
      <div className="kdx-panel-head">
        <div className="kdx-panel-title">
          <Clock size={15} />
          Reserved and waiting for a Shelter Manager to confirm
        </div>
      </div>
      <div className="kdx-list">
        {groups.map((group) => {
          const pendingAllocations = group.allocations.filter(
            (a) => a.status === "PENDING"
          );

          return (
            <div key={group.id} className="kdx-mission">
              <div className="kdx-mission-top">
                <div>
                  <div className="kdx-mission-code">{group.groupCode}</div>
                  <div className="kdx-panel-sub">
                    {group.peopleCount} people ·{" "}
                    {group.arrivalSource === "RESCUE_TEAM" ? "rescued" : "self-arrived"}
                  </div>
                </div>
                <span className={`kdx-chip ${groupStatusMeta(group.status).chip}`}>
                  {groupStatusMeta(group.status).label}
                </span>
              </div>
              <div className="kdx-mission-body">
                {pendingAllocations.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: Colors.navy }}>
                      {a.shelterName}{" "}
                      <span style={{ color: Colors.muted, fontWeight: 600 }}>
                        ({a.shelterCode})
                      </span>
                    </span>
                    <span className="kdx-chip kdx-chip-info">
                      {a.allocatedCount} reserved · by {a.allocatedByName ?? "desk"} ·{" "}
                      {relativeTime(a.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- register a group ---------------------------- */

function RegisterGroupModal({
  token,
  district,
  onClose,
  onDone,
}: {
  token: string;
  district: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [people, setPeople] = useState("");
  const [vulnerable, setVulnerable] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const peopleCount = Number(people);

    if (!Number.isInteger(peopleCount) || peopleCount < 1) {
      setError("Enter how many people arrived (at least 1).");
      return;
    }

    const originLatitude = latitude.trim() === "" ? undefined : Number(latitude);
    const originLongitude = longitude.trim() === "" ? undefined : Number(longitude);

    if ((originLatitude === undefined) !== (originLongitude === undefined)) {
      setError("Give both a latitude and a longitude, or neither.");
      return;
    }

    if (
      originLatitude !== undefined &&
      (!Number.isFinite(originLatitude) ||
        originLatitude < -90 ||
        originLatitude > 90)
    ) {
      setError("Latitude must be between -90 and 90.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const group = await createGroup(token, {
        peopleCount,
        vulnerableCount: vulnerable.trim() === "" ? undefined : Number(vulnerable),
        district: district || undefined,
        originLatitude,
        originLongitude,
      });
      onDone(`Group ${group.groupCode} is waiting for a shelter.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The group could not be logged.");
      setBusy(false);
    }
  };

  return (
    <div className="kdx-modal-back" onClick={busy ? undefined : onClose}>
      <div className="kdx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kdx-modal-head">
          <div>
            <div className="kdx-modal-title">Log a self-arrived group</div>
            <div className="kdx-modal-sub">
              For people the desk heard about by phone. Rescue teams arrive here on
              their own when a mission completes.
            </div>
          </div>
          <button type="button" className="kdx-x" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="kdx-modal-body">
          {error && (
            <div className="kdx-error">
              <TriangleAlert size={16} />
              <span>{error}</span>
            </div>
          )}
          <div className="kdx-two" style={{ marginBottom: 0 }}>
            <div className="kdx-form">
              <label className="kdx-label">People</label>
              <input
                className="kdx-input"
                value={people}
                onChange={(e) => setPeople(e.target.value)}
                inputMode="numeric"
                placeholder="12"
              />
            </div>
            <div className="kdx-form">
              <label className="kdx-label">Vulnerable (optional)</label>
              <input
                className="kdx-input"
                value={vulnerable}
                onChange={(e) => setVulnerable(e.target.value)}
                inputMode="numeric"
                placeholder="3"
              />
            </div>
          </div>
          <div className="kdx-two" style={{ marginBottom: 0 }}>
            <div className="kdx-form">
              <label className="kdx-label">Origin latitude (optional)</label>
              <input
                className="kdx-input"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                inputMode="decimal"
                placeholder="6.9271"
              />
            </div>
            <div className="kdx-form">
              <label className="kdx-label">Origin longitude (optional)</label>
              <input
                className="kdx-input"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                inputMode="decimal"
                placeholder="79.8612"
              />
            </div>
          </div>
          <div className="kdx-hint">
            An origin point lets the desk recommend the nearest shelters
            automatically.
          </div>
        </div>

        <div className="kdx-modal-foot">
          <button type="button" className="kdx-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="kdx-btn kdx-btn-primary"
            onClick={submit}
            disabled={busy}
          >
            {busy && <Loader2 className="kdx-spin" size={14} />}
            Log group
          </button>
        </div>
      </div>
    </div>
  );
}
