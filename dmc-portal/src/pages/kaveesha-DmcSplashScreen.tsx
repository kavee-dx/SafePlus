import { useEffect, useState } from "react";
import { Activity, Radio, ShieldAlert } from "lucide-react";

import { Colors } from "../constants/theme";

interface DmcSplashScreenProps {
  onFinish: () => void;
}

export default function KaveeshaDmcSplashScreen({
  onFinish,
}: DmcSplashScreenProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setVisible(true);
    }, 100);

    const finishTimer = setTimeout(() => {
      onFinish();
    }, 2800);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className="dmc-splash">
      {/* Background */}
      <div className="dmc-splash-grid" />

      <div className="dmc-splash-glow dmc-splash-glow-red" />
      <div className="dmc-splash-glow dmc-splash-glow-amber" />

      {/* Main content */}
      <main
        className={`dmc-splash-content ${
          visible ? "dmc-splash-visible" : ""
        }`}
      >
        {/* Status */}
        <div className="dmc-status-pill">
          <span className="dmc-status-dot" />
          DMC OPERATIONS SYSTEM
        </div>

        {/* Logo */}
        <div className="dmc-splash-logo">
          <div className="dmc-splash-logo-inner">
            <ShieldAlert size={42} strokeWidth={1.8} />
          </div>
        </div>

        {/* Brand */}
        <h1 className="dmc-splash-brand">
          Safe<span>Plus</span>
        </h1>

        <p className="dmc-splash-title">
          Disaster Management Centre
        </p>

        <p className="dmc-splash-description">
          Smart Disaster Early-Warning & Emergency Coordination
        </p>

        {/* System cards */}
        <div className="dmc-splash-indicators">
          <div className="dmc-indicator">
            <Radio size={16} />
            <span>LIVE ALERTS</span>
          </div>

          <div className="dmc-indicator">
            <Activity size={16} />
            <span>MONITORING</span>
          </div>

          <div className="dmc-indicator">
            <ShieldAlert size={16} />
            <span>RESPONSE READY</span>
          </div>
        </div>

        <p className="dmc-splash-footer">
          PROTECT • COORDINATE • RESPOND
        </p>
      </main>

      <style>
        {`
          * {
            box-sizing: border-box;
          }

          .dmc-splash {
            min-height: 100vh;
            min-height: 100dvh;
            width: 100%;
            background: ${Colors.navy};
            color: ${Colors.white};
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            font-family:
              Inter,
              system-ui,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
          }

          .dmc-splash-grid {
            position: absolute;
            inset: 0;
            opacity: 0.055;
            background-image:
              linear-gradient(
                rgba(255, 255, 255, 0.5) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(255, 255, 255, 0.5) 1px,
                transparent 1px
              );
            background-size: 48px 48px;
          }

          .dmc-splash-glow {
            position: absolute;
            border-radius: 50%;
            pointer-events: none;
            filter: blur(80px);
          }

          .dmc-splash-glow-red {
            width: 520px;
            height: 520px;
            background: ${Colors.red};
            opacity: 0.08;
            top: -180px;
            right: -140px;
          }

          .dmc-splash-glow-amber {
            width: 420px;
            height: 420px;
            background: ${Colors.amber};
            opacity: 0.06;
            bottom: -180px;
            left: -140px;
          }

          .dmc-splash-content {
            position: relative;
            z-index: 2;
            width: min(900px, 92%);
            padding: 40px 20px;
            text-align: center;
            opacity: 0;
            transform: translateY(18px);
            transition:
              opacity 700ms ease,
              transform 700ms ease;
          }

          .dmc-splash-visible {
            opacity: 1;
            transform: translateY(0);
          }

          .dmc-status-pill {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            padding: 8px 14px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            background: rgba(255, 255, 255, 0.06);
            margin-bottom: 38px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
          }

          .dmc-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${Colors.success};
            box-shadow: 0 0 12px ${Colors.success};
          }

          .dmc-splash-logo {
            width: 108px;
            height: 108px;
            margin: 0 auto 28px;
            border-radius: 30px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.14);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 24px 70px rgba(0, 0, 0, 0.3);
          }

          .dmc-splash-logo-inner {
            width: 76px;
            height: 76px;
            border-radius: 22px;
            background: ${Colors.red};
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 12px 35px ${Colors.red}55;
          }

          .dmc-splash-brand {
            margin: 0;
            font-size: clamp(44px, 7vw, 72px);
            font-weight: 800;
            letter-spacing: -0.045em;
            line-height: 1;
          }

          .dmc-splash-brand span {
            color: ${Colors.red};
          }

          .dmc-splash-title {
            margin: 18px 0 0;
            font-size: clamp(16px, 2vw, 22px);
            color: #d0d5dd;
            font-weight: 500;
          }

          .dmc-splash-description {
            margin: 8px auto 0;
            max-width: 560px;
            color: #98a2b3;
            font-size: 14px;
            line-height: 1.6;
          }

          .dmc-splash-indicators {
            margin-top: 52px;
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 12px;
          }

          .dmc-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            min-width: 130px;
            padding: 10px 14px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.09);
            color: #d0d5dd;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.06em;
          }

          .dmc-splash-footer {
            margin: 48px 0 0;
            color: #667085;
            font-size: 11px;
            letter-spacing: 0.06em;
          }

          @media (max-width: 600px) {
            .dmc-splash-content {
              width: 100%;
              padding: 28px 20px;
            }

            .dmc-status-pill {
              margin-bottom: 30px;
              padding: 7px 11px;
              font-size: 9px;
            }

            .dmc-splash-logo {
              width: 88px;
              height: 88px;
              border-radius: 25px;
              margin-bottom: 23px;
            }

            .dmc-splash-logo-inner {
              width: 62px;
              height: 62px;
              border-radius: 18px;
            }

            .dmc-splash-logo-inner svg {
              width: 34px;
              height: 34px;
            }

            .dmc-splash-brand {
              font-size: clamp(42px, 14vw, 58px);
            }

            .dmc-splash-title {
              margin-top: 13px;
              font-size: 16px;
            }

            .dmc-splash-description {
              font-size: 12px;
              max-width: 320px;
            }

            .dmc-splash-indicators {
              margin-top: 34px;
              gap: 8px;
            }

            .dmc-indicator {
              min-width: 0;
              flex: 1 1 90px;
              padding: 9px 7px;
              font-size: 8px;
            }

            .dmc-indicator svg {
              width: 13px;
              height: 13px;
            }

            .dmc-splash-footer {
              margin-top: 32px;
              font-size: 9px;
            }
          }

          @media (max-height: 650px) and (min-width: 601px) {
            .dmc-splash-content {
              transform: scale(0.88);
            }

            .dmc-splash-visible {
              transform: scale(0.88);
            }

            .dmc-status-pill {
              margin-bottom: 22px;
            }

            .dmc-splash-indicators {
              margin-top: 30px;
            }

            .dmc-splash-footer {
              margin-top: 28px;
            }
          }

          @media (max-height: 650px) and (max-width: 600px) {
            .dmc-splash-content {
              padding-top: 18px;
              padding-bottom: 18px;
            }

            .dmc-status-pill {
              margin-bottom: 18px;
            }

            .dmc-splash-logo {
              width: 72px;
              height: 72px;
              margin-bottom: 15px;
            }

            .dmc-splash-logo-inner {
              width: 52px;
              height: 52px;
            }

            .dmc-splash-title {
              margin-top: 9px;
            }

            .dmc-splash-indicators {
              margin-top: 22px;
            }

            .dmc-splash-footer {
              margin-top: 20px;
            }
          }
        `}
      </style>
    </div>
  );
}
