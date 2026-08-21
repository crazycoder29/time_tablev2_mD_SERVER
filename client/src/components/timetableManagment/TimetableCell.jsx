import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, AlertCircle, Trash2, Copy, Move, X, GripVertical, MessageSquarePlus } from "lucide-react";
import { validateCourse, validateTeacher, validateRoom } from "../../utils/validationHelpers";
import { getCourseIdFromDisplay, getTeacherIdFromDisplay, getRoomIdFromDisplay } from "../../utils/idDisplayHelpers";

/**
 * Smart dropdown for teachers with three sections:
 * 1. Assigned — teachers linked to the selected course in the curriculum
 * 2. Same department — teachers sharing the course's department
 * 3. Other departments — remaining teachers, grouped by their department
 */
const TeacherCombobox = ({
  value,
  onChange,
  onKeyDown,
  groups,
  inputRef,
  className,
  placeholder,
  title,
}) => {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 200 });
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const internalInputRef = useRef(null);
  const containerRef = useRef(null);
  const dropRef = useRef(null);

  // Let parent register the input DOM node via callback ref
  useEffect(() => {
    if (typeof inputRef === "function") inputRef(internalInputRef.current);
  });

  // Close when clicking outside
  useEffect(() => {
    const handleOuter = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOuter);
    return () => document.removeEventListener("mousedown", handleOuter);
  }, []);

  // Reset highlight when dropdown opens/closes or filter changes
  useEffect(() => {
    setHighlightIdx(-1);
  }, [open, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx < 0 || !dropRef.current) return;
    const el = dropRef.current.querySelector(`[data-idx="${highlightIdx}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  // Position the dropdown below the container div
  const updatePos = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropPos({
        top: rect.bottom,
        left: rect.left,
        width: Math.max(220, rect.width),
      });
    }
  };

  const fragments = (value || "").split(',');
  const filterStr = fragments[fragments.length - 1].trim().toLowerCase();
  const filterOpts = (opts) =>
    opts.filter((o) => !filterStr || o.toLowerCase().includes(filterStr));

  const { assigned = [], courseDept, sameDept = [], otherDepts = {} } = groups;
  const fAssigned = filterOpts(assigned);
  const fSameDept = filterOpts(sameDept);
  const fOtherDepts = Object.fromEntries(
    Object.entries(otherDepts)
      .map(([dept, ts]) => [dept, filterOpts(ts)])
      .filter(([, ts]) => ts.length > 0)
  );

  // Flat list of all visible options (for keyboard navigation)
  const flatOptions = [
    ...fAssigned,
    ...fSameDept,
    ...Object.values(fOtherDepts).flat(),
  ];
  const hasOptions = flatOptions.length > 0;

  const handleSelect = (val) => {
    const parts = (value || "").split(',');
    parts[parts.length - 1] = val;
    const newValue = parts.map(s => s.trim()).filter(Boolean).join(", ");
    onChange(newValue);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setHighlightIdx((i) => Math.min(i + 1, flatOptions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && highlightIdx >= 0) {
        e.preventDefault();
        e.stopPropagation();
        handleSelect(flatOptions[highlightIdx]);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }
    onKeyDown && onKeyDown(e);
  };

  // Build a continuous flat index across groups for highlighting
  let flatIdx = 0;
  const renderGroup = (items, headerEl, hoverClass) =>
    items.length > 0 ? (
      <React.Fragment>
        {headerEl}
        {items.map((t) => {
          const idx = flatIdx++;
          const isHl = idx === highlightIdx;
          return (
            <div
              key={idx}
              data-idx={idx}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(t); }}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`px-2 py-1 cursor-pointer text-gray-800 ${
                isHl ? "bg-gray-200" : hoverClass
              }`}
            >
              {t}
            </div>
          );
        })}
      </React.Fragment>
    ) : null;

  const dropdown = open && hasOptions
    ? createPortal(
        <div
          ref={dropRef}
          style={{
            position: "fixed",
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
          }}
          className="max-h-52 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg text-[10px] ring-1 ring-black/5"
        >
          {(() => { flatIdx = 0; return null; })()}
          {fAssigned.length > 0 && renderGroup(
            fAssigned,
            <div className="sticky top-0 px-2 py-0.5 bg-amber-50 text-amber-700 font-semibold text-[9px] uppercase tracking-wide border-b border-amber-100">
              ★ Assigned
            </div>,
            "hover:bg-amber-50"
          )}
          {fSameDept.length > 0 && renderGroup(
            fSameDept,
            <div className="sticky top-0 px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold text-[9px] uppercase tracking-wide border-b border-blue-100">
              {courseDept || "Same Dept"}
            </div>,
            "hover:bg-blue-50"
          )}
          {Object.entries(fOtherDepts).map(([dept, teachers]) =>
            renderGroup(
              teachers,
              <div key={dept} className="sticky top-0 px-2 py-0.5 bg-gray-50 text-gray-500 font-semibold text-[9px] uppercase tracking-wide border-b border-gray-100">
                {dept}
              </div>,
              "hover:bg-gray-50"
            )
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={internalInputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); updatePos(); setOpen(true); }}
        onClick={() => { updatePos(); setOpen(true); }}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className={className}
        title={title}
        autoComplete="off"
      />
      {dropdown}
    </div>
  );
};

/**
 * Simple portal-based combobox for flat option lists (Course, Room).
 * Same positioning/look as TeacherCombobox but with a single flat list.
 */
const SimpleCombobox = ({
  value,
  onChange,
  onKeyDown,
  options,
  inputRef,
  className,
  placeholder,
  title,
}) => {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 200 });
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const internalInputRef = useRef(null);
  const containerRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    if (typeof inputRef === "function") inputRef(internalInputRef.current);
  });

  useEffect(() => {
    const handleOuter = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOuter);
    return () => document.removeEventListener("mousedown", handleOuter);
  }, []);

  // Reset highlight when dropdown opens/closes or filter changes
  useEffect(() => {
    setHighlightIdx(-1);
  }, [open, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx < 0 || !dropRef.current) return;
    const el = dropRef.current.querySelector(`[data-idx="${highlightIdx}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  const updatePos = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropPos({
        top: rect.bottom,
        left: rect.left,
        width: Math.max(220, rect.width),
      });
    }
  };

  const fragments = (value || "").split(',');
  const filterStr = fragments[fragments.length - 1].trim().toLowerCase();
  const filtered = (options || []).filter(
    (o) => !filterStr || o.toLowerCase().includes(filterStr)
  );

  const handleSelect = (val) => {
    const parts = (value || "").split(',');
    parts[parts.length - 1] = val;
    const newValue = parts.map(s => s.trim()).filter(Boolean).join(", ");
    onChange(newValue);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && highlightIdx >= 0) {
        e.preventDefault();
        e.stopPropagation();
        handleSelect(filtered[highlightIdx]);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }
    onKeyDown && onKeyDown(e);
  };

  const dropdown =
    open && filtered.length > 0
      ? createPortal(
          <div
            ref={dropRef}
            style={{
              position: "fixed",
              top: dropPos.top,
              left: dropPos.left,
              width: dropPos.width,
              zIndex: 9999,
            }}
            className="max-h-52 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg text-[10px] ring-1 ring-black/5"
          >
            {filtered.map((opt, i) => (
              <div
                key={i}
                data-idx={i}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                onMouseEnter={() => setHighlightIdx(i)}
                className={`px-2 py-1 cursor-pointer text-gray-800 ${
                  i === highlightIdx ? "bg-gray-200" : "hover:bg-gray-50"
                }`}
              >
                {opt}
              </div>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={internalInputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); updatePos(); setOpen(true); }}
        onClick={() => { updatePos(); setOpen(true); }}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className={className}
        title={title}
        autoComplete="off"
      />
      {dropdown}
    </div>
  );
};

