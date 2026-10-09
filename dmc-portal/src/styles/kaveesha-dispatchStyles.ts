import { Colors } from "../constants/theme";

/* ------------------------------------------------------------------ *
 * Dispatch board styling (prefix kdx-).
 *
 * Shared by the officer incident workspace, the mission board and the team
 * leader's assignment panel, so one look and one feel across the job.
 * ------------------------------------------------------------------ */

export const DISPATCH_CSS = `
  .kdx-stack { display: flex; flex-direction: column; gap: 18px; }

  .kdx-tabs {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px;
    border: 1px solid ${Colors.border};
    border-radius: 14px;
    background: ${Colors.white};
  }

  .kdx-tab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 16px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: ${Colors.muted};
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
    transition: background 160ms ease, color 160ms ease;
  }

  .kdx-tab:hover { color: ${Colors.navy}; background: ${Colors.background}; }

  .kdx-tab-on { background: ${Colors.navy}; color: ${Colors.white}; }
  .kdx-tab-on:hover { background: ${Colors.navyLight}; color: ${Colors.white}; }

  .kdx-tab-count {
    min-width: 20px;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    font-size: 11px;
    text-align: center;
  }

  .kdx-tab:not(.kdx-tab-on) .kdx-tab-count {
    background: ${Colors.background};
    border: 1px solid ${Colors.border};
  }

  .kdx-split {
    display: grid;
    grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }

  @media (max-width: 1080px) {
    .kdx-split { grid-template-columns: 1fr; }
  }

  .kdx-panel {
    border: 1px solid ${Colors.border};
    border-radius: 18px;
    background: ${Colors.white};
    overflow: hidden;
  }

  .kdx-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 14px 18px;
    border-bottom: 1px solid ${Colors.border};
    background: ${Colors.background};
  }

  .kdx-panel-title {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 13.5px;
    font-weight: 800;
    color: ${Colors.navy};
    letter-spacing: -0.01em;
  }

  .kdx-panel-title svg { color: ${Colors.blue}; }

  .kdx-panel-sub { font-size: 11.5px; color: ${Colors.muted}; font-weight: 600; }

  .kdx-panel-body { padding: 16px 18px; }

  .kdx-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    max-height: 720px;
    overflow-y: auto;
  }

  .kdx-incident {
    display: flex;
    gap: 13px;
    padding: 13px;
    border: 1px solid ${Colors.border};
    border-radius: 15px;
    background: ${Colors.white};
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }

  .kdx-incident:hover {
    border-color: ${Colors.blue};
    transform: translateY(-1px);
    box-shadow: 0 12px 26px rgba(21, 112, 239, 0.12);
  }

  .kdx-incident-on {
    border-color: ${Colors.navy};
    background: rgba(11, 31, 51, 0.03);
    box-shadow: 0 12px 26px rgba(11, 31, 51, 0.12);
  }

  .kdx-shot {
    position: relative;
    width: 78px;
    height: 78px;
    flex-shrink: 0;
    border-radius: 13px;
    overflow: hidden;
    background: ${Colors.background};
    border: 1px solid ${Colors.border};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${Colors.muted};
  }

  .kdx-shot img { width: 100%; height: 100%; object-fit: cover; display: block; }

  /* A tile with no picture behind it says so, rather than showing an empty box. */
  .kdx-shot-bare { color: ${Colors.border}; background: repeating-linear-gradient(135deg, ${Colors.background}, ${Colors.background} 8px, #fff 8px, #fff 16px); }

  .kdx-shot-count {
    position: absolute;
    right: 5px;
    bottom: 5px;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(8, 16, 32, 0.68);
    color: #fff;
    font-size: 9.5px;
    font-weight: 800;
  }

  .kdx-shot-live {
    position: relative;
  }

  .kdx-shot-live::after {
    content: "";
    position: absolute;
    top: 7px;
    right: 7px;
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: ${Colors.red};
    border: 2px solid ${Colors.white};
    animation: kdx-pulse 1600ms ease-in-out infinite;
  }

  @keyframes kdx-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.45; transform: scale(0.82); }
  }

  .kdx-incident-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }

  .kdx-incident-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 800;
    color: ${Colors.navy};
    line-height: 1.35;
  }

  .kdx-sev-dot {
    width: 9px;
    height: 9px;
    flex-shrink: 0;
    border-radius: 999px;
  }

  .kdx-incident-meta {
    font-size: 11px;
    font-weight: 700;
    color: ${Colors.muted};
    letter-spacing: 0.01em;
  }

  .kdx-incident-place {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 12px;
    color: ${Colors.text};
    line-height: 1.5;
  }

  .kdx-chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }

  .kdx-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid ${Colors.border};
    background: ${Colors.background};
    color: ${Colors.navy};
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.01em;
  }

  .kdx-chip-alert {
    background: ${Colors.redLight};
    border-color: ${Colors.red};
    color: ${Colors.redDark};
  }

  .kdx-chip-good {
    background: rgba(18, 183, 106, 0.1);
    border-color: ${Colors.success};
    color: #0A7A47;
  }

  .kdx-chip-info {
    background: ${Colors.blueLight};
    border-color: ${Colors.blue};
    color: ${Colors.blueDark};
  }

  .kdx-chip-warn {
    background: ${Colors.amberLight};
    border-color: ${Colors.amber};
    color: ${Colors.amberText};
  }

  .kdx-detail-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    padding-bottom: 12px;
    border-bottom: 1px solid ${Colors.border};
    margin-bottom: 14px;
  }

  .kdx-detail-name {
    font-size: 17px;
    font-weight: 800;
    color: ${Colors.navy};
    letter-spacing: -0.02em;
    line-height: 1.3;
  }

  .kdx-detail-sub { font-size: 12px; color: ${Colors.muted}; font-weight: 600; margin-top: 4px; }

  .kdx-facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  .kdx-fact {
    padding: 11px 13px;
    border: 1px solid ${Colors.border};
    border-radius: 13px;
    background: ${Colors.background};
  }

  .kdx-fact-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .kdx-fact-value { margin-top: 5px; font-size: 13px; font-weight: 800; color: ${Colors.navy}; }

  .kdx-fact-text {
    margin-top: 4px;
    font-size: 12.5px;
    line-height: 1.55;
    color: ${Colors.text};
  }

  .kdx-desc {
    padding: 13px 15px;
    border: 1px solid ${Colors.border};
    border-left: 3px solid ${Colors.blue};
    border-radius: 12px;
    background: rgba(21, 112, 239, 0.04);
    font-size: 13px;
    line-height: 1.65;
    color: ${Colors.text};
    margin-bottom: 14px;
  }

  .kdx-two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 14px;
    margin-bottom: 14px;
  }

  @media (max-width: 1240px) {
    .kdx-two { grid-template-columns: 1fr; }
  }

  .kdx-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 9px; }

  .kdx-gallery button {
    padding: 0;
    border: 1px solid ${Colors.border};
    border-radius: 12px;
    background: ${Colors.background};
    overflow: hidden;
    cursor: pointer;
    aspect-ratio: 1 / 1;
    transition: border-color 160ms ease, transform 160ms ease;
  }

  .kdx-gallery button:hover { border-color: ${Colors.blue}; transform: scale(1.02); }

  .kdx-gallery img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .kdx-lightbox {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 24px;
    background: rgba(11, 31, 51, 0.82);
  }

  .kdx-lightbox img {
    max-width: min(1000px, 92vw);
    max-height: 78vh;
    border-radius: 14px;
    border: 3px solid rgba(255, 255, 255, 0.85);
    object-fit: contain;
  }

  .kdx-lightbox-bar { display: flex; align-items: center; gap: 10px; }

  .kdx-lightbox-label { color: rgba(255, 255, 255, 0.88); font-size: 12px; font-weight: 700; }

  .kdx-lightbox-close {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 15px;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.12);
    color: ${Colors.white};
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .kdx-lightbox-close:hover { background: rgba(255, 255, 255, 0.22); }

  .kdx-teams { display: flex; flex-direction: column; gap: 11px; }

  .kdx-team {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 13px;
    align-items: start;
    padding: 13px 14px;
    border: 1px solid ${Colors.border};
    border-radius: 15px;
    background: ${Colors.white};
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }

  .kdx-team:hover { border-color: ${Colors.blue}; }

  .kdx-team-pick {
    border-color: ${Colors.navy};
    background: rgba(18, 183, 106, 0.05);
    box-shadow: 0 12px 26px rgba(11, 31, 51, 0.1);
  }

  .kdx-team-map {
    border-color: ${Colors.success};
    box-shadow: 0 0 0 3px rgba(18, 183, 106, 0.16);
  }

  .kdx-rank {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 10px;
    background: ${Colors.navy};
    color: ${Colors.white};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 800;
  }

  .kdx-rank-lead { background: ${Colors.success}; }

  .kdx-team-name {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 13.5px;
    font-weight: 800;
    color: ${Colors.navy};
    line-height: 1.35;
  }

  .kdx-team-type {
    padding: 2px 8px;
    border-radius: 999px;
    background: ${Colors.background};
    border: 1px solid ${Colors.border};
    color: ${Colors.muted};
    font-size: 10.5px;
    font-weight: 800;
  }

  .kdx-team-line { margin-top: 4px; font-size: 11.5px; color: ${Colors.muted}; line-height: 1.55; }

  .kdx-reasons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }

  .kdx-bars { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 9px; }

  .kdx-bar { min-width: 108px; flex: 1; }

  .kdx-bar-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .kdx-bar-track {
    margin-top: 4px;
    height: 6px;
    border-radius: 999px;
    background: ${Colors.background};
    border: 1px solid ${Colors.border};
    overflow: hidden;
  }

  .kdx-bar-fill { height: 100%; border-radius: 999px; transition: width 320ms ease; }

  .kdx-score {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 7px;
  }

  .kdx-score-num { font-size: 21px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }

  .kdx-score-cap { font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${Colors.muted}; }

  .kdx-muted-line { font-size: 11.5px; color: ${Colors.muted}; }

  .kdx-explain {
    display: flex;
    gap: 9px;
    padding: 12px 14px;
    border-radius: 13px;
    background: ${Colors.blueLight};
    border: 1px solid rgba(21, 112, 239, 0.35);
    color: ${Colors.blueDark};
    font-size: 11.5px;
    line-height: 1.6;
    font-weight: 600;
  }

  .kdx-warn {
    display: flex;
    gap: 9px;
    padding: 12px 14px;
    border-radius: 13px;
    background: ${Colors.amberLight};
    border: 1px solid ${Colors.amber};
    color: ${Colors.amberText};
    font-size: 11.5px;
    line-height: 1.6;
    font-weight: 600;
  }

  .kdx-danger {
    display: flex;
    gap: 9px;
    padding: 12px 14px;
    border-radius: 13px;
    background: ${Colors.redLight};
    border: 1px solid ${Colors.red};
    color: ${Colors.redDark};
    font-size: 11.5px;
    line-height: 1.6;
    font-weight: 700;
  }

  .kdx-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 9px 14px;
    border: 1px solid ${Colors.border};
    border-radius: 11px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease, background 160ms ease, transform 160ms ease;
  }

  .kdx-btn:hover:not(:disabled) { border-color: ${Colors.blue}; color: ${Colors.blue}; transform: translateY(-1px); }

  .kdx-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .kdx-btn-primary {
    background: ${Colors.navy};
    border-color: ${Colors.navy};
    color: ${Colors.white};
  }

  .kdx-btn-primary:hover:not(:disabled) {
    background: ${Colors.blueDark};
    border-color: ${Colors.blueDark};
    color: ${Colors.white};
  }

  .kdx-btn-task {
    background: ${Colors.success};
    border-color: ${Colors.success};
    color: ${Colors.white};
  }

  .kdx-btn-task:hover:not(:disabled) {
    background: #0A7A47;
    border-color: #0A7A47;
    color: ${Colors.white};
  }

  .kdx-btn-danger {
    background: ${Colors.white};
    border-color: ${Colors.red};
    color: ${Colors.redDark};
  }

  .kdx-btn-danger:hover:not(:disabled) { background: ${Colors.redLight}; border-color: ${Colors.redDark}; color: ${Colors.redDark}; }

  .kdx-btn-sm { padding: 7px 11px; font-size: 11px; }

  .kdx-form { display: flex; flex-direction: column; gap: 11px; }

  .kdx-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .kdx-input, .kdx-area, .kdx-select {
    box-sizing: border-box;
    max-width: 100%;
    min-width: 0;
    width: 100%;
    padding: 11px 13px;
    border: 1px solid ${Colors.border};
    border-radius: 12px;
    background: ${Colors.white};
    color: ${Colors.text};
    font-family: inherit;
    font-size: 13px;
    line-height: 1.5;
    outline: none;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }

  .kdx-input:focus, .kdx-area:focus, .kdx-select:focus {
    border-color: ${Colors.blue};
    box-shadow: 0 0 0 3px rgba(21, 112, 239, 0.14);
  }

  .kdx-area { min-height: 88px; resize: vertical; }

  .kdx-hint { font-size: 11px; color: ${Colors.muted}; line-height: 1.55; }

  /* A leading icon must not sit flush against the sentence it introduces. */
  .kdx-hint svg { margin-right: 7px; vertical-align: -2px; }

  .kdx-modal-back {
    position: fixed;
    inset: 0;
    z-index: 9998;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(11, 31, 51, 0.62);
    backdrop-filter: blur(2px);
  }

  .kdx-modal {
    width: min(560px, 100%);
    max-height: 88vh;
    overflow-y: auto;
    border-radius: 20px;
    background: ${Colors.white};
    box-shadow: 0 32px 80px rgba(11, 31, 51, 0.4);
  }

  .kdx-modal-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px;
    border-bottom: 1px solid ${Colors.border};
  }

  .kdx-modal-title { font-size: 15.5px; font-weight: 800; color: ${Colors.navy}; letter-spacing: -0.01em; }

  .kdx-modal-sub { margin-top: 4px; font-size: 12px; color: ${Colors.muted}; line-height: 1.55; }

  .kdx-modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }

  .kdx-modal-foot {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 15px 20px;
    border-top: 1px solid ${Colors.border};
    background: ${Colors.background};
  }

  .kdx-x {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border: 1px solid ${Colors.border};
    border-radius: 9px;
    background: ${Colors.white};
    color: ${Colors.muted};
    cursor: pointer;
  }

  .kdx-x:hover { border-color: ${Colors.red}; color: ${Colors.redDark}; }

  .kdx-mission {
    border: 1px solid ${Colors.border};
    border-radius: 16px;
    background: ${Colors.white};
    overflow: hidden;
  }

  .kdx-mission-live { border-color: rgba(217, 45, 32, 0.45); }

  .kdx-mission-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 13px;
    flex-wrap: wrap;
    padding: 14px 16px;
    border-bottom: 1px solid ${Colors.border};
  }

  .kdx-mission-code {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    font-weight: 800;
    color: ${Colors.navy};
    letter-spacing: 0.01em;
  }

  .kdx-mission-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 13px; }

  .kdx-stage-strip { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  .kdx-step {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid ${Colors.border};
    background: ${Colors.background};
    color: ${Colors.muted};
    font-size: 10.5px;
    font-weight: 800;
  }

  .kdx-step-done { background: rgba(18, 183, 106, 0.12); border-color: ${Colors.success}; color: #0A7A47; }

  .kdx-step-now { background: ${Colors.navy}; border-color: ${Colors.navy}; color: ${Colors.white}; }

  .kdx-trail { display: flex; flex-direction: column; gap: 0; }

  .kdx-trail-item {
    position: relative;
    display: flex;
    gap: 11px;
    padding: 9px 0 9px 20px;
  }

  .kdx-trail-item::before {
    content: "";
    position: absolute;
    left: 6px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: ${Colors.border};
  }

  .kdx-trail-item:first-child::before { top: 14px; }
  .kdx-trail-item:last-child::before { bottom: calc(100% - 14px); }

  .kdx-trail-item::after {
    content: "";
    position: absolute;
    left: 2px;
    top: 14px;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: ${Colors.white};
    border: 2px solid ${Colors.blue};
  }

  .kdx-trail-lead::after { border-color: ${Colors.success}; }

  .kdx-trail-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }

  .kdx-trail-title { font-size: 12px; font-weight: 800; color: ${Colors.navy}; }

  .kdx-trail-meta { font-size: 11px; color: ${Colors.muted}; line-height: 1.5; }

  .kdx-note-box {
    padding: 11px 13px;
    border-radius: 12px;
    background: ${Colors.background};
    border: 1px dashed ${Colors.border};
    font-size: 12px;
    line-height: 1.6;
    color: ${Colors.text};
  }

  .kdx-outcome { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }

  .kdx-stat {
    padding: 12px 14px;
    border: 1px solid ${Colors.border};
    border-radius: 13px;
    background: ${Colors.white};
  }

  .kdx-stat-num { font-size: 20px; font-weight: 800; color: ${Colors.navy}; letter-spacing: -0.02em; }

  .kdx-stat-cap { margin-top: 2px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: ${Colors.muted}; }

  .kdx-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 9px;
    padding: 34px 20px;
    text-align: center;
    color: ${Colors.muted};
    font-size: 12.5px;
    line-height: 1.6;
  }

  .kdx-empty svg { color: ${Colors.border}; }

  .kdx-loading {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 22px;
    color: ${Colors.muted};
    font-size: 12.5px;
    font-weight: 600;
  }

  .kdx-error {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 14px 16px;
    border-radius: 14px;
    background: ${Colors.redLight};
    border: 1px solid ${Colors.red};
    color: ${Colors.redDark};
    font-size: 12.5px;
    line-height: 1.6;
  }

  .kdx-success {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(18, 183, 106, 0.1);
    border: 1px solid ${Colors.success};
    color: #0A7A47;
    font-size: 12.5px;
    font-weight: 700;
    line-height: 1.55;
  }

  .kdx-spin { animation: kdx-turn 900ms linear infinite; }

  @keyframes kdx-turn { to { transform: rotate(360deg); } }

  .kdx-scroll-x { overflow-x: auto; }

  .kdx-stage-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }

  .kdx-stage-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px;
    border: 1px solid ${Colors.border};
    border-radius: 14px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 800;
    text-align: left;
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease, transform 160ms ease, box-shadow 160ms ease;
  }

  .kdx-stage-btn:hover:not(:disabled) {
    border-color: ${Colors.success};
    background: rgba(18, 183, 106, 0.06);
    transform: translateY(-1px);
    box-shadow: 0 12px 26px rgba(18, 183, 106, 0.16);
  }

  .kdx-stage-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .kdx-stage-btn-next {
    border-color: ${Colors.success};
    background: ${Colors.success};
    color: ${Colors.white};
  }

  .kdx-stage-btn-next:hover:not(:disabled) { background: #0A7A47; border-color: #0A7A47; color: ${Colors.white}; }

  .kdx-stage-btn-stop {
    border-color: ${Colors.border};
    background: ${Colors.background};
    color: ${Colors.muted};
  }

  .kdx-stage-icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .kdx-stage-btn:not(.kdx-stage-btn-next) .kdx-stage-icon {
    background: ${Colors.blueLight};
    color: ${Colors.blueDark};
  }

  .kdx-hero {
    display: flex;
    align-items: flex-start;
    gap: 15px;
    flex-wrap: wrap;
    padding: 17px 18px;
    border-radius: 18px;
    background: ${Colors.navy};
    color: ${Colors.white};
  }

  .kdx-hero-body { display: flex; flex-direction: column; gap: 7px; flex: 1; min-width: 220px; }

  .kdx-hero-code { font-size: 12.5px; font-weight: 800; letter-spacing: 0.04em; opacity: 0.82; }

  .kdx-hero-title { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.25; }

  .kdx-hero-sub { font-size: 12.5px; opacity: 0.86; line-height: 1.6; }

  .kdx-hero-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    border: 1px solid rgba(255, 255, 255, 0.28);
    font-size: 11px;
    font-weight: 800;
  }
`;

