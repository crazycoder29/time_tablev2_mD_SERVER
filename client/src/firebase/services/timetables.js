/**
 * Timetable service — backed by local FastAPI backend
 * The backend handles schedule building/reconstruction, so this file
 * is much simpler than the Firebase version.
 */

import { apiFetch } from "../api";
import { normalize, DEFAULT_DAYS } from "../../utils/dataHelpers";
import {
  generateTimetableId,
} from "../../utils/timetableHelpers";

/**
 * Fetches all timetables with optional filters
 */
export async function listTimetables({ faculty, department, semester } = {}) {
  const params = new URLSearchParams();
  if (faculty) params.append("faculty", faculty);
  if (department) params.append("department", department);
  if (semester) params.append("semester", semester);
  const qs = params.toString();
  return await apiFetch(`/api/timetables${qs ? `?${qs}` : ""}`);
}

/**
 * Fetches ALL timetable metadata for the settings panel
 */
export async function listAllTimetablesMeta() {
  return await apiFetch("/api/timetables/all-meta");
}

/**
 * Updates ONLY the metadata fields of a timetable
 */
export async function updateTimetableMeta(oldTimetableId, updatedMeta) {
  const result = await apiFetch(`/api/timetables/${encodeURIComponent(oldTimetableId)}/meta`, {
    method: "PUT",
    body: JSON.stringify({
      name: updatedMeta.name || "",
      class: normalize(updatedMeta.class),
      branch: normalize(updatedMeta.branch),
      faculty: normalize(updatedMeta.faculty || ""),
      department: normalize(updatedMeta.department || ""),
      semester: normalize(updatedMeta.semester),
      type: normalize(updatedMeta.type),
      days: updatedMeta.days || [],
      timeSlots: updatedMeta.timeSlots || [],
    }),
  });
  // Return the new timetable ID
  return result?.timetableId || result?.unid || generateTimetableId(updatedMeta);
}

/**
 * Creates a new blank timetable preset (no schedules)
 */
export async function createTimetablePreset(meta) {
  const result = await apiFetch("/api/timetables/preset", {
    method: "POST",
    body: JSON.stringify({
      name: meta.name || "",
      class: normalize(meta.class),
      branch: normalize(meta.branch),
      faculty: normalize(meta.faculty || ""),
      department: normalize(meta.department || ""),
      semester: normalize(meta.semester),
      type: normalize(meta.type),
      days: (meta.days?.length ? meta.days : DEFAULT_DAYS).map(normalize),
      timeSlots: (meta.timeSlots ?? []).map(normalize),
    }),
  });
  return result?.timetableId || result?.unid || generateTimetableId(meta);
}

/**
 * Saves a complete timetable with schedules
 */
export async function saveTimetable({
  meta,
  tables,
  days,
  timeSlots,
  batchesByTable,
  batchDataByTable,
}) {
  const payload = {
    meta: {
      name: meta.name || "",
      class: normalize(meta.class),
      branch: normalize(meta.branch),
      faculty: normalize(meta.faculty || ""),
      department: normalize(meta.department || ""),
      semester: normalize(meta.semester),
      type: normalize(meta.type),
      days: (meta.days || days || DEFAULT_DAYS).map(normalize),
      timeSlots: (meta.timeSlots || timeSlots || []).map(normalize),
    },
    tables: tables || [],
    days: (days || DEFAULT_DAYS).map(normalize),
    timeSlots: (timeSlots || []).map(normalize),
    batchesByTable: batchesByTable || {},
    batchDataByTable: batchDataByTable || {},
  };

  const result = await apiFetch("/api/timetables/save", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return result?.timetableId || generateTimetableId(meta);
}

/**
 * Loads a complete timetable with schedules
 */
export async function loadTimetable(timetableId) {
  const result = await apiFetch(`/api/timetables/${encodeURIComponent(timetableId)}`);
  if (!result) return null;

  return {
    meta: result.meta,
    tables: result.tables || ["Table 1"],
    days: result.days || DEFAULT_DAYS,
    timeSlots: result.timeSlots || [],
    batchesByTable: result.batchesByTable || {},
    batchDataByTable: result.batchDataByTable || {},
  };
}

/**
 * Deletes a timetable and all its schedules
 */
export async function deleteTimetable(timetableId) {
  await apiFetch(`/api/timetables/${encodeURIComponent(timetableId)}`, { method: "DELETE" });
}
