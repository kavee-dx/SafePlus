import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Lock,
  Pencil,
  Save,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Colors } from "../constants/theme";
import { DATA_STYLES } from "../styles/dushani-dataStyles";
import {
  PORTAL_ROLE_LABELS,
  PortalApiError,
  fetchPortalProfile,
  updatePortalProfile,
  type PortalAccount,
  type PortalProfile,
} from "../services/dildhara-portalAuthApi";

type Value = string | number | boolean | null | undefined;

interface FieldDef {
  key: string;
  label: string;
  source: "user" | "details";
  editable?: boolean;
  multiline?: boolean;
  numeric?: boolean;
}

interface SectionDef {
  title: string;
  icon: LucideIcon;
  fields: FieldDef[];
}

const NAME: FieldDef = { key: "fullName", label: "Full name", source: "user", editable: true };
const PHONE: FieldDef = { key: "phoneNumber", label: "Phone number", source: "user", editable: true };

const PERSONAL: SectionDef = { title: "Personal details", icon: User, fields: [NAME, PHONE] };

// Editable fields can be changed here; the rest were verified by the Super Admin and stay locked.
const ROLE_SECTIONS: Record<string, SectionDef[]> = {
  DMC_OFFICER: [
    PERSONAL,
    {
      title: "Officer details",
      icon: ShieldCheck,
      fields: [
        { key: "officerId", label: "Officer ID", source: "details" },
        { key: "designation", label: "Designation", source: "details" },
        { key: "dmcOffice", label: "DMC office", source: "details" },
        { key: "district", label: "District", source: "details" },
        { key: "clearanceInfo", label: "Clearance information", source: "details", editable: true, multiline: true },
      ],
    },
  ],
  DISTRICT_OFFICER: [
    PERSONAL,
    {
      title: "Officer details",
      icon: ShieldCheck,
      fields: [
        { key: "officerId", label: "Officer ID", source: "details" },
        { key: "assignedDistrict", label: "Assigned district", source: "details" },
        { key: "clearanceLevel", label: "Clearance level", source: "details" },
        { key: "divisionalSecretariats", label: "Divisional secretariats", source: "details", editable: true, multiline: true },
      ],
    },
  ],
  COORDINATOR: [PERSONAL],
  ORGANIZATION_ADMIN: [
    {
      title: "Contact person",
      icon: User,
      fields: [{ ...NAME, label: "Contact person" }, PHONE],
    },
    {
      title: "Organization",
      icon: Building2,
      fields: [
        { key: "organizationName", label: "Organization name", source: "details" },
        { key: "organizationType", label: "Organization type", source: "details" },
        { key: "registrationNumber", label: "Registration number", source: "details" },
        { key: "district", label: "District", source: "details" },
        { key: "address", label: "Address", source: "user", editable: true, multiline: true },
        { key: "operatingArea", label: "Operating area", source: "details", editable: true },
        { key: "rescueTeamCount", label: "Number of rescue teams", source: "details", editable: true, numeric: true },
      ],
    },
  ],
};

const read = (profile: PortalProfile, field: FieldDef): Value =>
  field.source === "user"
    ? profile.user[field.key]
    : profile.details?.[field.key];

const asText = (value: Value): string =>
  value === null || value === undefined ? "" : String(value);

const initials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

// Identifiers and phone numbers read as fixed-width codes; everything else stays proportional.
const isMono = (key: string): boolean =>
  key === "officerId" || key === "registrationNumber" || key === "phoneNumber";

interface ProfilePageProps {
  token: string;
  account: PortalAccount;
  onProfileSaved: (fullName: string) => void;
  onSessionExpired: () => void;
}

