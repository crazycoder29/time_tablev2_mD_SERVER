import React, { useState, useEffect, useMemo } from "react";
import { 
  Building2, Calendar, Clock, Download, Filter, Layers, 
  Loader2, AlertCircle, Search, Sparkles, Check, AlertTriangle, 
  ChevronRight, RefreshCw, Eye, Shield, Users, ArrowRight, SlidersHorizontal,
  BookOpen, UserCheck, MapPin, Hash, CheckCircle2, ChevronDown
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getCentralRoomOccupancy } from "../firebase/services/rooms";
import { useAuthStore } from "../store/authStore";

const DAYS = [
  { key: "Mon", label: "Monday" },
  { key: "Tue", label: "Tuesday" },
  { key: "Wed", label: "Wednesday" },
  { key: "Thu", label: "Thursday" },
  { key: "Fri", label: "Friday" },
  { key: "Sat", label: "Saturday" },
];

const formatMinutesTo12h = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  return `${displayHours}:${displayMinutes} ${period}`;
};

const CentralRoomOccupancy = () => {
  const { user, role } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Per-faculty semester contribution state: { [slug]: "odd" | "even" }
  const [semesterOverrides, setSemesterOverrides] = useState({});

  // Filters & State
  const [selectedDay, setSelectedDay] = useState("Mon");
  const [searchQuery, setSearchQuery] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all"); // "all" | "shared" | "single"
  const [showSemesterConfig, setShowSemesterConfig] = useState(true);

  // Interactive Hover Floating Tooltip State
  const [hoveredSchedule, setHoveredSchedule] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadCentralOccupancy(semesterOverrides);
  }, []);

  const loadCentralOccupancy = async (overrides = semesterOverrides) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getCentralRoomOccupancy(overrides);
      setData(res);

      // Sync local semester overrides state from initial server response
      if (res?.faculties && Object.keys(overrides).length === 0) {
        const initialOverrides = {};
        res.faculties.forEach((f) => {
          initialOverrides[f.slug] = f.current_semester || "odd";
        });
        setSemesterOverrides(initialOverrides);
      }
    } catch (err) {
      console.error("Error loading central occupancy:", err);
      setError(err.message || "Failed to load central room occupancy data.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFacultySemester = (slug) => {
    const current = semesterOverrides[slug] || "odd";
    const nextSem = current === "even" ? "odd" : "even";
    const updated = { ...semesterOverrides, [slug]: nextSem };
    setSemesterOverrides(updated);
    loadCentralOccupancy(updated);
  };

  const handleBlockMouseEnter = (e, schedule, room) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setHoveredSchedule({
      ...schedule,
      roomName: room.name,
      roomCapacity: room.capacity,
      roomFloor: room.floor,
    });
  };

  const handleBlockMouseLeave = () => {
    setHoveredSchedule(null);
  };

  const faculties = data?.faculties || [];
  const rooms = data?.rooms || [];
  const allSchedules = data?.schedules || [];
  
  // Standardized generous time bounds (7:00 AM to 6:00 PM)
  const timeBounds = useMemo(() => {
    const raw = data?.timeBounds || { minMinute: 420, maxMinute: 1080, totalMinutes: 660 };
    const minM = Math.min(raw.minMinute, 420); // at least 7:00 AM
    const maxM = Math.max(raw.maxMinute, 1080); // at least 6:00 PM
    return { minMinute: minM, maxMinute: maxM, totalMinutes: maxM - minM };
  }, [data]);

  // Calculate timeline hour markers (e.g. 7 AM, 8 AM, 9 AM ... 6 PM)
  const hourMarkers = useMemo(() => {
    const markers = [];
    const startHour = Math.floor(timeBounds.minMinute / 60);
    const endHour = Math.ceil(timeBounds.maxMinute / 60);
    for (let h = startHour; h <= endHour; h++) {
      const min = h * 60;
      if (min >= timeBounds.minMinute && min <= timeBounds.maxMinute) {
        const pct = ((min - timeBounds.minMinute) / (timeBounds.totalMinutes || 1)) * 100;
        markers.push({
          minute: min,
          label: formatMinutesTo12h(min),
          percent: pct,
        });
      }
    }
    return markers;
  }, [timeBounds]);

  // Filtered rooms for the active view
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesSearch = 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.faculty_names.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesFaculty = facultyFilter === "all" || r.faculties.includes(facultyFilter);
      
      const matchesType = 
        roomTypeFilter === "all" ? true :
        roomTypeFilter === "shared" ? r.is_shared :
        !r.is_shared;

      return matchesSearch && matchesFaculty && matchesType;
    });
  }, [rooms, searchQuery, facultyFilter, roomTypeFilter]);

  // Schedules indexed by room and day
  const schedulesByRoomAndDay = useMemo(() => {
    const map = new Map();
    for (const s of allSchedules) {
      const key = `${s.roomNormalized}:${s.day}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(s);
    }
    return map;
  }, [allSchedules]);

  // Count true collisions on the current selected day
  const dayCollisionCount = useMemo(() => {
    const daySchedules = allSchedules.filter((s) => s.day === selectedDay);
    return daySchedules.filter((s) => s.hasCollision).length;
  }, [allSchedules, selectedDay]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 text-slate-800">
      <Header />

      <main className="flex-1 w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header & Overview Hero Banner */}
        <div className="mb-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3.5 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl shadow-md">
                  <Building2 className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      Central Room Occupancy
                    </h1>
                    <span className="px-3 py-1 text-xs font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-full flex items-center gap-1.5 shadow-xs">
                      <Shield size={13} className="text-indigo-600" /> Super Admin Central Registry
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    Multi-faculty consolidated physical room utilization with continuous dynamic timeline scaling
                  </p>
                </div>
              </div>
            </div>

            {/* Metric Counters */}
            {data && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-center min-w-[110px]">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Rooms</div>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">{data.stats.totalRooms}</div>
                </div>
                <div className="bg-indigo-50/70 border border-indigo-100 px-4 py-3 rounded-2xl text-center min-w-[110px]">
                  <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Shared Rooms</div>
                  <div className="text-2xl font-black text-indigo-700 mt-0.5">{data.stats.sharedRoomsCount}</div>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-100 px-4 py-3 rounded-2xl text-center min-w-[110px]">
                  <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Total Classes</div>
                  <div className="text-2xl font-black text-emerald-700 mt-0.5">{data.stats.totalBookings}</div>
                </div>
                {dayCollisionCount > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 px-4 py-3 rounded-2xl text-center min-w-[120px] animate-pulse">
                    <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Overlap Warning</div>
                    <div className="text-2xl font-black text-amber-800 mt-0.5">{dayCollisionCount}</div>
                  </div>
                ) : (
                  <div className="bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-center min-w-[120px]">
                    <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Conflicts ({selectedDay})</div>
                    <div className="text-2xl font-black text-blue-700 mt-0.5">0</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Per-Faculty Contributing Semester Configuration Card ─────────── */}
        <div className="mb-8 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <SlidersHorizontal size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Contributing Semester Database per Faculty</h3>
                <p className="text-xs text-slate-500 mt-0.5">Toggle which semester database (Odd / Even) each faculty contributes into the central timeline.</p>
              </div>
            </div>
            <button
              onClick={() => setShowSemesterConfig(!showSemesterConfig)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 bg-indigo-50/60 hover:bg-indigo-100 rounded-xl transition-colors"
            >
              {showSemesterConfig ? "Hide Config" : "Show Config"}
            </button>
          </div>

          {showSemesterConfig && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-5">
              {faculties.map((f) => {
                const currentSem = semesterOverrides[f.slug] || f.current_semester || "odd";
                const isEven = currentSem === "even";

                return (
                  <div
                    key={f.slug}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-white transition-all shadow-xs flex flex-col justify-between gap-3"
                    style={{ borderTopColor: f.color, borderTopWidth: "4px" }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                        <span className="w-3 h-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: f.color }} />
                        <span className="truncate">{f.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1.5">
                        <span className="font-semibold text-slate-500">Active DB:</span>
                        <span className="bg-slate-200/70 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                          {isEven ? `${f.slug}_even` : (f.slug === "engineering" ? "deitimetable" : `${f.slug}_odd`)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-xs font-semibold text-slate-500">Contributing:</span>
                      <button
                        onClick={() => handleToggleFacultySemester(f.slug)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1.5 ${
                          isEven
                            ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200"
                            : "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200"
                        }`}
                        title={`Click to toggle ${f.name} to ${isEven ? 'Odd' : 'Even'} semester database`}
                      >
                        <span>{isEven ? "Even Semester" : "Odd Semester"}</span>
                        <RefreshCw size={12} className="opacity-80" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Filters & Day Selection Bar ──────────────────────────────────── */}
        <div className="mb-6 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          {/* Day Selector Pills */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl overflow-x-auto gap-1">
            {DAYS.map((d) => {
              const isSelected = selectedDay === d.key;
              const countForDay = allSchedules.filter((s) => s.day === d.key).length;
              return (
                <button
                  key={d.key}
                  onClick={() => setSelectedDay(d.key)}
                  className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                  }`}
                >
                  <span>{d.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  }`}>
                    {countForDay}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search and Secondary Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rooms, courses, instructors..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <select
              value={facultyFilter}
              onChange={(e) => setFacultyFilter(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Faculties</option>
              {faculties.map((f) => (
                <option key={f.slug} value={f.slug}>{f.name}</option>
              ))}
            </select>

            <select
              value={roomTypeFilter}
              onChange={(e) => setRoomTypeFilter(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Room Types</option>
              <option value="shared">Shared Rooms Only</option>
              <option value="single">Single Faculty Only</option>
            </select>

            <button
              onClick={() => loadCentralOccupancy(semesterOverrides)}
              className="p-2.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 bg-slate-50 rounded-2xl transition-colors border border-slate-200 shrink-0"
              title="Refresh Central Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-28 bg-white rounded-3xl border border-slate-200 shadow-sm text-slate-500">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
            <p className="text-lg font-black text-slate-800">Aggregating Cross-Faculty Rooms & Class Schedules...</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">Resolving rooms, courses, teachers, and timetable periods across isolated databases</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-3xl text-red-800 flex items-center justify-between shadow-sm mb-6">
            <div className="flex items-center gap-3.5">
              <AlertCircle className="w-7 h-7 text-red-600 shrink-0" />
              <div>
                <h4 className="font-extrabold text-base">Failed to Load Central Occupancy</h4>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => loadCentralOccupancy(semesterOverrides)}
              className="px-5 py-2.5 bg-red-600 text-white font-bold text-xs rounded-2xl hover:bg-red-700 transition-colors shadow-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Central Timeline Visualization Canvas */}
        {!loading && !error && data && (
          <div className="space-y-6">
            {filteredRooms.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-3xl border border-slate-200 text-slate-500 shadow-sm">
                <Building2 className="w-14 h-14 text-slate-300 mx-auto mb-3" />
                <p className="text-lg font-bold text-slate-800">No rooms match your filter criteria</p>
                <p className="text-xs text-slate-500 mt-1">Try clearing your search query or switching to another day.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                {/* Timeline Header (Dynamic Continuous Ruler) */}
                <div className="sticky top-0 z-20 bg-slate-900 text-white px-6 py-4 border-b border-slate-800 flex items-center shadow-lg">
                  <div className="w-72 shrink-0 font-black text-xs uppercase tracking-wider text-slate-300 flex items-center gap-2.5">
                    <Building2 size={16} className="text-indigo-400" />
                    <span>Room Details & Sharing</span>
                  </div>
                  
                  {/* Dynamic Time Scale Grid Header */}
                  <div className="flex-1 relative h-7">
                    {hourMarkers.map((marker, idx) => (
                      <div
                        key={idx}
                        className="absolute text-xs font-mono font-bold text-slate-200 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${marker.percent}%` }}
                      >
                        <span>{marker.label}</span>
                        <div className="w-1 h-1 rounded-full bg-slate-500 mt-1" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rooms List with Spacious, High-Clarity Timelines */}
                <div className="divide-y divide-slate-100">
                  {filteredRooms.map((room) => {
                    const roomKey = `${room.normalized_name}:${selectedDay}`;
                    const schedules = schedulesByRoomAndDay.get(roomKey) || [];
                    const isShared = room.is_shared;

                    return (
                      <div
                        key={room.normalized_name}
                        className={`flex items-stretch px-6 py-4.5 transition-colors ${
                          isShared ? "bg-indigo-50/20 hover:bg-indigo-50/40" : "hover:bg-slate-50/80"
                        }`}
                      >
                        {/* Room Info Left Column */}
                        <div className="w-72 shrink-0 pr-6 flex flex-col justify-center">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-base text-slate-900 tracking-tight">
                              {room.name}
                            </span>
                            {isShared && (
                              <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-2xs">
                                Shared ({room.faculties.length})
                              </span>
                            )}
                          </div>
                          
                          <div className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-2.5">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono text-[11px]">
                              Cap: {room.capacity}
                            </span>
                            {room.floor && (
                              <span className="text-slate-500 text-[11px]">Floor {room.floor}</span>
                            )}
                          </div>

                          {/* Associated Faculty Badges */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {room.faculty_names.map((facName, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs"
                              >
                                {facName}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Spacious Continuous Timeline Canvas */}
                        <div className="flex-1 relative min-h-[90px] bg-slate-50/90 rounded-2xl border border-slate-200/80 overflow-hidden shadow-inner p-1.5">
                          {/* Hour Vertical Grid Lines */}
                          {hourMarkers.map((marker, idx) => (
                            <div
                              key={idx}
                              className="absolute top-0 bottom-0 border-l border-slate-200/80 pointer-events-none"
                              style={{ left: `${marker.percent}%` }}
                            />
                          ))}

                          {/* Render Schedule Blocks */}
                          {schedules.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 font-semibold italic pointer-events-none">
                              No classes scheduled in {room.name} on {DAYS.find((d) => d.key === selectedDay)?.label}
                            </div>
                          ) : (
                            schedules.map((s) => {
                              const leftPct = Math.max(
                                0,
                                ((s.startMinute - timeBounds.minMinute) / (timeBounds.totalMinutes || 1)) * 100
                              );
                              const widthPct = Math.min(
                                100 - leftPct,
                                (s.durationMinutes / (timeBounds.totalMinutes || 1)) * 100
                              );

                              return (
                                <div
                                  key={s.id || `${s.startMinute}-${s.endMinute}`}
                                  onMouseEnter={(e) => handleBlockMouseEnter(e, s, room)}
                                  onMouseLeave={handleBlockMouseLeave}
                                  className={`absolute top-2 bottom-2 rounded-xl px-3 py-1.5 text-white shadow-md flex flex-col justify-center overflow-hidden transition-all hover:z-30 hover:scale-[1.02] cursor-pointer select-none ${
                                    s.hasCollision ? "ring-2 ring-amber-400 shadow-amber-200" : ""
                                  }`}
                                  style={{
                                    left: `${leftPct}%`,
                                    width: `${Math.max(widthPct, 3.5)}%`,
                                    backgroundColor: s.facultyColor,
                                    borderLeft: `5px solid ${s.facultyBorderColor}`,
                                  }}
                                >
                                  {/* Subject Code / Title */}
                                  <div className="flex items-center justify-between gap-1 leading-tight">
                                    <span className="font-black text-xs truncate tracking-tight">
                                      {s.courseCode || s.courseName || "Class"}
                                    </span>
                                    {s.hasCollision && (
                                      <AlertTriangle size={13} className="text-amber-300 shrink-0" />
                                    )}
                                  </div>

                                  {/* Instructor & Class Section */}
                                  <div className="text-[11px] text-white/95 truncate font-medium flex items-center gap-1.5 mt-0.5">
                                    <span className="opacity-80 font-bold">{s.facultyCode}:</span>
                                    <span className="truncate">{s.teacherName || s.class || "Lecture"}</span>
                                  </div>

                                  {/* Time Duration Badge */}
                                  <div className="text-[10px] text-white/80 font-mono mt-0.5 truncate">
                                    {formatMinutesTo12h(s.startMinute)} - {formatMinutesTo12h(s.endMinute)}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Global Interactive Floating Tooltip (Never Clipped, Crystal Clear) ─ */}
      {hoveredSchedule && (
        <div
          className="fixed z-[9999] pointer-events-none p-5 bg-slate-900/95 text-white rounded-3xl shadow-2xl text-xs space-y-3 w-88 border border-slate-700/80 backdrop-blur-md transition-all -translate-x-1/2 -translate-y-[108%]"
          style={{
            left: `${Math.min(Math.max(tooltipPos.x, 180), window.innerWidth - 190)}px`,
            top: `${Math.max(tooltipPos.y - 12, 110)}px`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="font-black text-base text-indigo-300 flex items-center gap-2">
                <Building2 size={17} />
                <span>{hoveredSchedule.roomName}</span>
              </div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">
                Room Capacity: {hoveredSchedule.roomCapacity || "N/A"} {hoveredSchedule.roomFloor && `• Floor ${hoveredSchedule.roomFloor}`}
              </div>
            </div>
            <span
              className="text-[11px] px-3 py-1 rounded-full font-black uppercase shadow-xs tracking-wider"
              style={{ backgroundColor: `${hoveredSchedule.facultyColor}40`, color: '#FFFFFF', border: `1.5px solid ${hoveredSchedule.facultyColor}` }}
            >
              {hoveredSchedule.facultyName} ({hoveredSchedule.facultySemester.toUpperCase()} SEM)
            </span>
          </div>

          {/* Subject / Course Details */}
          <div className="space-y-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <BookOpen size={13} className="text-indigo-400" />
              Course / Subject
            </div>
            <div className="text-white font-black text-sm">
              {hoveredSchedule.courseCode} {hoveredSchedule.courseName && `— ${hoveredSchedule.courseName}`}
            </div>
          </div>

          {/* Teacher / Instructor Details */}
          <div className="space-y-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <UserCheck size={13} className="text-emerald-400" />
              Teacher / Instructor
            </div>
            <div className="text-slate-100 font-bold text-xs">
              {hoveredSchedule.teacherName || "Not assigned"}
            </div>
          </div>

          {/* Class / Branch / Batch Details */}
          {(hoveredSchedule.class || hoveredSchedule.branch) && (
            <div className="text-slate-300 text-xs flex items-center gap-1.5 bg-slate-800/60 p-2 rounded-xl">
              <span className="text-slate-400 font-medium">Class:</span>
              <strong className="text-white font-bold">{hoveredSchedule.class} {hoveredSchedule.branch}</strong>
              {hoveredSchedule.batch && <span className="text-slate-400 font-mono">({hoveredSchedule.batch})</span>}
            </div>
          )}

          {/* Time Coordinates */}
          <div className="pt-2.5 border-t border-slate-800 text-amber-300 font-mono text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <Clock size={14} />
              <span>{hoveredSchedule.timeSlot}</span>
            </div>
            <span className="text-slate-400 text-xs">
              {hoveredSchedule.durationMinutes} mins
            </span>
          </div>

          {/* Caution / Conflict Breakdown */}
          {hoveredSchedule.hasCollision && (
            <div className="p-3.5 bg-red-950/95 border border-red-500 rounded-2xl text-red-200 text-xs space-y-1.5 shadow-lg">
              <div className="font-black flex items-center gap-1.5 text-amber-300">
                <AlertTriangle size={15} className="text-amber-300 shrink-0" />
                <span>⚠️ ROOM BOOKING OVERLAP DETECTED</span>
              </div>
              <p className="text-xs text-red-100 leading-snug">
                This room is simultaneously booked by <strong>{hoveredSchedule.collisionWith}</strong> for <strong>{hoveredSchedule.collisionCourse}</strong> during {hoveredSchedule.collisionTime || hoveredSchedule.timeSlot} on {selectedDay}.
              </p>
            </div>
          )}
        </div>
      )}

      <Footer />
    </div>
  );
};

export default CentralRoomOccupancy;