const TimetableCell = ({ 
  rowIndex, 
  colIndex,
  rowSpan,
  colSpan,
  batches,
  batchData,
  conflicts, 
  validationErrors,
  courseOptions,
  teacherOptions,
  roomOptions,
  onCreateBatch, 
  onUpdateBatch,
  onRemoveBatch,
  onValidationChange,
  isFirstCell,
  firstCellRef,
  onCopyCell,
  onMoveCell,
  curriculumData,
  allCoursesRaw,
  allTeachersRaw,
  roomBookings,
  teacherBookings,
  allRoomsRaw,
  timeSlots,
  days,
  currentTabMeta,
  currentTableKey,
}) => {
  const key = `${rowIndex}-${colIndex}`;
  const batchCount = batches[key] || 1;
  const showBatchField = batchCount > 1;

  // A cell is "filled" if any of its batches has at least one value
  const isFilled = Array.from({ length: batchCount }).some((_, bi) => {
    const d = batchData[`${rowIndex}-${colIndex}-${bi}`] || {};
    return !!(d.course || d.teacher || d.room || (d.remark !== undefined && d.remark !== ""));
  });

  const courses = Array.isArray(courseOptions) ? courseOptions : [];
  const teachers = Array.isArray(teacherOptions) ? teacherOptions : [];
  const rooms = Array.isArray(roomOptions) ? roomOptions : [];

  // --- Curriculum-aware course list ---
  // Only show courses assigned to this class in the curriculum (falls back to all).
  const filteredCourses = React.useMemo(() => {
    const currCourses = curriculumData?.courses;
    if (!currCourses?.length || !allCoursesRaw?.length) return courses;
    const ids = new Set(currCourses.map((c) => String(c.courseId)));
    const names = allCoursesRaw
      .filter((c) => ids.has(String(c.unid)))
      .map((c) => c.ID || c.code || c.name)
      .filter(Boolean);
    return names.length > 0 ? names : courses;
  }, [curriculumData, allCoursesRaw, courses]);

  // --- Teacher groups for a selected course display name ---
  const getTeacherGroups = React.useCallback(
    (selectedCourseDisplay) => {
      const empty = { assigned: [], courseDept: null, sameDept: [], otherDepts: {} };
      if (!allTeachersRaw?.length) {
        // No raw data: return flat groups by nothing
        const otherDepts = {};
        teachers.forEach((t) => {
          const dept = "All Teachers";
          if (!otherDepts[dept]) otherDepts[dept] = [];
          otherDepts[dept].push(t);
        });
        return { ...empty, otherDepts };
      }

      // Find raw course object
      const rawCourse = selectedCourseDisplay
        ? allCoursesRaw?.find(
            (c) => (c.ID || c.code || c.name) === selectedCourseDisplay
          )
        : null;

      const courseDept = rawCourse?.department || null;

      // Assigned teacher IDs from curriculum
      const currEntry = rawCourse
        ? curriculumData?.courses?.find(
            (c) => String(c.courseId) === String(rawCourse.unid)
          )
        : null;
      const assignedIds = new Set((currEntry?.teacherIds || []).map(String));

      const assigned = Array.from(assignedIds)
        .map((tid) => {
          const t = allTeachersRaw.find((t) => String(t.unid) === tid);
          return t ? t.ID || t.name : null;
        })
        .filter(Boolean);

      const remaining = allTeachersRaw.filter((t) => !assignedIds.has(String(t.unid)));

      const sameDept = courseDept
        ? remaining
            .filter((t) => t.department === courseDept)
            .map((t) => t.ID || t.name)
            .filter(Boolean)
        : [];

      const otherDepts = {};
      remaining
        .filter((t) => !courseDept || t.department !== courseDept)
        .forEach((t) => {
          const dept = t.department || "Other";
          if (!otherDepts[dept]) otherDepts[dept] = [];
          otherDepts[dept].push(t.ID || t.name);
        });

      return { assigned, courseDept, sameDept, otherDepts };
    },
    [curriculumData, allCoursesRaw, allTeachersRaw, teachers]
  );
  
  // Create refs for inputs within each batch
  const inputRefs = useRef({});
  const validationTimeouts = useRef({});
  const [showDropMenu, setShowDropMenu] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [hoveredAction, setHoveredAction] = useState(null);
  const [dismissedBookingWarnings, setDismissedBookingWarnings] = useState({});
  
  // Drag and drop handlers
  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', JSON.stringify({ rowIndex, colIndex }));
    e.currentTarget.style.opacity = '0.5';
    // Store source cell info globally since getData doesn't work in dragOver
    window.__dragSourceCell = { rowIndex, colIndex };
  };
  
  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    window.__dragSourceCell = null;
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };
  
  const handleDragLeave = (e) => {
    // Only hide if leaving the cell completely
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false);
      setHoveredAction(null);
    }
  };
  
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if it's a JSON payload (custom course drop)
    const jsonPayload = e.dataTransfer.getData('application/json');
    if (jsonPayload) {
      try {
        const data = JSON.parse(jsonPayload);
        if (data.type === 'COURSE_BUBBLE' && data.course) {
          const { course, remaining = 1 } = data;
          
          let periodsToFill = 1;
          if (remaining > 1) {
            const result = window.prompt(`How many continuous periods for ${course.ID || course.code}? (Max ${remaining})`, "1");
            if (result === null) {
              setDragOver(false);
              setHoveredAction(null);
              return; // User cancelled drop
            }
            const parsed = parseInt(result, 10);
            if (!isNaN(parsed) && parsed > 0) {
              periodsToFill = Math.min(parsed, remaining);
            }
          }
          
          // Try to auto-resolve teacher from curriculum or default teachers list
          let defaultTeacherId = null;
          let teacherValue = null;
          if (curriculumData?.courses) {
            const currEntry = curriculumData.courses.find(c => String(c.courseId) === String(course.unid));
            if (currEntry && currEntry.teacherIds && currEntry.teacherIds.length > 0) {
              defaultTeacherId = currEntry.teacherIds[0];
            }
          } else if (course.teachers && course.teachers.length > 0) {
            defaultTeacherId = course.teachers[0];
          }
          
          if (defaultTeacherId && allTeachersRaw?.length) {
            const teacherObj = allTeachersRaw.find(t => String(t.unid) === String(defaultTeacherId));
            if (teacherObj) {
              teacherValue = teacherObj.ID || teacherObj.name;
            }
          }
          
          const courseValue = course.ID || course.code || course.name;

          // Helper to resolve teacher for batch section
          const resolveTeacherForBatch = (courseObj, bName) => {
            if (!courseObj) return { teacherId: null, teacherDisplay: null };
            if (courseObj.batchTeachers?.[bName] && Array.isArray(courseObj.batchTeachers[bName]) && courseObj.batchTeachers[bName].length > 0) {
              const tUnid = courseObj.batchTeachers[bName][0];
              const tObj = allTeachersRaw?.find(t => String(t.unid) === String(tUnid));
              if (tObj) return { teacherId: tObj.unid, teacherDisplay: tObj.ID || tObj.name };
            }
            if (courseObj.teachers && Array.isArray(courseObj.teachers) && courseObj.teachers.length > 0) {
              const tUnid = courseObj.teachers[0];
              const tObj = allTeachersRaw?.find(t => String(t.unid) === String(tUnid));
              if (tObj) return { teacherId: tObj.unid, teacherDisplay: tObj.ID || tObj.name };
            }
            return { teacherId: null, teacherDisplay: null };
          };

          const targetBatchName = course.batchName || (course.name?.match(/\(([^)]+)\)$/)?.[1]);

          for (let p = 0; p < periodsToFill; p++) {
            const targetRowIter = rowIndex + p;
            const cellBatchCount = batches[`${targetRowIter}-${colIndex}`] || 1;
            let targetBatchIndex = 0;

            if (cellBatchCount > 1) {
              const partitionList = Array.from({ length: cellBatchCount }, (_, i) => {
                const bData = batchData[`${targetRowIter}-${colIndex}-${i}`] || {};
                const name = bData.batchName || `B${i + 1}`;
                const cVal = bData.course ? ` - ${bData.course}` : ' (Empty)';
                return `${i + 1}: Partition ${i + 1} [${name}]${cVal}`;
              }).join('\n');

              const promptMsg = `This cell has ${cellBatchCount} partitions:\n\n${partitionList}\n\nWhere do you want to place ${courseValue}?\n• Enter partition number (1-${cellBatchCount})\n• Enter 0 to revert cell to Single Unpartitioned Cell`;
              const response = window.prompt(promptMsg, "1");
              if (response === null) {
                setDragOver(false);
                setHoveredAction(null);
                return;
              }

              const choice = parseInt(String(response).trim(), 10);
              if (choice === 0) {
                for (let b = cellBatchCount - 1; b >= 1; b--) {
                  if (onRemoveBatch) onRemoveBatch(targetRowIter, colIndex, b);
                }
                targetBatchIndex = 0;
              } else if (!isNaN(choice) && choice >= 1 && choice <= cellBatchCount) {
                targetBatchIndex = choice - 1;
              }
            } else {
              targetBatchIndex = 0;
            }

            onUpdateBatch(targetRowIter, colIndex, targetBatchIndex, 'course', courseValue);
            if (targetBatchName) {
              onUpdateBatch(targetRowIter, colIndex, targetBatchIndex, 'batchName', targetBatchName);
            }
            if (course.unid) {
              onUpdateBatch(targetRowIter, colIndex, targetBatchIndex, 'courseId', course.unid);
            }

            if (teacherValue) {
              onUpdateBatch(targetRowIter, colIndex, targetBatchIndex, 'teacher', teacherValue);
              if (defaultTeacherId) {
                onUpdateBatch(targetRowIter, colIndex, targetBatchIndex, 'teacherId', defaultTeacherId);
              }
            }
          }

          setDragOver(false);
          setHoveredAction(null);
          return;
          
          setDragOver(false);
          setHoveredAction(null);
          return;
        }

        // Handle ROOM_BUBBLE drop from sidebar
        if (data.type === 'ROOM_BUBBLE' && data.room) {
          const { room, roomDisplay } = data;
          const cellBatchCount = batches[`${rowIndex}-${colIndex}`] || 1;
          
          // Find the first batch that doesn't have a room assigned
          let targetBatchIndex = 0;
          for (let i = 0; i < cellBatchCount; i++) {
            const d = batchData[`${rowIndex}-${colIndex}-${i}`] || {};
            if (!d.room) {
              targetBatchIndex = i;
              break;
            }
          }
          
          // Assign room to the cell spanning all merged rows if applicable
          for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
            onUpdateBatch(r, colIndex, targetBatchIndex, 'room', roomDisplay);
            onUpdateBatch(r, colIndex, targetBatchIndex, 'roomId', room.unid);
          }
          
          setDragOver(false);
          setHoveredAction(null);
          return;
        }
      } catch (err) {
        console.error("Error parsing drop payload", err);
      }
    }
    
    // Default cell-to-cell move/copy logic
    const sourceData = window.__dragSourceCell;
    if (!sourceData) {
      setDragOver(false);
      setHoveredAction(null);
      return;
    }
    
    const targetRow = rowIndex;
    const targetCol = colIndex;
    
    // Don't drop on same cell
    if (sourceData.rowIndex === targetRow && sourceData.colIndex === targetCol) {
      setDragOver(false);
      setHoveredAction(null);
      return;
    }
    
    // Execute action based on which icon was hovered
    if (hoveredAction === 'copy' && onCopyCell) {
      onCopyCell(sourceData.rowIndex, sourceData.colIndex, targetRow, targetCol);
    } else if (hoveredAction === 'move' && onMoveCell) {
      onMoveCell(sourceData.rowIndex, sourceData.colIndex, targetRow, targetCol);
    }
    
    setDragOver(false);
    setHoveredAction(null);
    window.__dragSourceCell = null;
  };
  
  // Handle clearing all entries in the cell
  const handleClearCell = () => {
    const confirmClear = window.confirm('Are you sure you want to clear all entries in this block?');
    if (!confirmClear) return;
    
    // Clear all batches in this block
    for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
      const bCount = batches[`${r}-${colIndex}`] || 1;
      for (let i = 0; i < bCount; i++) {
        onUpdateBatch(r, colIndex, i, 'batchName', '');
        onUpdateBatch(r, colIndex, i, 'course', '');
        onUpdateBatch(r, colIndex, i, 'teacher', '');
        onUpdateBatch(r, colIndex, i, 'room', '');
        onUpdateBatch(r, colIndex, i, 'courseId', '');
        onUpdateBatch(r, colIndex, i, 'teacherId', '');
        onUpdateBatch(r, colIndex, i, 'roomId', '');
        onUpdateBatch(r, colIndex, i, 'remark', undefined);
      }
    }
  };

  const handleClearBatch = (batchIndex) => {
    for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
      onUpdateBatch(r, colIndex, batchIndex, 'batchName', '');
      onUpdateBatch(r, colIndex, batchIndex, 'course', '');
      onUpdateBatch(r, colIndex, batchIndex, 'teacher', '');
      onUpdateBatch(r, colIndex, batchIndex, 'room', '');
      onUpdateBatch(r, colIndex, batchIndex, 'courseId', '');
      onUpdateBatch(r, colIndex, batchIndex, 'teacherId', '');
      onUpdateBatch(r, colIndex, batchIndex, 'roomId', '');
      onUpdateBatch(r, colIndex, batchIndex, 'remark', undefined);
    }
  };

  // Handle input change with validation
  const handleInputChange = async (batchIndex, field, value) => {
    // Update the value immediately for all rows in span
    for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
      onUpdateBatch(r, colIndex, batchIndex, field, value);
    }
    
    // Clear existing timeout for this field
    const timeoutKey = `${batchIndex}-${field}`;
    if (validationTimeouts.current[timeoutKey]) {
      clearTimeout(validationTimeouts.current[timeoutKey]);
    }
    
    // Debounce validation (wait 500ms after user stops typing)
    validationTimeouts.current[timeoutKey] = setTimeout(async () => {
      let validation = { isValid: true, error: null };
      let entityId = null;
      
      if (field === 'course') {
        if (!value.trim()) {
          for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
            onUpdateBatch(r, colIndex, batchIndex, 'courseId', '');
          }
        } else {
          // Auto-split cell into batches if selected course has batches configured
          const normVal = value.trim().toLowerCase();
          const matchedCourse = allCoursesRaw?.find(
            (c) => (c.ID || c.code || c.name || '').trim().toLowerCase() === normVal
          );

          if (matchedCourse) {
            // Auto-populate batchName if course belongs to a specific batch (e.g., B1, B2)
            const extractedBatchName = matchedCourse.batchName || (matchedCourse.name?.match(/\(([^)]+)\)$/)?.[1]);
            if (extractedBatchName) {
              for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
                onUpdateBatch(r, colIndex, batchIndex, 'batchName', extractedBatchName);
              }
            }

            // Auto-assign teacher if course has assigned teachers
            if (matchedCourse.teachers && matchedCourse.teachers.length > 0 && allTeachersRaw?.length) {
              const tUnid = matchedCourse.teachers[0];
              const tObj = allTeachersRaw.find(t => String(t.unid) === String(tUnid));
              if (tObj) {
                for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
                  onUpdateBatch(r, colIndex, batchIndex, 'teacher', tObj.ID || tObj.name);
                  onUpdateBatch(r, colIndex, batchIndex, 'teacherId', tObj.unid);
                }
              }
            }
          }

          validation = await validateCourse(value);
          if (validation.isValid) {
            entityId = await getCourseIdFromDisplay(value);
            if (entityId) {
              for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
                onUpdateBatch(r, colIndex, batchIndex, 'courseId', entityId);
              }
            }
          }
        }
      } else if (field === 'teacher') {
        if (!value.trim()) {
          for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
            onUpdateBatch(r, colIndex, batchIndex, 'teacherId', '');
          }
        } else {
          validation = await validateTeacher(value);
          if (validation.isValid) {
            entityId = await getTeacherIdFromDisplay(value);
            if (entityId) {
              for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
                onUpdateBatch(r, colIndex, batchIndex, 'teacherId', entityId);
              }
            }
          }
        }
      } else if (field === 'room') {
        if (!value.trim()) {
          for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
            onUpdateBatch(r, colIndex, batchIndex, 'roomId', '');
          }
        } else {
          validation = await validateRoom(value);
          if (validation.isValid) {
            entityId = await getRoomIdFromDisplay(value);
            if (entityId) {
              for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
                onUpdateBatch(r, colIndex, batchIndex, 'roomId', entityId);
              }
            }
          }
        }
      }
      
      // Notify parent component of validation result
      if (onValidationChange) {
        const dataKey = `${rowIndex}-${colIndex}-${batchIndex}`;
        onValidationChange(dataKey, field, validation);
      }
    }, 500);
  };

  // Helper function to check if a cell has batch fields
  const cellHasBatchField = (targetRow, targetCol) => {
    const allInputs = document.querySelectorAll('input[type="text"]');
    
    for (const input of allInputs) {
      const placeholder = input.getAttribute('placeholder');
      if (placeholder !== 'Batch') continue;
      
      const cell = input.closest('td');
      if (!cell) continue;
      
      const row = cell.parentElement;
      const table = row.parentElement.parentElement;
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const cells = Array.from(row.children).filter(c => c.tagName === 'TD');
      
      const cellRow = rows.indexOf(row);
      const cellCol = cells.indexOf(cell) - 1; // -1 for time column
      
      if (cellRow === targetRow && cellCol === targetCol) {
        return true;
      }
    }
    return false;
  };

  // Helper function to get the last batch index in a cell
  const getLastBatchIndex = (targetRow, targetCol) => {
    const allInputs = document.querySelectorAll('input[type="text"]');
    let maxBatchIndex = 0;
    
    for (const input of allInputs) {
      const cell = input.closest('td');
      if (!cell) continue;
      
      const row = cell.parentElement;
      const table = row.parentElement.parentElement;
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const cells = Array.from(row.children).filter(c => c.tagName === 'TD');
      
      const cellRow = rows.indexOf(row);
      const cellCol = cells.indexOf(cell) - 1; // -1 for time column
      
      if (cellRow === targetRow && cellCol === targetCol) {
        const batchDiv = input.closest('.flex-1');
        if (batchDiv) {
          const batchContainer = batchDiv.parentElement;
          const allBatches = Array.from(batchContainer.children);
          const currentBatchIdx = allBatches.indexOf(batchDiv);
          maxBatchIndex = Math.max(maxBatchIndex, currentBatchIdx);
        }
      }
    }
    return maxBatchIndex;
  };

  // Helper function to find input in another cell
  const findInputInCell = (targetRow, targetCol, fieldType, targetBatchIndex = 0) => {
    const allInputs = document.querySelectorAll('input[type="text"]');
    
    // Find the placeholder text for the field type
    let placeholderText;
    if (fieldType === 'batchName') placeholderText = 'Batch';
    else if (fieldType === 'course') placeholderText = 'Course';
    else if (fieldType === 'teacher') placeholderText = 'Teacher';
    else if (fieldType === 'room') placeholderText = 'Room';
    
    // Find all inputs with matching placeholder
    for (const input of allInputs) {
      const placeholder = input.getAttribute('placeholder');
      if (placeholder !== placeholderText) continue;
      
      const cell = input.closest('td');
      if (!cell) continue;
      
      const row = cell.parentElement;
      const table = row.parentElement.parentElement;
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const cells = Array.from(row.children).filter(c => c.tagName === 'TD');
      
      const cellRow = rows.indexOf(row);
      const cellCol = cells.indexOf(cell) - 1; // -1 for time column
      
      // Check if this is the target cell
      if (cellRow === targetRow && cellCol === targetCol) {
        // Find the batch index of this input
        const batchDiv = input.closest('.flex-1');
        if (batchDiv) {
          const batchContainer = batchDiv.parentElement;
          const allBatches = Array.from(batchContainer.children);
          const currentBatchIdx = allBatches.indexOf(batchDiv);
          
          if (currentBatchIdx === targetBatchIndex) {
            return input;
          }
        }
      }
    }
    return null;
  };

  // Handle keyboard navigation
  const handleKeyDown = (e, batchIndex, fieldType) => {
    const fields = showBatchField ? ['batchName', 'course', 'teacher', 'room'] : ['course', 'teacher', 'room'];
    const currentFieldIndex = fields.indexOf(fieldType);
    
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Move to next field in current batch
      if (currentFieldIndex < fields.length - 1) {
        const nextField = fields[currentFieldIndex + 1];
        const nextRef = inputRefs.current[`${batchIndex}-${nextField}`];
        nextRef?.focus();
      } 
      // Move to next batch's first field
      else if (batchIndex < batchCount - 1) {
        const nextBatchFirstField = fields[0];
        const nextRef = inputRefs.current[`${batchIndex + 1}-${nextBatchFirstField}`];
        nextRef?.focus();
      }
      // Move to next cell - try to find next cell's first input
      else {
        const allInputs = document.querySelectorAll('input[type="text"]');
        const currentInput = e.target;
        const currentIndex = Array.from(allInputs).indexOf(currentInput);
        if (currentIndex >= 0 && currentIndex < allInputs.length - 1) {
          allInputs[currentIndex + 1]?.focus();
        }
      }
    }
    
    // Arrow key navigation
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      
      // First, try to move to the same field in the next batch within the current cell
      if (batchIndex < batchCount - 1) {
        const nextRef = inputRefs.current[`${batchIndex + 1}-${fieldType}`];
        nextRef?.focus();
      }
      // If no more batches in current cell, move to the first field of the next cell's first batch
      else {
        let targetFieldType = fieldType;
        // If we're on a batch field, check if the next cell has batch field
        if (fieldType === 'batchName') {
          const nextCellHasBatch = cellHasBatchField(rowIndex, colIndex + 1);
          targetFieldType = nextCellHasBatch ? 'batchName' : 'course';
        }
        const targetInput = findInputInCell(rowIndex, colIndex + 1, targetFieldType, 0);
        targetInput?.focus();
      }
    }
    
    else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      
      // First, try to move to the same field in the previous batch within the current cell
      if (batchIndex > 0) {
        const prevRef = inputRefs.current[`${batchIndex - 1}-${fieldType}`];
        prevRef?.focus();
      }
      // If no previous batch in current cell, move to the last batch of the previous cell
      else if (colIndex > 0) {
        let targetFieldType = fieldType;
        let targetBatchIndex = 0;
        
        // If we're on a batch field, check if the previous cell has batch field
        if (fieldType === 'batchName') {
          const prevCellHasBatch = cellHasBatchField(rowIndex, colIndex - 1);
          targetFieldType = prevCellHasBatch ? 'batchName' : 'course';
          // Get the last batch index of the previous cell
          if (prevCellHasBatch) {
            targetBatchIndex = getLastBatchIndex(rowIndex, colIndex - 1);
          }
        } else {
          // For non-batch fields, also jump to the last batch
          targetBatchIndex = getLastBatchIndex(rowIndex, colIndex - 1);
        }
        
        const targetInput = findInputInCell(rowIndex, colIndex - 1, targetFieldType, targetBatchIndex);
        targetInput?.focus();
      }
    }
    
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      
      // Move to next field within the same cell and batch
      if (currentFieldIndex < fields.length - 1) {
        const nextField = fields[currentFieldIndex + 1];
        const nextRef = inputRefs.current[`${batchIndex}-${nextField}`];
        nextRef?.focus();
      }
      // If on last field (room), move to the cell below with smart batch logic
      else {
        const downCellHasBatch = cellHasBatchField(rowIndex + 1, colIndex);
        
        if (downCellHasBatch) {
          // Get the last batch index of the downward cell
          const downCellLastBatchIndex = getLastBatchIndex(rowIndex + 1, colIndex);
          // Try to jump to the same batch index, or the last available batch if current index is higher
          const targetBatchIndex = Math.min(batchIndex, downCellLastBatchIndex);
          const firstField = fields[0];
          const targetInput = findInputInCell(rowIndex + 1, colIndex, firstField, targetBatchIndex);
          targetInput?.focus();
        } else {
          // No batch field in downward cell, jump to course field
          const targetInput = findInputInCell(rowIndex + 1, colIndex, 'course', 0);
          targetInput?.focus();
        }
      }
    }
    
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      
      // Move to previous field within the same cell and batch
      if (currentFieldIndex > 0) {
        const prevField = fields[currentFieldIndex - 1];
        const prevRef = inputRefs.current[`${batchIndex}-${prevField}`];
        prevRef?.focus();
      }
      // If on first field, move to last field (room) of the cell above (same batch index)
      else if (rowIndex > 0) {
        const lastField = fields[fields.length - 1];
        const targetInput = findInputInCell(rowIndex - 1, colIndex, lastField, batchIndex);
        targetInput?.focus();
      }
    }
  };

  return (
    <td 
      rowSpan={rowSpan || 1}
      colSpan={colSpan || 1}
      className={`p-2 min-w-[140px] align-top relative group cursor-move transition-all border-r border-gray-400 ${
        dragOver
          ? 'bg-indigo-50 ring-2 ring-indigo-400 shadow-inner'
          : isFilled
          ? 'bg-white'
          : 'bg-gray-50 opacity-50 hover:opacity-100'
      }`}
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Indicator - Top Left */}
      <div className="absolute top-1 left-1 z-10">
        <div className="w-4 h-4 flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100 transition-all">
          <GripVertical className="w-3 h-3" />
        </div>
      </div>

      {/* Action Buttons - Top Right */}
      <div className="absolute top-1 right-1 z-10 flex gap-1">
        {/* Delete Button — only shown when there is a single batch */}
        {batchCount === 1 && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClearCell();
            }}
            className="w-5 h-5 flex items-center justify-center bg-white hover:bg-red-50 text-gray-600 hover:text-red-600 rounded border border-gray-200 hover:border-red-300 opacity-0 group-hover:opacity-100 transition-all"
            title="Clear cell"
            type="button"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
              const currentCount = batches[`${r}-${colIndex}`] || 1;
              onCreateBatch(r, colIndex);
              
              const d0 = batchData[`${r}-${colIndex}-0`] || {};
              const courseVal = d0.course || '';
              const matchedCourse = allCoursesRaw?.find(
                (c) => (c.ID || c.code || c.name || '').trim().toLowerCase() === courseVal.trim().toLowerCase()
              );
              const parentBatches = matchedCourse?.batches || [];
              const defaultBatchName = parentBatches[currentCount] || `B${currentCount + 1}`;
              onUpdateBatch(r, colIndex, currentCount, 'batchName', defaultBatchName);
            }
          }}
          className="w-5 h-5 flex items-center justify-center bg-white hover:bg-gray-900 text-gray-600 hover:text-white rounded border border-gray-200 hover:border-gray-900 opacity-0 group-hover:opacity-100 transition-all"
          title="Create new batch / partition"
          type="button"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Drag Overlay with Action Icons */}
      {dragOver && (
        <div 
          className="absolute inset-0 bg-gradient-to-br from-blue-100 to-blue-50 z-20 flex items-center justify-center gap-4 rounded backdrop-blur-sm"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Copy Icon */}
          <div
            onMouseEnter={() => setHoveredAction('copy')}
            onMouseLeave={() => setHoveredAction(null)}
            onDragOver={(e) => {
              e.preventDefault();
              setHoveredAction('copy');
            }}
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-lg cursor-pointer transition-all duration-200 ${
              hoveredAction === 'copy'
                ? 'bg-blue-600 scale-110 shadow-xl'
                : 'bg-gray-400 hover:bg-gray-500 shadow-md'
            }`}
            title="Copy to this cell"
          >
            <Copy size={28} className="text-white pointer-events-none" />
            {hoveredAction === 'copy' && (
              <span className="text-white text-[10px] font-medium mt-1 pointer-events-none">Copy</span>
            )}
          </div>

          {/* Move Icon */}
          <div
            onMouseEnter={() => setHoveredAction('move')}
            onMouseLeave={() => setHoveredAction(null)}
            onDragOver={(e) => {
              e.preventDefault();
              setHoveredAction('move');
            }}
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-lg cursor-pointer transition-all duration-200 ${
              hoveredAction === 'move'
                ? 'bg-green-600 scale-110 shadow-xl'
                : 'bg-gray-400 hover:bg-gray-500 shadow-md'
            }`}
            title="Move to this cell"
          >
            <Move size={28} className="text-white pointer-events-none" />
            {hoveredAction === 'move' && (
              <span className="text-white text-[10px] font-medium mt-1 pointer-events-none">Move</span>
            )}
          </div>

          {/* Cancel Icon */}
          <div
            onMouseEnter={() => setHoveredAction('cancel')}
            onMouseLeave={() => setHoveredAction(null)}
            onDragOver={(e) => {
              e.preventDefault();
              setHoveredAction('cancel');
            }}
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-lg cursor-pointer transition-all duration-200 ${
              hoveredAction === 'cancel'
                ? 'bg-red-600 scale-110 shadow-xl'
                : 'bg-gray-400 hover:bg-gray-500 shadow-md'
            }`}
            title="Cancel"
          >
            <X size={28} className="text-white pointer-events-none" />
            {hoveredAction === 'cancel' && (
              <span className="text-white text-[10px] font-medium mt-1 pointer-events-none">Cancel</span>
            )}
          </div>
        </div>
      )}

      <div className="flex divide-x divide-gray-200 min-h-[70px]">
        {Array.from({ length: batchCount }).map((_, batchIndex) => {
          const dataKey = `${rowIndex}-${colIndex}-${batchIndex}`;
          const batch = batchData[dataKey] || {};
          const conflictInfo = conflicts?.[dataKey] || {};
          const validationInfo = validationErrors?.[dataKey] || {};
          const hasTeacherConflict = conflictInfo.teacher?.conflict;
          const hasRoomConflict = conflictInfo.room?.conflict;
          
          // Validation errors
          const hasCourseError = validationInfo.course && !validationInfo.course.isValid;
          const hasTeacherError = validationInfo.teacher && !validationInfo.teacher.isValid;
          const hasRoomError = validationInfo.room && !validationInfo.room.isValid;
          
          // Check if data is migrated (has IDs) or using old format
          const isCourseOldFormat = batch.course && !batch.courseId;
          const isTeacherOldFormat = batch.teacher && !batch.teacherId;
          const isRoomOldFormat = batch.room && !batch.roomId;

          return (
            <div key={batchIndex} className="relative group/batch flex-1 min-w-[70px] p-1 space-y-1">
              {/* Action buttons (Delete and Remark Toggle) */}
              <div className="absolute top-0 right-1 z-10 flex gap-0.5 opacity-0 group-hover/batch:opacity-100 transition-all bg-white rounded shadow-sm border border-gray-100">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newRemark = batch.remark !== undefined ? undefined : "";
                    for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
                      onUpdateBatch(r, colIndex, batchIndex, 'remark', newRemark);
                    }
                  }}
                  className="w-4 h-4 flex items-center justify-center hover:bg-blue-50 text-gray-400 hover:text-blue-500 rounded"
                  title="Toggle remark field"
                  type="button"
                >
                  <MessageSquarePlus className="w-2.5 h-2.5" />
                </button>
                {batchCount > 1 && (
                  <button
                    onClick={(e) => { 
                      e.preventDefault(); 
                      e.stopPropagation(); 
                      for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
                        onRemoveBatch(r, colIndex, batchIndex); 
                      }
                    }}
                    className="w-4 h-4 flex items-center justify-center hover:bg-red-50 text-gray-400 hover:text-red-500 rounded"
                    title="Remove this split"
                    type="button"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              {/* Batch Name Field - only shown when more than 1 batch */}
              {showBatchField && (
                <input
                  ref={(el) => {
                    inputRefs.current[`${batchIndex}-batchName`] = el;
                    // Set firstCellRef for the very first input
                    if (isFirstCell && batchIndex === 0 && firstCellRef) {
                      firstCellRef.current = el;
                    }
                  }}
                  type="text"
                  placeholder="Batch"
                  value={batch.batchName || ""}
                  onChange={(e) => {
                    for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
                      onUpdateBatch(r, colIndex, batchIndex, 'batchName', e.target.value);
                    }
                  }}
                  onKeyDown={(e) => handleKeyDown(e, batchIndex, 'batchName')}
                  className="w-full text-[10px] px-1 py-0.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                />
              )}

              {/* Course Field */}
              <div className="relative">
                <SimpleCombobox
                  value={batch.course || ""}
                  onChange={(val) => {
                    handleInputChange(batchIndex, 'course', val);
                  }}
                  onKeyDown={(e) => handleKeyDown(e, batchIndex, 'course')}
                  options={filteredCourses}
                  inputRef={(el) => {
                    inputRefs.current[`${batchIndex}-course`] = el;
                    if (isFirstCell && batchIndex === 0 && !showBatchField && firstCellRef) {
                      firstCellRef.current = el;
                    }
                  }}
                  className={`w-full text-[10px] px-1 py-0.5 border rounded focus:outline-none focus:ring-1 ${
                    hasCourseError
                      ? "border-orange-500 bg-orange-50 focus:ring-orange-500 focus:border-orange-500"
                      : isCourseOldFormat
                      ? "border-red-900 bg-red-50 text-red-900 focus:ring-red-900 focus:border-red-900"
                      : "border-gray-300 focus:ring-blue-400 focus:border-blue-400"
                  }`}
                  placeholder="Course"
                  title={
                    hasCourseError
                      ? `⚠️ ${validationInfo.course?.error || 'Invalid course'}`
                      : isCourseOldFormat
                      ? "⚠️ Not migrated - Using old format (no ID reference)"
                      : ""
                  }
                />
                {hasCourseError && (
                  <AlertCircle className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-orange-500" />
                )}
              </div>

              {/* Teacher Field — smart grouped combobox */}
              <div className="relative">
                <TeacherCombobox
                  value={batch.teacher || ""}
                  onChange={(val) => handleInputChange(batchIndex, 'teacher', val)}
                  onKeyDown={(e) => handleKeyDown(e, batchIndex, 'teacher')}
                  groups={getTeacherGroups(batch.course || "")}
                  inputRef={(el) => inputRefs.current[`${batchIndex}-teacher`] = el}
                  className={`w-full text-[10px] px-1 py-0.5 border rounded focus:outline-none focus:ring-1 ${
                    hasTeacherError
                      ? "border-orange-500 bg-orange-50 focus:ring-orange-500 focus:border-orange-500"
                      : hasTeacherConflict
                      ? "border-red-500 bg-red-50 focus:ring-red-400 focus:border-red-500"
                      : isTeacherOldFormat
                      ? "border-red-900 bg-red-50 text-red-900 focus:ring-red-900 focus:border-red-900"
                      : "border-gray-300 focus:ring-blue-400 focus:border-blue-400"
                  }`}
                  placeholder="Teacher"
                  title={
                    hasTeacherError
                      ? `⚠️ ${validationInfo.teacher?.error || 'Invalid teacher'}`
                      : hasTeacherConflict
                      ? "⚠️ Conflict: Teacher assigned elsewhere at this time"
                      : isTeacherOldFormat
                      ? "⚠️ Not migrated - Using old format (no ID reference)"
                      : ""
                  }
                />
                {hasTeacherError && (
                  <AlertCircle className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-orange-500" />
                )}
              </div>

              {/* Cross-timetable Teacher Booking Warning (Directly Below Teacher Input) */}
              {(() => {
                if (!batch.teacherId || !teacherBookings || !days || !timeSlots) return null;
                const warnKey = `teacher-${batchIndex}-${batch.teacherId}`;
                if (dismissedBookingWarnings[warnKey]) return null;
                
                const cellDay = (days || [])[colIndex];
                const cellTime = (timeSlots || [])[rowIndex];
                if (!cellDay || !cellTime) return null;
                
                const norm = (v) => String(v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
                const teacherIds = String(batch.teacherId).split(',').map(id => id.trim()).filter(Boolean);
                
                const allBookingsAtSlot = [];
                teacherIds.forEach((tId) => {
                  const bookingsForTeacher = teacherBookings[tId] || [];
                  const matches = bookingsForTeacher.filter(
                    (b) => norm(b.day) === norm(cellDay) && norm(b.time) === norm(cellTime)
                  );
                  allBookingsAtSlot.push(...matches);
                });
                
                // Smart exclusion: 
                // Exclude any draft bookings coming from the EXACT SAME tab doing the editing.
                const bookings = allBookingsAtSlot.filter((b) => {
                  if (b.source === "draft" && b.sourceTableKey === currentTableKey) return false;
                  return true;
                });
                
                if (bookings.length === 0) return null;
                
                const getTeacherDisplay = (tId) => {
                  const found = allTeachersRaw?.find((t) => String(t.unid) === String(tId));
                  return found ? (found.ID || found.name) : tId;
                };

                // Build label showing who it's booked by
                const bookedByLabels = bookings.map((b) => {
                  const parts = [b.class, b.branch].filter(Boolean);
                  const classBranch = parts.join(" · ") || b.timetableId || "Another timetable";
                  const teacherDisplay = getTeacherDisplay(b.teacherId);
                  return `${teacherDisplay} occupied by ${classBranch}`;
                });
                const uniqueLabels = [...new Set(bookedByLabels)];
                
                return (
                  <div className="mt-0.5 flex items-start gap-0.5 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 animate-fadeIn">
                    <AlertCircle className="w-2.5 h-2.5 text-amber-500 shrink-0 mt-[1px]" />
                    <span className="text-[7px] text-amber-700 leading-tight flex-1">
                      {uniqueLabels.join(", ")}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDismissedBookingWarnings((prev) => ({ ...prev, [warnKey]: true }));
                      }}
                      className="text-amber-400 hover:text-amber-600 shrink-0 -mt-[1px]"
                      title="Dismiss warning"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })()}

              {/* Room Field */}
              <div className="relative">
                <SimpleCombobox
                  value={batch.room || ""}
                  onChange={(val) => handleInputChange(batchIndex, 'room', val)}
                  onKeyDown={(e) => handleKeyDown(e, batchIndex, 'room')}
                  options={rooms}
                  inputRef={(el) => inputRefs.current[`${batchIndex}-room`] = el}
                  className={`w-full text-[10px] px-1 py-0.5 border rounded focus:outline-none focus:ring-1 ${
                    hasRoomError
                      ? "border-orange-500 bg-orange-50 focus:ring-orange-500 focus:border-orange-500"
                      : hasRoomConflict
                      ? "border-red-500 bg-red-50 focus:ring-red-400 focus:border-red-500"
                      : isRoomOldFormat
                      ? "border-red-900 bg-red-50 text-red-900 focus:ring-red-900 focus:border-red-900"
                      : "border-gray-300 focus:ring-blue-400 focus:border-blue-400"
                  }`}
                  placeholder="Room"
                  title={
                    hasRoomError
                      ? `⚠️ ${validationInfo.room?.error || 'Invalid room'}`
                      : hasRoomConflict
                      ? "⚠️ Conflict: Room assigned elsewhere at this time"
                      : isRoomOldFormat
                      ? "⚠️ Not migrated - Using old format (no ID reference)"
                      : ""
                  }
                />
                {hasRoomError && (
                  <AlertCircle className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-orange-500" />
                )}
              </div>

              {/* Cross-timetable Room Booking Warning (Directly Below Room Input) */}
              {(() => {
                if (!batch.roomId || !roomBookings || !days || !timeSlots) return null;
                const warnKey = `room-${batchIndex}-${batch.roomId}`;
                if (dismissedBookingWarnings[warnKey]) return null;
                
                const cellDay = (days || [])[colIndex];
                const cellTime = (timeSlots || [])[rowIndex];
                if (!cellDay || !cellTime) return null;
                
                const norm = (v) => String(v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
                const allBookingsAtSlot = (roomBookings[String(batch.roomId)] || []).filter(
                  (b) => norm(b.day) === norm(cellDay) && norm(b.time) === norm(cellTime)
                );
                
                // Smart exclusion: 
                // Exclude any draft bookings coming from the EXACT SAME tab doing the editing.
                const bookings = allBookingsAtSlot.filter((b) => {
                  if (b.source === "draft" && b.sourceTableKey === currentTableKey) return false;
                  return true;
                });
                
                if (bookings.length === 0) return null;
                
                // Build label showing who it's booked by
                const bookedByLabels = bookings.map((b) => {
                  const parts = [b.class, b.branch].filter(Boolean);
                  return parts.join(" · ") || b.timetableId || "Another timetable";
                });
                const uniqueLabels = [...new Set(bookedByLabels)];
                
                return (
                  <div className="mt-0.5 flex items-start gap-0.5 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 animate-fadeIn">
                    <AlertCircle className="w-2.5 h-2.5 text-amber-500 shrink-0 mt-[1px]" />
                    <span className="text-[7px] text-amber-700 leading-tight flex-1">
                      Room occupied by {uniqueLabels.join(", ")}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDismissedBookingWarnings((prev) => ({ ...prev, [warnKey]: true }));
                      }}
                      className="text-amber-400 hover:text-amber-600 shrink-0 -mt-[1px]"
                      title="Dismiss warning"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })()}

              {/* Remark Field */}
              {batch.remark !== undefined && (
                <div className="relative mt-1">
                  <input
                    type="text"
                    placeholder="Remark (Girls/Boys/etc)"
                    value={batch.remark || ""}
                    onChange={(e) => {
                      for (let r = rowIndex; r < rowIndex + (rowSpan || 1); r++) {
                        onUpdateBatch(r, colIndex, batchIndex, 'remark', e.target.value);
                      }
                    }}
                    className="w-full text-[10px] px-1 py-0.5 border border-dashed border-blue-300 bg-blue-50/30 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-gray-600"
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </td>
  );
};

export default TimetableCell;
