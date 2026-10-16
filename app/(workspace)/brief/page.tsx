"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BriefRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/copilot");
  }, [router]);
  return <p className="muted">Opening AI copilot…</p>;
}
