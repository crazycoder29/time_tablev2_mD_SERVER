import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Building2, Mail, Lock, LogIn, AlertCircle, Download, FileText, UserCheck, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../firebase/api';
import { DEFAULT_TIME_SLOTS, fetchDynamicTimeSlots } from '../utils/timetableUIHelpers';
import { exportIndividualTeacherOccupancyToPdf } from '../utils/teacherOccupancyExport';
import { timetableService, courseService } from '../firebase/services';
import { getRoomDisplayName } from '../utils/idDisplayHelpers';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // Teacher Quick Download States
  const [teacherCode, setTeacherCode] = useState('');
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherError, setTeacherError] = useState('');
  const [teacherSuccess, setTeacherSuccess] = useState('');

  const { login, loading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      // Error is handled in store
    }
  };

  const handleTeacherDownload = async (e) => {
    e.preventDefault();
    const codeClean = teacherCode.trim();
    if (!codeClean) return;

    setTeacherError('');
    setTeacherSuccess('');
    setTeacherLoading(true);

    try {
      const teacherRes = await apiFetch(`/api/teachers/public-lookup/${encodeURIComponent(codeClean)}`);

      if (!teacherRes) {
        setTeacherError(`Teacher code "${codeClean}" not found.`);
        setTeacherLoading(false);
        return;
      }

      const [schedules, coursesList, dynamicSlots, allTimetablesList] = await Promise.all([
        apiFetch('/api/schedules/public-all'),
        apiFetch('/api/courses/public-all').catch(() => []),
        fetchDynamicTimeSlots(timetableService),
        timetableService.listAllTimetablesMeta().catch(() => []),
      ]);

      // Filter schedules to only include this teacher's schedules first
      const teacherId = String(teacherRes.unid || '');
      const teacherSchedules = (schedules || []).filter((s) => {
        const teacherIds = s.teacherId ? String(s.teacherId).split(',').map(id => id.trim()).filter(Boolean) : [];
        return teacherIds.includes(teacherId);
      });

      const timetablesMap = new Map();
      if (Array.isArray(allTimetablesList)) {
        allTimetablesList.forEach((t) => {
          timetablesMap.set(t.timetableId, t);
        });
      }

      const courseMap = new Map();
      if (Array.isArray(coursesList)) {
        coursesList.forEach((c) => {
          if (c.unid) courseMap.set(String(c.unid), c);
          if (c.ID) courseMap.set(String(c.ID), c);
          if (c.code) courseMap.set(String(c.code), c);
          if (c.parentCourseId) courseMap.set(String(c.parentCourseId), c);
        });
      }

      const enrichedSchedules = await Promise.all(
        teacherSchedules.map(async (s) => {
          const resolved = { ...s };

          // 1. Resolve timetable metadata (class, branch, semester, type)
          const timetableMeta = timetablesMap.get(s.timetableId);
          if (timetableMeta) {
            resolved.class = timetableMeta.class;
            resolved.branch = timetableMeta.branch;
            resolved.semester = timetableMeta.semester;
            resolved.type = timetableMeta.type;
          }

          // 2. Resolve room display name
          if (s.roomId) {
            resolved.room = await getRoomDisplayName(s.roomId);
          }

          // 3. Resolve course information
          const cKey = String(s.courseId || s.course || "").trim();
          let matched = courseMap.get(cKey);
          
          if (!matched && Array.isArray(coursesList)) {
            matched = coursesList.find(c => 
              String(c.unid) === cKey || 
              String(c.ID) === cKey || 
              String(c.code) === cKey || 
              (c.parentCourseId && String(c.parentCourseId) === cKey)
            );
          }

          if (matched) {
            resolved.code = matched.code || matched.ID || "";
            resolved.course = matched.name || matched.ID || "";
            resolved.batch = matched.batchName || s.batch || "";
          } else if (s.course && !/^\d{10,}$/.test(String(s.course).trim())) {
            resolved.code = s.code || s.course;
            resolved.course = s.course;
          }

          return resolved;
        })
      );

      exportIndividualTeacherOccupancyToPdf(
        teacherRes,
        enrichedSchedules,
        dynamicSlots,
        `${teacherRes.ID || teacherRes.name}_Weekly_Schedule`
      );

      setTeacherSuccess(`Schedule for ${teacherRes.name || teacherRes.ID} downloaded!`);
    } catch (err) {
      console.error("Error downloading teacher schedule:", err);
      setTeacherError(`Teacher code "${codeClean}" not found. Please check your code.`);
    } finally {
      setTeacherLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-blue-600 p-3 rounded-full shadow-lg">
            <Building2 className="h-12 w-12 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          Dayalbagh Educational Institute
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Timetable Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md space-y-6">
        {/* Sign In Card */}
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          <div className="mb-6 text-center border-b pb-4">
            <h3 className="text-lg font-semibold text-gray-800">Sign In to Your Account</h3>
            <p className="text-xs text-gray-500 mt-1">Authorized logins: Admin, HOD, Timetable Incharge</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {(error || localError) && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error || localError}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                  placeholder="admin@dei.ac.in"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Teacher Schedule Quick Download Card */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-6 shadow-md rounded-lg border border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-base font-semibold">Teacher Schedule Quick Download</h4>
              <p className="text-xs text-slate-300">Enter your teacher code to download your weekly timetable</p>
            </div>
          </div>

          <form onSubmit={handleTeacherDownload} className="mt-4 space-y-4">
            {teacherError && (
              <div className="bg-red-900/40 border border-red-500/50 p-3 rounded text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{teacherError}</span>
              </div>
            )}

            {teacherSuccess && (
              <div className="bg-green-900/40 border border-green-500/50 p-3 rounded text-xs text-green-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <span>{teacherSuccess}</span>
              </div>
            )}

            <div>
              <label htmlFor="teacherCode" className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1">
                Teacher Code / ID
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserCheck className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="teacherCode"
                  type="text"
                  required
                  value={teacherCode}
                  onChange={(e) => setTeacherCode(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Teacher Code (e.g. T101, AS...)"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={teacherLoading || !teacherCode.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-md shadow transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed"
            >
              {teacherLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating Schedule PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Weekly Schedule (PDF)</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