export default function ProfilePage({
  token,
  account,
  onProfileSaved,
  onSessionExpired,
}: ProfilePageProps) {
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const sections = ROLE_SECTIONS[account.role] ?? [PERSONAL];
  const editableFields = sections.flatMap((s) => s.fields).filter((f) => f.editable);

  useEffect(() => {
    let cancelled = false;

    fetchPortalProfile(token)
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof PortalApiError && error.status === 401) {
          onSessionExpired();
          return;
        }
        setLoadError(
          error instanceof Error ? error.message : "Could not load your profile."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token, onSessionExpired]);

  const startEdit = () => {
    if (!profile) return;

    const next: Record<string, string> = {};
    for (const field of editableFields) {
      next[field.key] = asText(read(profile, field));
    }

    setDraft(next);
    setFieldErrors({});
    setSaveError("");
    setNotice("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setFieldErrors({});
    setSaveError("");
  };

  const handleSave = async () => {
    if (!profile) return;

    const changes: Record<string, string> = {};
    for (const field of editableFields) {
      const current = draft[field.key] ?? "";
      if (current !== asText(read(profile, field))) changes[field.key] = current;
    }

    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setSaveError("");

    try {
      const updated = await updatePortalProfile(token, changes);
      setProfile(updated);
      setEditing(false);
      setNotice("Your profile has been updated.");
      onProfileSaved(String(updated.user.fullName ?? account.fullName));
    } catch (error) {
      if (error instanceof PortalApiError) {
        if (error.status === 401) {
          onSessionExpired();
          return;
        }
        setFieldErrors(error.fieldErrors);
        setSaveError(error.message);
      } else {
        setSaveError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return <div className="pp-banner error">{loadError}</div>;
  }

  if (!profile) {
    return <div className="pp-loading">Loading your profile…</div>;
  }

  const roleLabel = PORTAL_ROLE_LABELS[account.role] ?? account.role;
  const name = String(profile.user.fullName ?? account.fullName);
  const statusText = asText(profile.user.status).replace(/_/g, " ");
  const active = profile.user.status === "ACTIVE";
  const statusClass = active ? "sp-pill sp-pill-green" : "sp-pill sp-pill-red";

  const renderRow = (field: FieldDef) => (
    <li className="sp-row" key={field.key}>
      <span className="sp-label">
        {field.label}
        {editing && <Lock className="pp-lock" size={11} />}
      </span>
      <span className={isMono(field.key) ? "sp-value sp-mono" : "sp-value"}>
        {asText(read(profile, field)) || "—"}
      </span>
    </li>
  );

  const renderInput = (field: FieldDef) => {
    const error = fieldErrors[field.key];
    const id = `pp-${field.key}`;
    return (
      <div className="pp-field" key={field.key}>
        <label htmlFor={id}>{field.label}</label>
        {field.multiline ? (
          <textarea
            id={id}
            className={error ? "invalid" : ""}
            value={draft[field.key] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
          />
        ) : (
          <input
            id={id}
            className={error ? "invalid" : ""}
            type="text"
            inputMode={field.numeric ? "numeric" : undefined}
            value={draft[field.key] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
          />
        )}
        {error && (
          <span className="pp-error">
            <AlertCircle size={12} />
            {error}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="pp-page">
      <div className="pp-header">
        <div className="pp-avatar-lg">{initials(name)}</div>
        <div className="pp-header-text">
          <h1>{name}</h1>
          <div className="sp-badges">
            <span className="sp-pill sp-pill-blue">{roleLabel}</span>
            <span className={statusClass}>{active ? "Active" : statusText}</span>
          </div>
        </div>

        {!editing ? (
          <button type="button" className="pp-btn primary" onClick={startEdit}>
            <Pencil size={15} />
            Edit profile
          </button>
        ) : (
          <div className="pp-btn-row">
            <button type="button" className="pp-btn" onClick={cancelEdit} disabled={saving}>
              <X size={15} />
              Cancel
            </button>
            <button type="button" className="pp-btn primary" onClick={handleSave} disabled={saving}>
              <Save size={15} />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div className="pp-banner ok">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}
      {saveError && (
        <div className="pp-banner error">
          <AlertCircle size={16} />
          {saveError}
        </div>
      )}

      <section className="pp-card">
        <h3>
          <ShieldCheck size={16} />
          Account
        </h3>
        <ul className="sp-list">
          <li className="sp-row">
            <span className="sp-label">Email</span>
            <span className="sp-value">{asText(profile.user.email) || "—"}</span>
          </li>
          <li className="sp-row">
            <span className="sp-label">Username</span>
            <span className="sp-value sp-mono">{asText(profile.user.username) || "—"}</span>
          </li>
          <li className="sp-row">
            <span className="sp-label">Role</span>
            <span className="sp-pill sp-pill-blue">{roleLabel}</span>
          </li>
          <li className="sp-row">
            <span className="sp-label">Account status</span>
            <span className={statusClass}>{active ? "Active" : statusText}</span>
          </li>
          <li className="sp-row">
            <span className="sp-label">Can sign in to</span>
            {account.interfaces.length > 0 ? (
              <ul className="sp-bullets">
                {account.interfaces.map((i) => (
                  <li key={i}>{i === "DMC_PORTAL" ? "SafePlus DMC portal" : "SafePlus mobile app"}</li>
                ))}
              </ul>
            ) : (
              <span className="sp-value">—</span>
            )}
          </li>
        </ul>
      </section>

      {sections.map((section) => {
        const rows = section.fields.filter((f) => !(editing && f.editable)).map(renderRow);
        const inputs = editing
          ? section.fields.filter((f) => f.editable).map(renderInput)
          : [];
        return (
          <section className="pp-card" key={section.title}>
            <h3>
              <section.icon size={16} />
              {section.title}
            </h3>
            <div className="sp-stack">
              {rows.length > 0 && <ul className="sp-list">{rows}</ul>}
              {inputs.length > 0 && <div className="pp-grid">{inputs}</div>}
            </div>
          </section>
        );
      })}

      <div className="sp-block">
        Fields marked with a lock were verified when your account was approved.
        Contact the system administrator if one of them needs to change.
      </div>

      <style>{DATA_STYLES}</style>
      <style>{`
        .pp-page { text-align: left; }
        .pp-loading { padding: 40px; text-align: center; color: ${Colors.muted}; font-size: 14px; }
        .pp-header {
          display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
          padding: 22px; margin-bottom: 16px; border-radius: 18px;
          background: ${Colors.white}; border: 1px solid ${Colors.border};
        }
        .pp-avatar-lg {
          width: 68px; height: 68px; border-radius: 50%; flex-shrink: 0;
          background: ${Colors.red}; color: #fff; font-size: 24px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
        }
        .pp-header-text { flex: 1; min-width: 180px; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
        .pp-header-text h1 { margin: 0; font-size: 22px; color: ${Colors.text}; letter-spacing: -0.02em; }
        .pp-lock { display: inline-block; vertical-align: -1px; margin-left: 4px; color: ${Colors.muted}; }
        .pp-btn-row { display: flex; gap: 8px; }
        .pp-btn {
          display: inline-flex; align-items: center; gap: 7px; height: 42px; padding: 0 16px;
          border-radius: 10px; border: 1px solid ${Colors.border}; background: ${Colors.white};
          color: ${Colors.text}; font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .pp-btn.primary { background: ${Colors.red}; border-color: ${Colors.red}; color: #fff; }
        .pp-btn.primary:hover:not(:disabled) { background: ${Colors.redDark}; }
        .pp-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .pp-banner {
          display: flex; align-items: center; gap: 9px; margin-bottom: 16px;
          padding: 12px 14px; border-radius: 11px; font-size: 13px; line-height: 1.5;
        }
        .pp-banner.ok { background: #ecfdf3; color: #067647; }
        .pp-banner.error { background: ${Colors.redLight}; color: ${Colors.redDark}; }
        .pp-card {
          padding: 22px; margin-bottom: 16px; border-radius: 18px;
          background: ${Colors.white}; border: 1px solid ${Colors.border};
        }
        .pp-card h3 {
          display: flex; align-items: center; gap: 8px; margin: 0 0 16px;
          font-size: 15px; color: ${Colors.text};
        }
        .pp-card h3 svg { color: ${Colors.red}; }
        .pp-grid { display: grid; gap: 16px 22px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .pp-field { display: flex; flex-direction: column; min-width: 0; }
        .pp-field label {
          display: flex; align-items: center; gap: 5px; margin-bottom: 6px;
          font-size: 11px; font-weight: 800; letter-spacing: 0.04em;
          text-transform: uppercase; color: ${Colors.muted};
        }
        .pp-field input, .pp-field textarea {
          width: 100%; padding: 11px 13px; border-radius: 10px; font-size: 14px;
          border: 1px solid ${Colors.border}; color: ${Colors.text}; background: ${Colors.white};
          font-family: inherit; outline: none;
        }
        .pp-field textarea { min-height: 84px; resize: vertical; }
        .pp-field input:focus, .pp-field textarea:focus {
          border-color: ${Colors.red}; box-shadow: 0 0 0 3px ${Colors.red}15;
        }
        .pp-field .invalid { border-color: ${Colors.red}; }
        .pp-error {
          display: flex; align-items: center; gap: 5px; margin-top: 6px;
          font-size: 11px; color: ${Colors.redDark};
        }
        @media (max-width: 700px) { .pp-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
