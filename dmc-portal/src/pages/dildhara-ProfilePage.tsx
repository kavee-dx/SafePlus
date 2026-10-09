import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Info,
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

type Tone = "red" | "blue" | "amber" | "navy";

// Each section card gets its own accent from the theme.
const TONES: Record<Tone, { solid: string; soft: string; text: string }> = {
  red: { solid: Colors.red, soft: Colors.redLight, text: Colors.redDark },
  blue: { solid: Colors.blue, soft: Colors.blueLight, text: Colors.blueDark },
  amber: { solid: Colors.amber, soft: Colors.amberLight, text: Colors.amberText },
  navy: { solid: Colors.navy, soft: "#E4EAF1", text: Colors.navy },
};

const toneVars = (tone: Tone) =>
  ({
    "--tone": TONES[tone].solid,
    "--tone-soft": TONES[tone].soft,
    "--tone-text": TONES[tone].text,
  }) as CSSProperties;

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
  tone: Tone;
  fields: FieldDef[];
}

const NAME: FieldDef = { key: "fullName", label: "Full name", source: "user", editable: true };
const PHONE: FieldDef = { key: "phoneNumber", label: "Phone number", source: "user", editable: true };

const PERSONAL: SectionDef = {
  title: "Personal details",
  icon: User,
  tone: "blue",
  fields: [NAME, PHONE],
};

