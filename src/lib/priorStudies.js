// Earlier studies of the open study's patient, for comparing with a prior: the patient's
// cases, their studies (newest first, the open one left out) and each study's series, plus
// a finished AI result on a prior series to compare lesion sizes with.
import { authFetch, getSeriesForStudy } from "./api";

const API = (process.env.REACT_APP_API_BASE || "").trim().replace(/\/$/, "");

async function getJson(url) {
  const res = await authFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// [{ id, name, modality, bodyRegion, date, caseTitle }] — every other study of the patient
export async function listPatientStudies(caseId, openStudyId) {
  const theCase = await getJson(`${API}/cases/${caseId}`);
  const cases = await getJson(`${API}/cases/patient/${theCase.patient_id}`);
  const perCase = await Promise.all(cases.map(c =>
    getJson(`${API}/imaging-studies/case/${c.id}`)
      .then(studies => studies.map(s => ({
        id: s.id,
        name: s.study_name,
        modality: s.modality,
        bodyRegion: s.body_region,
        date: s.study_date,
        caseTitle: c.title,
      })))
      .catch(() => [])
  ));
  return perCase.flat()
    .filter(s => String(s.id) !== String(openStudyId))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// The study's series, shaped like the side panel's, marked as a prior (they show in a
// viewer beside the open study but aren't part of it)
export async function priorSeriesOf(study) {
  const series = await getSeriesForStudy(study.id);
  return (series ?? []).map(s => ({
    id: s.id,
    name: s.series_name,
    description: s.description ?? "",
    modality: s.modality ?? "",
    image_count: s.image_count ?? 0,
    prior: { studyId: study.id, studyName: study.name, date: study.date },
  }));
}

export const formatStudyDate = (date) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

// The newest finished result of a model on a series (the stored result JSON), or null
export async function latestResult(seriesId, modelId) {
  const jobs = await getJson(`${API}/series/${seriesId}/jobs`);
  const done = jobs
    .filter(j => String(j.model_id) === String(modelId) && String(j.status).toLowerCase() === "completed")
    .sort((a, b) => new Date(b.updated_at ?? b.created_at ?? 0) - new Date(a.updated_at ?? a.created_at ?? 0));
  if (!done.length) return null;
  const raw = await getJson(`${process.env.REACT_APP_API_INFERENCE_BASE}/results/${done[0].id}`);
  return raw.url && !raw.slices ? (await fetch(raw.url)).json() : raw;
}

// Lesion totals now and before: { before, now, changePct, countBefore, countNow, largestBefore,
// largestNow, date } from two results' volume_analysis, or null when either has no lesion volume
export function compareLesions(current, prior, date) {
  const a = prior?.volume_analysis, b = current?.volume_analysis;
  if (a?.total_volume_cm3 == null || b?.total_volume_cm3 == null) return null;
  const before = Number(a.total_volume_cm3), now = Number(b.total_volume_cm3);
  return {
    date,
    before, now,
    changePct: before > 0 ? Math.round(((now - before) / before) * 100) : null,
    countBefore: a.lesion_count ?? null,
    countNow: b.lesion_count ?? null,
    largestBefore: a.largest_lesion_volume_cm3 ?? null,
    largestNow: b.largest_lesion_volume_cm3 ?? null,
  };
}
