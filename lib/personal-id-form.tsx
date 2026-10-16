"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, api, loadSession, type Session } from "@/lib/api";
import { aadhaarDigits, isValidAadhaar, maskAadhaar, panOk } from "@/lib/aadhaar";
import { EmployeeWizard, Field } from "@/lib/employee-wizard";
import { NavIcon } from "@/lib/nav-icon";

type Person = {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string | null;
  dob: string | null;
  pan: string | null;
  aadhaarMasked: string;
  hasAadhaar: boolean;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  hasPhoto: boolean;
};

export function PersonalIdForm({ employeeId }: { employeeId?: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [id, setId] = useState(employeeId ?? "");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [aadhaarMasked, setAadhaarMasked] = useState(false);
  const [pan, setPan] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const creating = useRef(false);

  const fill = useCallback((person: Person, token: string) => {
    setId(person.id);
    setName(person.name);
    setCode(person.code);
    setDob(person.dob ?? "");
    setPhone(person.phone);
    setEmail(person.email ?? "");
    setAadhaar(person.aadhaarMasked);
    setAadhaarMasked(Boolean(person.aadhaarMasked));
    setPan(person.pan ?? "");
    setAddress(person.address ?? "");
    setEmergencyName(person.emergencyName ?? "");
    setEmergencyPhone(person.emergencyPhone ?? "");
    if (person.hasPhoto) {
      fetch(`${API_URL}/employees/${person.id}/photo`, { headers: { authorization: `Bearer ${token}` } })
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          if (blob) setPhotoUrl(URL.createObjectURL(blob));
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    const token = current.token;
    async function start() {
      if (!employeeId) return;
      const person = await api<Person>(`/employees/${employeeId}`, {}, token);
      fill(person, token);
    }
    start().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not open"));
  }, [employeeId, fill, router]);

  async function ensureDraft() {
    if (!session) return "";
    if (id) return id;
    if (creating.current) return "";
    creating.current = true;
    try {
      const draft = await api<Person>("/employees/drafts", { method: "POST", body: JSON.stringify({}) }, session.token);
      setId(draft.id);
      setCode(draft.code);
      router.replace(`/employees/${draft.id}/edit`);
      return draft.id;
    } catch (err) {
      creating.current = false;
      throw err;
    }
  }

  async function persist(patch: Record<string, string | null>) {
    if (!session) return;
    try {
      const currentId = await ensureDraft();
      if (!currentId) return;
      const person = await api<Person>(`/employees/${currentId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }, session.token);
      if (patch.aadhaar) {
        setAadhaar(person.aadhaarMasked);
        setAadhaarMasked(Boolean(person.aadhaarMasked));
      }
      if (patch.code !== undefined) setCode(person.code);
      return person;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save";
      if (message === "Phone already in use") setErrors((current) => ({ ...current, phone: message }));
      else if (message === "Invalid Aadhaar number") setErrors((current) => ({ ...current, aadhaar: message }));
      else setError(message);
      creating.current = false;
      throw err;
    }
  }

  async function blurPhone() {
    if (!session || !phone) return;
    const check = await api<{ taken: boolean }>(
      `/employees/check-phone?phone=${encodeURIComponent(phone)}&excludeId=${id}`,
      {},
      session.token,
    );
    if (check.taken) {
      setErrors((current) => ({ ...current, phone: "Phone already in use" }));
      return;
    }
    setErrors((current) => ({ ...current, phone: "" }));
    await persist({ phone }).catch(() => undefined);
  }

  async function blurAadhaar() {
    const digits = aadhaarDigits(aadhaar);
    if (!digits) {
      setErrors((current) => ({ ...current, aadhaar: "" }));
      return;
    }
    if (!isValidAadhaar(aadhaar)) {
      setErrors((current) => ({ ...current, aadhaar: "Invalid Aadhaar number" }));
      setAadhaarMasked(false);
      return;
    }
    setErrors((current) => ({ ...current, aadhaar: "" }));
    await persist({ aadhaar: digits }).catch(() => undefined);
    setAadhaar(maskAadhaar(digits));
    setAadhaarMasked(true);
  }

  async function continueNext() {
    if (!session) return;
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Enter the full name";
    if (phone.replace(/\D/g, "").length < 8) next.phone = "Enter a mobile number";
    if (errors.phone === "Phone already in use") next.phone = "Phone already in use";
    const digits = aadhaarDigits(aadhaar);
    if (!aadhaarMasked && !isValidAadhaar(aadhaar)) next.aadhaar = "Invalid Aadhaar number";
    if (pan && !panOk(pan)) next.pan = "Enter a valid PAN";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError("");
    try {
      const saved = await persist({
        name,
        phone,
        code,
        email,
        dob,
        pan,
        aadhaar: aadhaarMasked ? aadhaar : digits,
        address,
        emergencyName,
        emergencyPhone,
      });
      const currentId = saved?.id ?? id;
      if (!currentId) throw new Error("Could not save");
      await api(`/employees/${currentId}/continue`, { method: "POST", body: JSON.stringify({}) }, session.token);
      router.push(`/employees/${currentId}/assignment`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not continue";
      if (message === "Phone already in use") setErrors((current) => ({ ...current, phone: message }));
      else if (message === "Invalid Aadhaar number") setErrors((current) => ({ ...current, aadhaar: message }));
      else if (message === "Enter the full name") setErrors((current) => ({ ...current, name: message }));
      else setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(file: File) {
    if (!session) return;
    const currentId = await ensureDraft();
    if (!currentId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const photoBase64 = String(reader.result);
      api(`/employees/${currentId}/photo`, {
        method: "POST",
        body: JSON.stringify({ photoBase64 }),
      }, session.token)
        .then(() => setPhotoUrl(photoBase64))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not upload"));
    };
    reader.readAsDataURL(file);
  }

  return (
    <EmployeeWizard
      stepIndex={0}
      title="Personal details & ID"
      backHref="/employees"
      onContinue={() => void continueNext()}
      busy={busy}
    >
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      <div className="emp-personal">
        <div className="panel" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Profile photo</div>
          <label className="emp-photo">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" />
            ) : (
              <>
                <NavIcon name="camera" size={28} color="var(--if-ink-3)" />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Upload photo</span>
                <span style={{ fontSize: 10 }}>or capture live</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              capture="user"
              aria-label="Profile photo"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onPhoto(file);
              }}
            />
          </label>
          <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 12, lineHeight: 1.4 }}>
            Photo is used for the profile & face-match verification on check-in.
          </div>
        </div>

        <div className="panel" style={{ padding: 24 }}>
          <div className="emp-grid-2">
            <Field label="Full name" required span={2} error={errors.name}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => void persist({ name }).catch(() => undefined)}
              />
            </Field>
            <Field label="Employee ID" hint="Auto-generated; you can override">
              <input
                className="if-num"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onBlur={() => void persist({ code }).catch(() => undefined)}
              />
            </Field>
            <Field label="Date of birth">
              <input type="date" value={dob} onChange={(event) => setDob(event.target.value)} onBlur={() => void persist({ dob }).catch(() => undefined)} />
            </Field>
            <Field label="Mobile number" required hint="Used for OTP login" error={errors.phone}>
              <div className="emp-prefix">
                <span>+91</span>
                <input
                  className="if-num"
                  inputMode="numeric"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  onBlur={() => void blurPhone()}
                />
              </div>
            </Field>
            <Field label="Personal email">
              <input placeholder="Optional" value={email} onChange={(event) => setEmail(event.target.value)} onBlur={() => void persist({ email }).catch(() => undefined)} />
            </Field>
            <Field label="Aadhaar number" required error={errors.aadhaar}>
              <input
                className="if-num"
                inputMode="numeric"
                value={aadhaar}
                onFocus={() => {
                  if (aadhaarMasked) {
                    setAadhaar("");
                    setAadhaarMasked(false);
                  }
                }}
                onChange={(event) => setAadhaar(event.target.value)}
                onBlur={() => void blurAadhaar()}
              />
            </Field>
            <Field label="PAN" error={errors.pan}>
              <input
                className="if-num"
                value={pan}
                onChange={(event) => setPan(event.target.value.toUpperCase())}
                onBlur={() => void persist({ pan }).catch(() => undefined)}
              />
            </Field>
            <div className="emp-rule" />
            <Field label="Address" span={2}>
              <input value={address} onChange={(event) => setAddress(event.target.value)} onBlur={() => void persist({ address }).catch(() => undefined)} />
            </Field>
            <div className="emp-section">Bank details</div>
            <Field label="Bank name">
              <input disabled placeholder="Off this product" />
            </Field>
            <Field label="Account number">
              <input className="if-num" disabled placeholder="Off this product" />
            </Field>
            <Field label="IFSC">
              <input className="if-num" disabled placeholder="Off this product" />
            </Field>
            <Field label="UPI ID (optional)">
              <input className="if-num" disabled placeholder="Off this product" />
            </Field>
            <div className="emp-section">Emergency contact</div>
            <Field label="Contact name">
              <input value={emergencyName} onChange={(event) => setEmergencyName(event.target.value)} onBlur={() => void persist({ emergencyName }).catch(() => undefined)} />
            </Field>
            <Field label="Relationship & phone">
              <input value={emergencyPhone} onChange={(event) => setEmergencyPhone(event.target.value)} onBlur={() => void persist({ emergencyPhone }).catch(() => undefined)} />
            </Field>
          </div>
        </div>
      </div>
    </EmployeeWizard>
  );
}
