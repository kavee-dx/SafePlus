import { Colors } from "../constants/theme";

/**
 * The dashboard's visual system. Kept out of the page file the same way the
 * registration form keeps its CSS, so the layout can be tuned without wading
 * through JSX. Light mode is forced: the scaffold `index.css` still flips its
 * CSS variables on `prefers-color-scheme: dark`, which would wash out text.
 */
const Hairline = "#EAECF0";
const Divider = "#F2F4F7";
const Surface = "#F9FAFB";
const Green = Colors.success;
const GreenTint = "#DCFCE7";
const GreenText = "#166534";
const RedTint = "#FEF3F2";
const ShadowCard = "0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.06)";
const ShadowRaised = "0 4px 12px rgba(16, 24, 40, 0.09), 0 2px 4px rgba(16, 24, 40, 0.05)";
const FocusRing = "0 0 0 3px rgba(217, 45, 32, 0.16)";
const Mono =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

export const DASHBOARD_STYLES = `
  .dmc-dashboard {
    display: flex;
    min-height: 100vh;
    min-height: 100dvh;
    background: ${Colors.background};
    color: ${Colors.text};
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
    background: ${Colors.redLight};
    color: ${Colors.redDark};
  }

  .dmc-sidebar {
    width: 272px;
    background: linear-gradient(180deg, #0a1c2f 0%, ${Colors.navy} 42%, #0d2438 100%);
    color: ${Colors.white};
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
    background: linear-gradient(160deg, ${Colors.red} 0%, ${Colors.redDark} 100%);
    color: ${Colors.white};
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
    color: ${Colors.white};
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
    color: ${Colors.white};
  }

  .dmc-nav-item:hover svg {
    opacity: 1;
  }

  .dmc-nav-item-active {
    background: linear-gradient(90deg, rgba(217, 45, 32, 0.28) 0%, rgba(217, 45, 32, 0.06) 100%);
    color: ${Colors.white};
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
    background: ${Colors.red};
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
    background: linear-gradient(160deg, ${Colors.navyLight} 0%, #1b4a6b 100%);
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
    color: ${Colors.white};
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
    color: ${Colors.white};
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
    background: rgba(255, 255, 255, 0.92);
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
    color: ${Colors.text};
    margin: 0 0 4px;
  }

  .dmc-header-title p {
    font-size: 13px;
    font-weight: 500;
    color: ${Colors.muted};
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
    background: ${Colors.navy};
    color: ${Colors.white};
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
    background: ${Colors.red};
    border-color: ${Colors.redDark};
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
    background: ${Colors.white};
    border: 1px solid ${Hairline};
    box-shadow: ${ShadowCard};
    color: ${Colors.muted};
    font-size: 13px;
    font-weight: 600;
  }

  .dmc-loading svg {
    color: ${Colors.red};
  }

  .dmc-error-card {
    border-color: #fda29b;
    background: ${RedTint};
    color: ${Colors.redDark};
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
    background: ${Colors.white};
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
    background: ${Colors.border};
  }

  .dmc-stat-card-active::before {
    background: linear-gradient(180deg, ${Colors.red} 0%, ${Colors.redDark} 100%);
  }

  .dmc-stat-card-warning::before {
    background: linear-gradient(180deg, ${Colors.amber} 0%, #b54708 100%);
  }

  .dmc-stat-card-info::before {
    background: linear-gradient(180deg, ${Colors.blue} 0%, ${Colors.blueDark} 100%);
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
    background: ${Colors.redLight};
    color: ${Colors.redDark};
    border-color: #fecaaf;
  }

  .dmc-stat-card-success .dmc-stat-icon {
    background: ${GreenTint};
    color: ${GreenText};
    border-color: #a7f3c0;
  }

  .dmc-stat-card-info .dmc-stat-icon {
    background: ${Colors.blueLight};
    color: ${Colors.blueDark};
    border-color: #b5d8fb;
  }

  .dmc-stat-card-warning .dmc-stat-icon {
    background: ${Colors.amberLight};
    color: ${Colors.amberText};
    border-color: #fdcf5f;
  }

  .dmc-stat-content {
    min-width: 0;
  }

  .dmc-stat-value {
    font-size: 28px;
    line-height: 1.1;
    font-weight: 800;
    color: ${Colors.text};
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  .dmc-stat-label {
    font-size: 12px;
    color: ${Colors.muted};
    font-weight: 600;
    margin-top: 5px;
    line-height: 1.35;
  }

  .dmc-columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 18px;
    align-items: start;
  }

  .dmc-panel {
    background: ${Colors.white};
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
    color: ${Colors.text};
    border-bottom: 1px solid ${Divider};
  }

  .dmc-empty {
    margin: 0;
    padding: 18px;
    border: 1px dashed ${Colors.border};
    border-radius: 12px;
    background: ${Surface};
    font-size: 13px;
    color: ${Colors.muted};
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
    background: ${Colors.white};
    border-color: ${Colors.border};
    box-shadow: ${ShadowCard};
  }

  .dmc-action-row h3 {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Colors.text};
  }

  .dmc-action-row p {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    color: ${Colors.muted};
  }

  .dmc-action-button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 38px;
    padding: 0 15px;
    border: 1px solid ${Colors.border};
    border-radius: 10px;
    background: ${Colors.white};
    color: ${Colors.text};
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
    border-color: ${Colors.navy};
    color: ${Colors.navy};
    box-shadow: ${ShadowCard};
  }

  .dmc-action-button:active:not(:disabled) {
    transform: translateY(1px);
  }

  .dmc-action-button:focus-visible {
    outline: none;
    border-color: ${Colors.red};
    box-shadow: ${FocusRing};
  }

  .dmc-action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dmc-action-button-primary {
    background: ${Colors.red};
    border-color: ${Colors.red};
    color: ${Colors.white};
    box-shadow: 0 1px 3px rgba(217, 45, 32, 0.32);
  }

  .dmc-action-button-primary:hover:not(:disabled) {
    background: ${Colors.redDark};
    border-color: ${Colors.redDark};
    color: ${Colors.white};
    box-shadow: 0 4px 12px -4px rgba(180, 35, 24, 0.5);
  }

  .dmc-action-button-standdown,
  .dmc-action-button-delete {
    color: ${Colors.redDark};
    border-color: #fda29b;
    background: ${RedTint};
  }

  .dmc-action-button-standdown:hover:not(:disabled),
  .dmc-action-button-delete:hover:not(:disabled) {
    background: ${Colors.redLight};
    border-color: ${Colors.red};
    color: ${Colors.redDark};
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
    color: ${Colors.text};
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
    box-shadow: inset 0 1px 2px rgba(16, 24, 40, 0.06);
    overflow: hidden;
  }

  .dmc-coverage-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, ${Colors.blue} 0%, ${Colors.blueDark} 100%);
    transition: width 520ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .dmc-coverage-count {
    text-align: right;
    color: ${Colors.muted};
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
    background: ${Colors.white};
    border: 1px solid ${Hairline};
    display: flex;
    align-items: center;
    gap: 14px;
    overflow: hidden;
    transition: box-shadow 160ms ease, border-color 160ms ease;
  }

  .dmc-alert-item:hover {
    border-color: ${Colors.border};
    box-shadow: ${ShadowCard};
  }

  .dmc-alert-item::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${Colors.border};
  }

  .dmc-alert-item.dmc-alert-critical::before {
    background: ${Colors.red};
  }

  .dmc-alert-item.dmc-alert-high::before {
    background: ${Colors.amber};
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
    background: ${Colors.redLight};
    color: ${Colors.redDark};
    border-color: #fda29b;
  }

  .dmc-alert-item.dmc-alert-high .dmc-alert-status,
  .dmc-history-row.dmc-alert-high .dmc-alert-status {
    background: ${Colors.amberLight};
    color: ${Colors.amberText};
    border-color: #fdcf5f;
  }

  .dmc-alert-item.dmc-alert-medium .dmc-alert-status,
  .dmc-history-row.dmc-alert-medium .dmc-alert-status {
    background: ${GreenTint};
    color: ${GreenText};
    border-color: #a7f3c0;
  }

  .dmc-alert-details {
    flex: 1;
    min-width: 0;
  }

  .dmc-alert-title {
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: ${Colors.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dmc-alert-time {
    font-size: 11.5px;
    font-weight: 600;
    color: ${Colors.muted};
    white-space: nowrap;
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
    color: ${Colors.muted};
  }

  .dmc-history-card {
    background: ${Colors.white};
    border: 1px solid ${Hairline};
    border-radius: 16px;
    box-shadow: ${ShadowCard};
    overflow: hidden;
    transition: box-shadow 180ms ease, border-color 180ms ease;
  }

  .dmc-history-card:hover {
    border-color: ${Colors.border};
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
    background: ${Colors.border};
  }

  .dmc-history-row.dmc-alert-critical::before {
    background: ${Colors.red};
  }

  .dmc-history-row.dmc-alert-high::before {
    background: ${Colors.amber};
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
    background: ${Colors.white};
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
    color: ${Colors.muted};
  }

  .dmc-detail-block p {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: ${Colors.text};
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
    border-left: 3px solid ${Colors.border};
    background: ${Surface};
    color: ${Colors.text};
    font-size: 13px;
    font-weight: 600;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .dmc-language-en .dmc-message {
    border-left-color: ${Colors.blue};
  }

  .dmc-language-si .dmc-message {
    border-left-color: ${Colors.amber};
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
    color: ${Colors.muted};
  }

  .dmc-extend-row select,
  .dmc-pin-input {
    height: 38px;
    padding: 0 12px;
    border: 1px solid ${Colors.border};
    border-radius: 10px;
    background: ${Colors.white};
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: ${Colors.text};
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
    border-color: ${Colors.red};
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
    color: ${Colors.navy};
  }

  .dmc-log-error {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    color: ${Colors.redDark};
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
    color: ${Colors.muted};
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
