import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Ambulance,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Gauge,
  Home,
  IdCard,
  ListChecks,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import {
  FormMessages,
  FormSection,
  LockedField,
  SelectField,
  TextField,
} from "../components/dushani-RegistrationFields";
import {
  CapabilityField,
  EquipmentField,
  LocationPickerField,
} from "../components/kaveesha-RescueTeamFields";
import {
  latitudeRule,
  listRule,
  longitudeRule,
  oneOfRule,
  optionalListRule,
  teamTypeIcon,
  TEAM_CAPABILITIES,
  TEAM_EQUIPMENT,
  TEAM_TYPES,
} from "../constants/kaveesha-rescueTeamOptions";
import { DISTRICTS } from "../constants/districts";
import { useRegistrationForm } from "../hooks/dushani-useRegistrationForm";
import {
  fetchTeamLeaderDashboard,
  resubmitRescueTeam,
  updateTeamAvailability,
  type RescueTeamDashboard,
} from "../services/kaveesha-rescueTeamApi";
import { getStoredDmcToken } from "../services/dmc-authApi";
import { REGISTRATION_FORM_CSS } from "../styles/dushani-registrationFormStyles";
import { TDASH_CSS } from "../styles/kaveesha-teamDashboardStyles";
import KaveeshaAssignmentPanel from "../components/kaveesha-AssignmentPanel";
import type { AuthUser } from "../types/auth";
import {
  positiveInteger as positiveIntegerRule,
  required as requiredRule,
  optional as optionalRule,
  type Validator,
} from "../utils/dushani-registrationValidation";

interface TeamLeaderDashboardProps {
  leader: AuthUser;
  onLogout: () => void;
}

type DashboardView = "overview" | "missions" | "team" | "review";

const VIEW_META: Record<DashboardView, { title: string; subtitle: string }> = {
  overview: {
    title: "Team status",
    subtitle: "Where your rescue team registration stands right now",
  },
  missions: {
    title: "Assignments",
    subtitle: "What the district has tasked your team with, and what you report back",
  },
  team: {
    title: "Team profile",
    subtitle: "The team details your reviewer sees and dispatch works from",
  },
  review: {
    title: "Review and edits",
    subtitle: "Correct a rejected team and send it back for review",
  },
};

const NAV: { view: DashboardView; label: string; icon: typeof Home }[] = [
  { view: "overview", label: "Status", icon: Home },
  { view: "missions", label: "Assignments", icon: Send },
  { view: "team", label: "Team profile", icon: Users },
  { view: "review", label: "Review & edits", icon: ClipboardList },
];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Verified team", tone: "success" },
  PENDING_VERIFICATION: { label: "Pending review", tone: "warning" },
  REJECTED: { label: "Rejected", tone: "danger" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};

const AVAILABILITY_META: Record<string, { label: string; tone: string }> = {
  AVAILABLE: { label: "Available", tone: "success" },
  ON_DEPLOYMENT: { label: "On deployment", tone: "warning" },
  UNAVAILABLE: { label: "Not available", tone: "neutral" },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, tone: "neutral" };
}

