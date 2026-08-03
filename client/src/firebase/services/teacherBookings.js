/**
 * Teacher Booking Service
 * Queries the existing 'schedules' collection to find teacher bookings across all timetables.
 * Used to prevent double-booking of teachers at the same day+time.
 */

import { apiFetch } from "../api";

const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

const getBatchCount = (batchesForTable, rowIndex, colIndex) => {
  const count = batchesForTable?.[`${rowIndex}-${colIndex}`];
  return typeof count === "number" && Number.isFinite(count) && count > 0 ? count : 1;
};

/**
 * Fetches all teacher bookings across all timetables.
 * Returns a map: teacherId -> [{ day, time, timetableId, class, branch, semester, type }]
 */
export async function getAllTeacherBookings() {
  const allSchedules = await apiFetch("/api/schedules/all");
  const bookingsMap = {};

  (allSchedules || []).forEach((data) => {
    const teacherIdStr = data.teacherId;
    if (!teacherIdStr) return; // Skip entries without a teacher

    const teacherIds = String(teacherIdStr).split(',').map(id => id.trim()).filter(Boolean);

    teacherIds.forEach((tId) => {
      if (!bookingsMap[tId]) {
        bookingsMap[tId] = [];
      }

      bookingsMap[tId].push({
        day: normalize(data.day),
        time: normalize(data.time),
        timetableId: data.timetableId || "",
        class: data.class || "",
        branch: data.branch || "",
        semester: data.semester || "",
        type: data.type || "",
        courseId: data.courseId || "",
        teacherId: tId,
      });
    });
  });

  return bookingsMap;
}

/**
 * Gets all bookings for a specific teacher.
 * @param {object} bookingsMap - The cached bookings map
 * @param {string} teacherId - The teacher's unid
 * @param {string} [excludeTimetableId] - Exclude bookings from this timetable
 * @returns {Array} List of bookings
 */
export function getTeacherBookings(bookingsMap, teacherId, excludeTimetableId) {
  const bookings = bookingsMap[String(teacherId)] || [];
  if (!excludeTimetableId) return bookings;
  return bookings.filter((b) => b.timetableId !== excludeTimetableId);
}

export function filterTeacherBookings(bookingsMap, excludedTimetableIds = []) {
  const excluded = new Set(
    (excludedTimetableIds || []).map((value) => String(value || "").trim()).filter(Boolean)
  );

  if (excluded.size === 0) return bookingsMap || {};

  const filtered = {};
  Object.entries(bookingsMap || {}).forEach(([teacherId, bookings]) => {
    const remaining = (bookings || []).filter(
      (booking) => !excluded.has(String(booking?.timetableId || "").trim())
    );
    if (remaining.length > 0) {
      filtered[teacherId] = remaining;
    }
  });

  return filtered;
}

export function buildDraftTeacherBookings({
  tables = [],
  tabMetadata = {},
  batchesByTable = {},
  batchDataByTable = {},
  timeSlots = [],
  days = DEFAULT_DAYS,
}) {
  const normalizedDays = (days?.length ? days : DEFAULT_DAYS).map(normalize);
  const normalizedTimeSlots = (timeSlots || []).map(normalize);
  const bookingsMap = {};

  (tables || []).forEach((tableKey) => {
    const tableMeta = tabMetadata?.[tableKey] || {};
    const batchesForTable = batchesByTable?.[tableKey] || {};
    const dataForTable = batchDataByTable?.[tableKey] || {};

    normalizedTimeSlots.forEach((time, rowIndex) => {
      normalizedDays.forEach((day, colIndex) => {
        const batchCount = getBatchCount(batchesForTable, rowIndex, colIndex);

        for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
          const entry = dataForTable?.[`${rowIndex}-${colIndex}-${batchIndex}`] || {};
          const teacherIdStr = entry?.teacherId ? String(entry.teacherId) : "";
          if (!teacherIdStr) continue;

          const teacherIds = teacherIdStr.split(',').map(id => id.trim()).filter(Boolean);

          teacherIds.forEach((tId) => {
            if (!bookingsMap[tId]) {
              bookingsMap[tId] = [];
            }

            bookingsMap[tId].push({
              day,
              time,
              timetableId: tableMeta?.timetableId || "",
              class: tableMeta?.className || "",
              branch: tableMeta?.branch || "",
              semester: tableMeta?.semester || "",
              type: tableMeta?.type || "",
              courseId: entry?.courseId ? String(entry.courseId) : "",
              source: "draft",
              sourceTableKey: tableKey,
              teacherId: tId,
            });
          });
        }
      });
    });
  });

  return bookingsMap;
}

export function mergeTeacherBookingsMaps(...maps) {
  const merged = {};
  const seen = new Set();

  maps.forEach((map) => {
    Object.entries(map || {}).forEach(([teacherId, bookings]) => {
      (bookings || []).forEach((booking) => {
        const normalizedTeacherId = String(teacherId || "");
        const dedupeKey = [
          normalizedTeacherId,
          normalize(booking?.day),
          normalize(booking?.time),
          String(booking?.timetableId || ""),
          normalize(booking?.class),
          normalize(booking?.branch),
          normalize(booking?.semester),
          normalize(booking?.type),
          String(booking?.courseId || ""),
        ].join("__");

        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        if (!merged[normalizedTeacherId]) {
          merged[normalizedTeacherId] = [];
        }

        merged[normalizedTeacherId].push(booking);
      });
    });
  });

  return merged;
}
