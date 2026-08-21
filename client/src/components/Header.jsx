import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, LogOut, Building2, Calendar, Sparkles } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { facultiesService } from "../firebase/services";

const Header = () => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path) => currentPath === path;
  const isLoadActive = ['/teacher-load', '/course-load', '/room-load', '/manage-all-courses'].includes(currentPath);
  const isOccupancyActive = ['/teacher-occupancy', '/class-occupancy', '/room-occupancy', '/central-room-occupancy'].includes(currentPath);
  const isAdminActive = ['/admin-settings', '/audit-logs'].includes(currentPath);
  const { logout, user, role, activeFaculty, setActiveFaculty, activeSemester, setActiveSemester } = useAuthStore();

  useEffect(() => {
    if (role === "admin") {
      facultiesService.getFaculties().then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setFaculties(data);
        }
      }).catch(() => {});
    }
  }, [role]);

  const handleFacultyChange = (slug) => {
    setActiveFaculty(slug);
    setActiveDropdown(null);
    window.location.reload();
  };

  const handleSemesterChange = async (newSem) => {
    setActiveSemester(newSem);
    setActiveDropdown(null);
    // If admin or sub-admin, also notify backend to sync semester state
    try {
      await facultiesService.switchFacultySemester(activeFaculty, newSem);
    } catch (e) {
      console.warn("Semester switch sync notice:", e);
    }
    window.location.reload();
  };

  const currentFacultyObj = faculties.find(f => f.slug === activeFaculty) || {
    name: activeFaculty ? activeFaculty.replace(/_/g, " ").toUpperCase() : "Faculty of Engineering",
    slug: activeFaculty || "engineering",
    current_semester: activeSemester || "odd",
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm relative z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <a href="/" className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <span>Planovate</span>
          </a>

          {/* Super Admin Faculty Context Switcher */}
          {role === "admin" && faculties.length > 0 && (
            <div 
              className="relative"
              onMouseEnter={() => setActiveDropdown('faculty-switch')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button 
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                <Building2 size={14} className="text-indigo-600" />
                <span className="max-w-[150px] truncate">{currentFacultyObj.name}</span>
                <ChevronDown size={14} className="text-indigo-600" />
              </button>

              {activeDropdown === 'faculty-switch' && (
                <div className="absolute top-full left-0 pt-1 z-50">
                  <div className="bg-white border border-gray-200 rounded-xl shadow-xl py-2 min-w-[220px] divide-y divide-gray-100">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Switch Faculty Database
                    </div>
                    <div className="py-1">
                      {faculties.map((f) => (
                        <button
                          key={f.slug}
                          onClick={() => handleFacultyChange(f.slug)}
                          className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                            activeFaculty === f.slug 
                              ? "bg-indigo-50 text-indigo-900 font-bold" 
                              : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                        >
                          <span className="truncate">{f.name}</span>
                          {activeFaculty === f.slug && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 ml-2 shrink-0"></span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sub Admin / Staff Faculty Indicator */}
          {role !== "admin" && user?.faculty && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200">
              <Building2 size={13} className="text-gray-500" />
              <span className="capitalize">{user.faculty.replace(/_/g, " ")}</span>
            </div>
          )}

          {/* Academic Semester Switcher Pill (Odd / Even) */}
          {(role === "admin" || role === "sub_admin") && (
            <div
              className="relative"
              onMouseEnter={() => setActiveDropdown('semester-switch')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                type="button"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-xs border transition-all ${
                  activeSemester === "even"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                    : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                }`}
              >
                <Calendar size={13} />
                <span>{activeSemester === "even" ? "Even Sem" : "Odd Sem"}</span>
                <ChevronDown size={13} />
              </button>

              {activeDropdown === 'semester-switch' && (
                <div className="absolute top-full left-0 pt-1 z-50">
                  <div className="bg-white border border-gray-200 rounded-xl shadow-xl py-2 min-w-[170px]">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Academic Semester DB
                    </div>
                    <button
                      onClick={() => handleSemesterChange("odd")}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between ${
                        activeSemester !== "even"
                          ? "bg-amber-50 text-amber-900 font-bold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>Odd Semester</span>
                      {activeSemester !== "even" && <span className="w-2 h-2 rounded-full bg-amber-600"></span>}
                    </button>
                    <button
                      onClick={() => handleSemesterChange("even")}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between ${
                        activeSemester === "even"
                          ? "bg-emerald-50 text-emerald-900 font-bold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>Even Semester</span>
                      {activeSemester === "even" && <span className="w-2 h-2 rounded-full bg-emerald-600"></span>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <nav>
          <ul className="flex gap-1 items-center">
            <li><a href="/" className={`inline-block px-3 py-2 text-sm rounded transition-colors ${isActive('/') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}>Home</a></li>
            
            {/* Load Dropdown */}
            <li 
              className="relative"
              onMouseEnter={() => setActiveDropdown('load')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button className={`inline-block px-3 py-2 text-sm rounded transition-colors align-middle ${isLoadActive ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}>
                Manage <ChevronDown size={16} className="inline transition-transform align-middle" style={{ transform: activeDropdown === 'load' ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>
              {activeDropdown === 'load' && (
                <div className="absolute top-full left-0 pt-1 z-50">
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[160px]">
                    <a href="/teacher-load" className={`block px-4 py-2 text-sm transition-colors ${isActive('/teacher-load') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}>Staff</a>
                    <a href="/course-load" className={`block px-4 py-2 text-sm transition-colors ${isActive('/course-load') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}>Courses</a>
                    <a href="/manage-all-courses" className={`block px-4 py-2 text-sm transition-colors ${isActive('/manage-all-courses') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}>Manage All Course</a>
                    {(role === 'admin' || role === 'sub_admin' || role === 'hod') && (
                      <a href="/assign-load" className={`block px-4 py-2 text-sm transition-colors font-semibold text-blue-700 hover:bg-blue-50 ${isActive('/assign-load') ? 'bg-blue-100 text-blue-900 font-bold' : ''}`}>Assign Load (Matrix)</a>
                    )}
                    <a href="/room-load" className={`block px-4 py-2 text-sm transition-colors ${isActive('/room-load') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}>Rooms</a>
                  </div>
                </div>
              )}
            </li>

            {/* Occupancy Dropdown */}
            <li 
              className="relative"
              onMouseEnter={() => setActiveDropdown('occupancy')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button className={`inline-block px-3 py-2 text-sm rounded transition-colors align-middle ${isOccupancyActive ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}>
                Occupancy <ChevronDown size={16} className="inline transition-transform align-middle" style={{ transform: activeDropdown === 'occupancy' ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>
              {activeDropdown === 'occupancy' && (
                <div className="absolute top-full left-0 pt-1 z-50">
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[200px]">
                    <a href="/teacher-occupancy" className={`block px-4 py-2 text-sm transition-colors ${isActive('/teacher-occupancy') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}>Teacher Occupancy</a>
                    <a href="/class-occupancy" className={`block px-4 py-2 text-sm transition-colors ${isActive('/class-occupancy') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}>Class Occupancy</a>
                    <a href="/room-occupancy" className={`block px-4 py-2 text-sm transition-colors ${isActive('/room-occupancy') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}>Faculty Room Occupancy</a>
                    {role === 'admin' && (
                      <a 
                        href="/central-room-occupancy" 
                        className={`block px-4 py-2.5 text-sm transition-colors border-t border-gray-100 font-bold flex items-center justify-between ${
                          isActive('/central-room-occupancy') 
                            ? 'bg-indigo-100 text-indigo-900' 
                            : 'text-indigo-700 hover:bg-indigo-50'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles size={14} className="text-indigo-600" />
                          Central Room Occupancy
                        </span>
                        <span className="text-[10px] bg-indigo-200 text-indigo-900 px-1.5 py-0.2 rounded font-extrabold uppercase">
                          Merged
                        </span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </li>

            <li><a href="/curriculum" className={`inline-block px-3 py-2 text-sm rounded transition-colors ${isActive('/curriculum') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}>Curriculum</a></li>
            <li><a href="/timetable" className={`inline-block px-3 py-2 text-sm rounded transition-colors ${isActive('/timetable') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}>Timetable</a></li>
            <li><a href="/manage" className={`inline-block px-3 py-2 text-sm rounded transition-colors ${isActive('/manage') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}>Manage</a></li>
            <li><a href="/bulk-upload" className={`inline-block px-3 py-2 text-sm rounded transition-colors ${isActive('/bulk-upload') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}>Bulk Upload</a></li>
            
            {/* Admin and Sub-Admin links */}
            {(role === "admin" || role === "sub_admin") && (
              <>
                <li><a href="/admin-settings" className={`inline-block px-3 py-2 text-sm rounded transition-colors ${isAdminActive ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}>Settings</a></li>
                <li><a href="/audit-logs" className={`inline-block px-3 py-2 text-sm rounded transition-colors ${isActive('/audit-logs') ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}>Audit Logs</a></li>
              </>
            )}

            {user && (
              <li className="ml-2 flex items-center gap-2 border-l border-gray-200 pl-3">
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-100 text-blue-800 uppercase">
                  {role === "sub_admin" ? "Sub Admin" : (role === "timetable_incharge" ? "TT Incharge" : role)}
                </span>
                <button 
                  onClick={logout}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm rounded transition-colors text-red-600 hover:bg-red-50 font-medium"
                >
                  <LogOut size={16} /> Logout
                </button>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
