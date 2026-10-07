import {
  Building2,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Colors } from "../constants/theme";
import type { AdminUser } from "../types/auth";
import type { ReviewableRole } from "../services/amasha-adminApi";

export type SidebarKey = ReviewableRole | "ALL";

export interface SidebarItem {
  key: SidebarKey;
  label: string;
  count: number;
  icon: LucideIcon;
}

interface AdminSidebarProps {
  items: SidebarItem[];
  selected: SidebarKey;
  onSelect: (key: SidebarKey) => void;
  admin: AdminUser;
  onLogout: () => void;
}

export default function AdminSidebar({
  items,
  selected,
  onSelect,
  admin,
  onLogout,
}: AdminSidebarProps) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-icon">
          <ShieldCheck size={20} />
        </div>
        <div>
          <strong>
            Safe<span>Plus</span>
          </strong>
          <small>SUPER ADMIN</small>
        </div>
      </div>

      <nav className="admin-sidebar-nav">
        <span className="admin-sidebar-title">Users by role</span>
        {items.map((item) => {
          const Icon = item.icon;
          const active = selected === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={active ? "admin-nav-item admin-nav-active" : "admin-nav-item"}
              onClick={() => onSelect(item.key)}
            >
              <Icon size={17} />
              <span className="admin-nav-label">{item.label}</span>
              <span className="admin-nav-count">{item.count}</span>
            </button>
          );
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-sidebar-user">
          <LayoutDashboard size={16} />
          <div>
            <span>{admin.fullName}</span>
            <small>{admin.email}</small>
          </div>
        </div>
        <button type="button" className="admin-sidebar-logout" onClick={onLogout}>
          <LogOut size={15} />
          Logout
        </button>
      </div>

      <style>{`
        .admin-sidebar {
          width: 264px;
          flex-shrink: 0;
          background: ${Colors.navy};
          color: #fff;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          position: sticky;
          top: 0;
          height: 100vh;
        }

        .admin-sidebar-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 20px 20px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .admin-sidebar-icon {
          width: 38px; height: 38px; border-radius: 11px;
          background: ${Colors.red};
          display: flex; align-items: center; justify-content: center;
        }
        .admin-sidebar-brand strong { display: block; font-size: 16px; line-height: 1; }
        .admin-sidebar-brand strong span { color: #fda29b; }
        .admin-sidebar-brand small {
          display: block; color: #98a2b3; font-size: 9px;
          font-weight: 800; letter-spacing: 0.09em; margin-top: 4px;
        }

        .admin-sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .admin-sidebar-title {
          color: #667085; font-size: 10px; font-weight: 800;
          letter-spacing: 0.09em; text-transform: uppercase;
          padding: 4px 10px 10px;
        }
        .admin-nav-item {
          display: flex; align-items: center; gap: 11px;
          width: 100%; padding: 11px 12px;
          border: none; border-radius: 10px;
          background: transparent; color: #cbd2dc;
          font-size: 13px; font-weight: 600; cursor: pointer;
          text-align: left;
          transition: background 140ms ease, color 140ms ease;
        }
        .admin-nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .admin-nav-active { background: ${Colors.red}; color: #fff; }
        .admin-nav-active:hover { background: ${Colors.redDark}; }
        .admin-nav-label { flex: 1; min-width: 0; }
        .admin-nav-count {
          background: rgba(255,255,255,0.14); color: #fff;
          font-size: 11px; font-weight: 800;
          min-width: 22px; height: 20px; padding: 0 7px;
          border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .admin-nav-active .admin-nav-count { background: rgba(0,0,0,0.22); }

        .admin-sidebar-footer {
          padding: 14px; border-top: 1px solid rgba(255,255,255,0.08);
        }
        .admin-sidebar-user {
          display: flex; align-items: center; gap: 10px;
          padding: 6px 8px 12px;
        }
        .admin-sidebar-user > svg { color: #98a2b3; flex-shrink: 0; }
        .admin-sidebar-user span {
          display: block; font-size: 12px; font-weight: 700;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;
        }
        .admin-sidebar-user small {
          display: block; color: #98a2b3; font-size: 10px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;
        }
        .admin-sidebar-logout {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          width: 100%; padding: 10px;
          border: 1px solid rgba(255,255,255,0.18); border-radius: 9px;
          background: transparent; color: #fff;
          font-size: 12px; font-weight: 700; cursor: pointer;
        }
        .admin-sidebar-logout:hover { background: rgba(255,255,255,0.1); }

        @media (max-width: 860px) {
          .admin-sidebar {
            width: 100%; height: auto; min-height: 0;
            position: static; flex-direction: column;
          }
          .admin-sidebar-nav {
            flex-direction: row; overflow-x: auto; gap: 8px; padding: 12px;
          }
          .admin-sidebar-title { display: none; }
          .admin-nav-item { width: auto; white-space: nowrap; }
          .admin-nav-label { flex: none; }
          .admin-sidebar-footer {
            display: flex; align-items: center; justify-content: space-between;
            gap: 12px;
          }
          .admin-sidebar-user { padding: 0; }
          .admin-sidebar-logout { width: auto; padding: 10px 16px; }
        }
      `}</style>
    </aside>
  );
}

export const ROLE_ICONS: Record<ReviewableRole, LucideIcon> = {
  DISTRICT_OFFICER: UserCog,
  DMC_OFFICER: ShieldCheck,
  COORDINATOR: Users,
  RELIEF_AGENCY: Building2,
  ORGANIZATION_ADMIN: Building2,
  INDEPENDENT_TEAM_LEADER: Users,
};
