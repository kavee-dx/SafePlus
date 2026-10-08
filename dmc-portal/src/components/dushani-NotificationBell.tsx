import { useEffect, useRef, useState } from "react";
import { Bell, Check, RefreshCw } from "lucide-react";

import { Colors } from "../constants/theme";
import { fetchNotifications, markNotificationRead } from "../services/dushani-alertApi";
import type { PortalNotification } from "../types/hazardReport";

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
    <div className="bell" ref={panelRef}>
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
            border: 1px solid ${Colors.border};
            background: ${Colors.white};
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: ${Colors.muted};
          }

          .bell-button:hover {
            border-color: ${Colors.red};
            color: ${Colors.red};
          }

          .bell-badge {
            position: absolute;
            top: -6px;
            right: -6px;
            min-width: 19px;
            height: 19px;
            padding: 0 4px;
            background: ${Colors.red};
            color: ${Colors.white};
            font-size: 10px;
            font-weight: 800;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .bell-panel {
            position: absolute;
            right: 0;
            top: 52px;
            width: 380px;
            max-height: 460px;
            overflow-y: auto;
            background: ${Colors.white};
            border: 1px solid ${Colors.border};
            border-radius: 14px;
            box-shadow: 0 18px 40px rgba(16, 24, 40, 0.16);
            z-index: 60;
          }

          .bell-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            border-bottom: 1px solid ${Colors.border};
            font-size: 13px;
            font-weight: 800;
            color: ${Colors.text};
            position: sticky;
            top: 0;
            background: ${Colors.white};
          }

          .bell-refresh {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: none;
            background: transparent;
            color: ${Colors.blue};
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
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
            padding: 6px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .bell-item {
            width: 100%;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px;
            border: none;
            border-radius: 10px;
            background: transparent;
            text-align: left;
            cursor: pointer;
            font: inherit;
          }

          .bell-item:hover {
            background: ${Colors.background};
          }

          .bell-item-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${Colors.border};
            margin-top: 5px;
            flex-shrink: 0;
          }

          .bell-item-unread .bell-item-dot {
            background: ${Colors.red};
          }

          .bell-item-body {
            display: flex;
            flex-direction: column;
            gap: 3px;
            flex: 1;
            min-width: 0;
          }

          .bell-item-title {
            font-size: 13px;
            font-weight: 700;
            color: ${Colors.text};
          }

          .bell-item-message {
            font-size: 12px;
            color: ${Colors.muted};
          }

          .bell-item-time {
            font-size: 11px;
            color: ${Colors.muted};
          }

          .bell-item-read {
            color: ${Colors.success};
            margin-top: 4px;
          }

          .bell-empty,
          .bell-error {
            margin: 0;
            padding: 18px 16px;
            font-size: 12px;
            color: ${Colors.muted};
          }

          .bell-error {
            color: ${Colors.redDark};
          }
        `}
      </style>
    </div>
  );
}
