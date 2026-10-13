import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Info,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  TriangleAlert,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { Colors } from "../constants/theme";
import {
  type ShelterAnalytics,
  type ShelterAnalyticsRow,
  type ShelterLiveEvent,
  ShelterApiError,
  createShelter,
  fetchShelterAnalytics,
  openShelterStream,
  updateShelter,
} from "../services/kaveesha-shelterApi";
import {
  STATUS_META,
  bandFor,
  claimedPct,
  occupancyPct,
} from "../utils/kaveesha-shelterFormat";
import { CapacityDonutChart, OccupancyTrendChart } from "./kaveesha-charts";
import KaveeshaShelterInsights from "./kaveesha-ShelterInsights";
import { DISPATCH_CSS, DESK_CSS, SHELTER_CSS } from "../styles/kaveesha-dispatchStyles";
import { relativeTime } from "../utils/kaveesha-dispatchFormat";

/* ------------------------------------------------------------------ *
 * The shelter board (officer desk).
 *
 * Reads the whole district (or all districts) as one analytics snapshot, then
 * draws it as charts + a status board. An officer can READ anywhere they switch
 * to, but Manage only offers Edit inside their own district — the same boundary
 * the server enforces on every write, surfaced here so it is never a surprise.
 * Create and edit still live here; a slow poll backs the live SSE so a dropped
 * stream degrades to "refreshes in twenty-five seconds".
 * ------------------------------------------------------------------ */

interface DraftState {
  open: boolean;
  editingId: string | null;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  maxCapacity: string;
  facilities: string;
  isActive: boolean;
}

const EMPTY_DRAFT: DraftState = {
  open: false,
  editingId: null,
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  maxCapacity: "",
  facilities: "",
  isActive: true,
};

function toDraft(shelter: ShelterAnalyticsRow): DraftState {
  return {
    open: true,
    editingId: shelter.id,
    name: shelter.name,
    address: shelter.address ?? "",
    latitude: String(shelter.latitude),
    longitude: String(shelter.longitude),
    maxCapacity: String(shelter.maxCapacity),
    facilities: shelter.facilities.join(", "),
    isActive: shelter.isActive,
  };
}

