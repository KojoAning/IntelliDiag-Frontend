import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Appbar from "../appbar/appbar";
import Sidebar from "../sidebar/Sidebar";
import SeriesGrid from "./SeriesGrid";
import AddSeriesModal from "./AddSeriesModal";
import { getSeriesForStudy, deleteSeries } from "../../../lib/api";
import { FiShare2, FiFileText, FiPlusCircle } from "react-icons/fi";

const mockCase = {
  patientName: "Darrell Steward",
  age: 32,
  gender: "Male",
  caseId: "CASE-2024-00112",
  status: "In Review",
  dateCreated: "Jan 15, 2024",
  referringPhysician: "Dr. James Osei",
};

const statusColors = {
  "In Review": "text-[#F59E0B] bg-[rgba(245,158,11,0.12)]",
  "AI Flagged": "text-[#FF6B35] bg-[rgba(255,107,53,0.12)]",
  "Pending Review": "text-[#0694FB] bg-[rgba(6,148,251,0.12)]",
  "Completed": "text-[#22C55E] bg-[rgba(34,197,94,0.12)]",
};

export const mockStudies = [
  {
    id: "study-1",
    name: "MRI Knee",
    modality: "MRI",
    date: "Jan 15, 2024",
    accession: "ACC-2024-00121",
    status: "AI Flagged",
    region: "Right Knee",
    imageCount: 86,
    series: [
      { id: "s1-1", name: "Axial T2", description: "24 images · TR 4500 TE 90", images: [], expanded: false },
      { id: "s1-2", name: "Sagittal PD", description: "18 images · TR 3200 TE 30", images: [], expanded: false },
      { id: "s1-3", name: "Coronal T1", description: "20 images · TR 600 TE 14", images: [], expanded: false },
      { id: "s1-4", name: "Diffusion", description: "24 images · b=1000", images: [], expanded: false },
    ],
  },
  {
    id: "study-2",
    name: "CT Chest",
    modality: "CT",
    date: "Jan 10, 2024",
    accession: "ACC-2024-00098",
    status: "Pending Review",
    region: "Chest",
    imageCount: 210,
    series: [
      { id: "s2-1", name: "Lung Window", description: "70 images · WL -600 WW 1500", images: [], expanded: false },
      { id: "s2-2", name: "Soft Tissue Window", description: "70 images · WL 40 WW 400", images: [], expanded: false },
      { id: "s2-3", name: "Bone Window", description: "70 images · WL 400 WW 1800", images: [], expanded: false },
    ],
  },
  {
    id: "study-3",
    name: "X-Ray Right Wrist",
    modality: "X-Ray",
    date: "Dec 28, 2023",
    accession: "ACC-2023-00451",
    status: "Completed",
    region: "Right Wrist",
    imageCount: 4,
    series: [
      { id: "s3-1", name: "PA View", description: "2 images · Standard", images: [], expanded: false },
      { id: "s3-2", name: "Lateral View", description: "2 images · Standard", images: [], expanded: false },
    ],
  },
];

function CaseDashboard() {
  const { state: navState } = useLocation();
  const navigate = useNavigate();

  // Resolve active study from nav state or default to first study
  const initialStudy = navState?.studyId
    ? mockStudies.find(s => s.id === navState.studyId) ?? mockStudies[0]
    : mockStudies[0];

  const [studies, setStudies] = useState(mockStudies);
  const [activeStudy, setActiveStudy] = useState(initialStudy);
  const [addSeriesOpen, setAddSeriesOpen] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError]     = useState(null);

  // Fetch series for the active study from the API
  useEffect(() => {
    const studyId = navState?.studyId ?? activeStudy.id;
    if (!studyId) return;

    let cancelled = false;
    setSeriesLoading(true);
    setSeriesError(null);

    getSeriesForStudy(studyId)
      .then(data => {
        console.log(data)
        if (cancelled) return;
        const series = (data ?? []).map(s => ({
          id:          s.id,
          name:        s.series_name,
          description: s.description ?? "",
          modality:    s.modality    ?? "",
          image_count: s.image_count??0,
          expanded:    false,
        }));
        setActiveStudy(prev => ({ ...prev, series }));
      })
      .catch(err => {
        if (!cancelled) setSeriesError(err.message);
      })
      .finally(() => {
        if (!cancelled) setSeriesLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState?.studyId, activeStudy.id]);

  const openSeries = (series) => {
    navigate("/case-workspace/viewer", { state: { study: activeStudy, series } });
  };

 

  const handleDeleteSeries = async (seriesId) => {
    await deleteSeries(seriesId);
    setActiveStudy(prev => ({ ...prev, series: prev.series.filter(s => s.id !== seriesId) }));
  };

  const handleAddSeries = (newSeries) => {
    setStudies(prev => prev.map(s =>
      s.id === activeStudy.id
        ? { ...s, series: [...s.series, ...newSeries] }
        : s
    ));

    setActiveStudy(prev => ({ ...prev, series: [...prev.series, ...newSeries] }));
  };

  return (
    <div className="m-0 p-0 h-screen bg-black w-screen">
      <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
        <Appbar />

        <div className="w-full flex flex-row gap-[30px] box-border mt-[30px] flex-1 min-h-0">
          <Sidebar activePage="Cases" />

          <div className="flex flex-col flex-1 min-w-0 gap-4 overflow-hidden">

            {/* Page header */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <h1 className="text-white text-[28px] font-medium m-0 leading-tight mb-0 pb-1">
                      {activeStudy.name}
                    </h1>
                    <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${statusColors[mockCase.status] || "text-white bg-[#1a1a1a]"}`}>
                      {mockCase.status}
                    </span>
                  </div>
                  <p className="text-[#6B6B6B] text-sm m-0">{mockCase.dateCreated} · {mockCase.referringPhysician}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-4 py-[8px] rounded-full border border-[#1E1E1E] text-[#6B6B6B] text-[12px] bg-transparent hover:text-white hover:border-[#2a2a2a] cursor-pointer transition-all">
                  <FiShare2 size={13} /> Share
                </button>
                <button className="flex items-center gap-1.5 px-4 py-[8px] rounded-full border border-[#1E1E1E] text-[#6B6B6B] text-[13px] bg-transparent hover:text-white hover:border-[#2a2a2a] cursor-pointer transition-all">
                  <FiFileText size={13} /> Generate Summary
                </button>
                <button
                  onClick={() => setAddSeriesOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-[8px] rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white text-[13px] font-medium border-none cursor-pointer transition-colors"
                >
                  Add New Series
                </button>
              </div>
            </div>

            {/* Series grid */}
            <div className="flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2a2a transparent" }}>
              {seriesError && (
                <p className="text-[#FF4A4A] text-xs font-mono px-1">{seriesError}</p>
              )}
              <SeriesGrid study={activeStudy} onOpenSeries={openSeries} onDeleteSeries={handleDeleteSeries} loading={seriesLoading} />
            </div>

          </div>
        </div>
      </div>

      <AddSeriesModal
        isOpen={addSeriesOpen}
        onClose={() => setAddSeriesOpen(false)}
        onAdd={handleAddSeries}
        studyId={navState?.studyId}
        studyModality={activeStudy.modality}
      />
    </div>
  );
}

export default CaseDashboard;
