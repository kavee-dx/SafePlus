import { Console, ConsoleTokens as T } from "./dushani-consoleTheme";

/**
 * The dashboard's visual system. Kept out of the page file the same way the
 * registration form keeps its CSS, so the layout can be tuned without wading
 * through JSX. The palette follows the group 30 wireframes: a dark navy
 * console with one lighter step per elevation.
 */
const Hairline = T.Hairline;
const Divider = T.Divider;
const Surface = T.SurfaceAlt;
const Card = Console.surface;
const Ink = Console.ink;
const InkDim = Console.inkDim;
const White = "#FFFFFF";
const Line = Console.line;
const Green = Console.green;
const GreenTint = Console.greenTint;
const GreenText = Console.greenInk;
const RedTint = Console.redTint;
const RedText = Console.redInk;
const ShadowCard = T.ShadowCard;
const ShadowRaised = T.ShadowRaised;
const FocusRing = T.FocusRing;
const Mono = T.Mono;

export const DASHBOARD_STYLES = `
  .dmc-dashboard {
    display: flex;
    min-height: 100vh;
    min-height: 100dvh;
    background: ${Console.bg};
    color: ${Ink};
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.5;
    text-align: left;
    color-scheme: light;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .dmc-dashboard *,
  .dmc-dashboard *::before,
  .dmc-dashboard *::after {
    box-sizing: border-box;
  }

  .dmc-dashboard ::selection {
    background: ${RedTint};
    color: ${RedText};
  }

  .dmc-sidebar {
    width: 272px;
    background: linear-gradient(180deg, #0a1c2f 0%, ${Console.bgDeep} 42%, #0d2438 100%);
    color: ${White};
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    transition: width 240ms ease;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 4px 0 24px -12px rgba(16, 24, 40, 0.4);
    z-index: 30;
  }

  .dmc-sidebar-closed {
    width: 76px;
  }

  .dmc-sidebar-header {
    padding: 20px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 82px;
  }

  .dmc-sidebar-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .dmc-sidebar-brand-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: linear-gradient(160deg, ${Console.red} 0%, ${RedText} 100%);
    color: ${White};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 6px 16px -6px rgba(217, 45, 32, 0.7);
  }

  .dmc-sidebar-brand-name {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .dmc-sidebar-brand-name span {
    color: #f97066;
  }

  .dmc-sidebar-brand-subtitle {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #7f8fa3;
    margin-top: 3px;
  }

  .dmc-sidebar-toggle {
    width: 32px;
    height: 32px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
    color: #cbd5e1;
    border-radius: 9px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 140ms ease, color 140ms ease;
  }

  .dmc-sidebar-toggle:hover {
    background: rgba(255, 255, 255, 0.14);
    color: ${White};
  }

  .dmc-sidebar-toggle:focus-visible,
  .dmc-nav-item:focus-visible,
  .dmc-logout-button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(249, 115, 102, 0.45);
  }

  .dmc-sidebar-nav {
    flex: 1;
    padding: 16px 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    overflow-y: auto;
  }

  .dmc-sidebar-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: #64748b;
    padding: 8px 14px 10px;
  }

  .dmc-nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 42px;
    padding: 10px 14px;
    border: none;
    background: transparent;
    color: #a7b4c4;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    transition: background 140ms ease, color 140ms ease;
  }

  .dmc-nav-item svg {
    flex-shrink: 0;
    opacity: 0.8;
  }

  .dmc-nav-item:hover {
    background: rgba(255, 255, 255, 0.07);
    color: ${White};
  }

  .dmc-nav-item:hover svg {
    opacity: 1;
  }

  .dmc-nav-item-active {
    background: linear-gradient(90deg, rgba(217, 45, 32, 0.28) 0%, rgba(217, 45, 32, 0.06) 100%);
    color: ${White};
    font-weight: 700;
  }

  .dmc-nav-item-active svg {
    opacity: 1;
    color: #f97066;
  }

  .dmc-nav-item-active::before {
    content: "";
    position: absolute;
    left: -12px;
    top: 10px;
    bottom: 10px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: ${Console.red};
  }

  .dmc-sidebar-closed .dmc-nav-item span,
  .dmc-sidebar-closed .dmc-sidebar-brand-name,
  .dmc-sidebar-closed .dmc-sidebar-brand-subtitle,
  .dmc-sidebar-closed .dmc-sidebar-label,
  .dmc-sidebar-closed .dmc-officer-details,
  .dmc-sidebar-closed .dmc-logout-button span {
    display: none;
  }

  .dmc-sidebar-closed .dmc-nav-item,
  .dmc-sidebar-closed .dmc-logout-button {
    justify-content: center;
    padding: 10px;
  }

  .dmc-sidebar-footer {
    padding: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .dmc-officer-info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .dmc-officer-avatar {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: linear-gradient(160deg, ${Console.blue} 0%, #1b4a6b 100%);
    border: 1px solid rgba(255, 255, 255, 0.16);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .dmc-officer-name {
    font-size: 13px;
    font-weight: 700;
    color: ${White};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dmc-officer-role {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #7f8fa3;
    margin-top: 3px;
    text-transform: uppercase;
  }

  .dmc-logout-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 10px 14px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: transparent;
    color: #fda29b;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    border-radius: 10px;
    cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
  }

  .dmc-logout-button:hover {
    background: rgba(217, 45, 32, 0.18);
    border-color: rgba(217, 45, 32, 0.7);
    color: ${White};
  }

  .dmc-main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .dmc-content-header {
    position: sticky;
    top: 0;
    z-index: 20;
    padding: 18px 32px;
    background: rgba(5, 13, 26, 0.88);
    backdrop-filter: saturate(180%) blur(10px);
    border-bottom: 1px solid ${Hairline};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .dmc-header-title h1 {
    font-size: 21px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${Ink};
    margin: 0 0 4px;
  }

  .dmc-header-title p {
    font-size: 13px;
    font-weight: 500;
    color: ${InkDim};
    margin: 0;
  }

  .dmc-header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .dmc-profile-button {
    width: 40px;
    height: 40px;
    border: 2px solid transparent;
    border-radius: 12px;
    background: ${Console.surfaceAlt};
    border-color: ${Console.line};
    color: ${Console.ink};
    font-family: inherit;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: ${ShadowCard};
    transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
  }

  .dmc-profile-button:hover {
    transform: translateY(-1px);
  }

  .dmc-profile-button:hover,
  .dmc-profile-button-active {
    background: ${Console.red};
    border-color: ${RedText};
  }

  .dmc-profile-button:focus-visible {
    outline: none;
    box-shadow: ${FocusRing};
  }

  .dmc-content-body {
    flex: 1;
    padding: 26px 32px 44px;
    overflow-y: auto;
    width: 100%;
    max-width: 1280px;
    margin: 0 auto;
  }

  .dmc-loading,
  .dmc-error-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    border-radius: 14px;
    background: ${Card};
    border: 1px solid ${Hairline};
    box-shadow: ${ShadowCard};
    color: ${InkDim};
    font-size: 13px;
    font-weight: 600;
  }

  .dmc-loading svg {
    color: ${Console.red};
  }

  .dmc-error-card {
    border-color: var(--sp-red-line, #5F1D22);
    background: ${RedTint};
    color: ${RedText};
    gap: 14px;
  }

  .dmc-error-card h3 {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .dmc-error-card p {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.5;
  }

  .dmc-spin {
    animation: dmc-spin 900ms linear infinite;
  }

  @keyframes dmc-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dmc-dashboard *,
    .dmc-dashboard *::before,
    .dmc-dashboard *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  @media (max-width: 1024px) {
    .dmc-sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 100;
    }

    .dmc-sidebar-closed {
      left: -280px;
      width: 272px;
    }

    .dmc-content-header {
      padding: 16px 20px;
    }

    .dmc-content-body {
      padding: 20px 18px 36px;
    }
  }
`;

