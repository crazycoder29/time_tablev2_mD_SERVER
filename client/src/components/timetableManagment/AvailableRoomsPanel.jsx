// Tooltip Portal to escape overflow containers
import { createPortal } from "react-dom";
import React, { useState, useMemo, useRef, useEffect } from "react";
import { Building2, Search, ChevronDown, ChevronRight, Lock, MapPin, X } from "lucide-react";
import { getRoomBookings } from "../../firebase/services/roomBookings";

const TooltipPortal = ({ children, targetRef, isVisible }) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isVisible && targetRef.current) {
      const updatePosition = () => {
        const rect = targetRef.current.getBoundingClientRect();
        setPosition({
          top: rect.top - 10, // 10px above the element
          left: rect.left + rect.width / 2,
        });
      };
      
      updatePosition();
      
      // Update on resize or scroll
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible, targetRef]);

  if (!isVisible || !document.body) return null;

  return createPortal(
    <div 
      className="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-full"
      style={{ top: position.top, left: position.left }}
    >
      {children}
    </div>,
    document.body
  );
};

const BookedSlotBadge = ({ slot }) => {
  const [isHovered, setIsHovered] = useState(false);
  const badgeRef = useRef(null);

  return (
    <span
      ref={badgeRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="inline-flex items-center gap-0.5 text-[7px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-medium cursor-help"
    >
      <Lock size={7} />
      {slot.day} {slot.time?.split(" - ")[0] || slot.time}
      {slot.classes.length > 1 && (
        <span className="bg-red-200 text-red-700 text-[6px] px-1 rounded-full ml-0.5">
          {slot.classes.length}
        </span>
      )}

      {/* Styled hover popup via Portal */}
      <TooltipPortal targetRef={badgeRef} isVisible={isHovered}>
        <div className="bg-gray-900 text-white rounded-lg shadow-xl px-3 py-2 min-w-[180px] max-w-[240px] animate-fadeIn">
          <div className="text-[9px] font-bold text-red-300 uppercase tracking-wide mb-1 border-b border-gray-700 pb-1">
            🔒 {slot.day} {slot.time}
          </div>
          <div className="text-[9px] text-gray-300 font-medium mb-1">
            Occupied by:
          </div>
          {slot.classes.length > 0 ? (
            <ul className="space-y-0.5">
              {slot.classes.map((cls, ci) => (
                <li key={ci} className="text-[9px] text-white flex items-start gap-1">
                  <span className="text-yellow-400 shrink-0">•</span>
                  <span>{cls}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[9px] text-gray-400 italic">Unknown class</div>
          )}
          
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px]">
             <div className="border-[5px] border-transparent border-t-gray-900"></div>
          </div>
        </div>
      </TooltipPortal>
    </span>
  );
};

/**
 * Modal popup showing all occupied slots for a room.
 */
const AllSlotsModal = ({ isOpen, onClose, roomName, slots }) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-[420px] max-h-[70vh] flex flex-col animate-fadeIn border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-100 rounded-lg">
              <Lock size={14} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{roomName}</h3>
              <p className="text-[10px] text-gray-500">{slots.length} occupied time slots</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* Slots List */}
        <div className="overflow-y-auto flex-1 p-3 space-y-1.5 custom-scrollbar">
          {slots.map((slot, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:bg-red-50/50 hover:border-red-100 transition-colors"
            >
              {/* Day + Time */}
              <div className="flex flex-col items-center min-w-[72px] shrink-0">
                <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                  {slot.day}
                </span>
                <span className="text-[8px] text-gray-500 mt-0.5 leading-tight text-center">
                  {slot.time}
                </span>
              </div>
              {/* Classes */}
              <div className="flex-1 min-w-0">
                {slot.classes.length > 0 ? (
                  <ul className="space-y-0.5">
                    {slot.classes.map((cls, ci) => (
                      <li key={ci} className="text-[10px] text-gray-700 flex items-start gap-1.5">
                        <span className="text-red-400 shrink-0 mt-[1px]">●</span>
                        <span className="break-words">{cls}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[10px] text-gray-400 italic">Unknown class</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

/**
 * Available Rooms Panel for the timetable sidebar.
 * Shows rooms grouped by faculty with booking status badges.
 * Rooms are draggable and can be dropped onto timetable cells.
 */
const AvailableRoomsPanel = ({
  allRoomsRaw = [],
  roomBookings = {},
  allCoursesRaw = [],
  timeSlots = [],
  isMetadataComplete = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedFaculties, setCollapsedFaculties] = useState({});
  const [allSlotsModal, setAllSlotsModal] = useState({ open: false, roomName: "", slots: [] });
  const dayOrder = useMemo(
    () => ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5 }),
    []
  );
  const timeOrder = useMemo(() => {
    const lookup = {};
    timeSlots.forEach((slot, index) => {
      lookup[slot] = index;
    });
    return lookup;
  }, [timeSlots]);

  // Group rooms by faculty
  const roomsByFaculty = useMemo(() => {
    const groups = {};
    const filtered = allRoomsRaw.filter((room) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (room.ID || "").toLowerCase().includes(q) ||
        (room.name || "").toLowerCase().includes(q) ||
        (room.faculty || "").toLowerCase().includes(q)
      );
    });

    filtered.forEach((room) => {
      const faculty = room.faculty || "Other";
      if (!groups[faculty]) groups[faculty] = [];
      groups[faculty].push(room);
    });

    // Sort faculties and rooms within each faculty
    const sorted = {};
    Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .forEach((faculty) => {
        sorted[faculty] = groups[faculty].sort((a, b) =>
          (a.ID || a.name || "").localeCompare(b.ID || b.name || "")
        );
      });

    return sorted;
  }, [allRoomsRaw, searchQuery]);

  const toggleFaculty = (faculty) => {
    setCollapsedFaculties((prev) => ({
      ...prev,
      [faculty]: !prev[faculty],
    }));
  };

  /**
   * Build sorted slot list for a room (reused for both inline display and modal)
   */
  const buildSlotList = (bookings) => {
    const slotMap = {};
    bookings.forEach((b) => {
      const slotKey = `${b.day}__${b.time}`;
      if (!slotMap[slotKey]) slotMap[slotKey] = { day: b.day, time: b.time, classes: [] };
      
      // Find the course code if we have allCoursesRaw
      let courseStr = "";
      if (b.courseId && allCoursesRaw.length > 0) {
        const course = allCoursesRaw.find(c => String(c.unid) === String(b.courseId) || String(c.ID) === String(b.courseId));
        if (course) {
          courseStr = course.code || course.ID || course.name;
        }
      }
      
      const parts = [b.class, b.branch, b.semester ? `Sem ${b.semester}` : ""];
      if (courseStr) parts.push(`(${courseStr})`);
      
      const classLabel = parts.filter(Boolean).join(" · ");
      if (classLabel && !slotMap[slotKey].classes.includes(classLabel)) {
        slotMap[slotKey].classes.push(classLabel);
      }
    });
    return Object.values(slotMap).sort((a, b) => {
      const dayDiff = (dayOrder[a.day] ?? 99) - (dayOrder[b.day] ?? 99);
      if (dayDiff !== 0) return dayDiff;
      return (timeOrder[a.time] ?? 999) - (timeOrder[b.time] ?? 999);
    });
  };

  const faculties = Object.keys(roomsByFaculty);
  const totalRooms = allRoomsRaw.length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col max-h-[500px]">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Building2 size={16} className="text-emerald-600" />
        Available Rooms
        <span className="text-[10px] text-gray-400 font-normal ml-auto">
          {totalRooms} rooms
        </span>
      </h3>

      {!isMetadataComplete ? (
        <div className="text-xs text-gray-500 italic p-4 text-center border border-dashed rounded bg-gray-50">
          Select a Class, Branch, and Semester to see rooms.
        </div>
      ) : (
        <>
          {/* Search Bar */}
          <div className="relative mb-3">
            <Search
              size={12}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-[10px] border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400"
            />
          </div>

          <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider font-semibold">
            Drag to timetable
          </p>

          {/* Rooms by Faculty */}
          <div className="overflow-y-auto pr-1 space-y-1 flex-1 pb-2 custom-scrollbar">
            {faculties.length === 0 ? (
              <div className="text-xs text-gray-400 p-3 text-center">
                No rooms found.
              </div>
            ) : (
              faculties.map((faculty) => {
                const rooms = roomsByFaculty[faculty];
                const isCollapsed = collapsedFaculties[faculty];

                return (
                  <div key={faculty} className="border border-gray-100 rounded-lg overflow-hidden">
                    {/* Faculty Header */}
                    <button
                      onClick={() => toggleFaculty(faculty)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 transition-colors text-left"
                    >
                      {isCollapsed ? (
                        <ChevronRight size={12} className="text-emerald-600 shrink-0" />
                      ) : (
                        <ChevronDown size={12} className="text-emerald-600 shrink-0" />
                      )}
                      <span className="text-[11px] font-semibold text-emerald-900 flex-1 truncate">
                        {faculty}
                      </span>
                      <span className="text-[9px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                        {rooms.length}
                      </span>
                    </button>

                    {/* Room Cards */}
                    {!isCollapsed && (
                      <div className="p-1.5 space-y-1.5 bg-gray-50/50">
                        {rooms.map((room) => {
                          const roomDisplay = room.ID && room.faculty
                            ? `${room.ID} ${room.faculty}`
                            : room.ID || room.name || "";
                          const bookings = getRoomBookings(
                            roomBookings,
                            String(room.unid)
                          );

                          // Build slot list once for reuse
                          const slots = bookings.length > 0 ? buildSlotList(bookings) : [];
                          const MAX_VISIBLE = 8;

                          return (
                            <div
                              key={room.unid}
                              draggable="true"
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "copy";
                                e.dataTransfer.setData(
                                  "application/json",
                                  JSON.stringify({
                                    type: "ROOM_BUBBLE",
                                    room,
                                    roomDisplay,
                                  })
                                );
                                e.currentTarget.style.opacity = "0.7";
                                e.currentTarget.style.transform = "scale(0.98)";
                              }}
                              onDragEnd={(e) => {
                                e.currentTarget.style.opacity = "1";
                                e.currentTarget.style.transform = "scale(1)";
                              }}
                              className="group p-2.5 rounded-lg bg-white border border-emerald-200 hover:border-emerald-400 hover:shadow-md cursor-grab active:cursor-grabbing transition-all hover:-translate-y-0.5"
                            >
                              {/* Room Info Row */}
                              <div className="flex items-center gap-2 mb-1">
                                <MapPin size={10} className="text-emerald-500 shrink-0" />
                                <span className="font-bold text-emerald-900 text-[11px] truncate flex-1">
                                  {room.ID || room.name}
                                </span>
                                {room.capacity > 0 && (
                                  <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                                    {room.capacity} seats
                                  </span>
                                )}
                              </div>

                              {/* Booked Slots */}
                              {slots.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {slots.slice(0, MAX_VISIBLE).map((slot, idx) => (
                                    <BookedSlotBadge key={idx} slot={slot} />
                                  ))}
                                  {slots.length > MAX_VISIBLE && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setAllSlotsModal({
                                          open: true,
                                          roomName: room.ID || room.name || "Room",
                                          slots,
                                        });
                                      }}
                                      className="inline-flex items-center text-[7px] text-red-600 font-semibold px-1.5 py-0.5 rounded bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 cursor-pointer transition-colors"
                                      title="View all occupied slots"
                                    >
                                      +{slots.length - MAX_VISIBLE} more
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Available indicator */}
                              {bookings.length === 0 && (
                                <div className="text-[8px] text-emerald-500 font-medium mt-0.5">
                                  ✓ All slots available
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* All Slots Modal */}
      <AllSlotsModal
        isOpen={allSlotsModal.open}
        onClose={() => setAllSlotsModal({ open: false, roomName: "", slots: [] })}
        roomName={allSlotsModal.roomName}
        slots={allSlotsModal.slots}
      />
    </div>
  );
};

export default AvailableRoomsPanel;
