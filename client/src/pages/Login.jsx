import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  Building2, Mail, Lock, LogIn, AlertCircle, Download, FileText, 
  UserCheck, CheckCircle2, RefreshCw
} from 'lucide-react';
import { apiFetch } from '../firebase/api';
import { 
  exportIndividualTeacherOccupancyToPdf, 
  exportAllTeachersIndividualOccupancyToPdf 
} from '../utils/teacherOccupancyExport';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // Teacher Quick Download state
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
      // Direct cross-database lookup: scans all faculties and odd/even semesters automatically
      const res = await apiFetch(`/api/teachers/public-schedule/${encodeURIComponent(codeClean)}`);

      if (!res) {
        setTeacherError(`Teacher code "${codeClean}" not found in any faculty database.`);
        setTeacherLoading(false);
        return;
      }

      if (res.mode === "all" && Array.isArray(res.teachers)) {
        // Bulk download for all teachers
        exportAllTeachersIndividualOccupancyToPdf(
          res.teachers.map(item => item.teacher),
          res.teachers.flatMap(item => item.schedules),
          res.teachers[0]?.timeSlots || [],
          `all_teachers_weekly_schedules`
        );
        setTeacherSuccess(`Downloaded schedules for all ${res.teachers.length} teachers across all faculties!`);
      } else {
        // Single teacher schedule
        const { teacher, schedules, timeSlots, faculty_name, institute_name, semester } = res;
        const headerMeta = {
          instituteName: institute_name || "DAYALBAGH EDUCATIONAL INSTITUTE",
          facultyName: `${faculty_name || "FACULTY"} (${(semester || "odd").toUpperCase()} SEMESTER)`,
        };

        exportIndividualTeacherOccupancyToPdf(
          teacher,
          schedules || [],
          timeSlots || [],
          `${teacher.ID || teacher.name}_Weekly_Schedule`,
          headerMeta
        );

        setTeacherSuccess(`Schedule for ${teacher.name || teacher.ID} (${faculty_name}) downloaded successfully!`);
      }
    } catch (err) {
      console.error("Error downloading teacher schedule:", err);
      setTeacherError(err.message || `Teacher code "${codeClean}" was not found in any database. Please verify your acronym/ID.`);
    } finally {
      setTeacherLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-indigo-600 p-3.5 rounded-2xl shadow-lg">
            <Building2 className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-black text-slate-900 tracking-tight">
          Dayalbagh Educational Institute
        </h2>
        <p className="mt-1 text-center text-sm font-medium text-slate-600">
          Timetable Management & Academic Scheduler
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md space-y-6">
        {/* ── Sign In Card ───────────────────────────────────────────────── */}
        <div className="bg-white py-7 px-6 sm:px-8 shadow-sm rounded-3xl border border-slate-200">
          <div className="mb-5 text-center border-b border-slate-100 pb-4">
            <h3 className="text-base font-extrabold text-slate-900">Sign In to Your Account</h3>
            <p className="text-xs text-slate-500 mt-0.5">Authorized logins: Super Admin, Sub Admin, HOD, TT Incharge</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {(error || localError) && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-xs font-semibold text-red-700">{error || localError}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="admin@dei.ac.in"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Direct Teacher Schedule Quick Download Card ─────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 shadow-lg rounded-3xl border border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-md">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-base font-black text-white">Teacher Schedule Quick Download</h4>
              <p className="text-xs text-indigo-200">Enter teacher code/ID (or 'all') to fetch schedule across all faculty databases</p>
            </div>
          </div>

          <form onSubmit={handleTeacherDownload} className="mt-4 space-y-4">
            {teacherError && (
              <div className="bg-red-950/80 border border-red-500/60 p-3 rounded-2xl text-xs text-red-200 flex items-center gap-2.5 shadow-xs">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{teacherError}</span>
              </div>
            )}

            {teacherSuccess && (
              <div className="bg-emerald-950/80 border border-emerald-500/60 p-3 rounded-2xl text-xs text-emerald-200 flex items-center gap-2.5 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{teacherSuccess}</span>
              </div>
            )}

            <div>
              <label htmlFor="teacherCode" className="block text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-1.5">
                Teacher Code / Acronym / ID
              </label>
              <div className="relative rounded-2xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <UserCheck className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="teacherCode"
                  type="text"
                  required
                  value={teacherCode}
                  onChange={(e) => setTeacherCode(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-2xl text-xs font-semibold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="e.g. AS, T101, Sharma, or 'all'"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={teacherLoading || !teacherCode.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-indigo-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {teacherLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Searching databases & generating PDF...</span>
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