export const OVERVIEW_STYLES = `
  .dmc-overview {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .dmc-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }

  .dmc-stat-card {
    position: relative;
    padding: 20px 22px;
    border-radius: 16px;
    background: ${Card};
    border: 1px solid ${Hairline};
    box-shadow: ${ShadowCard};
    display: flex;
    align-items: center;
    gap: 16px;
    overflow: hidden;
    transition: transform 180ms ease, box-shadow 180ms ease;
  }

  .dmc-stat-card:hover {
    transform: translateY(-2px);
    box-shadow: ${ShadowRaised};
  }

  .dmc-stat-card::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: ${Line};
  }

  .dmc-stat-card-active::before {
    background: linear-gradient(180deg, ${Console.red} 0%, ${RedText} 100%);
  }

  .dmc-stat-card-warning::before {
    background: linear-gradient(180deg, ${Console.amber} 0%, #B45309 100%);
  }

  .dmc-stat-card-info::before {
    background: linear-gradient(180deg, ${Console.blue} 0%, ${Console.blueInk} 100%);
  }

  .dmc-stat-card-success::before {
    background: linear-gradient(180deg, ${Green} 0%, ${GreenText} 100%);
  }

  .dmc-stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid transparent;
  }

  .dmc-stat-card-active .dmc-stat-icon {
    background: ${RedTint};
    color: ${RedText};
    border-color: #5F3A1D;
  }

  .dmc-stat-card-success .dmc-stat-icon {
    background: ${GreenTint};
    color: ${GreenText};
    border-color: var(--sp-green-line, #174E2E);
  }

  .dmc-stat-card-info .dmc-stat-icon {
    background: ${Console.blueTint};
    color: ${Console.blueInk};
    border-color: var(--sp-blue-line, #1E3A66);
  }

  .dmc-stat-card-warning .dmc-stat-icon {
    background: ${Console.amberTint};
    color: ${Console.amberInk};
    border-color: var(--sp-amber-line, #5C4310);
  }

  .dmc-stat-content {
    min-width: 0;
  }

  .dmc-stat-value {
    font-family: ${Mono};
    font-size: 27px;
    line-height: 1.1;
    font-weight: 700;
    color: ${Ink};
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .dmc-stat-label {
    font-size: 11px;
    color: ${Console.inkFaint};
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    margin-top: 6px;
    line-height: 1.35;
  }

  .dmc-columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 18px;
    align-items: start;
  }

  .dmc-panel {
    background: ${Card};
    border: 1px solid ${Hairline};
    border-radius: 16px;
    padding: 22px 24px;
    box-shadow: ${ShadowCard};
  }

  .dmc-panel h2 {
    margin: 0 0 16px;
    padding: 0 0 12px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Ink};
    border-bottom: 1px solid ${Divider};
  }

  .dmc-empty {
    margin: 0;
    padding: 18px;
    border: 1px dashed ${Line};
    border-radius: 12px;
    background: ${Surface};
    font-size: 13px;
    color: ${InkDim};
    line-height: 1.6;
  }

  .dmc-action-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .dmc-action-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid ${Hairline};
    border-radius: 12px;
    background: ${Surface};
    transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .dmc-action-row:hover {
    background: ${Card};
    border-color: ${Line};
    box-shadow: ${ShadowCard};
  }

  .dmc-action-row h3 {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Ink};
  }

  .dmc-action-row p {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    color: ${InkDim};
  }

  .dmc-action-button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 38px;
    padding: 0 15px;
    border: 1px solid ${Line};
    border-radius: 10px;
    background: ${Card};
    color: ${Ink};
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    transition: background 140ms ease, border-color 140ms ease, color 140ms ease,
      transform 140ms ease, box-shadow 140ms ease;
  }

  .dmc-action-button:hover:not(:disabled) {
    border-color: ${Console.blueSoft};
    color: ${Console.blueInk};
    box-shadow: ${ShadowCard};
  }

  .dmc-action-button:active:not(:disabled) {
    transform: translateY(1px);
  }

  .dmc-action-button:focus-visible {
    outline: none;
    border-color: ${Console.red};
    box-shadow: ${FocusRing};
  }

  .dmc-action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dmc-action-button-primary {
    background: ${Console.red};
    border-color: ${Console.red};
    color: ${White};
    box-shadow: 0 1px 3px rgba(217, 45, 32, 0.32);
  }

  .dmc-action-button-primary:hover:not(:disabled) {
    background: ${RedText};
    border-color: ${RedText};
    color: ${White};
    box-shadow: 0 4px 12px -4px rgba(180, 35, 24, 0.5);
  }

  .dmc-action-button-standdown,
  .dmc-action-button-delete {
    color: ${RedText};
    border-color: var(--sp-red-line, #5F1D22);
    background: ${RedTint};
  }

  .dmc-action-button-standdown:hover:not(:disabled),
  .dmc-action-button-delete:hover:not(:disabled) {
    background: ${RedTint};
    border-color: ${Console.red};
    color: ${RedText};
  }

  .dmc-coverage-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .dmc-coverage-row {
    display: grid;
    grid-template-columns: 150px 1fr 96px;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border-radius: 10px;
    font-size: 12px;
    color: ${Ink};
    transition: background 140ms ease;
  }

  .dmc-coverage-row:hover {
    background: ${Surface};
  }

  .dmc-coverage-name {
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dmc-coverage-bar {
    height: 8px;
    border-radius: 999px;
    background: ${Divider};
    box-shadow: inset 0 1px 2px rgba(2, 8, 20, 0.6);
    overflow: hidden;
  }

  .dmc-coverage-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, ${Console.blue} 0%, ${Console.blueInk} 100%);
    transition: width 520ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .dmc-coverage-count {
    text-align: right;
    color: ${InkDim};
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .dmc-alert-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .dmc-alert-item {
    position: relative;
    padding: 14px 16px 14px 18px;
    border-radius: 14px;
    background: ${Card};
    border: 1px solid ${Hairline};
    display: flex;
    align-items: center;
    gap: 14px;
    overflow: hidden;
    transition: box-shadow 160ms ease, border-color 160ms ease;
  }

  .dmc-alert-item:hover {
    border-color: ${Line};
    box-shadow: ${ShadowCard};
  }

  .dmc-alert-item::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${Line};
  }

  .dmc-alert-item.dmc-alert-critical::before {
    background: ${Console.red};
  }

  .dmc-alert-item.dmc-alert-high::before {
    background: ${Console.amber};
  }

  .dmc-alert-item.dmc-alert-medium::before {
    background: ${Green};
  }

  .dmc-alert-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
    border: 1px solid transparent;
  }

  .dmc-alert-status::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .dmc-alert-item.dmc-alert-critical .dmc-alert-status,
  .dmc-history-row.dmc-alert-critical .dmc-alert-status {
    background: ${RedTint};
    color: ${RedText};
    border-color: var(--sp-red-line, #5F1D22);
  }

  .dmc-alert-item.dmc-alert-high .dmc-alert-status,
  .dmc-history-row.dmc-alert-high .dmc-alert-status {
    background: ${Console.amberTint};
    color: ${Console.amberInk};
    border-color: var(--sp-amber-line, #5C4310);
  }

  .dmc-alert-item.dmc-alert-medium .dmc-alert-status,
  .dmc-history-row.dmc-alert-medium .dmc-alert-status {
    background: ${GreenTint};
    color: ${GreenText};
    border-color: var(--sp-green-line, #174E2E);
  }

  .dmc-alert-details {
    flex: 1;
    min-width: 0;
  }

  .dmc-alert-title {
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: ${Ink};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dmc-alert-time {
    font-family: ${Mono};
    font-size: 11.5px;
    font-weight: 600;
    color: ${Console.cyan};
    white-space: nowrap;
  }

  .dmc-draft-list {
    margin-top: 14px;
  }

  @media (max-width: 720px) {
    .dmc-coverage-row {
      grid-template-columns: 110px 1fr 80px;
    }

    .dmc-alert-item,
    .dmc-action-row {
      flex-wrap: wrap;
    }

    .dmc-alert-time {
      width: 100%;
    }
  }
`;

