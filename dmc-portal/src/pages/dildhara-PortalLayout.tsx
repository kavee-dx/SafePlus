import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Bell,
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  ShieldCheck,
  TriangleAlert,
  Truck,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Colors } from "../constants/theme";
import {
  PORTAL_ROLE_LABELS,
  type PortalAccount,
} from "../services/dildhara-portalAuthApi";

export type PortalPage = "dashboard" | "profile" | "resource-requests";

const UPCOMING_MENU: Record<string, { label: string; icon: LucideIcon }[]> = {
  DMC_OFFICER: [
    { label: "Incidents", icon: TriangleAlert },
    { label: "Resource requests", icon: Package },
    { label: "Reports", icon: FileText },
  ],
  DISTRICT_OFFICER: [
    { label: "Relief centres", icon: Building2 },
    { label: "Rescue teams", icon: Users },
    { label: "Agency requests", icon: ClipboardList },
  ],
  COORDINATOR: [
    { label: "Operations", icon: Activity },
    { label: "Volunteers", icon: Users },
    { label: "Deliveries", icon: Truck },
  ],
  ORGANIZATION_ADMIN: [
    { label: "Rescue teams", icon: Users },
    { label: "Approvals", icon: UserCheck },
    { label: "Deployments", icon: MapPin },
  ],
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

interface PortalLayoutProps {
  account: PortalAccount;
  activePage: PortalPage;
  onNavigate: (page: PortalPage) => void;
  onSignOut: () => void;
  children: ReactNode;
}

export default function PortalLayout({
  account,
  activePage,
  onNavigate,
  onSignOut,
  children,
}: PortalLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const go = (page: PortalPage) => {
    setMenuOpen(false);
    onNavigate(page);
  };

  const roleLabel = PORTAL_ROLE_LABELS[account.role] ?? account.role;
  const upcoming = UPCOMING_MENU[account.role] ?? [];

  return (
    <div className="pl-shell">
      <header className="pl-topbar">
        <div className="pl-brand">
          <div className="pl-brand-icon">
            <ShieldCheck size={20} />
          </div>
          <div>
            <strong>
              Safe<span>Plus</span>
            </strong>
            <small>DMC OPERATIONS</small>
          </div>
        </div>

        <div className="pl-actions">
          <button
            type="button"
            className="pl-icon-btn"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="pl-dot" />
          </button>

          <div className="pl-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="pl-profile-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Open profile menu"
            >
              <span className="pl-avatar">{initials(account.fullName)}</span>
              <span className="pl-profile-name">{account.fullName}</span>
              <ChevronDown size={15} />
            </button>

            {menuOpen && (
              <div className="pl-menu" role="menu">
                <div className="pl-menu-head">
                  <strong>{account.fullName}</strong>
                  <span>{roleLabel}</span>
                </div>

                <button
                  type="button"
                  className="pl-menu-item"
                  onClick={() => go("dashboard")}
                >
                  <LayoutDashboard size={16} />
                  Dashboard
                </button>
                <button
                  type="button"
                  className="pl-menu-item"
                  onClick={() => go("profile")}
                >
                  <User size={16} />
                  My profile
                </button>
                <button
                  type="button"
                  className="pl-menu-item danger"
                  onClick={onSignOut}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="pl-body">
        <aside className="pl-sidebar">
          <nav>
            <button
              type="button"
              className={`pl-nav-item ${activePage === "dashboard" ? "active" : ""}`}
              onClick={() => go("dashboard")}
            >
              <LayoutDashboard size={17} />
              Dashboard
            </button>
            <button
              type="button"
              className={`pl-nav-item ${activePage === "profile" ? "active" : ""}`}
              onClick={() => go("profile")}
            >
              <User size={17} />
              My profile
            </button>
            {account.role === "COORDINATOR" && (
              <button
                type="button"
                className={`pl-nav-item ${activePage === "resource-requests" ? "active" : ""}`}
                onClick={() => go("resource-requests")}
              >
                <Package size={17} />
                Resource requests
              </button>
            )}

            {upcoming.length > 0 && (
              <>
                <div className="pl-nav-label">COMING SOON</div>
                {upcoming.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    className="pl-nav-item"
                    disabled
                    title="Coming soon"
                  >
                    <Icon size={17} />
                    {label}
                  </button>
                ))}
              </>
            )}
          </nav>
        </aside>

        <main className="pl-main">{children}</main>
      </div>

      <style>{`
        .pl-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: ${Colors.background};
          font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .pl-topbar {
          height: 64px;
          background: ${Colors.navy};
          color: ${Colors.white};
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .pl-brand { display: flex; align-items: center; gap: 11px; }
        .pl-brand-icon {
          width: 38px; height: 38px; border-radius: 11px;
          background: ${Colors.red};
          display: flex; align-items: center; justify-content: center;
        }
        .pl-brand strong { display: block; font-size: 17px; line-height: 1; }
        .pl-brand strong span { color: ${Colors.red}; }
        .pl-brand small {
          display: block; margin-top: 4px; color: #98a2b3;
          font-size: 9px; font-weight: 700; letter-spacing: 0.08em;
        }
        .pl-actions { display: flex; align-items: center; gap: 10px; }
        .pl-icon-btn {
          position: relative; width: 40px; height: 40px; border: none;
          border-radius: 50%; background: rgba(255,255,255,0.08);
          color: ${Colors.white}; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .pl-dot {
          position: absolute; top: 9px; right: 10px; width: 8px; height: 8px;
          border-radius: 50%; background: ${Colors.red};
        }
        .pl-profile-btn {
          display: flex; align-items: center; gap: 8px; border: none;
          background: rgba(255,255,255,0.08); color: ${Colors.white};
          padding: 4px 12px 4px 4px; border-radius: 999px; cursor: pointer;
          font-size: 13px; font-weight: 600;
        }
        .pl-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: ${Colors.red}; color: #fff; font-size: 12px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
        }
        .pl-menu-wrap { position: relative; }
        .pl-menu {
          position: absolute; right: 0; top: calc(100% + 10px); width: 240px;
          background: ${Colors.white}; color: ${Colors.text};
          border: 1px solid ${Colors.border}; border-radius: 14px;
          box-shadow: 0 20px 40px rgba(16,24,40,0.18); padding: 8px;
        }
        .pl-menu-head {
          padding: 10px 12px 12px; margin-bottom: 6px;
          border-bottom: 1px solid ${Colors.border};
        }
        .pl-menu-head strong { display: block; font-size: 13px; }
        .pl-menu-head span { font-size: 11px; color: ${Colors.muted}; }
        .pl-menu-item {
          width: 100%; display: flex; align-items: center; gap: 10px;
          border: none; background: transparent; padding: 10px 12px;
          border-radius: 9px; font-size: 13px; font-weight: 600;
          color: ${Colors.text}; cursor: pointer; text-align: left;
        }
        .pl-menu-item:hover { background: ${Colors.background}; }
        .pl-menu-item.danger { color: ${Colors.redDark}; }
        .pl-body { flex: 1; display: flex; min-height: 0; }
        .pl-sidebar {
          width: 230px; flex-shrink: 0; background: ${Colors.white};
          border-right: 1px solid ${Colors.border}; padding: 20px 14px;
        }
        .pl-nav-label {
          margin: 18px 10px 8px; color: ${Colors.muted};
          font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
        }
        .pl-nav-item {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 11px 12px; margin-bottom: 2px; border: none;
          background: transparent; border-radius: 10px; font-size: 13px;
          font-weight: 600; color: ${Colors.text}; cursor: pointer; text-align: left;
        }
        .pl-nav-item:hover:not(:disabled) { background: ${Colors.background}; }
        .pl-nav-item.active { background: ${Colors.redLight}; color: ${Colors.redDark}; }
        .pl-nav-item:disabled { color: #98a2b3; cursor: not-allowed; }
        .pl-main {
          flex: 1; min-width: 0; width: 100%; max-width: 1100px;
          margin: 0 auto; padding: 28px;
        }
        @media (max-width: 860px) {
          .pl-sidebar { display: none; }
          .pl-main { padding: 18px 16px; }
          .pl-profile-name { display: none; }
          .pl-topbar { padding: 0 16px; }
        }
      `}</style>
    </div>
  );
}