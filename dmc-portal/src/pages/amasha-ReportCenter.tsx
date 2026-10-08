import { useState } from "react";

import type { ExtendedReport } from "../services/amasha-reportApi";
import ReportQueueView from "./amasha-ReportQueueView";
import ReportDetailView from "./amasha-ReportDetailView";
import ReportVerifyView from "./amasha-ReportVerifyView";
import { REPORT_STYLES } from "./amasha-reportUi";

interface ReportCenterProps {
  onIssueWarning: (reportId: string) => void;
}

type CenterView = "list" | "detail" | "verify";

/**
 * UC-02 report queue for officers: list -> full detail -> a separate verify
 * page. Swapped into the dashboard's "Report queue" view in place of the
 * inline-decision queue so verification happens on its own page.
 */
export default function ReportCenter({ onIssueWarning }: ReportCenterProps) {
  const [view, setView] = useState<CenterView>("list");
  const [selected, setSelected] = useState<ExtendedReport | null>(null);
  const [listKey, setListKey] = useState(0);

  const refreshList = () => {
    setSelected(null);
    setView("list");
    setListKey((key) => key + 1);
  };

  return (
    <div className="rc">
      {view === "list" && (
        <ReportQueueView
          key={listKey}
          onOpen={(report) => {
            setSelected(report);
            setView("detail");
          }}
          onIssueWarning={onIssueWarning}
        />
      )}

      {view === "detail" && selected && (
        <ReportDetailView
          report={selected}
          onBack={() => setView("list")}
          onVerify={(report) => {
            setSelected(report);
            setView("verify");
          }}
          onIssueWarning={onIssueWarning}
          onChanged={refreshList}
        />
      )}

      {view === "verify" && selected && (
        <ReportVerifyView
          report={selected}
          onBack={() => setView("detail")}
          onDecided={refreshList}
        />
      )}

      <style>{REPORT_STYLES}</style>
    </div>
  );
}
