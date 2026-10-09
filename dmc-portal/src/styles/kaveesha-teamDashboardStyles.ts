import { Colors } from "../constants/theme";

/**
 * Styles for the rescue team leader dashboard. Every class is namespaced with
 * tdash- so this page can sit beside the other portal dashboards without
 * leaking rules.
 */
export const TDASH_CSS = `
  .tdash-app {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    background: ${Colors.background};
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: ${Colors.text};
  }

  .tdash-sidebar {
    width: 268px;
    flex-shrink: 0;
    background: ${Colors.navy};
    padding: 26px 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .tdash-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .tdash-brand-mark {
    width: 42px;
    height: 42px;
    border-radius: 13px;
    background: ${Colors.blue};
    color: ${Colors.white};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .tdash-brand-name {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: ${Colors.white};
  }

  .tdash-brand-name span { color: ${Colors.amber}; }

  .tdash-brand-sub {
    color: ${Colors.blueLight};
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.11em;
    margin-top: 3px;
  }

  .tdash-team-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: ${Colors.blueLight};
  }

  .tdash-team-name {
    color: ${Colors.white};
    font-size: 13px;
    font-weight: 800;
    line-height: 1.35;
  }

  .tdash-team-meta {
    color: ${Colors.blueLight};
    font-size: 11.5px;
    margin-top: 2px;
  }

  .tdash-nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .tdash-nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    text-align: left;
    transition: background 160ms ease, color 160ms ease;
  }

  .tdash-nav-item svg:last-child {
    margin-left: auto;
    opacity: 0;
    transition: opacity 160ms ease;
  }

  .tdash-nav-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: ${Colors.white};
  }

  .tdash-nav-item-active {
    background: ${Colors.blue};
    color: ${Colors.white};
  }

  .tdash-nav-item-active svg:last-child { opacity: 1; }

  .tdash-sidebar-foot {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }

  .tdash-leader {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .tdash-avatar {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: ${Colors.navyLight};
    color: ${Colors.white};
    font-size: 13px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .tdash-leader-name {
    color: ${Colors.white};
    font-size: 13px;
    font-weight: 800;
  }

  .tdash-leader-role {
    color: ${Colors.blueLight};
    font-size: 11.5px;
    margin-top: 2px;
  }

  .tdash-logout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 14px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    color: ${Colors.white};
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: background 160ms ease;
  }

  .tdash-logout:hover { background: rgba(217, 45, 32, 0.85); }

  .tdash-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .tdash-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 26px clamp(20px, 3vw, 34px) 22px;
    background: ${Colors.white};
    border-bottom: 1px solid ${Colors.border};
  }

  .tdash-topbar h1 {
    font-size: 21px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: ${Colors.navy};
    margin: 0 0 5px;
  }

  .tdash-topbar p {
    font-size: 13px;
    color: ${Colors.muted};
    margin: 0;
  }

  .tdash-refresh {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: 1px solid ${Colors.border};
    border-radius: 11px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease;
    flex-shrink: 0;
  }

  .tdash-refresh:hover {
    border-color: ${Colors.blue};
    color: ${Colors.blue};
  }

  .tdash-body {
    flex: 1;
    padding: clamp(18px, 3vw, 26px) clamp(20px, 3vw, 34px) 48px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .tdash-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    border-radius: 14px;
    background: rgba(18, 183, 106, 0.12);
    border: 1px solid ${Colors.success};
    color: #067647;
    font-size: 13px;
    font-weight: 700;
  }

  .tdash-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 0;
    color: ${Colors.muted};
    font-size: 14px;
    font-weight: 600;
  }

  .tdash-spin { animation: tdash-turn 900ms linear infinite; }

  @keyframes tdash-turn {
    to { transform: rotate(360deg); }
  }

  .tdash-error {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 18px 20px;
    border-radius: 16px;
    background: ${Colors.redLight};
    border: 1px solid ${Colors.red};
    color: ${Colors.redDark};
  }

  .tdash-error h3 {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 800;
  }

  .tdash-error p {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.6;
  }

  .tdash-error-action {
    margin-left: auto;
    align-self: center;
    padding: 9px 14px;
    border: 1px solid ${Colors.red};
    border-radius: 10px;
    background: ${Colors.white};
    color: ${Colors.redDark};
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .tdash-hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    padding: clamp(22px, 3vw, 28px);
    border-radius: 20px;
    background: linear-gradient(135deg, ${Colors.navy} 0%, ${Colors.navyLight} 100%);
    box-shadow: 0 16px 40px rgba(11, 31, 51, 0.18);
  }

  .tdash-hero-text { min-width: 0; }

  .tdash-hero h2 {
    font-size: clamp(20px, 2.6vw, 26px);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: ${Colors.white};
    margin: 14px 0 8px;
  }

  .tdash-hero p {
    font-size: 13.5px;
    line-height: 1.65;
    color: ${Colors.blueLight};
    margin: 0;
    max-width: 620px;
  }

  .tdash-hero p strong { color: ${Colors.white}; }

  .tdash-hero-facts {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }

  .tdash-fact {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: ${Colors.white};
    font-size: 12px;
    font-weight: 700;
  }

  .tdash-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 13px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .tdash-pill-success { background: rgba(18, 183, 106, 0.16); color: #067647; }
  .tdash-pill-warning { background: ${Colors.amberLight}; color: ${Colors.amberText}; }
  .tdash-pill-danger { background: ${Colors.redLight}; color: ${Colors.redDark}; }
  .tdash-pill-neutral { background: ${Colors.background}; color: ${Colors.muted}; }

  .tdash-hero .tdash-pill-success {
    background: rgba(18, 183, 106, 0.22);
    color: #7EE2B8;
  }

  .tdash-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 16px;
  }

  .tdash-stat {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 10px 26px rgba(11, 31, 51, 0.06);
    transition: transform 180ms ease, box-shadow 180ms ease;
  }

  .tdash-stat:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 34px rgba(11, 31, 51, 0.1);
  }

  .tdash-stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }

  .tdash-stat-icon-blue { background: ${Colors.blueLight}; color: ${Colors.blue}; }
  .tdash-stat-icon-success { background: rgba(18, 183, 106, 0.14); color: ${Colors.success}; }
  .tdash-stat-icon-amber { background: ${Colors.amberLight}; color: ${Colors.amber}; }
  .tdash-stat-icon-navy { background: rgba(11, 31, 51, 0.09); color: ${Colors.navy}; }

  .tdash-stat-value {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: ${Colors.navy};
    line-height: 1.1;
  }

  .tdash-stat-label {
    font-size: 13px;
    font-weight: 800;
    color: ${Colors.navy};
    margin-top: 6px;
  }

  .tdash-stat-caption {
    font-size: 11.5px;
    color: ${Colors.muted};
    margin-top: 4px;
    line-height: 1.5;
  }

  .tdash-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 20px;
  }

  .tdash-card {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-radius: 20px;
    padding: clamp(20px, 2.6vw, 26px);
    box-shadow: 0 10px 26px rgba(11, 31, 51, 0.06);
  }

  .tdash-card-head {
    padding-bottom: 16px;
    margin-bottom: 6px;
    border-bottom: 1px solid ${Colors.background};
  }

  .tdash-card-head h3 {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${Colors.navy};
    margin: 0 0 5px;
  }

  .tdash-card-head p {
    font-size: 12.5px;
    color: ${Colors.muted};
    margin: 0;
    line-height: 1.55;
  }

  .tdash-rows { padding-top: 6px; }

  .tdash-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 13px 0;
    border-bottom: 1px solid ${Colors.background};
  }

  .tdash-row:last-child { border-bottom: none; }

  .tdash-row-label {
    font-size: 12.5px;
    font-weight: 700;
    color: ${Colors.muted};
  }

  .tdash-row-value {
    font-size: 13px;
    font-weight: 800;
    color: ${Colors.navy};
    text-align: right;
    word-break: break-word;
  }

  .tdash-detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
    padding-top: 16px;
  }

  .tdash-detail {
    padding: 16px;
    border-radius: 14px;
    border: 1px solid ${Colors.background};
    background: ${Colors.background};
  }

  .tdash-detail-wide { grid-column: 1 / -1; }

  .tdash-detail-icon {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.blue};
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
  }

  .tdash-detail-label {
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .tdash-detail-value {
    font-size: 14px;
    font-weight: 800;
    color: ${Colors.navy};
    margin-top: 6px;
    line-height: 1.5;
    word-break: break-word;
  }

  .tdash-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 14px;
  }

  .tdash-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 13px;
    border-radius: 999px;
    background: ${Colors.navy};
    color: ${Colors.white};
    font-size: 11.5px;
    font-weight: 700;
  }

  .tdash-chip-soft {
    background: ${Colors.blueLight};
    color: ${Colors.blueDark};
  }

  .tdash-reject {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 18px 20px;
    border-radius: 16px;
    background: ${Colors.redLight};
    border: 1px solid ${Colors.red};
  }

  .tdash-reject svg { flex-shrink: 0; color: ${Colors.redDark}; margin-top: 2px; }

  .tdash-reject strong {
    display: block;
    color: ${Colors.redDark};
    font-size: 13px;
    font-weight: 800;
    margin-bottom: 5px;
  }

  .tdash-reject p {
    margin: 0;
    color: ${Colors.redDark};
    font-size: 12.5px;
    line-height: 1.65;
  }

  .tdash-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  .tdash-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 18px;
    border: none;
    border-radius: 12px;
    background: ${Colors.blue};
    color: ${Colors.white};
    font-family: inherit;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 10px 24px rgba(21, 112, 239, 0.24);
    transition: background 160ms ease, transform 160ms ease;
  }

  .tdash-button:hover:not(:disabled) {
    background: ${Colors.blueDark};
    transform: translateY(-1px);
  }

  .tdash-button-ghost {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.navy};
    box-shadow: none;
  }

  .tdash-button-ghost:hover:not(:disabled) {
    border-color: ${Colors.blue};
    color: ${Colors.blue};
    background: ${Colors.white};
  }

  .tdash-button-on {
    background: ${Colors.success};
  }

  .tdash-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }

  .tdash-form-note {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 16px 18px;
    border-radius: 16px;
    background: ${Colors.amberLight};
    border: 1px solid ${Colors.amber};
    color: ${Colors.amberText};
    font-size: 12px;
    line-height: 1.6;
    margin-bottom: 18px;
  }

  .tdash-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-top: 14px;
    color: ${Colors.blueDark};
    font-size: 12.5px;
    font-weight: 800;
    text-decoration: none;
  }

  .tdash-link:hover { text-decoration: underline; }

  @media (max-width: 1024px) {
    .tdash-app { flex-direction: column; }
    .tdash-sidebar { width: 100%; padding: 20px; }
    .tdash-nav { flex-direction: row; overflow-x: auto; }
    .tdash-nav-item { white-space: nowrap; }
    .tdash-nav-item svg:last-child { display: none; }
    .tdash-sidebar-foot { flex-direction: row; align-items: center; justify-content: space-between; }
  }

  @media (max-width: 640px) {
    .tdash-hero-facts { width: 100%; }
    .tdash-topbar { padding: 20px; }
    .tdash-stats { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
  }
`;
