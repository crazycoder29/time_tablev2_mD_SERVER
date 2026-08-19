/**
 * UI helper functions for timetable management
 * These handle UI-specific logic and data processing
 */

import { generateTimetableId } from "./timetableHelpers";

/**
 * Default time slots for a new timetable
 */
export const DEFAULT_TIME_SLOTS = [
  "7:00 AM - 7:55 AM",
  "7:55 AM - 8:50 AM",
  "8:50 AM - 9:45 AM",
  "10:30 AM - 11:25 AM",
  "11:25 AM - 12:20 PM",
  "12:20 PM - 1:15 PM",
  "1:15 PM - 2:10 PM",
  "2:10 PM - 3:05 PM",
  "3:05 PM - 4:00 PM",
  "4:00 PM - 4:55 PM",
];

/**
 * Checks if an existing timetable exists and returns it
 */
export async function checkExistingTimetable(className, branch, semester, type, timetableService) {
  // Only check if all three fields are filled
  if (!className?.trim() || !branch?.trim() || !semester?.trim() || !type?.trim()) {
    return null;
  }

  try {
    const timetableId = generateTimetableId({
      class: className,
      branch: branch,
      semester: semester,
      type: type,
    });

    const existingTimetable = await timetableService.loadTimetable(timetableId);

    if (existingTimetable) {
      return {
        ...existingTimetable,
        timetableId,
        tables: existingTimetable.tables || ["Table 1"],
        timeSlots: existingTimetable.timeSlots || DEFAULT_TIME_SLOTS,
        batchesByTable: existingTimetable.batchesByTable || {},
        batchDataByTable: existingTimetable.batchDataByTable || {},
      };
    }

    return null;
  } catch (error) {
    console.error("Error checking for existing timetable:", error);
    return null;
  }
}

/**
 * Calculates conflict statistics from conflicts data
 */
export function calculateConflictStats(conflicts) {
  const teacherConflicts = new Set();
  const roomConflicts = new Set();

  Object.values(conflicts).forEach((tableConflicts) => {
    Object.entries(tableConflicts).forEach(([key, conflictData]) => {
      if (conflictData.teacher?.conflict) {
        const cellKey = key.split("-").slice(0, 2).join("-");
        conflictData.teacher.matches?.forEach(match => {
          if (match.teacher) teacherConflicts.add(`${match.teacher}-${cellKey}`);
        });
      }
      if (conflictData.room?.conflict) {
        const cellKey = key.split("-").slice(0, 2).join("-");
        conflictData.room.matches?.forEach(match => {
          if (match.room) roomConflicts.add(`${match.room}-${cellKey}`);
        });
      }
    });
  });

  return {
    teacherConflicts: teacherConflicts.size,
    roomConflicts: roomConflicts.size
  };
}

/**
 * Creates a new batch in the batches data structure
 */
export function createBatchInCell(currentBatches, activeTable, rowIndex, colIndex) {
  const key = `${rowIndex}-${colIndex}`;
  const tableData = currentBatches[activeTable] || {};

  return {
    ...currentBatches,
    [activeTable]: {
      ...tableData,
      [key]: (tableData[key] || 1) + 1
    }
  };
}

/**
 * Updates batch data and handles conflict checking
 */
export function updateBatchData({
  currentBatchData,
  currentBatches,
  activeTable,
  rowIndex,
  colIndex,
  batchIndex,
  field,
  value,
  tables,
  checkConflictsFn,
}) {
  const key = `${rowIndex}-${colIndex}-${batchIndex}`;
  const tableData = currentBatchData[activeTable] || {};

  const updated = {
    ...currentBatchData,
    [activeTable]: {
      ...tableData,
      [key]: {
        ...(tableData[key] || {}),
        [field]: value
      }
    }
  };

  let conflictResult = null;
  if (field === "teacher" || field === "room") {
    conflictResult = checkConflictsFn({
      rowIndex,
      colIndex,
      batchIndex,
      field,
      nextValue: value,
      batchesByTable: {
        ...currentBatches,
        [activeTable]: updated[activeTable]
      },
      batchDataByTable: updated,
      tableId: activeTable,
      tableIds: tables
    });
  }

  return {
    updatedBatchData: updated,
    conflictResult
  };
}

/**
 * Updates conflicts state based on conflict result
 */
export function updateConflictsState(currentConflicts, activeTable, key, field, conflictResult) {
  const tableConflicts = currentConflicts[activeTable] || {};

  return {
    ...currentConflicts,
    [activeTable]: {
      ...tableConflicts,
      [key]: {
        ...(tableConflicts[key] || {}),
        teacher: field === "teacher"
          ? conflictResult.teacher
          : (tableConflicts[key]?.teacher || { conflict: false }),
        room: field === "room"
          ? conflictResult.room
          : (tableConflicts[key]?.room || { conflict: false })
      }
    }
  };
}

