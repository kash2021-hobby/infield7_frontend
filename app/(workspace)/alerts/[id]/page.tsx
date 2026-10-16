"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, loadSession } from "@/lib/api";
import { RuleForm, type Rule } from "../rule-form";

export default function EditRulePage() {
  const params = useParams<{ id: string }>();
  const [rule, setRule] = useState<Rule | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    api<Rule>(`/alert-rules/${params.id}`, {}, session.token)
      .then(setRule)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [params.id]);

  if (error) return <div className="error">{error}</div>;
  if (!rule) return <p className="muted">Loading rule…</p>;
  return <RuleForm title="Edit alert rule" initial={rule} />;
}