function availabilityMeta(value: string) {
  return AVAILABILITY_META[value] ?? { label: value, tone: "neutral" };
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function TeamLeaderDashboard({
  leader,
  onLogout,
}: TeamLeaderDashboardProps) {
  const [currentView, setCurrentView] = useState<DashboardView>("overview");
  const [data, setData] = useState<RescueTeamDashboard | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getStoredDmcToken()));
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const token = getStoredDmcToken();
  const sessionMissing = !token;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    fetchTeamLeaderDashboard(token)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        setError(cause.message || "Your team could not be loaded.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  const refresh = () => {
    setError(null);
    setBanner(null);
    setLoading(true);
    setRefreshKey((key) => key + 1);
  };

  const setAvailability = (value: string) => {
    if (!token) return;

    setBusy(true);
    setError(null);
    setBanner(null);

    updateTeamAvailability(token, value)
      .then((result) => {
        setData(result);
        setBusy(false);
        setBanner(
          value === "AVAILABLE"
            ? "Your team is now marked available for tasking."
            : "Your team is no longer shown as available."
        );
      })
      .catch((cause: Error) => {
        setBusy(false);
        setError(cause.message || "Availability could not be updated.");
      });
  };

  const leaderName = data?.leader.fullName || leader.fullName || "Team Leader";
  const teamName = data?.team.name || "Rescue team";

  return (
    <div className="tdash-app">
      <aside className="tdash-sidebar">
        <div className="tdash-brand">
          <div className="tdash-brand-mark">
            <Ambulance size={22} />
          </div>
          <div>
            <div className="tdash-brand-name">
              Safe<span>Plus</span>
            </div>
            <div className="tdash-brand-sub">RESCUE TEAM</div>
          </div>
        </div>

        <div className="tdash-team-card">
          <ShieldCheck size={15} />
          <div>
            <div className="tdash-team-name">{teamName}</div>
            {data && (
              <div className="tdash-team-meta">
                {data.team.district} District · {data.team.type}
              </div>
            )}
          </div>
        </div>

        <nav className="tdash-nav">
          {NAV.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`tdash-nav-item ${
                currentView === item.view ? "tdash-nav-item-active" : ""
              }`}
              onClick={() => setCurrentView(item.view)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              <ChevronRight size={15} />
            </button>
          ))}
        </nav>

        <div className="tdash-sidebar-foot">
          <div className="tdash-leader">
            <div className="tdash-avatar">{initialsOf(leaderName) || "TL"}</div>
            <div>
              <div className="tdash-leader-name">{leaderName}</div>
              <div className="tdash-leader-role">
                {data?.leader.designation ||
                  (data?.team.affiliation === "INDEPENDENT"
                    ? "Community Team Leader"
                    : "Team Leader")}
              </div>
            </div>
          </div>
          <button type="button" className="tdash-logout" onClick={onLogout}>
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="tdash-main">
        <header className="tdash-topbar">
          <div>
            <h1>{VIEW_META[currentView].title}</h1>
            <p>{VIEW_META[currentView].subtitle}</p>
          </div>
          <button
            type="button"
            className="tdash-refresh"
            onClick={refresh}
            disabled={loading || sessionMissing}
          >
            <RefreshIcon spinning={loading} />
            <span>Refresh</span>
          </button>
        </header>

        <div className="tdash-body">
          {sessionMissing && (
            <div className="tdash-error">
              <AlertTriangle size={18} />
              <div>
                <h3>Session not found</h3>
                <p>
                  Your sign-in session could not be restored. Please sign out and
                  sign in again.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="tdash-error">
              <AlertTriangle size={18} />
              <div>
                <h3>Could not load your team</h3>
                <p>{error}</p>
              </div>
              <button
                type="button"
                className="tdash-error-action"
                onClick={refresh}
              >
                Try again
              </button>
            </div>
          )}

          {banner && (
            <div className="tdash-banner">
              <CheckCircle2 size={17} />
              <span>{banner}</span>
            </div>
          )}

          {loading && !data && (
            <div className="tdash-loading">
              <Loader2 size={22} className="tdash-spin" />
              <span>Loading your team...</span>
            </div>
          )}

          {!loading && !sessionMissing && !error && data && (
            <>
              {currentView === "overview" && (
                <OverviewView
                  data={data}
                  leaderName={leaderName}
                  busy={busy}
                  onAvailability={setAvailability}
                  onOpenReview={() => setCurrentView("review")}
                />
              )}

              {currentView === "missions" && (
                <KaveeshaAssignmentPanel token={token ?? ""} />
              )}

              {currentView === "team" && <TeamView data={data} />}

              {currentView === "review" && (
                <ReviewView
                  data={data}
                  token={token ?? ""}
                  onResubmitted={(message) => {
                    setData(null);
                    setLoading(true);
                    setBanner(message);
                    setError(null);
                    setCurrentView("overview");
                    setRefreshKey((key) => key + 1);
                  }}
                />
              )}
            </>
          )}
        </div>
      </main>

      <style>{`${TDASH_CSS}${REGISTRATION_FORM_CSS}`}</style>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <RotateCcw size={15} className={spinning ? "tdash-spin" : undefined} />
  );
}