/* ------------------------------------------------------------------ *
 * District incident desk styling (prefix kqd-).
 *
 * The desk reuses the dispatch primitives (panels, tabs, chips) and adds the
 * one thing a duty queue needs and a workbench does not: a row per verified
 * incident that says, without being opened, what it is, how long it has waited,
 * whether the district has taken it on, and where the officer goes next.
 * ------------------------------------------------------------------ */

export const DESK_CSS = `
  .kqd-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    padding: 16px 18px;
    border: 1px solid ${Colors.border};
    border-radius: 16px;
    background: linear-gradient(135deg, ${Colors.white} 0%, ${Colors.background} 100%);
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  }

  .kqd-head-title {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 15.5px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Colors.navy};
  }

  .kqd-head-sub { margin-top: 5px; font-size: 12.5px; color: ${Colors.muted}; line-height: 1.6; max-width: 62ch; }

  /* The heading column takes the room it is given, so a wrapped header never
     leaves a third of the strip empty beside the sentence. */
  .kqd-head > div:first-child { flex: 1 1 340px; text-align: left; }

  .kqd-head-stats { display: flex; align-items: stretch; gap: 8px; flex-wrap: wrap; }

  .kqd-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 86px;
    padding: 9px 13px;
    border: 1px solid ${Colors.border};
    border-radius: 13px;
    background: ${Colors.white};
  }

  .kqd-stat strong { font-size: 19px; font-weight: 800; color: ${Colors.navy}; line-height: 1.1; }

  .kqd-stat span { font-size: 10.5px; font-weight: 700; color: ${Colors.muted}; letter-spacing: 0.02em; }

  .kqd-stat-hot { border-color: ${Colors.red}; background: ${Colors.red}0F; }
  .kqd-stat-hot strong { color: ${Colors.red}; }

  /* When the head wraps to its own line, the four chips spread across it
     instead of crowding the left edge and leaving the rest empty. */
  @media (max-width: 1000px) {
    .kqd-head-stats { width: 100%; }
    .kqd-stat { flex: 1 1 0; min-width: 0; }
  }

  /* A live mission is the one number the officer cannot afford to lose sight
     of, so it is the only chip that is allowed to look like an alarm. */
  .kqd-stat-live { border-color: ${Colors.blue}; background: ${Colors.blue}12; }
  .kqd-stat-live strong { color: ${Colors.blue}; }

  /* Evidence tiles are numbered so a handover can say "the third picture". */
  .kqd-shot {
    position: relative;
    display: block;
    padding: 0;
    border: 1px solid ${Colors.border};
    border-radius: 12px;
    background: ${Colors.background};
    overflow: hidden;
    cursor: pointer;
    aspect-ratio: 1 / 1;
    transition: border-color 160ms ease, transform 160ms ease;
  }

  .kqd-shot:hover { border-color: ${Colors.blue}; transform: scale(1.02); }

  .kqd-shot img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .kqd-shot-tag {
    position: absolute;
    left: 6px;
    bottom: 6px;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(8, 16, 32, 0.62);
    color: #fff;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.03em;
  }

  .kqd-shot-video {
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${Colors.blue};
    text-decoration: none;
    cursor: pointer;
  }

  .kqd-shot-play {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 999px;
    background: ${Colors.blue}1A;
    border: 1px solid ${Colors.blue}44;
  }

  /* --- the queue: one row per verified incident -------------------------- */

  .kqd-queue {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 12px;
  }

  .kqd-card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 13px;
    padding: 13px 14px 13px 18px;
    border: 1px solid ${Colors.border};
    border-radius: 15px;
    background: ${Colors.white};
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }

  .kqd-card:hover {
    border-color: ${Colors.navyLight};
    box-shadow: 0 8px 22px rgba(11, 31, 51, 0.08);
    transform: translateY(-1px);
  }

  /* The severity rail carries the colour from the top edge to the bottom, so a
     scan of the list reads as a strip of urgency rather than a wall of text. */
  .kqd-rail {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 15px 0 0 15px;
  }

  /* An incident that has waited longer than the district should ever let it is
     edged, because a queue that hides its oldest work is a queue that fails. */
  .kqd-card-stale { border-color: ${Colors.amber}; background: #FFFCF5; }

  .kqd-card .kqd-shot {
    flex: 0 0 76px;
    width: 76px;
    cursor: default;
  }

  .kqd-card .kqd-shot:hover { border-color: ${Colors.border}; transform: none; }

  .kqd-shot-live { border-color: ${Colors.blue}; box-shadow: 0 0 0 3px ${Colors.blue}1F; }

  /* The picture and the words together are the incident: clicking anywhere on
     them opens the response page, which is what a hand reaching for a card
     expects. The two action buttons stay outside this strip. */
  .kqd-open {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    flex: 1;
    min-width: 0;
    padding: 0;
    border: none;
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .kqd-open:hover .kqd-title { color: ${Colors.blue}; }

  .kqd-open:focus-visible {
    outline: 2px solid ${Colors.blue};
    outline-offset: 4px;
    border-radius: 12px;
  }

  .kqd-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }

  .kqd-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  .kqd-title { font-size: 14.5px; font-weight: 800; color: ${Colors.navy}; letter-spacing: -0.01em; }

  .kqd-sev {
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .kqd-danger {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    background: ${Colors.red};
    color: ${Colors.white};
    font-size: 10px;
    font-weight: 800;
  }

  .kqd-stage {
    margin-left: auto;
    padding: 3px 10px;
    border: 1px solid;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 800;
    white-space: nowrap;
  }

  .kqd-meta { font-size: 11.5px; font-weight: 600; color: ${Colors.muted}; }

  .kqd-place {
    font-size: 12.5px;
    line-height: 1.55;
    color: ${Colors.text};
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .kqd-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    flex: 0 0 auto;
  }

  .kqd-age {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 800;
    color: ${Colors.muted};
    white-space: nowrap;
  }

  .kqd-age-hot { color: ${Colors.amberText}; }

  @media (max-width: 900px) {
    .kqd-card { flex-wrap: wrap; }
    .kqd-open { flex: 1 1 100%; flex-wrap: wrap; }
    .kqd-main { flex: 1 1 220px; }
    .kqd-side { width: 100%; flex-direction: row; align-items: center; justify-content: space-between; }
    .kqd-stage { margin-left: 0; }
  }
`;

