import { useState } from "react";
import { ArrowRightLeft, Building2, ShieldCheck } from "lucide-react";

import KaveeshaShelterBoard from "./kaveesha-ShelterBoard";
import KaveeshaShelterAllocation from "./kaveesha-ShelterAllocation";
import KaveeshaShelterManagerAccounts from "./kaveesha-ShelterManagerAccounts";
import { DISPATCH_CSS, DESK_CSS } from "../styles/kaveesha-dispatchStyles";

/* ------------------------------------------------------------------ *
 * The officer's shelter area.
 *
 * One sidebar entry, three desks inside: the register (capacity you own), the
 * allocation desk (where waiting groups go), and the manager accounts that
 * confirm arrivals. They share the same live shelter feed and refresh together,
 * so a group allocated on one tab shows its new occupancy on another.
 * ------------------------------------------------------------------ */

type ShelterTab = "board" | "allocate" | "managers";

const TABS: { key: ShelterTab; label: string; icon: typeof Building2 }[] = [
  { key: "board", label: "Shelter board", icon: Building2 },
  { key: "allocate", label: "Allocation desk", icon: ArrowRightLeft },
  { key: "managers", label: "Manager accounts", icon: ShieldCheck },
];

export default function KaveeshaShelterArea({
  token,
  district,
}: {
  token: string | null;
  district: string;
}) {
  const [tab, setTab] = useState<ShelterTab>("board");

  return (
    <div className="kdx-stack">
      <div className="kdx-tabs" style={{ alignSelf: "flex-start" }}>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`kdx-tab ${tab === item.key ? "kdx-tab-on" : ""}`}
            onClick={() => setTab(item.key)}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ))}
      </div>

      {tab === "board" && (
        <KaveeshaShelterBoard token={token} district={district} />
      )}
      {tab === "allocate" && (
        <KaveeshaShelterAllocation token={token} district={district} />
      )}
      {tab === "managers" && (
        <KaveeshaShelterManagerAccounts token={token} district={district} />
      )}

      <style>{`${DISPATCH_CSS}${DESK_CSS}`}</style>
    </div>
  );
}