function OverviewView({
  data,
  leaderName,
  busy,
  onAvailability,
  onOpenReview,
}: {
  data: RescueTeamDashboard;
  leaderName: string;
  busy: boolean;
  onAvailability: (value: string) => void;
  onOpenReview: () => void;
}) {
  const status = statusMeta(data.account.status);
  const availability = availabilityMeta(data.team.availability);
  const isOrganization = data.team.affiliation === "ORGANIZATION";

  return (
    <>
      <section className="tdash-hero">
        <div className="tdash-hero-text">
          <span className={`tdash-pill tdash-pill-${status.tone}`}>
            <BadgeCheck size={13} />
            {status.label}
          </span>
          <h2>{greeting()}, {leaderName.split(" ")[0]}</h2>
          <p>
            {isOrganization ? (
              <>
                <strong>{data.team.name}</strong> is waiting for{" "}
                <strong>{data.organization?.name ?? "the organization admin"}</strong>{" "}
                to verify it. You will get an email as soon as the decision is
                made.
              </>
            ) : (
              <>
                <strong>{data.team.name}</strong> is an independent community
                team waiting for a <strong>DMC Super Admin</strong> to verify it.
              </>
            )}
          </p>
        </div>
        <div className="tdash-hero-facts">
          <div className="tdash-fact">
            <MapPin size={14} />
            <span>{data.team.district} District</span>
          </div>
          <div className="tdash-fact">
            <CalendarClock size={14} />
            <span>
              {data.account.verifiedAt
                ? `Verified ${formatDate(data.account.verifiedAt)}`
                : `Submitted ${formatDate(data.team.registeredAt)}`}
            </span>
          </div>
          <div className="tdash-fact">
            <Gauge size={14} />
            <span>{availability.label}</span>
          </div>
        </div>
      </section>

      {data.account.status === "REJECTED" && (
        <section className="tdash-reject">
          <AlertTriangle size={18} />
          <div>
            <strong>Your team was rejected</strong>
            <p>
              {data.account.rejectionReason ||
                "The reviewer did not include a reason."}
            </p>
            <div className="tdash-actions">
              <button type="button" className="tdash-button" onClick={onOpenReview}>
                <Pencil size={15} />
                Edit and resubmit
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="tdash-stats">
        <StatCard
          icon={Users}
          tone="blue"
          label="Team size"
          value={String(data.team.size)}
          caption="Members you reported"
        />
        <StatCard
          icon={ListChecks}
          tone="navy"
          label="Capabilities"
          value={String(data.team.capabilities.length)}
          caption="What this team can be tasked for"
        />
        <StatCard
          icon={Package}
          tone="amber"
          label="Equipment"
          value={String(data.team.equipment.length)}
          caption="Kit listed for this team"
        />
        <StatCard
          icon={ShieldCheck}
          tone="success"
          label="Reviewer"
          value={isOrganization ? "Org admin" : "Super Admin"}
          caption={data.review.reviewerLabel}
        />
      </section>

      <section className="tdash-grid">
        <div className="tdash-card">
          <div className="tdash-card-head">
            <h3>What happens next</h3>
            <p>The queue your registration is sitting in</p>
          </div>
          <div className="tdash-rows">
            <Row label="Reviewed by" value={data.review.reviewerLabel} />
            <Row
              label="Submitted"
              value={formatDate(data.team.registeredAt)}
            />
            <Row
              label="Last decision"
              value={
                data.team.reviewedAt ? formatDate(data.team.reviewedAt) : "Not reviewed yet"
              }
            />
            <Row
              label="Can resubmit"
              value={data.review.canResubmit ? "Yes — edit and send back" : "No"}
            />
          </div>
        </div>

        <div className="tdash-card">
          <div className="tdash-card-head">
            <h3>Team availability</h3>
            <p>
              {data.review.canSetAvailability
                ? "District officers see an available team when they look for a team to task."
                : "A team can only be marked available once it has been verified."}
            </p>
          </div>
          <div className="tdash-chips">
            <span className={`tdash-pill tdash-pill-${availability.tone}`}>
              <Gauge size={13} />
              {availability.label}
            </span>
          </div>
          <div className="tdash-actions">
            <button
              type="button"
              className={`tdash-button ${
                data.team.availability === "AVAILABLE" ? "tdash-button-on" : ""
              }`}
              onClick={() => onAvailability("AVAILABLE")}
              disabled={!data.review.canSetAvailability || busy}
            >
              <BadgeCheck size={15} />
              Mark available
            </button>
            <button
              type="button"
              className="tdash-button tdash-button-ghost"
              onClick={() => onAvailability("UNAVAILABLE")}
              disabled={!data.review.canSetAvailability || busy}
            >
              <Gauge size={15} />
              Mark not available
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function TeamView({ data }: { data: RescueTeamDashboard }) {
  const base = data.team.base;
  const hasBase = base.latitude !== null && base.longitude !== null;
  const TypeIcon = teamTypeIcon(data.team.type);

  return (
    <>
      <section className="tdash-card">
        <div className="tdash-card-head">
          <h3>{data.team.name}</h3>
          <p>
            {data.team.type} · {data.team.district} District ·{" "}
            {data.team.affiliation === "ORGANIZATION"
              ? `Under ${data.organization?.name ?? "organization"}`
              : "Independent / community team"}
          </p>
        </div>

        <div className="tdash-detail-grid">
          <Detail
            icon={Ambulance}
            label="Team name"
            value={data.team.name}
          />
          <Detail icon={TypeIcon} label="Team type" value={data.team.type} />
          <Detail
            icon={Users}
            label="Team size"
            value={`${data.team.size} members`}
          />
          <Detail
            icon={MapPin}
            label="District"
            value={data.team.district}
          />
          <Detail
            icon={Phone}
            label="Team contact"
            value={data.team.contactNumber}
          />
          <Detail
            icon={Gauge}
            label="Availability"
            value={availabilityMeta(data.team.availability).label}
          />

          <Detail
            icon={UserRound}
            label="Team leader"
            value={data.leader.fullName}
          />
          <Detail
            icon={IdCard}
            label="NIC / official ID"
            value={data.leader.nicNumber ?? "—"}
          />
          <Detail icon={Mail} label="Leader email" value={data.leader.email} />
          <Detail
            icon={Phone}
            label="Leader phone"
            value={data.leader.phone}
          />
          {data.organization && (
            <Detail
              icon={Building2}
              label="Organization"
              value={`${data.organization.name} · ${data.organization.registrationId}`}
            />
          )}
          <Detail
            icon={MapPin}
            label="Base location"
            value={
              hasBase
                ? `${base.label ?? "Mapped point"} · ${base.latitude?.toFixed(
                    5
                  )}, ${base.longitude?.toFixed(5)}`
                : "No base location was saved"
            }
            wide
          />
        </div>

        {hasBase && (
          <a
            className="tdash-link"
            href={`https://www.openstreetmap.org/?mlat=${base.latitude}&mlon=${base.longitude}#map=15/${base.latitude}/${base.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} />
            Open the base location on the map
          </a>
        )}
      </section>

      <section className="tdash-grid">
        <div className="tdash-card">
          <div className="tdash-card-head">
            <h3>Capabilities</h3>
            <p>Tasking looks for these first</p>
          </div>
          <div className="tdash-chips">
            {data.team.capabilities.map((item) => (
              <span key={item} className="tdash-chip">
                <BadgeCheck size={13} />
                {item}
              </span>
            ))}
            {data.team.capabilities.length === 0 && (
              <span className="tdash-chip tdash-chip-soft">None recorded</span>
            )}
          </div>
        </div>

        <div className="tdash-card">
          <div className="tdash-card-head">
            <h3>Equipment</h3>
            <p>Kit this team can deploy with</p>
          </div>
          <div className="tdash-chips">
            {data.team.equipment.map((item) => (
              <span key={item} className="tdash-chip tdash-chip-soft">
                <Package size={13} />
                {item}
              </span>
            ))}
            {data.team.equipment.length === 0 && (
              <span className="tdash-chip tdash-chip-soft">
                No equipment recorded
              </span>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

const RESUBMIT_RULES: Record<string, Validator> = {
  teamName: requiredRule("Team name"),
  teamType: oneOfRule("Team type", TEAM_TYPES),
  teamSize: positiveIntegerRule("Team size"),
  district: requiredRule("District"),
  teamContactNumber: requiredRule("Team contact number"),
  capabilities: listRule("Capabilities", TEAM_CAPABILITIES, 1),
  equipment: optionalListRule("Equipment", TEAM_EQUIPMENT),
  baseLatitude: latitudeRule,
  baseLongitude: longitudeRule,
  baseLocationLabel: optionalRule("Location name"),
};

function ReviewView({
  data,
  token,
  onResubmitted,
}: {
  data: RescueTeamDashboard;
  token: string;
  onResubmitted: (message: string) => void;
}) {
  if (!data.review.canResubmit) {
    return (
      <section className="tdash-card">
        <div className="tdash-card-head">
          <h3>Nothing to edit right now</h3>
          <p>
            A team can only be changed while it is rejected. Edit the details
            here after a reviewer sends the team back with a reason.
          </p>
        </div>
        <div className="tdash-rows">
          <Row label="Current status" value={statusMeta(data.account.status).label} />
          <Row
            label="Reviewed by"
            value={data.review.reviewerLabel}
          />
          <Row
            label="Rejection reason"
            value={data.account.rejectionReason ?? "—"}
          />
        </div>
      </section>
    );
  }

  return <ResubmitPanel data={data} token={token} onResubmitted={onResubmitted} />;
}

function ResubmitPanel({
  data,
  token,
  onResubmitted,
}: {
  data: RescueTeamDashboard;
  token: string;
  onResubmitted: (message: string) => void;
}) {
  const isOrganization = data.team.affiliation === "ORGANIZATION";

  const {
    formData,
    errors,
    submitError,
    isSubmitting,
    setField,
    blurField,
    submit,
  } = useRegistrationForm({
    initialValues: {
      teamName: data.team.name,
      teamType: data.team.type === "—" ? "" : data.team.type,
      teamSize: String(data.team.size),
      district: data.team.district,
      teamContactNumber: data.team.contactNumber,
      capabilities: data.team.capabilities.join(","),
      equipment: data.team.equipment.join(","),
      baseLatitude: data.team.base.latitude?.toFixed(6) ?? "",
      baseLongitude: data.team.base.longitude?.toFixed(6) ?? "",
      baseLocationLabel: data.team.base.label ?? "",
      leaderDesignation: data.leader.designation ?? "",
      organizationName: data.organization?.name ?? "",
      organizationRegistrationNumber: data.organization?.registrationId ?? "",
    },
    rules: RESUBMIT_RULES,
    onSubmit: (values) => {
      const payload: Record<string, string> = { ...values };

      if (!isOrganization) {
        delete payload.organizationName;
        delete payload.organizationRegistrationNumber;
      }

      return resubmitRescueTeam(token, payload);
    },
  });

  const handleSubmit = async () => {
    const ok = await submit();

    if (ok) onResubmitted("Your team is back in the review queue.");
  };

  return (
    <section className="tdash-card">
      <div className="tdash-card-head">
        <h3>Correct your team details</h3>
        <p>
          The reviewer's reason is shown above the form. Fix what was flagged and
          send the team back — the same reviewer sees it again as PENDING.
        </p>
      </div>

      <div className="tdash-form-note">
        <AlertTriangle size={16} />
        <span>
          Rejection reason: {data.account.rejectionReason || "None given."}
        </span>
      </div>

      <div className="form-section" style={{ border: "none", padding: 0, boxShadow: "none", margin: 0 }}>
        <FormSection
          icon={Users}
          title="Team details"
          caption="Everything here is what your reviewer will see again."
        >
          <TextField
            id="resubmitTeamName"
            label="Team name"
            value={formData.teamName}
            onChange={(v) => setField("teamName", v)}
            onBlur={() => blurField("teamName")}
            error={errors.teamName}
            placeholder="Colombo Flood Rescue Team 01"
            icon={Ambulance}
          />
          <SelectField
            id="resubmitTeamType"
            label="Team type"
            value={formData.teamType}
            onChange={(v) => setField("teamType", v)}
            onBlur={() => blurField("teamType")}
            error={errors.teamType}
            options={TEAM_TYPES}
            placeholder="Select team type"
          />
          <TextField
            id="resubmitTeamSize"
            label="Team size"
            value={formData.teamSize}
            onChange={(v) => setField("teamSize", v)}
            onBlur={() => blurField("teamSize")}
            error={errors.teamSize}
            placeholder="8"
            icon={Users}
            inputMode="numeric"
          />
          <SelectField
            id="resubmitDistrict"
            label="District"
            value={formData.district}
            onChange={(v) => setField("district", v)}
            onBlur={() => blurField("district")}
            error={errors.district}
            options={DISTRICTS}
            placeholder="Select district"
          />
          <TextField
            id="resubmitTeamContact"
            label="Team contact number"
            value={formData.teamContactNumber}
            onChange={(v) => setField("teamContactNumber", v)}
            onBlur={() => blurField("teamContactNumber")}
            error={errors.teamContactNumber}
            placeholder="077 123 4567"
            icon={Phone}
            type="tel"
          />
          {isOrganization && (
            <TextField
              id="resubmitDesignation"
              label="Designation"
              value={formData.leaderDesignation}
              onChange={(v) => setField("leaderDesignation", v)}
              onBlur={() => blurField("leaderDesignation")}
              error={errors.leaderDesignation}
              placeholder="Rescue Team Leader"
              icon={BadgeCheck}
              optional
            />
          )}

          <CapabilityField
            value={formData.capabilities}
            onChange={(next) => setField("capabilities", next)}
            onBlur={() => blurField("capabilities")}
            error={errors.capabilities}
          />

          <EquipmentField
            value={formData.equipment}
            onChange={(next) => setField("equipment", next)}
            onBlur={() => blurField("equipment")}
            error={errors.equipment}
          />

          <LocationPickerField
            latitude={formData.baseLatitude}
            longitude={formData.baseLongitude}
            district={formData.district}
            onPick={(point) => {
              setField("baseLatitude", point.baseLatitude);
              setField("baseLongitude", point.baseLongitude);
            }}
            error={errors.baseLatitude ?? errors.baseLongitude}
          />

          <TextField
            id="resubmitBaseLabel"
            label="Location name"
            value={formData.baseLocationLabel}
            onChange={(v) => setField("baseLocationLabel", v)}
            onBlur={() => blurField("baseLocationLabel")}
            error={errors.baseLocationLabel}
            placeholder="Kelaniya boat bay, Colombo 15"
            icon={MapPin}
            optional
          />

          {isOrganization && (
            <LockedField
              id="resubmitOrganization"
              label="Organization"
              value={`${formData.organizationName} · ${formData.organizationRegistrationNumber}`}
              icon={Building2}
            />
          )}
        </FormSection>

        <FormMessages submitError={submitError} errors={errors} />

        <div className="tdash-actions">
          <button
            type="button"
            className="tdash-button"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 size={15} className="tdash-spin" />
            ) : (
              <RotateCcw size={15} />
            )}
            {isSubmitting ? "Sending..." : "Send back for review"}
          </button>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: typeof Home;
  label: string;
  value: string;
  caption: string;
  tone: "blue" | "success" | "amber" | "navy";
}) {
  return (
    <div className="tdash-stat">
      <div className={`tdash-stat-icon tdash-stat-icon-${tone}`}>
        <Icon size={19} />
      </div>
      <div className="tdash-stat-value">{value}</div>
      <div className="tdash-stat-label">{label}</div>
      <div className="tdash-stat-caption">{caption}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="tdash-row">
      <span className="tdash-row-label">{label}</span>
      <span className="tdash-row-value">{value}</span>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  wide,
}: {
  icon: typeof Home;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`tdash-detail ${wide ? "tdash-detail-wide" : ""}`}>
      <div className="tdash-detail-icon">
        <Icon size={15} />
      </div>
      <div className="tdash-detail-label">{label}</div>
      <div className="tdash-detail-value">{value}</div>
    </div>
  );
}
