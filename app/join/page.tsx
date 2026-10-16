"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const code = search.get("code")?.trim().toUpperCase();
    if (code) sessionStorage.setItem("if7-invite", code);
    router.replace("/login");
  }, [router, search]);

  return (
    <main className="auth">
      <p className="sub">Opening sign-in…</p>
    </main>
  );
}
