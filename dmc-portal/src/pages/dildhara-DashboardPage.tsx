import {
  Activity,
  Building2,
  ClipboardList,
  MapPin,
  Package,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Colors } from "../constants/theme";
import {
  PORTAL_ROLE_LABELS,
  type PortalAccount,
} from "../services/dildhara-portalAuthApi";

interface Stat {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

interface RoleDashboard {
  subtitle: string;
  stats: Stat[];
  activity: { title: string; meta: string }[];
  actions: string[];
}

const DASHBOARDS: Record<string, RoleDashboard> = {
  
  DISTRICT_OFFICER: {
    subtitle: "Situation and relief activity in your assigned district.",
    stats: [
      { label: "Affected divisions", value: "5", hint: "Of 13 in district", icon: MapPin },
      { label: "Relief centres open", value: "14", hint: "2 near capacity", icon: Building2 },
      { label: "Rescue teams in district", value: "9", hint: "6 on active duty", icon: Users },
      { label: "Agency requests", value: "17", hint: "4 awaiting review", icon: ClipboardList },
    ],
    activity: [
      { title: "Relief centre at 90% capacity", meta: "15 minutes ago" },
      { title: "Relief agency request received", meta: "50 minutes ago" },
      { title: "Rescue team 4 reached the affected area", meta: "2 hours ago" },
      { title: "Divisional report submitted", meta: "Yesterday" },
    ],
    actions: ["Review agency requests", "Update relief centres", "Submit district report"],
  },
  COORDINATOR: {
    subtitle: "Operations, volunteers and deliveries you are coordinating.",
    stats: [
      { label: "Ongoing operations", value: "6", hint: "2 starting today", icon: Activity },
      { label: "Volunteers assigned", value: "128", hint: "94 available now", icon: Users },
      { label: "Deliveries in progress", value: "19", hint: "3 delayed", icon: Truck },
      { label: "Supply requests", value: "11", hint: "5 unassigned", icon: Package },
    ],
    activity: [
      { title: "Delivery team assigned to Negombo route", meta: "10 minutes ago" },
      { title: "Supply request raised by a relief agency", meta: "40 minutes ago" },
      { title: "Volunteer group checked in", meta: "2 hours ago" },
      { title: "Operation 'Coastal Relief' marked complete", meta: "Yesterday" },
    ],
    actions: ["Assign volunteers", "Plan a delivery route", "Review supply requests"],
  },
  ORGANIZATION_ADMIN: {
    subtitle: "Your rescue teams, approvals and deployments.",
    stats: [
      { label: "Rescue teams", value: "7", hint: "5 deployed", icon: Users },
      { label: "Pending leader approvals", value: "3", hint: "Awaiting your review", icon: UserCheck },
      { label: "Active deployments", value: "4", hint: "In 3 districts", icon: MapPin },
      { label: "Members available", value: "52", hint: "Ready to deploy", icon: Activity },
    ],
    activity: [
      { title: "New team leader registration to review", meta: "30 minutes ago" },
      { title: "Team 3 deployed to Colombo", meta: "2 hours ago" },
      { title: "Member roster updated", meta: "Yesterday" },
      { title: "Deployment report submitted", meta: "2 days ago" },
    ],
    actions: ["Review team leaders", "Deploy a team", "Update member roster"],
  },
};

export default function DashboardPage({ account }: { account: PortalAccount }) {
  const config = DASHBOARDS[account.role] ?? {
    subtitle: "Dashboard overview.",
    stats: [],
    activity: [],
    actions: [],
  };
  const firstName = account.fullName.split(" ")[0];

  return (
    <div className="db-page">
      <div className="db-heading">
        <div>
          <span className="db-role">
            {PORTAL_ROLE_LABELS[account.role] ?? account.role}
          </span>
          <h1>Welcome back, {firstName}</h1>
          <p>{config.subtitle}</p>
        </div>
      </div>

      <div className="db-note">
        Sample data. These figures are placeholders until the operations
        features are connected.
      </div>

      <div className="db-stats">
        {config.stats.map(({ label, value, hint, icon: Icon }) => (
          <div className="db-stat" key={label}>
            <span className="db-stat-icon">
              <Icon size={18} />
            </span>
            <strong>{value}</strong>
            <span className="db-stat-label">{label}</span>
            <small>{hint}</small>
          </div>
        ))}
      </div>

      <div className="db-columns">
        <section className="db-card">
          <h3>Recent activity</h3>
          {config.activity.map((item) => (
            <div className="db-activity" key={item.title}>
              <span className="db-bullet" />
              <div>
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </div>
            </div>
          ))}
        </section>

        <section className="db-card">
          <h3>Quick actions</h3>
          {config.actions.map((action) => (
            <div className="db-action" key={action}>
              {action}
              <span>Coming soon</span>
            </div>
          ))}
        </section>
      </div>

      <style>{`
        .db-role {
          color: ${Colors.red}; font-size: 11px; font-weight: 800; letter-spacing: 0.09em;
          text-transform: uppercase;
        }
        .db-heading h1 {
          margin: 8px 0 6px; color: ${Colors.text}; font-size: 28px; letter-spacing: -0.03em;
        }
        .db-heading p { margin: 0; color: ${Colors.muted}; font-size: 14px; }
        .db-note {
          margin: 20px 0; padding: 10px 14px; border-radius: 10px;
          background: ${Colors.redLight}; color: ${Colors.redDark};
          font-size: 12px; line-height: 1.5;
        }
        .db-stats {
          display: grid; gap: 14px;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        }
        .db-stat {
          display: flex; flex-direction: column; padding: 18px; border-radius: 16px;
          background: ${Colors.white}; border: 1px solid ${Colors.border};
        }
        .db-stat-icon {
          width: 38px; height: 38px; border-radius: 11px; margin-bottom: 14px;
          background: ${Colors.redLight}; color: ${Colors.red};
          display: flex; align-items: center; justify-content: center;
        }
        .db-stat strong { font-size: 30px; color: ${Colors.text}; letter-spacing: -0.03em; }
        .db-stat-label { margin-top: 2px; font-size: 13px; font-weight: 700; color: ${Colors.text}; }
        .db-stat small { margin-top: 4px; font-size: 11px; color: ${Colors.muted}; }
        .db-columns {
          display: grid; gap: 14px; margin-top: 14px;
          grid-template-columns: 1.6fr 1fr;
        }
        .db-card {
          padding: 20px; border-radius: 16px;
          background: ${Colors.white}; border: 1px solid ${Colors.border};
        }
        .db-card h3 { margin: 0 0 14px; font-size: 15px; color: ${Colors.text}; }
        .db-activity { display: flex; gap: 12px; padding: 11px 0; border-top: 1px solid ${Colors.border}; }
        .db-activity:first-of-type { border-top: none; }
        .db-bullet {
          width: 8px; height: 8px; margin-top: 6px; border-radius: 50%;
          background: ${Colors.red}; flex-shrink: 0;
        }
        .db-activity strong { display: block; font-size: 13px; color: ${Colors.text}; }
        .db-activity small { font-size: 11px; color: ${Colors.muted}; }
        .db-action {
          display: flex; justify-content: space-between; align-items: center;
          padding: 13px 14px; margin-bottom: 8px; border-radius: 11px;
          background: ${Colors.background}; border: 1px solid ${Colors.border};
          font-size: 13px; font-weight: 600; color: #98a2b3;
        }
        .db-action span { font-size: 10px; font-weight: 700; }
        @media (max-width: 860px) { .db-columns { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}