/* ================================================================== *
 * The incident response page — one verified incident, opened from the desk.
 * kyp-* : the page chrome. The panels themselves reuse kdx-* so a card looks
 * the same here as it does on the desk and on a team's own board.
 * ================================================================== */

export const RESPONSE_CSS = `
  .kyp-page {
    display: flex;
    flex-direction: column;
    gap: 15px;
    min-width: 0;
  }

  /* The bar stays on screen: on a long incident page the officer must always
     know which incident they are on and how fresh the picture is. */
  .kyp-bar {
    position: sticky;
    top: 0;
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 9px 12px;
    border: 1px solid ${Colors.border};
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(8px);
    box-shadow: 0 6px 18px rgba(11, 31, 51, 0.06);
  }

  .kyp-back {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 13px 6px 10px;
    border: 1px solid ${Colors.border};
    border-radius: 999px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 150ms ease, color 150ms ease;
  }

  .kyp-back:hover { border-color: ${Colors.blue}; color: ${Colors.blue}; }

  .kyp-bar-code {
    padding: 4px 9px;
    border-radius: 8px;
    background: ${Colors.navy};
    color: ${Colors.white};
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  .kyp-bar-place {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: ${Colors.muted};
  }

  .kyp-bar-right {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .kyp-live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    border: 1px solid ${Colors.border};
    border-radius: 999px;
    background: ${Colors.background};
    color: ${Colors.muted};
    font-size: 11.5px;
    font-weight: 800;
    white-space: nowrap;
  }

  .kyp-live-on {
    border-color: ${Colors.success};
    background: rgba(18, 183, 106, 0.09);
    color: #0E8A51;
  }

  .kyp-live-on svg { animation: kyp-pulse 1.9s ease-in-out infinite; }

  @keyframes kyp-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* --- 1. the incident ---------------------------------------------------- */

  .kyp-hero {
    display: flex;
    align-items: stretch;
    border: 1px solid ${Colors.border};
    border-radius: 18px;
    background: ${Colors.white};
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(11, 31, 51, 0.06);
  }

  /* A severity rail rather than a coloured badge: it is read from the corner of
     the eye while the officer works the rest of the page. */
  .kyp-hero-rail { flex: 0 0 6px; }

  .kyp-hero-main {
    flex: 1;
    min-width: 0;
    padding: 16px 18px 18px;
  }

  /* The headline pair sits together: what happened, then who says so and when. */
  .kyp-hero-top {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .kyp-hero-title {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
    font-size: 19px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Colors.navy};
  }

  .kyp-hero-sev {
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .kyp-hero-danger {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 999px;
    background: ${Colors.red};
    color: ${Colors.white};
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.03em;
    box-shadow: 0 4px 12px rgba(217, 45, 32, 0.28);
  }

  .kyp-hero-sub {
    margin-top: 2px;
    font-size: 12px;
    color: ${Colors.muted};
  }

  /* The five-step trail sits between the headline and the story, because an
     officer reads "where is this?" before they read what happened. */
  .kyp-flow {
    margin-top: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid ${Colors.border};
  }

  .kyp-hero-call {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
    margin-top: 13px;
    padding-top: 13px;
    border-top: 1px dashed ${Colors.border};
  }

  .kyp-hero-call-label {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .kyp-hero-call-name { font-size: 13px; font-weight: 700; color: ${Colors.navy}; }

  .kyp-hero-strip { margin-top: 13px; }

  .kyp-hero-strip button { position: relative; }

  .kyp-hero-strip-count {
    position: absolute;
    right: 5px;
    bottom: 5px;
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(11, 31, 51, 0.68);
    color: ${Colors.white};
    font-size: 10px;
    font-weight: 800;
  }

  .kyp-accept {
    margin-top: 15px;
    padding: 13px 14px;
    border: 1px solid ${Colors.amber};
    border-radius: 14px;
    background: ${Colors.amberLight};
  }

  .kyp-accept-lead {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    font-size: 12.5px;
    line-height: 1.65;
    color: ${Colors.amberText};
  }

  .kyp-accept-lead svg { flex: 0 0 auto; margin-top: 2px; }

  .kyp-accept-row {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
    margin-top: 11px;
  }

  .kyp-accept-row .kdx-input { flex: 1; min-width: 220px; background: ${Colors.white}; }

  .kyp-accepted {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin-top: 15px;
    padding: 11px 13px;
    border: 1px solid rgba(18, 183, 106, 0.4);
    border-radius: 12px;
    background: rgba(18, 183, 106, 0.08);
    font-size: 12.5px;
    line-height: 1.65;
    color: #0E8A51;
  }

  .kyp-accepted svg { flex: 0 0 auto; margin-top: 2px; }

  .kyp-accepted-note {
    display: block;
    margin-top: 3px;
    color: ${Colors.navy};
    font-style: italic;
    font-weight: 600;
  }

  /* --- 2. the map --------------------------------------------------------- */

  .kyp-map { min-width: 0; }

  /* --- 3 and 4. the two stacked answers ----------------------------------- */

  .kyp-section {
    display: flex;
    flex-direction: column;
    gap: 11px;
    min-width: 0;
    padding: 15px 16px 17px;
    border: 1px solid ${Colors.border};
    border-radius: 18px;
    background: ${Colors.white};
    box-shadow: 0 10px 30px rgba(11, 31, 51, 0.05);
    scroll-margin-top: 74px;
  }

  .kyp-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding-bottom: 11px;
    border-bottom: 1px solid ${Colors.border};
  }

  .kyp-section-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 800;
    letter-spacing: -0.005em;
    color: ${Colors.navy};
  }

  .kyp-section-title svg { color: ${Colors.blue}; }

  .kyp-section-sub { font-size: 11.5px; font-weight: 700; color: ${Colors.muted}; }

  .kyp-section-hint {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.65;
    color: ${Colors.muted};
  }

  .kyp-quiet {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 14px;
    border: 1px dashed ${Colors.border};
    border-radius: 13px;
    background: ${Colors.background};
    font-size: 12.5px;
    line-height: 1.65;
    color: ${Colors.muted};
  }

  .kyp-quiet svg { flex: 0 0 auto; margin-top: 2px; color: ${Colors.blue}; }

  .kyp-excluded { padding-top: 2px; }

  .kyp-excluded-summary {
    font-size: 11.5px;
    font-weight: 700;
    color: ${Colors.muted};
  }

  .kyp-excluded-summary:hover { color: ${Colors.navy}; }

  @media (max-width: 860px) {
    .kyp-bar-right { margin-left: 0; width: 100%; justify-content: space-between; }
    .kyp-hero-main { padding: 14px 14px 16px; }
    .kyp-section { padding: 13px 13px 15px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .kyp-live-on svg { animation: none; }
  }
`;