/**
 * Generates a new table name
 */
export function generateTableName(currentTables) {
  return `Table ${currentTables.length + 1}`;
}

/**
 * Generates the next time slot
 */
export function generateNextTimeSlot(currentTimeSlots) {
  if (!currentTimeSlots || currentTimeSlots.length === 0) {
    return "09:00 AM - 09:55 AM"; // fallback default
  }
  const lastSlot = currentTimeSlots[currentTimeSlots.length - 1];
  const parts = lastSlot.split(" - ");
  const endTime = parts[1] || parts[0];
  
  const match = endTime.trim().match(/(\d+):(\d+)\s*(am|pm)?/i);
  if (!match) return "09:00 AM - 09:55 AM";
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toLowerCase() : null;
  
  // Convert end time of last slot to minutes
  let startTotalMinutes;
  if (ampm) {
    let startHour24 = hours;
    if (ampm === "pm" && startHour24 < 12) startHour24 += 12;
    if (ampm === "am" && startHour24 === 12) startHour24 = 0;
    startTotalMinutes = startHour24 * 60 + minutes;
  } else {
    // If no AM/PM, use the hours as-is (could be 12h or 24h, but we keep the system consistent)
    startTotalMinutes = hours * 60 + minutes;
  }
  
  const endTotalMinutes = startTotalMinutes + 55;
  
  // Format start time
  const startH24 = Math.floor(startTotalMinutes / 60);
  const startM = startTotalMinutes % 60;
  
  // Format end time
  const endH24 = Math.floor(endTotalMinutes / 60);
  const endM = endTotalMinutes % 60;
  
  if (ampm) {
    // Format both as 12-hour with AM/PM
    const format12 = (h24, m) => {
      const p = h24 % 24 >= 12 ? "PM" : "AM";
      let h12 = h24 % 12;
      if (h12 === 0) h12 = 12;
      return `${h12}:${m.toString().padStart(2, '0')} ${p}`;
    };
    return `${format12(startH24, startM)} - ${format12(endH24, endM)}`;
  } else {
    // Format as original did (no AM/PM, but let's handle 12-hour wrap if hours was 12 or less)
    const formatNoAmpm = (h24, m) => {
      let h = h24;
      if (hours <= 12) {
        h = h24 % 12;
        if (h === 0) h = 12;
      }
      return `${h}:${m.toString().padStart(2, '0')}`;
    };
    return `${formatNoAmpm(startH24, startM)} - ${formatNoAmpm(endH24, endM)}`;
  }
}

/**
 * Normalizes a time slot string by removing all whitespace.
 */
export const cleanTime = (t) => String(t || "").replace(/\s+/g, "").trim().toLowerCase();

/**
 * Parses a time slot start time to minutes since midnight for chronological sorting.
 */
export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = String(timeStr).split(/[–-]/)[0].trim().match(/(\d+):(\d+)\s*(am|pm)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toLowerCase() : null;
  
  if (ampm) {
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
  } else {
    if (hours >= 1 && hours <= 6) {
      hours += 12;
    }
  }
  return hours * 60 + minutes;
}

/**
 * Dynamically fetches all timetables and presets, compiles unique, sorted time slots.
 */
export async function fetchDynamicTimeSlots(timetableService) {
  try {
    const timetablesMeta = await timetableService.listAllTimetablesMeta();
    const uniqueSlots = new Set();
    
    if (Array.isArray(timetablesMeta)) {
      timetablesMeta.forEach(meta => {
        if (Array.isArray(meta.timeSlots)) {
          meta.timeSlots.forEach(slot => {
            if (slot && slot.trim()) {
              uniqueSlots.add(slot.trim());
            }
          });
        }
      });
    }

    if (uniqueSlots.size === 0) {
      return DEFAULT_TIME_SLOTS;
    }

    return Array.from(uniqueSlots).sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
  } catch (error) {
    console.error("Error fetching dynamic time slots:", error);
    return DEFAULT_TIME_SLOTS;
  }
}

/**
 * Dynamically fetches all timetables and presets, compiles unique, sorted days.
 */
export async function fetchDynamicDays(timetableService) {
  try {
    const timetablesMeta = await timetableService.listAllTimetablesMeta();
    const uniqueDays = new Set();
    
    if (Array.isArray(timetablesMeta)) {
      timetablesMeta.forEach(meta => {
        if (Array.isArray(meta.days)) {
          meta.days.forEach(day => {
            if (day && day.trim()) {
              uniqueDays.add(day.trim());
            }
          });
        }
      });
    }

    if (uniqueDays.size === 0) {
      return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    }

    const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return Array.from(uniqueDays).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  } catch (error) {
    console.error("Error fetching dynamic days:", error);
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  }
}

