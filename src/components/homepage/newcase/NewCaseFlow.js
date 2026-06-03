import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiUploadCloud, FiX, FiCheck } from "react-icons/fi";
import { uid } from "../../../lib/uid";

// ─── Step indicator ────────────────────────────────────────────────────────────
const steps = [
  { number: 1, label: "Patient Info" },
  { number: 2, label: "Case Details" },
  // { number: 3, label: "Upload Scans" },
  // { number: 4, label: "AI Models" },
];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-7">
      {steps.map((step, i) => (
        <React.Fragment key={step.number}>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${current > step.number
                  ? "bg-[#0694FB] text-white"
                  : current === step.number
                    ? "bg-[#0694FB] text-white ring-4 ring-[rgba(6,148,251,0.2)]"
                    : "bg-[#1a1a1a] text-[#4a4a4a] border border-[#2a2a2a]"
                }`}
            >
              {current > step.number ? <FiCheck size={12} /> : step.number}
            </div>
            <span
              className={`text-[10px] font-medium whitespace-nowrap ${current >= step.number ? "text-[#0694FB]" : "text-[#4a4a4a]"
                }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-px w-12 mb-5 mx-1 transition-all duration-300 ${current > step.number ? "bg-[#0694FB]" : "bg-[#2a2a2a]"
                }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const inputCls =
  "w-full bg-[#111111] border border-[#1E1E1E] rounded-xl px-4 py-2.5 text-white text-sm outline-none placeholder-[#3a3a3a] focus:border-[#0694FB] transition-colors";
const labelCls = "text-[#6B6B6B] text-xs mb-1.5 block";

// ─── Step 1: Patient Info ──────────────────────────────────────────────────────
function StepPatientInfo({ data, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className={labelCls}>Full Name</label>
        <input type="text" placeholder="e.g. Courtney Smith" value={data.fullName || ""} onChange={(e) => onChange("fullName", e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Date of Birth</label>
        <input type="date" value={data.dob || ""} onChange={(e) => onChange("dob", e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Gender</label>
        <select value={data.gender || ""} onChange={(e) => onChange("gender", e.target.value)} className={`${inputCls} [&>option]:bg-[#111]`}>
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>MRN #</label>
        <input type="text" placeholder="e.g. 6864558" value={data.mrn || ""} onChange={(e) => onChange("mrn", e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Phone</label>
        <input type="tel" placeholder="+1 555 000 0000" value={data.phone || ""} onChange={(e) => onChange("phone", e.target.value)} className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Email</label>
        <input type="email" placeholder="patient@example.com" value={data.email || ""} onChange={(e) => onChange("email", e.target.value)} className={inputCls} />
      </div>
    </div>
  );
}

// ─── Step 2: Case Details ──────────────────────────────────────────────────────
const urgencyOptions = [
  { value: "Emergency", color: "text-[#FF3B3B] bg-[rgba(255,59,59,0.1)] border-[rgba(255,59,59,0.3)]" },
  { value: "Immediate", color: "text-[#FF6B35] bg-[rgba(255,107,53,0.1)] border-[rgba(255,107,53,0.3)]" },
  { value: "Less Urgent", color: "text-[#A855F7] bg-[rgba(168,85,247,0.1)] border-[rgba(168,85,247,0.3)]" },
  { value: "Routine", color: "text-[#0694FB] bg-[rgba(6,148,251,0.1)] border-[rgba(6,148,251,0.3)]" },
];

function StepCaseDetails({ data, onChange }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelCls}>Reason for Appointment</label>
        <input type="text" placeholder="e.g. Forearm fracture, Neck pain..." value={data.reason || ""} onChange={(e) => onChange("reason", e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Urgency Level</label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {urgencyOptions.map((u) => (
            <button key={u.value} onClick={() => onChange("urgency", u.value)}
              className={`py-2 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all duration-200 ${data.urgency === u.value ? u.color : "text-[#4a4a4a] bg-transparent border-[#1E1E1E] hover:border-[#2a2a2a]"}`}>
              {u.value}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Appointment Date</label>
          <input type="date" value={data.appointmentDate || ""} onChange={(e) => onChange("appointmentDate", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Appointment Time</label>
          <input type="time" value={data.appointmentTime || ""} onChange={(e) => onChange("appointmentTime", e.target.value)} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Additional Notes</label>
        <textarea placeholder="Any additional information..." value={data.notes || ""} onChange={(e) => onChange("notes", e.target.value)} rows={3} className={`${inputCls} resize-none`} />
      </div>
    </div>
  );
}

// ─── Step 3: Upload Scans ──────────────────────────────────────────────────────
function StepUploadScans({ scans, onAdd, onRemove }) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    const newScans = Array.from(files).map((file) => ({
      id: uid(),
      url: URL.createObjectURL(file),
      name: file.name,
      file,
    }));
    onAdd(newScans);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-7 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${dragging ? "border-[#0694FB] bg-[rgba(6,148,251,0.05)]" : "border-[#2a2a2a] hover:border-[#0694FB] hover:bg-[rgba(6,148,251,0.03)]"}`}
      >
        <FiUploadCloud size={28} color="#0694FB" />
        <div className="text-center">
          <p className="text-white text-sm font-medium m-0">Drop scans here or click to browse</p>
          <p className="text-[#4a4a4a] text-xs m-0 mt-0.5">Supports JPEG, PNG, DICOM</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {scans.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {scans.map((scan) => (
            <div key={scan.id} className="relative group rounded-xl overflow-hidden aspect-square bg-[#111]">
              <img src={scan.url} alt={scan.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onClick={(e) => { e.stopPropagation(); onRemove(scan.id); }} className="bg-[rgba(255,59,59,0.8)] rounded-full p-1 cursor-pointer border-none">
                  <FiX size={12} color="white" />
                </button>
              </div>
              <p className="absolute bottom-0 left-0 right-0 text-[9px] text-white/70 bg-black/60 px-1.5 py-0.5 truncate m-0">{scan.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 4: AI Models ─────────────────────────────────────────────────────────
const availableModels = [
  { id: "brain-tumor", name: "Brain Tumor Classifier", category: "Neuro", tag: "Brain Tumor", tagColor: "text-[#FF4A4A] bg-[rgba(255,74,74,0.17)]" },
  { id: "chest-xray", name: "Chest X-Ray Analyzer", category: "Pulmonology", tag: "Pneumonia", tagColor: "text-[#0694FB] bg-[rgba(6,148,251,0.17)]" },
  { id: "fracture", name: "Fracture Detection", category: "Orthopedics", tag: "Fracture", tagColor: "text-[#FF6B35] bg-[rgba(255,107,53,0.17)]" },
  { id: "skin-lesion", name: "Skin Lesion Detector", category: "Dermatology", tag: "Lesion", tagColor: "text-[#A855F7] bg-[rgba(168,85,247,0.17)]" },
  { id: "retinal", name: "Retinal Scan Analysis", category: "Ophthalmology", tag: "Diabetic Ret.", tagColor: "text-[#22C55E] bg-[rgba(34,197,94,0.17)]" },
  { id: "spine", name: "Spine Alignment Model", category: "Orthopedics", tag: "Spinal Stenosis", tagColor: "text-[#F59E0B] bg-[rgba(245,158,11,0.17)]" },
];

function StepAIModels({ selected, onToggle }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[#6B6B6B] text-xs m-0">Select one or more AI models to analyse the uploaded scans.</p>
      <div className="grid grid-cols-2 gap-2">
        {availableModels.map((model) => {
          const isSelected = selected.includes(model.id);
          return (
            <div key={model.id} onClick={() => onToggle(model.id)}
              className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all duration-200 ${isSelected ? "border-[#0694FB] bg-[rgba(6,148,251,0.08)]" : "border-[#1E1E1E] bg-[#111] hover:border-[#2a2a2a]"}`}>
              <div className="w-10 h-10 rounded-lg bg-black shrink-0 flex items-center justify-center">
                <div className="w-5 h-5 rounded bg-[#1a1a1a]" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-white text-[11px] font-medium m-0 truncate">{model.name}</p>
                <p className="text-[#4a4a4a] text-[10px] m-0">{model.category}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full w-fit ${model.tagColor}`}>{model.tag}</span>
              </div>
              <div className={`ml-auto w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${isSelected ? "border-[#0694FB] bg-[#0694FB]" : "border-[#2a2a2a]"}`}>
                {isSelected && <FiCheck size={9} color="white" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
function NewCaseModal({ isOpen, onClose, onCreated }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [patientInfo, setPatientInfo] = useState({});
  const [caseDetails, setCaseDetails] = useState({});
  const [scans, setScans] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setPatientInfo({});
      setCaseDetails({});
      setScans([]);
      setSelectedModels([]);
      setSubmitError("");
    }
  }, [isOpen]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const updatePatient = (key, val) => setPatientInfo((p) => ({ ...p, [key]: val }));
  const updateCase = (key, val) => setCaseDetails((p) => ({ ...p, [key]: val }));
  const addScans = (newScans) => setScans((s) => [...s, ...newScans]);
  const removeScan = (id) => setScans((s) => s.filter((x) => x.id !== id));
  const toggleModel = (id) => setSelectedModels((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id]);

  const canProceed = () => {
    if (step === 1) return !!patientInfo.fullName && !!patientInfo.gender;
    if (step === 2) return !!caseDetails.reason && !!caseDetails.urgency;
    return true;
  };

  const handleNext = async () => {
    if (step < steps.length) { setStep((s) => s + 1); return; }

    setSubmitting(true);
    setSubmitError("");

    try {
      const baseURL = process.env.REACT_APP_API_URL || "";
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // ── 1. Create patient ──────────────────────────────────────────────────
      const patientBody = { full_name: patientInfo.fullName, gender: patientInfo.gender };
      if (patientInfo.mrn) patientBody.mrn = patientInfo.mrn;
      if (patientInfo.phone) patientBody.phone = patientInfo.phone;
      if (patientInfo.email) patientBody.email = patientInfo.email;

      const patientRes = await fetch(`${baseURL}/patients/`, {
        method: "POST",
        headers,
        body: JSON.stringify(patientBody),
      });
      console.log(patientBody)
      if (!patientRes.ok) {
        const err = await patientRes.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to create patient");
      }


      const { id: patient_id } = await patientRes.json();

      // ── 2. Create case ─────────────────────────────────────────────────────
      const caseBody = {
        title: caseDetails.reason,
        reason: caseDetails.reason,
        urgency: caseDetails.urgency.toLowerCase().replace(/ /g, "_"),
        patient_id,
      };
      if (caseDetails.appointmentDate && caseDetails.appointmentTime)
        caseBody.appointment_datetime = new Date(`${caseDetails.appointmentDate}T${caseDetails.appointmentTime}`).toISOString();
      else if (caseDetails.appointmentDate)
        caseBody.appointment_datetime = new Date(caseDetails.appointmentDate).toISOString();
      if (caseDetails.notes) caseBody.notes = caseDetails.notes;

      const caseRes = await fetch(`${baseURL}/cases/`, {
        method: "POST",
        headers,
        body: JSON.stringify(caseBody),
      });
      if (!caseRes.ok) {
        const err = await caseRes.json().catch(() => ({}));
        console.error("Case 422 detail:", JSON.stringify(err.detail, null, 2));
        const msg = Array.isArray(err.detail)
          ? err.detail.map(d => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(", ")
          : err.detail || err.message || "Failed to create case";
        throw new Error(msg);
      }
      const newCase = await caseRes.json();

      onClose();
      onCreated?.();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitles = [
    { title: "Patient Information", sub: "Enter the patient's personal details" },
    { title: "Case Details", sub: "Describe the appointment and urgency" },
    // { title: "Upload Scans", sub: "Add medical images for analysis" },
    // { title: "Select AI Models", sub: "Choose which models to run on the scans" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal card */}
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[580px] max-h-[90vh] bg-[#161616] border border-[#1E1E1E] rounded-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-7 pb-0 shrink-0">
              <div>
                <h2 className="text-white text-lg font-medium m-0">{stepTitles[step - 1].title}</h2>
                <p className="text-[#6B6B6B] text-xs m-0 mt-0.5">{stepTitles[step - 1].sub}</p>
              </div>
              <button onClick={onClose} className="text-[#4a4a4a] hover:text-white transition-colors cursor-pointer bg-transparent border-none p-1 mt-0.5">
                <FiX size={18} />
              </button>
            </div>

            {/* Step indicator */}
            <div className="px-7 pt-5 shrink-0">
              <StepIndicator current={step} />
            </div>

            {/* Scrollable step content */}
            <div className="overflow-y-auto flex-1 px-7 pb-0">
              {step === 1 && <StepPatientInfo data={patientInfo} onChange={updatePatient} />}
              {step === 2 && <StepCaseDetails data={caseDetails} onChange={updateCase} />}
              {/* {step === 3 && <StepUploadScans scans={scans} onAdd={addScans} onRemove={removeScan} />} */}
              {/* {step === 4 && <StepAIModels selected={selectedModels} onToggle={toggleModel} />} */}
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-2 px-7 py-5 border-t border-[#1E1E1E] shrink-0 mt-5">
              {submitError && (
                <p className="text-[#FF6B6B] text-xs text-center m-0">{submitError}</p>
              )}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => (step === 1 ? onClose() : setStep((s) => s - 1))}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl border border-[#1E1E1E] text-[#6B6B6B] text-sm bg-transparent hover:border-[#2a2a2a] hover:text-white cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {step === 1 ? "Cancel" : "Back"}
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-[#3a3a3a] text-xs">Step {step} of {steps.length}</span>
                  <button
                    onClick={handleNext}
                    disabled={!canProceed() || submitting}
                    className={`px-5 py-2 rounded-md text-sm font-medium border-none transition-all duration-200 ${canProceed() && !submitting ? "bg-[#0694FB] text-white cursor-pointer hover:bg-[#0578d1]" : "bg-[#1a1a1a] text-[#3a3a3a] cursor-not-allowed"}`}
                  >
                    {submitting ? "Creating…" : step === steps.length ? "Finish" : "Continue"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default NewCaseModal;
