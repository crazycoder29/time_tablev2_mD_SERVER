/**
 * Room Booking Service
 * Queries the existing 'schedules' collection to find room bookings across all timetables.
 * Used to prevent double-booking of rooms at the same day+time.
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
 * Fetches all room bookings across all timetables.
 * Returns a map: roomId -> [{ day, time, timetableId, class, branch, semester, type }]
 */
export async function getAllRoomBookings() {
  const allSchedules = await apiFetch("/api/schedules/all");
  const bookingsMap = {};

  (allSchedules || []).forEach((data) => {
    const roomId = data.roomId;
    if (!roomId) return; // Skip entries without a room

    if (!bookingsMap[roomId]) {
      bookingsMap[roomId] = [];
    }

    bookingsMap[roomId].push({
      day: normalize(data.day),
      time: normalize(data.time),
      timetableId: data.timetableId || "",
      class: data.class || "",
      branch: data.branch || "",
      semester: data.semester || "",
      type: data.type || "",
      courseId: data.courseId || "",
    });
  });

  return bookingsMap;
}

/**
 * Checks if a room is available at a specific day+time.
 * @param {object} bookingsMap - The cached bookings map from getAllRoomBookings
 * @param {string} roomId - The room's unid
 * @param {string} day - e.g. "Mon"
 * @param {string} time - e.g. "7:00 - 7:55"
 * @param {string} [excludeTimetableId] - Exclude bookings from this timetable (the one being edited)
 * @returns {{ available: boolean, bookedBy: object|null }}
 */
export function isRoomAvailable(bookingsMap, roomId, day, time, excludeTimetableId) {
  const bookings = bookingsMap[String(roomId)] || [];
  const normDay = normalize(day).toLowerCase();
  const normTime = normalize(time).toLowerCase();

  const conflict = bookings.find(
    (b) =>
      b.day.toLowerCase() === normDay &&
      b.time.toLowerCase() === normTime &&
      (!excludeTimetableId || b.timetableId !== excludeTimetableId)
  );

  return {
    available: !conflict,
    bookedBy: conflict || null,
  };
}

/**
 * Gets all bookings for a specific room.
 * @param {object} bookingsMap - The cached bookings map
 * @param {string} roomId - The room's unid
 * @param {string} [excludeTimetableId] - Exclude bookings from this timetable
 * @returns {Array} List of bookings
 */
export function getRoomBookings(bookingsMap, roomId, excludeTimetableId) {
  const bookings = bookingsMap[String(roomId)] || [];
  if (!excludeTimetableId) return bookings;
  return bookings.filter((b) => b.timetableId !== excludeTimetableId);
}

export function filterRoomBookings(bookingsMap, excludedTimetableIds = []) {
  const excluded = new Set(
    (excludedTimetableIds || []).map((value) => String(value || "").trim()).filter(Boolean)
  );

  if (excluded.size === 0) return bookingsMap || {};

  const filtered = {};
  Object.entries(bookingsMap || {}).forEach(([roomId, bookings]) => {
    const remaining = (bookings || []).filter(
      (booking) => !excluded.has(String(booking?.timetableId || "").trim())
    );
    if (remaining.length > 0) {
      filtered[roomId] = remaining;
    }
  });

  return filtered;
}

export function buildDraftRoomBookings({
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
          const roomId = entry?.roomId ? String(entry.roomId) : "";

          if (!roomId) continue;

          if (!bookingsMap[roomId]) {
            bookingsMap[roomId] = [];
          }

          bookingsMap[roomId].push({
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
          });
        }
      });
    });
  });

  return bookingsMap;
}

export function mergeRoomBookingsMaps(...maps) {
  const merged = {};
  const seen = new Set();

  maps.forEach((map) => {
    Object.entries(map || {}).forEach(([roomId, bookings]) => {
      (bookings || []).forEach((booking) => {
        const normalizedRoomId = String(roomId || "");
        const dedupeKey = [
          normalizedRoomId,
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

        if (!merged[normalizedRoomId]) {
          merged[normalizedRoomId] = [];
        }

        merged[normalizedRoomId].push(booking);
      });
    });
  });

  return merged;
}
