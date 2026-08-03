/**
 * Schedule service — backed by local FastAPI backend
 */

import { apiFetch } from "../api";

let cachedSchedules = null;
let lastFetchTime = 0;
const CACHE_DURATION = 15000; // 15 seconds cache

export function clearSchedulesCache() {
  cachedSchedules = null;
  lastFetchTime = 0;
}

/**
 * Fetches all schedules for a timetable
 */
export async function getSchedulesByTimetableId(timetableId) {
  if (!timetableId) return [];
  return await apiFetch(`/api/schedules?timetableId=${encodeURIComponent(timetableId)}`);
}

/**
 * Deletes all schedules for a timetable
 */
export async function deleteSchedulesByTimetableId(timetableId) {
  clearSchedulesCache();
  if (!timetableId) return;
  await apiFetch(`/api/schedules/by-timetable/${encodeURIComponent(timetableId)}`, { method: "DELETE" });
}

/**
 * Saves multiple schedule records intelligently
 */
export async function saveSchedules({ timetableId, schedules }) {
  clearSchedulesCache();
  const list = Array.isArray(schedules) ? schedules : [];
  console.log('💾 saveSchedules called with:', { timetableId, schedulesCount: list.length });
  if (!timetableId) throw new Error("timetableId is required");

  await apiFetch("/api/schedules", {
    method: "POST",
    body: JSON.stringify({ timetableId, schedules: list }),
  });
}

/**
 * Deletes a single schedule by ID
 */
export async function deleteScheduleById(scheduleId) {
  clearSchedulesCache();
  await apiFetch(`/api/schedules/${encodeURIComponent(scheduleId)}`, { method: "DELETE" });
}

/**
 * Fetches all schedules across all timetables
 */
export async function getAllSchedules(forceRefresh = false) {
  const now = Date.now();
  if (cachedSchedules && !forceRefresh && (now - lastFetchTime < CACHE_DURATION)) {
    console.log("⚡ [getAllSchedules] Returning cached schedules, saved reads!");
    return cachedSchedules;
  }
  const result = await apiFetch("/api/schedules/all");
  cachedSchedules = result;
  lastFetchTime = Date.now();
  return cachedSchedules;
}
