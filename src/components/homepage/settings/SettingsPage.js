import React, { useState, useEffect, useRef } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { getSettings, patchProfileSettings, patchNotificationSettings, patchSecuritySettings, patchDataRetentionSettings, getSessions, signOut, signOutAll, revokeSession, changePassword } from "../../../lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1], delay: i * 0.07 },
  }),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function SettingRow({ label, description, value, fieldKey, onSave, badge, danger, onDanger }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value ?? ""); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    await onSave(fieldKey, draft);
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => { setDraft(value ?? ""); setEditing(false); };

  return (
    <div className="flex items-center justify-between py-5 border-b border-[#1a1a1a] last:border-0 gap-6">
      <div className="min-w-0 flex-1">
        <p className={`m-0 text-[15px] font-medium ${danger ? "text-red-400" : "text-white/80"}`}>
          {label}
        </p>
        {description && <p className="m-0 text-[14px] text-[#6b6a6a] mt-0">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.cls}`}>
            {badge.label}
          </span>
        )}

        {editing ? (
          <>
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
              className="bg-[#111] border border-[#0694FB]/40 text-white text-[14px] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#0694FB] w-52"
            />
            <button onClick={handleSave} disabled={saving}
              className="w-7 h-7 rounded-full bg-[#0694FB] border-none flex items-center justify-center cursor-pointer hover:bg-[#0578d1] transition-colors shrink-0 disabled:opacity-70">
              {saving
                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                : <FiCheck size={13} color="white" />
              }
            </button>
            <button onClick={handleCancel}
              className="w-7 h-7 rounded-full bg-[#1E1E1E] border border-[#2a2a2a] flex items-center justify-center cursor-pointer hover:bg-[#2a2a2a] transition-colors shrink-0">
              <FiX size={13} color="#6B6B6B" />
            </button>
          </>
        ) : (
          <>
            {value && <span className="text-[13.5px] text-[#ffffff] ">{value}</span>}
            {!danger && onSave && (
              <button onClick={() => setEditing(true)}
                className="text-[12px] font-medium px-3 py-1.5 rounded-full text-[#0694FB] hover:bg-[rgba(6,148,251,0.08)] bg-transparent cursor-pointer transition-colors">
                Edit
              </button>
            )}
            {danger && onDanger && (
              <button onClick={onDanger}
                className="text-[12px] font-medium px-3 py-1.5 rounded-lg  text-red-400 hover:bg-red-500/10 bg-transparent cursor-pointer transition-colors">
                Remove
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SliderRow({ label, description, value, min = 1, max = 30, unit = "days", onSave, fieldKey }) {
  const [draft, setDraft] = useState(value ?? max);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDraft(value ?? max); setDirty(false); }, [value, max]);

  const handleChange = (v) => {
    const clamped = Math.min(max, Math.max(min, v));
    setDraft(clamped);
    setDirty(clamped !== (value ?? max));
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    await onSave(fieldKey, draft);
    setSaving(false);
    setDirty(false);
  };

  const handleCancel = () => { setDraft(value ?? max); setDirty(false); };

  return (
    <div className="flex items-center justify-between py-5 border-b border-[#1a1a1a] last:border-0 gap-6">
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[15px] font-medium text-white/80">{label}</p>
        {description && <p className="m-0 text-[14px] text-[#6b6a6a] mt-0">{description}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {/* Stepper */}
        <div className="flex items-center bg-[#111] border border-[#1E1E1E] rounded-xl overflow-hidden">
          <button
            onClick={() => handleChange(draft - 1)}
            disabled={draft <= min}
            className="w-9 h-9 flex items-center justify-center text-[#6B6B6B] hover:text-white hover:bg-[#1E1E1E] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-none bg-transparent transition-colors text-[18px] font-light"
          >
            −
          </button>
          <span className="text-[14px] text-[#0694FB]  px-3 select-none min-w-[64px] text-center">
            {draft} {unit}
          </span>
          <button
            onClick={() => handleChange(draft + 1)}
            disabled={draft >= max}
            className="w-9 h-9 flex items-center justify-center text-[#6B6B6B] hover:text-white hover:bg-[#1E1E1E] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-none bg-transparent transition-colors text-[18px] font-light"
          >
            +
          </button>
        </div>
        <span className="text-[14px] text-[#6B6B6B] shrink-0">max {max}d</span>
        {dirty && (
          <>
            <button onClick={handleSave} disabled={saving}
              className="w-7 h-7 rounded-full bg-[#0694FB] border-none flex items-center justify-center cursor-pointer hover:bg-[#0578d1] transition-colors shrink-0 disabled:opacity-70">
              {saving
                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                : <FiCheck size={13} color="white" />}
            </button>
            <button onClick={handleCancel}
              className="w-7 h-7 rounded-full bg-[#1E1E1E] border border-[#2a2a2a] flex items-center justify-center cursor-pointer hover:bg-[#2a2a2a] transition-colors shrink-0">
              <FiX size={13} color="#6B6B6B" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, saving }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-[#1a1a1a] last:border-0 gap-6">
      <div className="min-w-0">
        <p className="m-0 text-[15px] font-medium text-white/80">{label}</p>
        {description && <p className="m-0 text-[14px] text-[#6b6a6a] mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saving && (
          <span className="w-3.5 h-3.5 border-2 border-[#0694FB]/30 border-t-[#0694FB] rounded-full animate-spin block" />
        )}
        <button
          onClick={() => !saving && onChange(!checked)}
          className={`relative w-10 h-5 rounded-full transition-colors border-none shrink-0 ${saving ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${checked ? "bg-[#0694FB]" : "bg-[#1E1E1E]"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${checked ? "left-[calc(100%-18px)]" : "left-0.5"}`} />
        </button>
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-[#0C0C0C] border border-[#1E1E1E] rounded-2xl px-6 py-2 mb-5">
      {title && (
        <p className="text-[11px] font-medium uppercase tracking-widest text-[#706f6f] mt-4 mb-1">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

// ── Tab Panels ────────────────────────────────────────────────────────────────

function ProfileTab({ s, onUpdate }) {
  const save = async (key, val) => {
    await patchProfileSettings({ [key]: val });
    onUpdate(key, val);
  };

  return (
    <div>
      <SectionCard>
        <SettingRow label="Profile photo" description="Displayed across the platform and in reports." />
        <SettingRow label="Full name" description="Your name as it appears on generated reports." value={s.full_name} fieldKey="full_name" onSave={save} />
        <SettingRow label="Role / Title" description="e.g. Radiologist, Oncologist, Technologist" value={s.role} />
        <SettingRow label="Specialty" description="Primary clinical specialty for AI model defaults." value={s.specialty} fieldKey="specialty" onSave={save} />
        <SettingRow label="Institution" description="Your hospital or clinic affiliation." value={s.institution} fieldKey="institution" onSave={save} />
        <SettingRow label="License number" description="Medical license for report signing." value={s.license_number} fieldKey="license_number" onSave={save} />
      </SectionCard>
      <SectionCard title="Contact">
        <SettingRow label="Email address" description="Used for login and notifications." value={s.email} fieldKey="email" onSave={save} />
        <SettingRow label="Phone number" description="Optional — used for urgent alerts." value={s.phone_number} fieldKey="phone_number" onSave={save} />
      </SectionCard>
    </div>
  );
}

function ChangePasswordDialog({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const currentRef = useRef(null);

  useEffect(() => { setTimeout(() => currentRef.current?.focus(), 50); }, []);

  const handleSave = async () => {
    setError(null);
    if (!current) { setError("Enter your current password."); return; }
    if (next.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      await changePassword({ current_password: current, new_password: next });
      setSuccess(true);
      setTimeout(onClose, 1600);
    } catch (err) {
      setError(err.message || "Could not change password.");
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={saving ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-[420px] bg-[#161616] border border-[#1E1E1E] rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-7 pb-5">
          <div>
            <h2 className="text-white text-[17px] font-medium m-0">Change Password</h2>
            <p className="text-[#6B6B6B] text-[13px] m-0 mt-1">Enter your current password to set a new one.</p>
          </div>
          <button onClick={onClose} disabled={saving}
            className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5 disabled:opacity-30">
            <FiX size={18} />
          </button>
        </div>

        {/* Fields */}
        <div className="px-7 pb-2 flex flex-col gap-3">
          <div>
            <label className="text-[12px] text-[#6B6B6B] mb-1.5 block">Current password</label>
            <input
              ref={currentRef}
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              disabled={saving || success}
              className="bg-[#111] border border-[#1E1E1E] focus:border-[#0694FB]/50 text-white text-[14px] rounded-xl px-4 py-2.5 focus:outline-none w-full transition-colors disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[12px] text-[#6B6B6B] mb-1.5 block">New password</label>
            <input
              type="password"
              placeholder="Minimum 8 characters"
              value={next}
              onChange={e => setNext(e.target.value)}
              disabled={saving || success}
              className="bg-[#111] border border-[#1E1E1E] focus:border-[#0694FB]/50 text-white text-[14px] rounded-xl px-4 py-2.5 focus:outline-none w-full transition-colors disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[12px] text-[#6B6B6B] mb-1.5 block">Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
              disabled={saving || success}
              className="bg-[#111] border border-[#1E1E1E] focus:border-[#0694FB]/50 text-white text-[14px] rounded-xl px-4 py-2.5 focus:outline-none w-full transition-colors disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="m-0 text-[13px] text-red-400 flex items-center gap-1.5">
              <FiX size={13} className="shrink-0" />{error}
            </p>
          )}
          {success && (
            <p className="m-0 text-[13px] text-emerald-400 flex items-center gap-1.5">
              <FiCheck size={13} className="shrink-0" />Password changed successfully.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 pt-4 pb-6 flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-full bg-transparent border border-[#2a2a2a] text-[#6B6B6B] hover:text-white hover:border-[#3a3a3a] text-[13px] font-medium cursor-pointer transition-colors disabled:opacity-30">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || success}
            className="flex-1 py-2.5 rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium border-none cursor-pointer transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin block" />}
            {saving ? "Saving…" : "Save password"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ChangePasswordRow() {
  const [open, setOpen] = useState(false);
  const [justChanged, setJustChanged] = useState(false);

  const handleClose = () => {
    setOpen(false);
    setJustChanged(true);
    setTimeout(() => setJustChanged(false), 3000);
  };

  return (
    <>
      <div className="flex items-center justify-between py-5 border-b border-[#1a1a1a] gap-6">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[15px] font-medium text-white/80">Password</p>
          <p className={`m-0 text-[14px] mt-0 ${justChanged ? "text-emerald-400" : "text-[#6b6a6a]"}`}>
            {justChanged ? "Password changed successfully." : "Update your account password."}
          </p>
        </div>
        <button onClick={() => setOpen(true)}
          className="text-[12px] font-medium px-3 py-1.5 rounded-full text-[#0694FB] hover:bg-[rgba(6,148,251,0.08)] bg-transparent cursor-pointer transition-colors">
          Change
        </button>
      </div>

      <AnimatePresence>
        {open && <ChangePasswordDialog onClose={handleClose} />}
      </AnimatePresence>
    </>
  );
}

function SecurityTab({ s, onUpdate }) {
  const [saving, setSaving] = useState({});
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [signOutAllLoading, setSignOutAllLoading] = useState(false);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, []);

  const toggle = async (key, val) => {
    setSaving(p => ({ ...p, [key]: true }));
    await patchSecuritySettings({ [key]: val });
    onUpdate(key, val);
    setSaving(p => ({ ...p, [key]: false }));
  };

  const handleRevokeSession = async (id) => {
    setRevokingId(id);
    try {
      await revokeSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch { }
    setRevokingId(null);
  };

  const handleSignOutAll = async () => {
    setSignOutAllLoading(true);
    try {
      await signOutAll();
      // Sign out locally too — all sessions including current are revoked
      try { await signOut(); } catch { }
      ["token", "refresh_token", "name", "role", "sub", "email"].forEach(k => localStorage.removeItem(k));
      window.location.href = "/";
    } catch {
      setSignOutAllLoading(false);
    }
  };

  return (
    <div>
      <SectionCard title="Authentication">
        <ChangePasswordRow />
        <ToggleRow label="Two-factor authentication" description="Require a verification code at each login."
          checked={s.two_factor_enabled} onChange={v => toggle("two_factor_enabled", v)} saving={saving.two_factor_enabled} />
        <ToggleRow label="Login alerts" description="Email me when a new device signs into my account."
          checked={s.login_alerts} onChange={v => toggle("login_alerts", v)} saving={saving.login_alerts} />
      </SectionCard>
      <SectionCard title="Active Sessions">
        {sessionsLoading ? (
          <p className="text-[14px] text-[#6b6a6a] py-4 m-0">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="text-[14px] text-[#6b6a6a] py-4 m-0">No active sessions found.</p>
        ) : (
          sessions.map(session => (
            <div key={session.id} className="flex items-center justify-between py-5 border-b border-[#1a1a1a] last:border-0 gap-6">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="m-0 text-[15px] font-medium text-white/80">
                    {session.device_hint || "Unknown device"}
                  </p>
                  {session.is_current && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-emerald-400">
                      Current
                    </span>
                  )}
                </div>
                <p className="m-0 text-[14px] text-[#6b6a6a]">
                  {session.ip_address || "Unknown IP"} · Last active {new Date(session.last_active_at).toLocaleDateString()}
                </p>
              </div>
              {!session.is_current && (
                <button
                  onClick={() => handleRevokeSession(session.id)}
                  disabled={revokingId === session.id}
                  className="text-[13px] text-red-400 hover:text-red-300 bg-transparent border-none cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {revokingId === session.id ? "Revoking…" : "Revoke"}
                </button>
              )}
            </div>
          ))
        )}
        <SettingRow
          label="Sign out all sessions"
          description="Force sign-out on all devices including this one."
          danger
          onDanger={handleSignOutAll}
          value={signOutAllLoading ? "Signing out…" : undefined}
        />
      </SectionCard>
    </div>
  );
}

const NOTIF_KEYS = ["notify_job_completed", "notify_job_failed", "notify_urgent_case_flagged", "notify_report_ready", "notify_new_patient", "notify_weekly_digest"];

function NotificationsTab({ s, onUpdate }) {
  const [saving, setSaving] = useState({});

  const toggle = async (key, val) => {
    setSaving(p => ({ ...p, [key]: true }));
    // build full notifications payload (API expects all fields)
    const payload = {};
    NOTIF_KEYS.forEach(k => { payload[k] = k === key ? val : s[k]; });
    await patchNotificationSettings(payload);
    onUpdate(key, val);
    setSaving(p => ({ ...p, [key]: false }));
  };

  return (
    <div>
      <SectionCard title="Job & Inference Alerts">
        <ToggleRow label="Inference job completed" description="Notify when an AI analysis finishes." checked={s.notify_job_completed} onChange={v => toggle("notify_job_completed", v)} saving={saving.notify_job_completed} />
        <ToggleRow label="Inference job failed" description="Alert if a job errors or times out." checked={s.notify_job_failed} onChange={v => toggle("notify_job_failed", v)} saving={saving.notify_job_failed} />
        <ToggleRow label="Urgent case flagged" description="Immediate alert when severity is marked Emergency or High." checked={s.notify_urgent_case_flagged} onChange={v => toggle("notify_urgent_case_flagged", v)} saving={saving.notify_urgent_case_flagged} />
        <ToggleRow label="Report ready for review" description="Notify when an AI-generated report is drafted." checked={s.notify_report_ready} onChange={v => toggle("notify_report_ready", v)} saving={saving.notify_report_ready} />
      </SectionCard>
      <SectionCard title="Patient & Case Activity">
        <ToggleRow label="New patient added" description="Alert when a new patient is registered." checked={s.notify_new_patient} onChange={v => toggle("notify_new_patient", v)} saving={saving.notify_new_patient} />
        <ToggleRow label="Weekly digest" description="Summary of jobs, cases, and studies every Monday." checked={s.notify_weekly_digest} onChange={v => toggle("notify_weekly_digest", v)} saving={saving.notify_weekly_digest} />
      </SectionCard>
    </div>
  );
}


function DataTab({ s, onUpdate }) {
  const save = async (key, val) => {
    await patchDataRetentionSettings({ [key]: val });
    onUpdate(key, val);
  };

  return (
    <div>
      <SectionCard title="Data Life Cycle">
        <SliderRow
          label="Inference data retention"
          description="How long we keep your AI inference results on our servers before automatic deletion."
          value={s.data_retention_days ?? 30}
          min={1}
          max={30}
          unit="days"
          fieldKey="data_retention_days"
          onSave={save}
        />
      </SectionCard>
    </div>
  );
}

// placeholder — keep old signature for unused tabs
// eslint-disable-next-line no-unused-vars
function NotificationsTabOLD() {
  const [state, setState] = useState({
    jobComplete: true,
    jobFailed: true,
    urgentCase: true,
    reportReady: false,
    newPatient: false,
    weeklyDigest: true,
    emailNotifs: true,
    browserNotifs: false,
  });

  const toggle = (key) => setState(s => ({ ...s, [key]: !s[key] }));

  return (
    <div>
      <SectionCard title="Job & Inference Alerts">
        <ToggleRow label="Inference job completed" description="Notify when an AI analysis finishes." checked={state.jobComplete} onChange={() => toggle("jobComplete")} />
        <ToggleRow label="Inference job failed" description="Alert if a job errors or times out." checked={state.jobFailed} onChange={() => toggle("jobFailed")} />
        <ToggleRow label="Urgent case flagged" description="Immediate alert when severity is marked Emergency or High." checked={state.urgentCase} onChange={() => toggle("urgentCase")} />
        <ToggleRow label="Report ready for review" description="Notify when an AI-generated report is drafted." checked={state.reportReady} onChange={() => toggle("reportReady")} />
      </SectionCard>

      <SectionCard title="Patient & Case Activity">
        <ToggleRow label="New patient added" description="Alert when a new patient is registered." checked={state.newPatient} onChange={() => toggle("newPatient")} />
        <ToggleRow label="Weekly digest" description="Summary of jobs, cases, and studies every Monday." checked={state.weeklyDigest} onChange={() => toggle("weeklyDigest")} />
      </SectionCard>

      <SectionCard title="Delivery Channels">
        <ToggleRow label="Email notifications" description="Receive alerts at your registered email address." checked={state.emailNotifs} onChange={() => toggle("emailNotifs")} />
        <ToggleRow label="Browser notifications" description="Push alerts while using the dashboard." checked={state.browserNotifs} onChange={() => toggle("browserNotifs")} />
      </SectionCard>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function AIModelsTab() {
  const [autoAnalysis, setAutoAnalysis] = useState(false);
  const [cacheResults, setCacheResults] = useState(true);

  return (
    <div>
      <SectionCard title="Inference Defaults">
        <SettingRow
          label="Default AI model"
          description="Pre-selected model when opening the workspace viewer."
          value="BrainTumorNet v2"
          onEdit={() => { }}
        />
        <SettingRow
          label="Confidence threshold"
          description="Minimum confidence to display a prediction (0–100%)."
          value="70%"
          onEdit={() => { }}
        />
        <ToggleRow
          label="Auto-run analysis on series open"
          description="Automatically trigger inference when a series loads."
          checked={autoAnalysis}
          onChange={setAutoAnalysis}
        />
        <ToggleRow
          label="Cache inference results"
          description="Store results locally to avoid re-running on revisit."
          checked={cacheResults}
          onChange={setCacheResults}
        />
      </SectionCard>

      <SectionCard title="Report Generation">
        <SettingRow
          label="Default report language"
          description="Language used when generating AI narrative reports."
          value="English"
          onEdit={() => { }}
        />
        <SettingRow
          label="Report template"
          description="Structure used for AI-generated findings."
          value="Standard Radiology"
          onEdit={() => { }}
        />
      </SectionCard>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function DicomTab() {
  const [tlsEnabled, setTlsEnabled] = useState(true);

  return (
    <div>
      <SectionCard title="DICOM Server">
        <SettingRow label="AE Title" description="Application Entity title for this node." value="INTELLIDIAG" onEdit={() => { }} />
        <SettingRow label="Host / IP" description="Listening address for incoming DICOM connections." value="0.0.0.0" onEdit={() => { }} />
        <SettingRow label="Port" description="Default DICOM port." value="4242" onEdit={() => { }} />
        <ToggleRow label="TLS encryption" description="Encrypt all DICOM traffic (recommended)." checked={tlsEnabled} onChange={setTlsEnabled} />
      </SectionCard>

      <SectionCard title="PACS Connection">
        <SettingRow
          label="PACS AE Title"
          description="Remote PACS server AE title."
          value="ORTHANC_PACS"
          onEdit={() => { }}
        />
        <SettingRow
          label="PACS host"
          description="IP or hostname of the remote PACS."
          value="192.168.1.100"
          onEdit={() => { }}
        />
        <SettingRow
          label="PACS port"
          description="Port of the remote PACS server."
          value="11112"
          onEdit={() => { }}
        />
        <SettingRow
          label="Test connection"
          description="Send a C-ECHO to verify PACS reachability."
          onEdit={() => { }}
        />
      </SectionCard>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function IntegrationsTab() {
  return (
    <div>
      <SectionCard title="Connected Systems">
        <SettingRow
          label="EMR / EHR"
          description="Connect to your hospital's Electronic Medical Record system."
          badge={{ label: "Not connected", cls: "bg-[#1E1E1E] text-[#3a3a3a] border-[#2a2a2a]" }}
          onEdit={() => { }}
        />
        <SettingRow
          label="RIS (Radiology Information System)"
          description="Sync worklists and order management."
          badge={{ label: "Not connected", cls: "bg-[#1E1E1E] text-[#3a3a3a] border-[#2a2a2a]" }}
          onEdit={() => { }}
        />
        <SettingRow
          label="HL7 / FHIR endpoint"
          description="Receive structured patient data via HL7 or FHIR R4."
          badge={{ label: "Connected", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" }}
          value="https://fhir.hospital.gh/r4"
          onEdit={() => { }}
        />
      </SectionCard>

      <SectionCard title="Webhooks">
        <SettingRow
          label="Job completion webhook"
          description="POST to your endpoint when inference finishes."
          value="https://—"
          onEdit={() => { }}
        />
        <SettingRow
          label="Urgent case webhook"
          description="Trigger an external alert on high-severity findings."
          value="https://—"
          onEdit={() => { }}
        />
      </SectionCard>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "profile", label: "My Profile" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "data", label: "Data" },
  // { id: "dicom",         label: "DICOM" },
  // { id: "integrations",  label: "Integrations" },
];

const DEFAULT_SETTINGS = {
  full_name: "", role: "", specialty: "", institution: "",
  license_number: "", email: "", phone_number: "",
  notify_job_completed: false, notify_job_failed: false,
  notify_urgent_case_flagged: false, notify_report_ready: false,
  notify_new_patient: false, notify_weekly_digest: false,
  two_factor_enabled: false, login_alerts: false,
};

function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then(data => { if (data) setSettings(data); })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setSettings(s => ({ ...s, [key]: value }));
  };

  const renderTab = () => {
    if (loading) return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#0694FB]/30 border-t-[#0694FB] rounded-full animate-spin" />
      </div>
    );
    switch (activeTab) {
      case "profile": return <ProfileTab s={settings} onUpdate={handleChange} />;
      case "security": return <SecurityTab s={settings} onUpdate={handleChange} />;
      case "notifications": return <NotificationsTab s={settings} onUpdate={handleChange} />;
      case "data": return <DataTab s={settings} onUpdate={handleChange} />;
      default: return null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-y-auto pb-8 pr-1"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}
    >
      {/* Header */}
      <motion.div className="shrink-0 mb-6" variants={fadeUp} initial="hidden" animate="show" custom={0}>
        <h1 className="m-0 text-white font-medium text-[40px] md:text-[32px] leading-[1.2] mt-0 mb-0">Settings</h1>
        <p className="m-0 text-[#999898] text-[13px] mt-0">Manage your account, preferences, and integrations.</p>
      </motion.div>

      {/* Tabs */}
      <motion.div className="flex items-center gap-1 border-b border-[#1a1a1a] mb-6 shrink-0" variants={fadeUp} initial="hidden" animate="show" custom={1}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-[15px] font-medium rounded-t-lg border-none cursor-pointer transition-colors bg-transparent whitespace-nowrap ${activeTab === tab.id
                ? "text-[#0694FB] border-b-2 border-[#0694FB]"
                : "text-[#7e7d7d] hover:text-white/80"
              }`}
            style={activeTab === tab.id ? { borderBottom: "2px solid #0694FB", marginBottom: "-1px" } : { marginBottom: "-1px" }}
          >
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Tab content */}
      <motion.div className="flex-1" variants={fadeUp} initial="hidden" animate="show" custom={2}>
        {renderTab()}
      </motion.div>
    </div>
  );
}

export default SettingsPage;