export default function KaveeshaShelterBoard({
  token,
  district,
}: {
  token: string | null;
  district: string;
}) {
  const [analytics, setAnalytics] = useState<ShelterAnalytics | null>(null);
  const [districtParam, setDistrictParam] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [streamLive, setStreamLive] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const refresh = () => setReload((key) => key + 1);

  // A District Officer changes only their own shelters; a DMC duty officer (no
  // district) changes any. This mirrors assertShelterInScope on the server.
  const canEdit = useMemo(
    () => (shelter: ShelterAnalyticsRow) => !district || shelter.district === district,
    [district]
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    fetchShelterAnalytics(token, districtParam)
      .then((data) => {
        if (cancelled) return;
        setAnalytics(data);
        setError(null);
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        setError(cause.message || "The shelter dashboard could not load.");
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, districtParam, reload]);

  // Live feed on top of the slow poll: a shelter event refreshes the snapshot.
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

  const detail = useMemo(
    () => analytics?.shelters.find((s) => s.id === detailId) ?? null,
    [analytics, detailId]
  );

  const openCreate = () => {
    setFieldErrors({});
    setDraft({ ...EMPTY_DRAFT, open: true });
  };

  const openEdit = (shelter: ShelterAnalyticsRow) => {
    setFieldErrors({});
    setDraft(toDraft(shelter));
  };

  const closeDraft = () => setDraft(EMPTY_DRAFT);

  const submit = async () => {
    if (!token) return;

    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);
    const maxCapacity = Number(draft.maxCapacity);

    const errors: Record<string, string> = {};

    if (draft.name.trim() === "") errors.name = "Give the shelter a name.";
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      errors.latitude = "Latitude must be between -90 and 90.";
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      errors.longitude = "Longitude must be between -180 and 180.";
    }
    if (!Number.isInteger(maxCapacity) || maxCapacity < 1) {
      errors.maxCapacity = "Capacity must be a whole number of at least 1.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const facilities = draft.facilities
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    setBusy(true);
    setError(null);

    try {
      if (draft.editingId) {
        const updated = await updateShelter(token, draft.editingId, {
          name: draft.name.trim(),
          address: draft.address.trim() || undefined,
          latitude,
          longitude,
          maxCapacity,
          isActive: draft.isActive,
          facilities,
        });
        setNotice(`${updated.name} was updated.`);
      } else {
        const created = await createShelter(token, {
          name: draft.name.trim(),
          address: draft.address.trim() || undefined,
          latitude,
          longitude,
          maxCapacity,
          facilities,
        });
        setNotice(
          `${created.name} is on the ${created.district} register with room for ${created.maxCapacity}.`
        );
      }
      closeDraft();
      refresh();
    } catch (err) {
      if (err instanceof ShelterApiError) {
        setFieldErrors(err.fields);
        setError(err.message);
      } else {
        setError(
          err instanceof Error ? err.message : "The shelter could not be saved."
        );
      }
    } finally {
      setBusy(false);
    }
  };

  if (!token) return null;

  const shelters = analytics?.shelters ?? [];
  const critical = shelters.filter((s) => s.status === "CRITICAL").length;

  return (
    <div className="ksh">
      <section className="ksh-hero">
        <div className="ksh-hero-head">
          <span className="ksh-medallion">
            <Building2 size={20} />
          </span>
          <div className="ksh-hero-text">
            <div className="ksh-title">Shelter coordination</div>
            <p className="ksh-sub">
              {analytics?.district ?? "All districts"} — occupancy, capacity and
              the status of every open shelter. Occupancy rises only once a
              Shelter Manager confirms people have arrived.
            </p>
          </div>
          <div className="ksh-actions">
            <span
              className={`ksh-live${streamLive ? " ksh-live-on" : ""}`}
              title={
                streamLive
                  ? "Live updates connected"
                  : "Live feed reconnecting — the board still refreshes on a timer"
              }
            >
              <i />
              {streamLive ? "Live" : "Polling"}
            </span>
            <button
              type="button"
              className="kdx-btn kdx-btn-sm"
              onClick={refresh}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              type="button"
              className="kdx-btn kdx-btn-primary"
              onClick={openCreate}
            >
              <Plus size={15} />
              Add shelter
            </button>
          </div>
        </div>

        {analytics && (
          <div className="ksh-rail">
            <div className="ksh-cells">
              <div className="ksh-cell">
                <span className="ksh-cell-ico">
                  <Building2 size={14} />
                </span>
                <span className="ksh-cell-figure">{analytics.shelters.length}</span>
                <span className="ksh-cell-caption">Shelters in view</span>
                <span className="ksh-cell-sub">
                  {analytics.totalBeds.toLocaleString()} beds registered
                </span>
              </div>
              <div className="ksh-cell ksh-cell-good">
                <span className="ksh-cell-ico">
                  <Users size={14} />
                </span>
                <span className="ksh-cell-figure">
                  {analytics.occupiedBeds.toLocaleString()}
                </span>
                <span className="ksh-cell-caption">Confirmed inside</span>
                <span className="ksh-cell-sub">
                  {analytics.totalBeds > 0
                    ? Math.round(
                        (analytics.occupiedBeds / analytics.totalBeds) * 100
                      )
                    : 0}
                  % of all beds
                </span>
              </div>
              <div className="ksh-cell ksh-cell-live">
                <span className="ksh-cell-ico">
                  <UserPlus size={14} />
                </span>
                <span className="ksh-cell-figure">
                  {analytics.reservedBeds.toLocaleString()}
                </span>
                <span className="ksh-cell-caption">Inbound</span>
                <span className="ksh-cell-sub">Reserved, not yet arrived</span>
              </div>
              <div className={`ksh-cell${critical > 0 ? " ksh-cell-hot" : ""}`}>
                <span className="ksh-cell-ico">
                  <TriangleAlert size={14} />
                </span>
                <span className="ksh-cell-figure">{critical}</span>
                <span className="ksh-cell-caption">Critical</span>
                <span className="ksh-cell-sub">No space left to claim</span>
              </div>
            </div>
          </div>
        )}
      </section>

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

      {error && !draft.open && (
        <div className="kdx-error">
          <TriangleAlert size={17} />
          <span>{error}</span>
        </div>
      )}

      {!ready || !analytics ? (
        <div className="kdx-loading">
          <Loader2 className="kdx-spin" size={17} /> Reading the shelter
          dashboard…
        </div>
      ) : shelters.length === 0 ? (
        <div className="ksh-quiet">
          <Building2 size={30} />
          <div>No open shelters are on the register for this view.</div>
          <button
            type="button"
            className="kdx-btn kdx-btn-primary"
            onClick={openCreate}
          >
            <Plus size={15} />
            Add the first shelter
          </button>
        </div>
      ) : (
        <KaveeshaShelterInsights
          analytics={analytics}
          canEdit={canEdit}
          onSelectDistrict={(value) =>
            setDistrictParam(value === "all" ? "all" : value)
          }
          onManage={(shelter) => setDetailId(shelter.id)}
        />
      )}

      {detail && (
        <ShelterDetailModal
          shelter={detail}
          trend={analytics?.perShelterTrend[detail.id] ?? []}
          beds={{
            totalBeds: detail.maxCapacity,
            occupiedBeds: detail.confirmedOccupancy,
            reservedBeds: detail.pendingArrivals,
            freeBeds: detail.remainingAllocatable,
          }}
          editable={canEdit(detail)}
          onClose={() => setDetailId(null)}
          onEdit={() => openEdit(detail)}
        />
      )}

      {draft.open && (
        <ShelterDraftModal
          draft={draft}
          busy={busy}
          fieldErrors={fieldErrors}
          onChange={setDraft}
          onClose={closeDraft}
          onSubmit={submit}
        />
      )}

      <style>{`${DISPATCH_CSS}${DESK_CSS}${SHELTER_CSS}`}</style>
    </div>
  );
}

