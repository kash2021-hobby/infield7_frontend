"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RuleForm, type Kind } from "../rule-form";

const names: Partial<Record<Kind, string>> = {
  late_checkin: "Late check-in",
  geofence_exit: "Geofence exit",
  sos: "Panic button",
  task_delay: "Task overdue",
  overtime: "Overtime",
  sales_below: "Sales below target",
  low_battery: "Low battery",
};

function NewRule() {
  const params = useSearchParams();
  const kind = (params.get("kind") as Kind) || "late_checkin";
  const blank = params.get("blank") === "1";
  const known = names[kind] ? kind : "late_checkin";
  if (blank) {
    return (
      <RuleForm
        persistLocal
        title="New alert rule"
        initial={{ name: "", kind: "late_checkin", siteId: null, minutesOver: null, notifyManagers: true, notifyPerson: false, status: "draft" }}
      />
    );
  }
  return (
    <RuleForm
      persistLocal
      title="New alert rule"
      initial={{ name: names[known] ?? "New rule", kind: known, siteId: null, minutesOver: null, notifyManagers: true, notifyPerson: false, status: "draft" }}
    />
  );
}

export default function NewRulePage() {
  return (
    <Suspense>
      <NewRule />
    </Suspense>
  );
}
