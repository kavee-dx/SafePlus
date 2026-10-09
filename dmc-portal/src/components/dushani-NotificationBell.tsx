import { useEffect, useRef, useState } from "react";
import { Bell, Check, RefreshCw } from "lucide-react";

import { Colors } from "../constants/theme";
import { fetchNotifications, markNotificationRead } from "../services/dushani-alertApi";
import type { PortalNotification } from "../types/hazardReport";

const Hairline = "#EAECF0";
const Divider = "#F2F4F7";
const Surface = "#F9FAFB";
const RedTint = "#FEF3F2";
const ShadowCard =
  "0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.06)";
const ShadowRaised =
  "0 4px 12px rgba(16, 24, 40, 0.09), 0 2px 4px rgba(16, 24, 40, 0.05)";
const ShadowOverlay =
  "0 24px 48px -12px rgba(16, 24, 40, 0.26), 0 8px 20px -8px rgba(16, 24, 40, 0.16)";
const FocusRing = "0 0 0 3px rgba(217, 45, 32, 0.16)";

const POLL_INTERVAL_MS = 20_000;

export default function NotificationBell({
  onOpenReports,
}: {
  onOpenReports?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [token, setToken] = useState(0);

  useEffect(() => {
    fetchNotifications()
      .then(({ notifications, unreadCount }) => {
        setItems(notifications);
        setUnread(unreadCount);
        setError(null);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error ? loadError.message : "Could not load alerts."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => {
      setToken((current) => current + 1);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  const refresh = () => {
    setLoading(true);
    setToken((current) => current + 1);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);

    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const handleRead = async (notification: PortalNotification) => {
    if (!notification.isRead) {
      await markNotificationRead(notification.id);
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item
        )
      );
      setUnread((current) => Math.max(0, current - 1));
    }

    if (
      notification.type === "REPORT_SUBMITTED" ||
      notification.type === "REPORT_VERIFIED" ||
      notification.type === "REPORT_REJECTED"
    ) {
      setOpen(false);
      onOpenReports?.();
    }
  };

  return (
    <div className={`bell ${open ? "bell-open" : ""}`} ref={panelRef}>
      <button
        type="button"
        className="bell-button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <Bell size={18} />
        {unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel">
          <div className="bell-panel-header">
            <span>Notifications</span>
            <button
              type="button"
              className="bell-refresh"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? "bell-spin" : undefined} />
              Refresh
            </button>
          </div>

          {error && <p className="bell-error">{error}</p>}

          {!error && items.length === 0 && (
            <p className="bell-empty">
              Nothing yet. You are told here when a ground report is verified and
              ready for a warning.
            </p>
          )}

          <ul className="bell-list">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`bell-item ${item.isRead ? "" : "bell-item-unread"}`}
                  onClick={() => void handleRead(item)}
                >
                  <span className="bell-item-dot" aria-hidden="true" />
                  <span className="bell-item-body">
                    <span className="bell-item-title">{item.title}</span>
                    <span className="bell-item-message">{item.message}</span>
                    <span className="bell-item-time">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </span>
                  {item.isRead && <Check size={14} className="bell-item-read" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>
        {`
          .bell {
            position: relative;
          }

          .bell-button {
            position: relative;
            width: 42px;
            height: 42px;
            border: 1px solid ${Hairline};
            background: ${Colors.white};
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: ${Colors.muted};
            font-family: inherit;
            box-shadow: ${ShadowCard};
            transition: color 140ms ease, border-color 140ms ease,
              background 140ms ease, transform 140ms ease, box-shadow 140ms ease;
          }

          .bell-button:hover {
            border-color: ${Colors.navy};
            color: ${Colors.navy};
            box-shadow: ${ShadowRaised};
            transform: translateY(-1px);
          }

          .bell-button:active {
            transform: translateY(0);
          }

          .bell-button:focus-visible {
            outline: none;
            border-color: ${Colors.red};
            box-shadow: ${FocusRing};
          }

          .bell-open .bell-button,
          .bell-open .bell-button:hover {
            background: ${Colors.redLight};
            border-color: ${Colors.red};
            color: ${Colors.redDark};
            box-shadow: ${ShadowCard};
            transform: none;
          }

          .bell-badge {
            position: absolute;
            top: -6px;
            right: -6px;
            min-width: 20px;
            height: 20px;
            padding: 0 5px;
            background: ${Colors.red};
            color: ${Colors.white};
            font-size: 11px;
            font-weight: 800;
            line-height: 1;
            font-variant-numeric: tabular-nums;
            border: 2px solid ${Colors.white};
            border-radius: 999px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 2px rgba(16, 24, 40, 0.16);
          }

          .bell-panel {
            position: absolute;
            right: 0;
            top: 52px;
            width: 380px;
            max-height: 460px;
            overflow-y: auto;
            background: ${Colors.white};
            border: 1px solid ${Hairline};
            border-radius: 16px;
            box-shadow: ${ShadowOverlay};
            z-index: 60;
            color: ${Colors.text};
            font-variant-numeric: tabular-nums;
            animation: bell-panel-in 160ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }

          @keyframes bell-panel-in {
            from {
              opacity: 0;
              transform: translateY(-6px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: none;
            }
          }

          .bell-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px 16px;
            border-bottom: 1px solid ${Divider};
            font-size: 15px;
            font-weight: 800;
            letter-spacing: -0.01em;
            color: ${Colors.text};
            position: sticky;
            top: 0;
            background: ${Colors.white};
            z-index: 2;
          }

          .bell-refresh {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 28px;
            padding: 0 11px;
            border: 1px solid ${Colors.border};
            background: ${Colors.white};
            color: ${Colors.blue};
            font-family: inherit;
            font-size: 12px;
            font-weight: 700;
            border-radius: 999px;
            cursor: pointer;
            box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
            transition: background 140ms ease, border-color 140ms ease,
              color 140ms ease;
          }

          .bell-refresh:hover:not(:disabled) {
            border-color: ${Colors.navy};
            color: ${Colors.navy};
            background: ${Surface};
          }

          .bell-refresh:focus-visible {
            outline: none;
            border-color: ${Colors.red};
            box-shadow: ${FocusRing};
          }

          .bell-refresh:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .bell-spin {
            animation: bell-rotate 900ms linear infinite;
          }

          @keyframes bell-rotate {
            to {
              transform: rotate(360deg);
            }
          }

          .bell-list {
            list-style: none;
            margin: 0;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .bell-list > li {
            display: block;
          }

          .bell-item {
            position: relative;
            width: 100%;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px 14px;
            border: 1px solid transparent;
            border-radius: 12px;
            background: transparent;
            text-align: left;
            cursor: pointer;
            font-family: inherit;
            color: inherit;
            transition: background 140ms ease, border-color 140ms ease;
          }

          .bell-item:hover {
            background: ${Surface};
            border-color: ${Hairline};
          }

          .bell-item:focus-visible {
            outline: none;
            border-color: ${Colors.red};
            box-shadow: ${FocusRing};
          }

          .bell-item-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${Colors.border};
            margin-top: 7px;
            flex-shrink: 0;
            transition: background 140ms ease, box-shadow 140ms ease;
          }

          .bell-item-unread {
            background: ${Colors.white};
          }

          .bell-item-unread::before {
            content: "";
            position: absolute;
            left: 0;
            top: 12px;
            bottom: 12px;
            width: 3px;
            border-radius: 0 3px 3px 0;
            background: ${Colors.red};
          }

          .bell-item-unread .bell-item-dot {
            background: ${Colors.red};
            box-shadow: 0 0 0 3px ${Colors.redLight};
          }

          .bell-item-body {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
            min-width: 0;
          }

          .bell-item-title {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: -0.01em;
            line-height: 1.4;
            color: ${Colors.text};
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .bell-item-message {
            font-size: 12px;
            font-weight: 500;
            line-height: 1.5;
            color: ${Colors.muted};
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .bell-item-time {
            font-size: 11px;
            font-weight: 500;
            letter-spacing: 0.02em;
            color: ${Colors.muted};
            font-variant-numeric: tabular-nums;
          }

          .bell-item-read {
            color: ${Colors.success};
            margin-top: 5px;
            flex-shrink: 0;
          }

          .bell-empty {
            margin: 12px;
            padding: 22px 18px;
            border: 1px dashed ${Colors.border};
            border-radius: 12px;
            background: ${Surface};
            font-size: 13px;
            font-weight: 500;
            line-height: 1.6;
            color: ${Colors.muted};
            text-align: center;
          }

          .bell-error {
            margin: 12px;
            padding: 12px 14px;
            border: 1px solid #FDA29B;
            border-radius: 12px;
            background: ${RedTint};
            font-size: 12.5px;
            font-weight: 600;
            line-height: 1.5;
            color: ${Colors.redDark};
          }

          @media (prefers-reduced-motion: reduce) {
            .bell,
            .bell *,
            .bell *::before,
            .bell *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }

          @media (max-width: 480px) {
            .bell-panel {
              width: min(340px, calc(100vw - 24px));
            }
          }
        `}
      </style>
    </div>
  );
}
