import React, { useState, useEffect, useRef } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { motion } from "framer-motion";
import { getSettings, patchProfileSettings, patchNotificationSettings, patchSecuritySettings, patchDataRetentionSettings } from "../../../lib/api";

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

function SecurityTab({ s, onUpdate }) {
  const [saving, setSaving] = useState({});

  const toggle = async (key, val) => {
    setSaving(p => ({ ...p, [key]: true }));
    await patchSecuritySettings({ [key]: val });
    onUpdate(key, val);
    setSaving(p => ({ ...p, [key]: false }));
  };

  return (
    <div>
      <SectionCard title="Authentication">
        <SettingRow label="Password" description="Last changed 3 months ago." />
        <ToggleRow label="Two-factor authentication" description="Require a verification code at each login."
          checked={s.two_factor_enabled} onChange={v => toggle("two_factor_enabled", v)} saving={saving.two_factor_enabled} />
        <ToggleRow label="Login alerts" description="Email me when a new device signs into my account."
          checked={s.login_alerts} onChange={v => toggle("login_alerts", v)} saving={saving.login_alerts} />
      </SectionCard>
      <SectionCard title="Active Sessions">
        <SettingRow label="Current session" description="Windows 11 · Chrome · Accra, Ghana"
          badge={{ label: "Active", cls: " text-emerald-400 border-none" }} />
        <SettingRow label="Sign out all other sessions" description="Force sign-out on all other devices." danger onDanger={() => { }} />
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
        <h1 className="m-0 text-white text-[35px] font-medium">Settings</h1>
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
