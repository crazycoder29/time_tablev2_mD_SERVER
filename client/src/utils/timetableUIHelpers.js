/**
 * UI helper functions for timetable management
 * These handle UI-specific logic and data processing
 */

import { generateTimetableId } from "./timetableHelpers";

/**
 * Default time slots for a new timetable
 */
export const DEFAULT_TIME_SLOTS = [
  "7:00 - 7:55",
  "7:55 - 8:50",
  "8:50 - 9:45",
  "10:30 - 11:25",
  "11:25 - 12:20",
  "12:20 - 1:15",
  "1:15 - 2:10",
  "2:10 - 3:05",
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
  const lastSlot = currentTimeSlots[currentTimeSlots.length - 1];
  const endTime = lastSlot.split(" - ")[1]; // Get ending time of last slot
  const [endHour, endMinute] = endTime.split(":").map(num => parseInt(num));

  // Start time is the end time of the last slot
  const startHour = endHour;
  const startMinute = endMinute;

  // Add 55 minutes to get the end time
  let newEndMinute = startMinute + 55;
  let newEndHour = startHour;

  if (newEndMinute >= 60) {
    newEndHour += 1;
    newEndMinute -= 60;
  }

  // Format the times (no leading zero for hours, but pad minutes)
  const startTimeStr = `${startHour}:${startMinute.toString().padStart(2, '0')}`;
  const endTimeStr = `${newEndHour}:${newEndMinute.toString().padStart(2, '0')}`;

  return `${startTimeStr} - ${endTimeStr}`;
}

/**
 * Normalizes a time slot string by removing all whitespace.
 */
export const cleanTime = (t) => String(t || "").replace(/\s+/g, "").trim();

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