/* ---------------------------- the detail modal ---------------------------- */

function ShelterDetailModal({
  shelter,
  trend,
  beds,
  editable,
  onClose,
  onEdit,
}: {
  shelter: ShelterAnalyticsRow;
  trend: { hour: string; occupancy: number }[];
  beds: {
    totalBeds: number;
    occupiedBeds: number;
    reservedBeds: number;
    freeBeds: number;
  };
  editable: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const meta = STATUS_META[shelter.status];
  const band = bandFor(shelter);

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
              {shelter.shelterCode} · {shelter.district} · open{" "}
              {relativeTime(shelter.createdAt)} · updated{" "}
              {relativeTime(shelter.updatedAt)}
            </div>
          </div>
          <button type="button" className="kdx-x" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="kdx-modal-body">
          <div className="kdx-facts" style={{ marginBottom: 16 }}>
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

          <div className="kdx-muted-line" style={{ marginBottom: 14 }}>
            {meta.hint} Currently {band.toLowerCase()} · {occupancyPct(shelter)}%
            inside ({claimedPct(shelter)}% claimed with inbound).
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
              marginBottom: 16,
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
                  { label: "Inside now", value: beds.occupiedBeds, color: Colors.blue },
                  { label: "Reserved (inbound)", value: beds.reservedBeds, color: Colors.amber },
                  { label: "Free", value: beds.freeBeds, color: Colors.success },
                ]}
                centerLabel={`${beds.totalBeds}`}
              />
            </div>
          </div>

            <div className="kdx-panel" style={{ marginBottom: 14 }}>
              <div className="kdx-panel-head">
                <div className="kdx-panel-title" style={{ fontSize: 13 }}>
                  Shelter manager
                </div>
              </div>
              <div className="kdx-panel-body">
                {shelter.managers.length === 0 ? (
                  <div className="kdx-muted-line" style={{ display: "flex", gap: 7 }}>
                    <Info size={14} />
                    <span>
                      No manager is assigned yet. Create one under “Manager
                      accounts”.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {shelter.managers.map((manager) => (
                      <div
                        key={manager.id}
                        style={{ display: "flex", flexDirection: "column", gap: 3 }}
                      >
                        <strong style={{ color: Colors.navy, fontSize: 13 }}>
                          {manager.fullName}
                        </strong>
                        {manager.email && (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              color: Colors.muted,
                            }}
                          >
                            <Mail size={12} /> {manager.email}
                          </span>
                        )}
                        {manager.phone && (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              color: Colors.muted,
                            }}
                          >
                            <Phone size={12} /> {manager.phone}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {shelter.address && (
              <div
                className="kdx-muted-line"
                style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 12 }}
              >
                <MapPin size={13} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{shelter.address}</span>
              </div>
            )}

            {shelter.facilities.length > 0 && (
              <div className="kdx-chip-row">
                {shelter.facilities.map((item) => (
                  <span key={item} className="kdx-chip">
                    {item}
                  </span>
                ))}
              </div>
            )}
        </div>

        <div className="kdx-modal-foot">
          {!editable && (
            <span
              style={{
                marginRight: "auto",
                fontSize: 12,
                color: Colors.muted,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Info size={13} />
              Read-only — the {shelter.district} office manages this shelter.
            </span>
          )}
          <button type="button" className="kdx-btn" onClick={onClose}>
            Close
          </button>
          {editable && (
            <button type="button" className="kdx-btn kdx-btn-primary" onClick={onEdit}>
              <Pencil size={14} />
              Edit shelter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- the draft modal ---------------------------- */

function ShelterDraftModal({
  draft,
  busy,
  fieldErrors,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: DraftState;
  busy: boolean;
  fieldErrors: Record<string, string>;
  onChange: (next: DraftState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const set = (patch: Partial<DraftState>) => onChange({ ...draft, ...patch });

  return (
    <div className="kdx-modal-back" onClick={busy ? undefined : onClose}>
      <div className="kdx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kdx-modal-head">
          <div>
            <div className="kdx-modal-title">
              {draft.editingId ? "Edit shelter" : "Register a shelter"}
            </div>
            <div className="kdx-modal-sub">
              Capacity is the ceiling. Occupancy only ever rises when a Shelter
              Manager confirms people arrived.
            </div>
          </div>
          <button type="button" className="kdx-x" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="kdx-modal-body">
          <div className="kdx-form">
            <label className="kdx-label">Shelter name</label>
            <input
              className="kdx-input"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Bandaranaike Hall"
            />
            {fieldErrors.name && <span className="kdx-hint" style={{ color: Colors.red }}>{fieldErrors.name}</span>}
          </div>

          <div className="kdx-form">
            <label className="kdx-label">Address</label>
            <input
              className="kdx-input"
              value={draft.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="Street, city"
            />
          </div>

          <div className="kdx-two" style={{ marginBottom: 0 }}>
            <div className="kdx-form">
              <label className="kdx-label">Latitude</label>
              <input
                className="kdx-input"
                value={draft.latitude}
                onChange={(e) => set({ latitude: e.target.value })}
                inputMode="decimal"
                placeholder="6.9271"
              />
              {fieldErrors.latitude && (
                <span className="kdx-hint" style={{ color: Colors.red }}>{fieldErrors.latitude}</span>
              )}
            </div>
            <div className="kdx-form">
              <label className="kdx-label">Longitude</label>
              <input
                className="kdx-input"
                value={draft.longitude}
                onChange={(e) => set({ longitude: e.target.value })}
                inputMode="decimal"
                placeholder="79.8612"
              />
              {fieldErrors.longitude && (
                <span className="kdx-hint" style={{ color: Colors.red }}>{fieldErrors.longitude}</span>
              )}
            </div>
          </div>

          <div className="kdx-form">
            <label className="kdx-label">Maximum capacity (people)</label>
            <input
              className="kdx-input"
              value={draft.maxCapacity}
              onChange={(e) => set({ maxCapacity: e.target.value })}
              inputMode="numeric"
              placeholder="200"
            />
            {fieldErrors.maxCapacity && (
              <span className="kdx-hint" style={{ color: Colors.red }}>{fieldErrors.maxCapacity}</span>
            )}
          </div>

          <div className="kdx-form">
            <label className="kdx-label">Facilities (comma separated)</label>
            <input
              className="kdx-input"
              value={draft.facilities}
              onChange={(e) => set({ facilities: e.target.value })}
              placeholder="Medical, Water, Sanitation, Power"
            />
          </div>

          {draft.editingId && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                fontSize: 12.5,
                fontWeight: 700,
                color: Colors.navy,
              }}
            >
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => set({ isActive: e.target.checked })}
              />
              This shelter is open for allocation
            </label>
          )}
        </div>

        <div className="kdx-modal-foot">
          <button type="button" className="kdx-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="kdx-btn kdx-btn-primary"
            onClick={onSubmit}
            disabled={busy}
          >
            {busy && <Loader2 className="kdx-spin" size={14} />}
            {draft.editingId ? "Save changes" : "Register shelter"}
          </button>
        </div>
      </div>
    </div>
  );
}