// Editable fields can be changed here; the rest were verified by the Super Admin and stay locked.
const ROLE_SECTIONS: Record<string, SectionDef[]> = {
  DMC_OFFICER: [
    PERSONAL,
    {
      title: "Officer details",
      icon: ShieldCheck,
      tone: "amber",
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
      tone: "amber",
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
      tone: "blue",
      fields: [{ ...NAME, label: "Contact person" }, PHONE],
    },
    {
      title: "Organization",
      icon: Building2,
      tone: "navy",
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

// Darker green for text on a light success tint (Colors.success is too light for text).
const SUCCESS_TEXT = "#067647";
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
    return (
      <div className="pp-banner error">
        <AlertCircle size={16} />
        {loadError}
      </div>
    );
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

    if (editing && field.editable) {
      const id = `pp-${field.key}`;
      return (
        <div className="pp-field editing" key={field.key}>
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
    }

    return (
      <div className="pp-field" key={field.key}>
        <span className="pp-label">
          {field.label}
          {editing && <Lock size={11} />}
        </span>
        <div className={`pp-value ${editing ? "locked" : ""}`}>
          {asText(read(profile, field)) || "—"}
        </div>
      </div>
    );
  };

  return (
    <div className="pp-page">
      <div className="pp-header">
        <div className="pp-cover" />
        <div className="pp-header-body">
          <div className="pp-avatar-lg">{initials(name)}</div>

          <div className="pp-header-text">
            <h1>{name}</h1>
            <div className="pp-meta">
              <span>{roleLabel}</span>
              <em className={active ? "pp-pill ok" : "pp-pill"}>
                {active ? "Active" : asText(profile.user.status).replace(/_/g, " ")}
              </em>
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

      <section className="pp-card" style={toneVars("red")}>
        <div className="pp-card-head">
          <span className="pp-card-icon">
            <ShieldCheck size={17} />
          </span>
          <h3>Account</h3>
        </div>
        <div className="pp-grid">
          {accountRows.map(([label, value]) => (
            <div className="pp-field" key={label}>
              <span className="pp-label">{label}</span>
              {label === "Account status" && value ? (
                <div className="pp-value">
                  <span className={active ? "pp-pill ok" : "pp-pill"}>
                    {active ? "Active" : value}
                  </span>
                </div>
              ) : (
                <div className="pp-value">{value || "—"}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {sections.map((section) => (
        <section className="pp-card" key={section.title} style={toneVars(section.tone)}>
          <div className="pp-card-head">
            <span className="pp-card-icon">
              <section.icon size={17} />
            </span>
            <h3>{section.title}</h3>
          </div>
          <div className="pp-grid">{section.fields.map(renderField)}</div>
        </section>
      ))}

      <p className="pp-footnote">
        <Info size={15} />
        <span>
          Fields marked with a lock were verified when your account was approved.
          Contact the system administrator if one of them needs to change.
        </span>
      </p>

      <style>{DATA_STYLES}</style>
      <style>{`
        .pp-page, .pp-banner, .pp-loading {
          text-align: left;
          font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .pp-loading { padding: 48px; text-align: center; color: ${Colors.muted}; font-size: 14px; }

        /* Header */
        .pp-header {
          margin-bottom: 20px; border-radius: 16px; overflow: hidden;
          background: ${Colors.white}; border: 1px solid ${Colors.border};
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
        }
        .pp-cover {
          height: 84px;
          background: linear-gradient(120deg, ${Colors.navy} 0%, ${Colors.navyLight} 100%);
          border-bottom: 3px solid ${Colors.red};
        }
        .pp-header-body {
          display: flex; align-items: flex-end; gap: 18px; flex-wrap: wrap;
          padding: 0 24px 20px;
        }
        .pp-avatar-lg {
          width: 76px; height: 76px; border-radius: 50%; flex-shrink: 0;
          margin-top: -38px; border: 4px solid ${Colors.white};
          background: ${Colors.red}; color: ${Colors.white};
          font-size: 26px; font-weight: 800; letter-spacing: 0.02em;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(16, 24, 40, 0.15);
        }
        .pp-header-text { flex: 1; min-width: 200px; padding-top: 14px; }
        .pp-header-text h1 {
          margin: 0; font-size: 22px; line-height: 1.25; font-weight: 700;
          color: ${Colors.text}; letter-spacing: -0.02em;
        }
        .pp-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
        .pp-meta > span { font-size: 14px; color: ${Colors.muted}; }

        .pp-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 3px 10px; border-radius: 999px; font-style: normal;
          font-size: 12px; font-weight: 600;
          background: ${Colors.redLight}; color: ${Colors.redDark};
        }
        .pp-pill.ok { background: ${Colors.success}1F; color: ${SUCCESS_TEXT}; }
        .pp-pill.ok::before {
          content: ""; width: 6px; height: 6px; border-radius: 50%;
          background: ${Colors.success};
        }

        /* Buttons */
        .pp-btn-row { display: flex; gap: 10px; }
        .pp-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          height: 40px; padding: 0 18px; border-radius: 10px;
          border: 1px solid ${Colors.border}; background: ${Colors.white};
          color: ${Colors.text}; font-size: 14px; font-weight: 600;
          font-family: inherit; cursor: pointer;
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .pp-btn:hover:not(:disabled) { background: ${Colors.background}; }
        .pp-btn.primary {
          background: ${Colors.red}; border-color: ${Colors.red}; color: ${Colors.white};
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08);
        }
        .pp-btn.primary:hover:not(:disabled) { background: ${Colors.redDark}; border-color: ${Colors.redDark}; }
        .pp-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px ${Colors.red}33; }
        .pp-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Banners */
        .pp-banner {
          display: flex; align-items: flex-start; gap: 10px; margin-bottom: 16px;
          padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5;
          border: 1px solid transparent;
        }
        .pp-banner svg { flex-shrink: 0; margin-top: 2px; }
        .pp-banner.ok {
          background: ${Colors.success}14; border-color: ${Colors.success}40; color: ${SUCCESS_TEXT};
        }
        .pp-banner.error {
          background: ${Colors.redLight}; border-color: ${Colors.red}40; color: ${Colors.redDark};
        }

        /* Section cards: colored by tone */
        .pp-card {
          margin-bottom: 20px; border-radius: 16px; overflow: hidden;
          background: ${Colors.white}; border: 1px solid ${Colors.border};
          border-top: 4px solid var(--tone);
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
        }
        .pp-card-head {
          display: flex; align-items: center; gap: 12px;
          padding: 16px 24px;
          background: var(--tone-soft);
        }
        .pp-card-icon {
          width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
          background: var(--tone); color: ${Colors.white};
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 6px rgba(16, 24, 40, 0.15);
        }
        .pp-card-head h3 {
          margin: 0; font-size: 16px; font-weight: 700; color: var(--tone-text);
          letter-spacing: -0.01em;
        }
        .pp-grid {
          display: grid; gap: 14px; padding: 24px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        /* Field tiles */
        .pp-field {
          display: flex; flex-direction: column; align-items: stretch; min-width: 0;
          padding: 14px 16px; border-radius: 12px;
          background: ${Colors.background};
          border: 1px solid ${Colors.border}55;
          border-left: 4px solid var(--tone);
        }
        .pp-field.editing { background: ${Colors.white}; border-color: ${Colors.border}; border-left-color: var(--tone); }
        .pp-field label, .pp-label {
          display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
          font-size: 12px; font-weight: 600; color: var(--tone-text);
        }
        .pp-value {
          font-size: 15px; font-weight: 600; line-height: 1.5;
          color: ${Colors.text}; word-break: break-word;
        }
        .pp-value.locked { color: ${Colors.muted}; font-weight: 500; }
        .pp-field input, .pp-field textarea {
          width: 100%; box-sizing: border-box; padding: 10px 14px; border-radius: 10px;
          font-size: 14px; font-family: inherit; outline: none; margin-top: 2px;
          border: 1px solid ${Colors.border}; color: ${Colors.text}; background: ${Colors.white};
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .pp-field input { height: 42px; }
        .pp-field textarea { min-height: 88px; resize: vertical; line-height: 1.5; }
        .pp-field input:focus, .pp-field textarea:focus {
          border-color: var(--tone); box-shadow: 0 0 0 3px ${Colors.red}1F;
        }
        .pp-field .invalid { border-color: ${Colors.red}; background: ${Colors.redLight}33; }
        .pp-error {
          display: flex; align-items: center; gap: 5px; margin-top: 6px;
          font-size: 12px; color: ${Colors.redDark};
        }

        /* Footnote */
        .pp-footnote {
          display: flex; align-items: flex-start; gap: 10px; margin: 4px 0 0;
          padding: 12px 16px; border-radius: 12px;
          background: ${Colors.blueLight}80; border: 1px solid ${Colors.blue}33;
          color: ${Colors.blueDark}; font-size: 13px; line-height: 1.6;
        }
        .pp-footnote svg { flex-shrink: 0; margin-top: 3px; }

        @media (max-width: 700px) {
          .pp-grid { grid-template-columns: 1fr; padding: 16px; }
          .pp-card-head { padding: 14px 16px; }
          .pp-header-body { padding: 0 16px 18px; }
          .pp-btn-row, .pp-header-body > .pp-btn { width: 100%; }
          .pp-btn-row .pp-btn { flex: 1; }
        }
      `}</style>
    </div>
  );
}