export const HISTORY_STYLES = `
  .dmc-history {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .dmc-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    padding: 4px 2px;
  }

  .dmc-muted {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: ${InkDim};
  }

  .dmc-history-card {
    background: ${Card};
    border: 1px solid ${Hairline};
    border-radius: 16px;
    box-shadow: ${ShadowCard};
    overflow: hidden;
    transition: box-shadow 180ms ease, border-color 180ms ease;
  }

  .dmc-history-card:hover {
    border-color: ${Line};
    box-shadow: ${ShadowRaised};
  }

  .dmc-history-row {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    border: none;
    background: transparent;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 140ms ease;
  }

  .dmc-history-row::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${Line};
  }

  .dmc-history-row.dmc-alert-critical::before {
    background: ${Console.red};
  }

  .dmc-history-row.dmc-alert-high::before {
    background: ${Console.amber};
  }

  .dmc-history-row.dmc-alert-medium::before {
    background: ${Green};
  }

  .dmc-history-row:hover {
    background: ${Surface};
  }

  .dmc-history-row:focus-visible {
    outline: none;
    box-shadow: ${FocusRing};
  }

  .dmc-history-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
  }

  .dmc-history-detail {
    padding: 20px;
    border-top: 1px solid ${Divider};
    background: ${Surface};
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
    align-items: start;
  }

  .dmc-detail-wide {
    grid-column: 1 / -1;
  }

  .dmc-detail-block {
    background: ${Card};
    border: 1px solid ${Hairline};
    border-radius: 12px;
    padding: 14px 16px;
  }

  .dmc-detail-block h4 {
    margin: 0 0 8px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: ${InkDim};
  }

  .dmc-detail-block p {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: ${Ink};
    line-height: 1.6;
  }

  .dmc-language {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .dmc-language .dmc-message {
    margin: 0;
    padding: 10px 13px;
    border-radius: 0 10px 10px 0;
    border: 1px solid ${Hairline};
    border-left: 3px solid ${Line};
    background: ${Surface};
    color: ${Ink};
    font-size: 13px;
    font-weight: 600;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .dmc-language-en .dmc-message {
    border-left-color: ${Console.blue};
  }

  .dmc-language-si .dmc-message {
    border-left-color: ${Console.amber};
  }

  .dmc-language-ta .dmc-message {
    border-left-color: ${Green};
  }

  .dmc-extend-row {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .dmc-extend-row label {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: ${InkDim};
  }

  .dmc-extend-row select,
  .dmc-pin-input {
    height: 38px;
    padding: 0 12px;
    border: 1px solid ${Line};
    border-radius: 10px;
    background: ${Card};
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: ${Ink};
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }

  .dmc-pin-input {
    width: 130px;
    font-family: ${Mono};
    letter-spacing: 0.14em;
  }

  .dmc-extend-row select:focus-visible,
  .dmc-pin-input:focus-visible {
    outline: none;
    border-color: ${Console.red};
    box-shadow: ${FocusRing};
  }

  .dmc-log-channel {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${Console.blueInk};
  }

  .dmc-log-error {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    color: ${RedText};
    overflow-wrap: anywhere;
  }

  /* A channel caveat is guidance, so it never borrows the error colour. */
  .dmc-log-note,
  .dmc-log-channel .sp-facts {
    text-transform: none;
    letter-spacing: 0;
  }

  .dmc-log-note {
    font-size: 11px;
    font-weight: 600;
    line-height: 1.5;
    color: ${InkDim};
    overflow-wrap: anywhere;
  }

  .dmc-log-channel .sp-fact {
    gap: 6px;
  }

  .dmc-log-channel .sp-fact .sp-value {
    font-size: 11px;
    font-weight: 600;
    line-height: 1.5;
  }

  .dmc-detail-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  @media (max-width: 720px) {
    .dmc-history-row {
      flex-wrap: wrap;
    }

    .dmc-history-detail {
      grid-template-columns: 1fr;
      padding: 14px;
    }

    .dmc-detail-wide {
      grid-column: auto;
    }
  }
`;
