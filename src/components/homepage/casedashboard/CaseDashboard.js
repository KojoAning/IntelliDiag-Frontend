import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Appbar from "../appbar/appbar";
import Sidebar from "../sidebar/Sidebar";
import SeriesGrid from "./SeriesGrid";
import AddSeriesModal from "./AddSeriesModal";
import { getSeriesForStudy, deleteSeries } from "../../../lib/api";
import { FiShare2, FiFileText, FiPlusCircle } from "react-icons/fi";

const statusColors = {
  "In Revyiew": "text-[#F59E0B] bg-[rgba(245,158,11,0.12)]",
  "AI Flagged": "text-[#FF6B35] bg-[rgba(255,107,53,0.12)]",
  "Pending Review": "text-[#0694FB] bg-[rgba(6,148,251,0.12)]",
  "Completed": "text-[#22C55E] bg-[rgba(34,197,94,0.12)]",
};

function CaseDashboard() {
  const { state: navState } = useLocation();
  const navigate = useNavigate();

  // Resolve active study: coming back from viewer navState has `study`; arriving fresh has `studyId`
  const initialStudy = navState?.study
    ?? { id: navState?.studyId ?? null, name: "", series: [], modality: "" };

  const [activeStudy, setActiveStudy] = useState(initialStudy);
  const [addSeriesOpen, setAddSeriesOpen] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState(null);

  // Fetch series for the active study from the API
  useEffect(() => {
    const studyId = navState?.studyId ?? activeStudy?.id;
    if (!studyId) return;

    let cancelled = false;
    setSeriesLoading(true);
    setSeriesError(null);

    getSeriesForStudy(studyId)
      .then(data => {
        console.log(data)
        if (cancelled) return;
        const series = (data ?? []).map(s => ({
          id: s.id,
          name: s.series_name,
          description: s.description ?? "",
          modality: s.modality ?? "",
          image_count: s.image_count ?? 0,
          expanded: false,
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
  }, [navState?.studyId, activeStudy?.id]);

  const openSeries = (series) => {
    navigate("/case-workspace/viewer", { state: { study: activeStudy, series } });
  };



  const handleDeleteSeries = async (seriesId) => {
    await deleteSeries(seriesId);
    setActiveStudy(prev => ({ ...prev, series: prev.series.filter(s => s.id !== seriesId) }));
  };

  const handleAddSeries = (newSeries) => {
    setActiveStudy(prev => ({ ...prev, series: [...(prev.series ?? []), ...newSeries] }));
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
              <div className="flex flex-col gap-2">
                {/* Title row */}
                <div className="flex items-center gap-2.5">
                  <h1 className="text-white text-[26px] font-medium m-0 leading-tight">
                    {activeStudy.label ?? activeStudy.name ?? "Imaging Study"}
                  </h1>
                  {activeStudy.modality && (
                    <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full text-[#0694FB] bg-[rgba(6,148,251,0.12)]">
                      {activeStudy.modality}
                    </span>
                  )}
                  {activeStudy.flagged && (
                    <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full text-[#FF6B35] bg-[rgba(255,107,53,0.12)]">
                      AI Flagged
                    </span>
                  )}
                </div>

                {/* Meta chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {activeStudy.region && (
                    <div className="flex items-center gap-1.5 bg-[#111] border border-[#1E1E1E] rounded-lg px-2.5 py-1">
                      <span className="text-[#3a3a3a] text-[10px]">Region</span>
                      <span className="text-[#CCCCCC] text-[11px] font-medium">{activeStudy.region}</span>
                    </div>
                  )}
                  {activeStudy.date && (
                    <div className="flex items-center gap-1.5 bg-[#111] border border-[#1E1E1E] rounded-lg px-2.5 py-1">
                      <span className="text-[#3a3a3a] text-[10px]">Date</span>
                      <span className="text-[#CCCCCC] text-[11px] font-medium">{activeStudy.date}</span>
                    </div>
                  )}
                  {activeStudy.accNumber && (
                    <div className="flex items-center gap-1.5 bg-[#111] border border-[#1E1E1E] rounded-lg px-2.5 py-1">
                      <span className="text-[#3a3a3a] text-[10px]">Acc</span>
                      <span className="text-[#CCCCCC] text-[11px] font-mono">{activeStudy.accNumber}</span>
                    </div>
                  )}
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
