import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Bell, ChevronRight, RefreshCw } from "lucide-react";

import { Colors } from "../constants/theme";
import { fetchNotifications, markNotificationRead } from "../services/dushani-alertApi";
import type { PortalNotification } from "../types/hazardReport";

/* ------------------------------------------------------------------ *
 * The district officer's standing message tray (portal).
 *
 * A verified ground report already becomes the officer's job the moment it is
 * confirmed — the backend drops a REPORT_VERIFIED row for every officer in that
 * district. This is the surface that reads it: a glance says "an incident is
 * ready for you", and one tap marks it read and opens that incident on its
 * response page. Read/unread colour is the same language the team leader's phone
 * uses (blue = verified incident, amber = warning) so the two consoles agree.
 * ------------------------------------------------------------------ */

/** Only the kinds a district officer acts on at the desk. */
const DESK_TYPES: PortalNotification["type"][] = ["REPORT_VERIFIED", "WARNING_CREATED"];

function toneOf(type: PortalNotification["type"]): { ink: string; wash: string } {
  switch (type) {
    case "WARNING_CREATED":
      return { ink: Colors.amber, wash: "#FFFAEB" };
    default:
      return { ink: Colors.blue, wash: "#EFF4FF" };
  }
}

function timeAgo(value: string, now: number): string {
  const diff = now - new Date(value).getTime();
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const POLL_INTERVAL_MS = 20_000;

export default function KaveeshaOfficerNotificationCenter({
  onOpenIncident,
}: {
  /** Open the incident the notification points at, on its response page. */
  onOpenIncident: (reportId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const panelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(() => {
    fetchNotifications()
      .then(({ notifications }) => {
        const desk = notifications.filter((item) => DESK_TYPES.includes(item.type));
        setItems(desk);
        setUnread(desk.filter((item) => !item.isRead).length);
        setError(null);
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error ? loadError.message : "Could not load alerts."
        );
      })
      .finally(() => {
        setLoading(false);
        setNow(Date.now());
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll quietly so a report verified in the field shows up without a reload.
  useEffect(() => {
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Keep relative timestamps honest while the panel is open.
  useEffect(() => {
    if (!open) return;
    const ticker = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(ticker);
  }, [open]);

  // Dismiss on an outside click, the way the panel is expected to behave.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const handleOpen = async (item: PortalNotification) => {
    if (!item.isRead) {
      await markNotificationRead(item.id).catch(() => undefined);
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, isRead: true } : row))
      );
      setUnread((current) => Math.max(0, current - 1));
    }

    if (item.relatedReportId) {
      setOpen(false);
      onOpenIncident(item.relatedReportId);
    }
  };

  return (
    <div className="konc" ref={panelRef}>
      <button
        type="button"
        className={`konc-btn ${open ? "konc-btn-active" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="konc-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="konc-panel">
          <div className="konc-head">
            <span className="konc-head-title">Incident alerts</span>
            <button
              type="button"
              className="konc-refresh"
              onClick={() => {
                setLoading(true);
                load();
              }}
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? "konc-spin" : undefined} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="konc-error">
              <span>{error}</span>
              <button type="button" className="konc-retry" onClick={load}>
                Try again
              </button>
            </div>
          )}

          {!error && items.length === 0 && (
            <p className="konc-empty">
              No verified incidents yet. You'll be told here the moment a report in
              your district is confirmed and ready to work.
            </p>
          )}

          <ul className="konc-list">
            {items.map((item) => {
              const tone = toneOf(item.type);
              const clickable = Boolean(item.relatedReportId);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`konc-item ${item.isRead ? "konc-item-read" : ""}`}
                    style={{ "--konc-accent": tone.ink } as CSSProperties}
                    onClick={() => void handleOpen(item)}
                    disabled={!clickable}
                    title={
                      clickable
                        ? "Open this incident on its response page"
                        : item.message
                    }
                  >
                    <span className="konc-rail" aria-hidden="true" />
                    <span className="konc-body">
                      <span className="konc-row">
                        <span className="konc-title">{item.title}</span>
                        <span className="konc-time">{timeAgo(item.createdAt, now)}</span>
                      </span>
                      <span className="konc-message">{item.message}</span>
                    </span>
                    {clickable ? (
                      <ChevronRight size={16} className="konc-go" />
                    ) : (
                      <span className="konc-dot konc-dot-seen" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <style>{`
        .konc { position: relative; }

        .konc-btn {
          position: relative;
          width: 40px; height: 40px;
          display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid #E9EEF4;
          background: linear-gradient(180deg,#ffffff,#f7fafd);
          color: ${Colors.navy};
          border-radius: 13px; cursor: pointer;
          box-shadow: 0 1px 2px rgba(16,24,40,.06);
          transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
        }
        .konc-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 22px -14px rgba(16,24,40,.32); border-color: ${Colors.blueLight}; }
        .konc-btn:active { transform: translateY(0); }
        .konc-btn-active { border-color: ${Colors.blue}; box-shadow: 0 0 0 3px rgba(21,112,239,.14); }

        .konc-badge {
          position: absolute; top: -6px; right: -6px;
          min-width: 19px; height: 19px; padding: 0 5px;
          background: ${Colors.red}; color: #fff;
          font-size: 11px; font-weight: 800; line-height: 1;
          font-variant-numeric: tabular-nums;
          border: 2px solid #fff; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          box-shadow: 0 1px 2px rgba(16,24,40,.18);
        }

        .konc-panel {
          position: absolute; right: 0; top: 50px;
          width: 372px; max-height: 468px; overflow-y: auto;
          background: #fff; border: 1px solid #E9EEF4; border-radius: 16px;
          box-shadow: 0 24px 60px -22px rgba(16,24,40,.34);
          z-index: 70; color: ${Colors.text};
          font-variant-numeric: tabular-nums;
          animation: konc-in 160ms cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes konc-in { from { opacity: 0; transform: translateY(-6px) scale(.98); } to { opacity: 1; transform: none; } }

        .konc-head {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 14px 16px; border-bottom: 1px solid #EEF1F5;
          position: sticky; top: 0; background: #fff; z-index: 2;
        }
        .konc-head-title { font-size: 14px; font-weight: 800; letter-spacing: -.01em; color: ${Colors.navy}; }
        .konc-refresh {
          display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px;
          border: 1px solid #E9EEF4; background: #fff; color: ${Colors.blue};
          font-size: 12px; font-weight: 700; border-radius: 999px; cursor: pointer;
          transition: background 140ms ease, border-color 140ms ease;
        }
        .konc-refresh:hover:not(:disabled) { border-color: ${Colors.blueLight}; background: #F7FAFD; }
        .konc-refresh:disabled { opacity: .5; cursor: not-allowed; }
        .konc-spin { animation: konc-rotate 900ms linear infinite; }
        @keyframes konc-rotate { to { transform: rotate(360deg); } }

        .konc-error {
          margin: 12px; padding: 12px 14px; border: 1px solid #FDA29B; border-radius: 12px;
          background: ${Colors.redLight}; color: ${Colors.redDark};
          font-size: 12.5px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .konc-retry {
          border: 1px solid #F4A9A3; background: #fff; color: ${Colors.redDark};
          font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; cursor: pointer; white-space: nowrap;
        }

        .konc-empty {
          margin: 14px; padding: 22px 18px; border: 1px dashed #D7DEE8; border-radius: 12px;
          background: #F7FAFD; font-size: 13px; font-weight: 500; line-height: 1.6;
          color: ${Colors.muted}; text-align: center;
        }

        .konc-list { list-style: none; margin: 0; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
        .konc-list > li { display: block; }

        .konc-item {
          position: relative; width: 100%;
          display: flex; align-items: flex-start; gap: 11px;
          padding: 12px 14px 12px 16px;
          border: 1px solid transparent; border-radius: 13px; background: #fff;
          text-align: left; cursor: pointer; font-family: inherit; color: inherit;
          transition: background 140ms ease, border-color 140ms ease;
        }
        .konc-item:hover { background: #F7FAFD; border-color: #EAEFF5; }
        .konc-item:disabled { cursor: default; }
        .konc-item:disabled:hover { background: #fff; border-color: transparent; }

        .konc-rail {
          position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px;
          border-radius: 0 3px 3px 0; background: var(--konc-accent, ${Colors.blue});
          transition: background 200ms ease, opacity 200ms ease;
        }

        .konc-body { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
        .konc-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
        .konc-title { font-size: 13px; font-weight: 800; letter-spacing: -.01em; color: ${Colors.navy}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .konc-time { font-size: 11px; font-weight: 600; color: ${Colors.muted}; flex-shrink: 0; }
        .konc-message { font-size: 12px; font-weight: 500; line-height: 1.5; color: ${Colors.muted}; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .konc-dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; background: var(--konc-accent, ${Colors.blue}); box-shadow: 0 0 0 3px color-mix(in srgb, var(--konc-accent, ${Colors.blue}) 22%, transparent); }
        .konc-dot-seen { background: #D0D5DD; box-shadow: none; }
        .konc-go { color: var(--konc-accent, ${Colors.blue}); margin-top: 3px; flex-shrink: 0; opacity: .8; }

        /* Read fades the colour away: neutral rail, muted title, no glow. */
        .konc-item-read .konc-rail { background: #D7DEE8; }
        .konc-item-read .konc-title { color: ${Colors.muted}; font-weight: 700; }
        .konc-item-read .konc-go { color: #A9B3C2; }

        @media (prefers-reduced-motion: reduce) {
          .konc, .konc *, .konc *::before, .konc *::after {
            animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important;
          }
        }
        @media (max-width: 480px) {
          .konc-panel { width: min(340px, calc(100vw - 24px)); }
        }
      `}</style>
    </div>
  );
}
