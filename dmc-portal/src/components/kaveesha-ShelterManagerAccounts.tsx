import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";

import { Colors } from "../constants/theme";
import {
  type ShelterManager,
  type ShelterRoll,
  ShelterApiError,
  createShelterManager,
  fetchShelterManagers,
  fetchShelters,
  updateShelterManager,
} from "../services/kaveesha-shelterApi";
import { DISPATCH_CSS, DESK_CSS } from "../styles/kaveesha-dispatchStyles";
import { relativeTime } from "../utils/kaveesha-dispatchFormat";

/* ------------------------------------------------------------------ *
 * Shelter Manager accounts.
 *
 * The officer creates the accounts that confirm arrivals — the only action that
 * raises a shelter's occupancy — and assigns each one the shelters they run.
 * A manager can hold one shelter or many. A suspended manager is locked out of
 * every action immediately; their account is kept for the audit trail.
 * ------------------------------------------------------------------ */

interface ManagerDraft {
  open: boolean;
  fullName: string;
  email: string;
  password: string;
  phone: string;
  designation: string;
  shelterIds: string[];
}

const EMPTY_DRAFT: ManagerDraft = {
  open: false,
  fullName: "",
  email: "",
  password: "",
  phone: "",
  designation: "",
  shelterIds: [],
};

