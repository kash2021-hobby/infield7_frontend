"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, loadSession, type Session } from "@/lib/api";
import { EmployeeWizard } from "@/lib/employee-wizard";
import { NavIcon } from "@/lib/nav-icon";

type Person = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  inviteCode: string | null;
  inviteExpiresAt: string | null;
  shareUrl: string | null;
  status: string;
  joinedOn: string | null;
};

function Toggle({ on, off }: { on: boolean; off?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        background: off ? "var(--if-cream-2)" : on ? "var(--if-green)" : "var(--if-cream-2)",
        display: "inline-flex",
        alignItems: "center",
        padding: 2,
        opacity: off ? 0.7 : 1,
      }}
    >
      <span style={{
        width: 16,
        height: 16,
        borderRadius: 999,
        background: "white",
        marginLeft: on && !off ? "auto" : 0,
      }} />
    </span>
  );
}

function statusTone(status: string) {
  if (status === "active") return "ok";
  if (status === "pending") return "wait";
  return "off";
}

function statusLabel(status: string) {
  if (status === "active") return "Active";
  if (status === "pending") return "Pending invite";
  if (status === "draft") return "Draft";
  return "Inactive";
}

export default function InvitePage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [code, setCode] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const join = search.get("join");
  const company = session?.workspace.name || "InField";
  const first = person?.name.split(" ")[0] || "them";
  const phone = person?.phone ? `+91 ${person.phone}` : "";
  const sent = Boolean(code) && person?.status === "pending";
  const live = person?.status === "active";

  const load = useCallback(async (current: Session) => {
    const row = await api<Person>(`/employees/${params.id}`, {}, current.token);
    setPerson(row);
    setCode(row.inviteCode ?? "");
    setShareUrl(row.shareUrl ?? "");
    return row;
  }, [params.id]);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    load(current).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [load]);

  useEffect(() => {
    if (!session || person?.status !== "pending") return;
    const timer = window.setInterval(() => {
      load(session).catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [load, session, person?.status]);

  async function send() {
    if (!session || join || live) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ inviteCode: string; shareUrl: string }>(`/employees/${params.id}/invite`, {
        method: "POST",
        body: JSON.stringify({}),
      }, session.token);
      setCode(result.inviteCode);
      setShareUrl(result.shareUrl);
      setNotice(code ? "Invite resent. The old code no longer works." : "Invite sent. Code expires in 7 days.");
      await load(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    const url = shareUrl || (code ? `https://in.field/join?code=${code}` : "");
    if (!url) return;
    void navigator.clipboard.writeText(url).then(() => setNotice("Invite link copied"));
  }

  const spaced = code.split("").join(" ");
  const sendLabel = live ? "Active" : sent ? "Resend" : "Send invite & activate";

  return (
    <EmployeeWizard
      stepIndex={2}
      title="Send invite & activate"
      backHref={`/employees/${params.id}/assignment`}
      continueLabel={sent || live ? "Done" : "Send invite & activate"}
      onContinue={() => {
        if (join || sent || live) {
          router.push("/employees");
          return;
        }
        void send();
      }}
      busy={busy}
    >
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {notice ? <div className="devcode" style={{ marginBottom: 12 }}>{notice}</div> : null}
      {person ? (
        <div style={{ marginBottom: 16 }}>
          <span className={`emp-status ${statusTone(person.status)}`}>
            <span className="emp-dot" />
            {statusLabel(person.status)}
          </span>
        </div>
      ) : null}
      {join ? (
        <div className="emp-ready wait" style={{ marginBottom: 16 }}>
          <b>Joins on {join}.</b> They stay off the live roster until that date. Come back then to send the SMS.
        </div>
      ) : null}
      {live ? (
        <div className="emp-ready" style={{ marginBottom: 16 }}>
          <b>Active.</b> {first} signed in. No further invite is needed.
        </div>
      ) : null}
      <div className="emp-invite">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>How should we invite {first}?</div>
            {[
              { name: "SMS", sub: `Sent to ${phone || "the mobile on file"} — best for field workers`, icon: "phone" as const, on: true },
              { name: "WhatsApp", sub: "Copy the invite link to share on WhatsApp. In-app WhatsApp send is off this product.", icon: "message" as const, on: false },
              { name: "Email", sub: person?.email ? `${person.email} · off this product` : "Off this product — no email login yet", icon: "settings" as const, on: false },
            ].map((channel) => (
              <div key={channel.name} className={`emp-channel${channel.on ? "" : " off"}`}>
                <div className="emp-channel-icon">
                  <NavIcon name={channel.icon} size={16} color={channel.on ? "var(--if-green-deep)" : "var(--if-ink-3)"} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{channel.name}</div>
                  <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>{channel.sub}</div>
                </div>
                <Toggle on={channel.on} off={!channel.on} />
              </div>
            ))}
          </div>
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Login code</div>
            <div className="emp-code">
              <span className="if-num">{spaced || "— — — — — —"}</span>
              <div style={{ flex: 1 }} />
              <button type="button" className="btn green" style={{ width: "auto", marginTop: 0 }} disabled={busy || Boolean(join) || live} onClick={() => void send()}>
                {code ? "Resend" : "Generate"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 10, lineHeight: 1.5 }}>
              {first} will use this one-time code the first time they open the app. Expires in 7 days. Resend replaces the old code.
            </div>
            <button type="button" className="btn secondary" style={{ width: "auto", marginTop: 12 }} disabled={!code} onClick={copyLink}>
              Copy invite link
            </button>
          </div>
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Activate profile</div>
            {[
              ["Enable location tracking during shift", true],
              ["Require selfie on check-in", true],
              ["Send day-1 walkthrough tutorial", true],
              ["Add to site geofence", true],
            ].map(([label, on]) => (
              <div key={String(label)} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px dashed var(--if-cream-2)",
              }}>
                <span style={{ fontSize: 12 }}>{String(label)}</span>
                <Toggle on={Boolean(on)} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="emp-kpi-label" style={{ marginBottom: 12 }}>SMS preview</div>
          <div className="emp-phone">
            <div className="emp-sms">
              <div style={{ textAlign: "center", fontSize: 11, opacity: 0.5, marginBottom: 12 }}>Today</div>
              <div style={{ textAlign: "center", fontSize: 12, opacity: 0.7, marginBottom: 8 }}>InField</div>
              <div className="emp-bubble">
                Namaste {first} 👋
                <br /><br />
                {company} has added you to InField.
                <br /><br />
                Download: <span style={{ color: "#4ea1ff" }}>infield.app/get</span>
                <br />
                Your login code: <b className="if-num">{code || "••••••"}</b>
                <br /><br />
                Expires in 7 days. Reply STOP to opt out.
              </div>
            </div>
          </div>
          <button type="button" className="btn green" style={{ marginTop: 16, width: "100%" }} disabled={busy || Boolean(join) || live} onClick={() => void send()}>
            <NavIcon name="check" size={16} color="var(--if-ink)" /> {sendLabel}
          </button>
        </div>
      </div>
    </EmployeeWizard>
  );
}