export default function KaveeshaShelterManagerAccounts({
  token,
  district,
}: {
  token: string | null;
  district: string;
}) {
  const [managers, setManagers] = useState<ShelterManager[]>([]);
  const [shelters, setShelters] = useState<ShelterRoll[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<ManagerDraft>(EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  const refresh = () => setReload((key) => key + 1);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    Promise.all([fetchShelterManagers(token), fetchShelters(token, { activeOnly: true })])
      .then(([managerRows, shelterRows]) => {
        if (cancelled) return;
        setManagers(managerRows);
        setShelters(shelterRows);
        setError(null);
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        setError(cause.message || "The shelter manager accounts could not load.");
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, reload]);

  const shelterById = useMemo(() => {
    const map = new Map<string, ShelterRoll>();
    for (const s of shelters) map.set(s.id, s);
    return map;
  }, [shelters]);

  const toggleShelter = (id: string) => {
    setDraft((d) => ({
      ...d,
      shelterIds: d.shelterIds.includes(id)
        ? d.shelterIds.filter((x) => x !== id)
        : [...d.shelterIds, id],
    }));
  };

  const submit = async () => {
    if (!token) return;

    const errors: Record<string, string> = {};

    if (draft.fullName.trim() === "") errors.fullName = "Enter the manager's full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      errors.email = "Enter a valid email.";
    }
    if (draft.password.length < 8) {
      errors.password = "Set a temporary password of at least 8 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const created = await createShelterManager(token, {
        fullName: draft.fullName.trim(),
        email: draft.email.trim(),
        password: draft.password,
        phone: draft.phone.trim() || undefined,
        designation: draft.designation.trim() || undefined,
        district: district || undefined,
        shelterIds: draft.shelterIds,
      });
      setManagers((rows) => [...rows, created]);
      setNotice(`${created.fullName} can now sign in to run their shelters.`);
      setDraft(EMPTY_DRAFT);
      setFieldErrors({});
    } catch (err) {
      if (err instanceof ShelterApiError) {
        setFieldErrors(err.fields);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "The account could not be created.");
      }
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (manager: ShelterManager, status: "ACTIVE" | "SUSPENDED") => {
    if (!token) return;

    try {
      const updated = await updateShelterManager(token, manager.id, { status });
      setManagers((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
      setNotice(
        status === "SUSPENDED"
          ? `${updated.fullName} is suspended and can no longer act on shelters.`
          : `${updated.fullName} is active again.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "The status change failed.");
    }
  };

  const reassign = async (manager: ShelterManager, shelterIds: string[]) => {
    if (!token) return;

    try {
      const updated = await updateShelterManager(token, manager.id, { shelterIds });
      setManagers((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
      setNotice(`${updated.fullName} now runs ${updated.shelters.length} shelter(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The reassignment failed.");
    }
  };

  if (!token) return null;

  return (
    <div className="kdx-stack">
      <div className="kqd-head">
        <div>
          <div className="kqd-head-title">
            <ShieldCheck size={18} />
            Shelter Manager accounts
          </div>
          <p className="kqd-head-sub">
            These accounts confirm arrivals — the only action that raises occupancy.
            Create one, assign the shelters it runs, and suspend it the moment it
            should stop. Created accounts are active immediately; they never go
            through public registration.
          </p>
        </div>
        <div className="kqd-head-stats">
          <div className="kqd-stat">
            <strong>{managers.length}</strong>
            <span>Managers</span>
          </div>
          <div className="kqd-stat kqd-stat-live">
            <strong>{managers.filter((m) => m.status === "ACTIVE").length}</strong>
            <span>Active</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" className="kdx-btn kdx-btn-sm" onClick={refresh}>
          <RefreshCw size={14} />
          Refresh
        </button>
        <button
          type="button"
          className="kdx-btn kdx-btn-primary"
          onClick={() => {
            setFieldErrors({});
            setDraft({ ...EMPTY_DRAFT, open: true });
          }}
        >
          <UserPlus size={15} />
          New manager
        </button>
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

      {error && !draft.open && (
        <div className="kdx-error">
          <TriangleAlert size={17} />
          <span>{error}</span>
        </div>
      )}

      {!ready ? (
        <div className="kdx-loading">
          <Loader2 className="kdx-spin" size={17} /> Loading accounts…
        </div>
      ) : managers.length === 0 ? (
        <div className="kdx-panel">
          <div className="kdx-empty">
            <ShieldAlert size={30} />
            <div>No Shelter Managers yet.</div>
            <button
              type="button"
              className="kdx-btn kdx-btn-primary"
              onClick={() => setDraft({ ...EMPTY_DRAFT, open: true })}
            >
              <UserPlus size={15} />
              Create the first
            </button>
          </div>
        </div>
      ) : (
        <div className="kdx-stack">
          {managers.map((manager) => (
            <ManagerRow
              key={manager.id}
              manager={manager}
              shelters={shelters}
              shelterById={shelterById}
              onToggleStatus={() =>
                setStatus(manager, manager.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")
              }
              onReassign={(ids) => reassign(manager, ids)}
            />
          ))}
        </div>
      )}

      {draft.open && (
        <ManagerDraftModal
          draft={draft}
          busy={busy}
          fieldErrors={fieldErrors}
          shelters={shelters}
          onChange={setDraft}
          onToggleShelter={toggleShelter}
          onClose={() => setDraft(EMPTY_DRAFT)}
          onSubmit={submit}
        />
      )}

      <style>{`${DISPATCH_CSS}${DESK_CSS}`}</style>
    </div>
  );
}

/* ------------------------------ one row ------------------------------ */

function ManagerRow({
  manager,
  shelters,
  shelterById,
  onToggleStatus,
  onReassign,
}: {
  manager: ShelterManager;
  shelters: ShelterRoll[];
  shelterById: Map<string, ShelterRoll>;
  onToggleStatus: () => void;
  onReassign: (ids: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [ids, setIds] = useState<string[]>(manager.shelterIds);

  // Enter edit mode from the manager's current assignment; leave it by discarding.
  const toggleEdit = () => {
    if (!editing) setIds(manager.shelterIds);
    setEditing((v) => !v);
  };

  const active = manager.status === "ACTIVE";

  const save = () => {
    onReassign(ids);
    setEditing(false);
  };

  return (
    <div className="kdx-panel">
      <div className="kdx-panel-head">
        <div style={{ minWidth: 0 }}>
          <div className="kdx-panel-title" style={{ fontSize: 14 }}>
            {manager.fullName}
            <span className={`kdx-chip ${active ? "kdx-chip-good" : "kdx-chip-alert"}`}>
              {active ? "Active" : "Suspended"}
            </span>
          </div>
          <div className="kdx-panel-sub">
            {manager.email}
            {manager.designation ? ` · ${manager.designation}` : ""}
            {manager.phone ? ` · ${manager.phone}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={`kdx-btn kdx-btn-sm ${active ? "kdx-btn-danger" : "kdx-btn-task"}`}
            onClick={onToggleStatus}
          >
            {active ? "Suspend" : "Reactivate"}
          </button>
          <button
            type="button"
            className="kdx-btn kdx-btn-sm"
            onClick={toggleEdit}
          >
            {editing ? "Cancel" : "Reassign"}
          </button>
        </div>
      </div>

      <div className="kdx-panel-body" style={{ display: "grid", gap: 10 }}>
        {editing ? (
          <>
            <div className="kdx-chip-row" style={{ gap: 8 }}>
              {shelters.map((s) => {
                const picked = ids.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`kdx-chip ${picked ? "kdx-chip-info" : ""}`}
                    style={{ cursor: "pointer", borderStyle: picked ? "solid" : "dashed" }}
                    onClick={() =>
                      setIds((cur) =>
                        cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id]
                      )
                    }
                  >
                    {s.name} · {s.shelterCode}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="kdx-btn kdx-btn-primary kdx-btn-sm" onClick={save}>
                Save shelters ({ids.length})
              </button>
            </div>
          </>
        ) : (
          <>
            {manager.shelters.length === 0 ? (
              <div className="kdx-muted-line">No shelters assigned yet.</div>
            ) : (
              <div className="kdx-chip-row">
                {manager.shelters.map((s) => (
                  <span key={s.id} className="kdx-chip kdx-chip-info">
                    {s.name}
                    {shelterById.get(s.id) ? ` · ${shelterById.get(s.id)!.remainingAllocatable} free` : ""}
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11, color: Colors.muted }}>
              Created {relativeTime(manager.createdAt)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- draft modal ---------------------------- */

function ManagerDraftModal({
  draft,
  busy,
  fieldErrors,
  shelters,
  onChange,
  onToggleShelter,
  onClose,
  onSubmit,
}: {
  draft: ManagerDraft;
  busy: boolean;
  fieldErrors: Record<string, string>;
  shelters: ShelterRoll[];
  onChange: (next: ManagerDraft) => void;
  onToggleShelter: (id: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const set = (patch: Partial<ManagerDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="kdx-modal-back" onClick={busy ? undefined : onClose}>
      <div className="kdx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kdx-modal-head">
          <div>
            <div className="kdx-modal-title">Create a Shelter Manager</div>
            <div className="kdx-modal-sub">
              They sign in to the portal with the email and temporary password you
              set here, and can only act on the shelters you assign.
            </div>
          </div>
          <button type="button" className="kdx-x" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="kdx-modal-body">
          <div className="kdx-form">
            <label className="kdx-label">Full name</label>
            <input
              className="kdx-input"
              value={draft.fullName}
              onChange={(e) => set({ fullName: e.target.value })}
              placeholder="Manager name"
            />
            {fieldErrors.fullName && (
              <span className="kdx-hint" style={{ color: Colors.red }}>{fieldErrors.fullName}</span>
            )}
          </div>

          <div className="kdx-two" style={{ marginBottom: 0 }}>
            <div className="kdx-form">
              <label className="kdx-label">Email</label>
              <input
                className="kdx-input"
                value={draft.email}
                onChange={(e) => set({ email: e.target.value })}
                placeholder="name@safeplus.lk"
              />
              {fieldErrors.email && (
                <span className="kdx-hint" style={{ color: Colors.red }}>{fieldErrors.email}</span>
              )}
            </div>
            <div className="kdx-form">
              <label className="kdx-label">Temporary password</label>
              <input
                className="kdx-input"
                type="text"
                value={draft.password}
                onChange={(e) => set({ password: e.target.value })}
                placeholder="min 8 characters"
              />
              {fieldErrors.password && (
                <span className="kdx-hint" style={{ color: Colors.red }}>{fieldErrors.password}</span>
              )}
            </div>
          </div>

          <div className="kdx-two" style={{ marginBottom: 0 }}>
            <div className="kdx-form">
              <label className="kdx-label">Phone (optional)</label>
              <input
                className="kdx-input"
                value={draft.phone}
                onChange={(e) => set({ phone: e.target.value })}
                placeholder="+94…"
              />
            </div>
            <div className="kdx-form">
              <label className="kdx-label">Designation (optional)</label>
              <input
                className="kdx-input"
                value={draft.designation}
                onChange={(e) => set({ designation: e.target.value })}
                placeholder="Shelter Coordinator"
              />
            </div>
          </div>

          <div className="kdx-form">
            <label className="kdx-label">Assign shelters</label>
            {shelters.length === 0 ? (
              <div className="kdx-hint">
                No shelters on the register yet — add them on the Shelter board first.
              </div>
            ) : (
              <div className="kdx-chip-row" style={{ gap: 8 }}>
                {shelters.map((s) => {
                  const picked = draft.shelterIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`kdx-chip ${picked ? "kdx-chip-info" : ""}`}
                      style={{ cursor: "pointer", borderStyle: picked ? "solid" : "dashed" }}
                      onClick={() => onToggleShelter(s.id)}
                    >
                      {picked ? "✓ " : "+ "}
                      {s.name} · {s.shelterCode}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="kdx-hint">
              A manager can hold one shelter or many. Assignments can change later.
            </div>
          </div>
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
            {busy ? <Loader2 className="kdx-spin" size={14} /> : <Plus size={15} />}
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}
