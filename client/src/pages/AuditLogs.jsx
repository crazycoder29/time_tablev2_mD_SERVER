import React, { useState, useEffect, useMemo } from 'react';
import { getRecentLogs } from '../firebase/services/auditLogs';
import { facultiesService } from '../firebase/services';
import { useAuthStore } from '../store/authStore';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { 
  Activity, Filter, Search, Shield, Building2, User, Clock, 
  Calendar, Loader2, CheckCircle2, AlertTriangle, Key, Layers,
  FileText, Database, Sparkles, RefreshCw, Trash2
} from 'lucide-react';

const ACTION_CATEGORY_COLORS = {
  AUTH: "bg-blue-100 text-blue-800 border-blue-200",
  USER: "bg-emerald-100 text-emerald-800 border-emerald-200",
  FACULTY: "bg-purple-100 text-purple-800 border-purple-200",
  TIMETABLE: "bg-indigo-100 text-indigo-800 border-indigo-200",
  SCHEDULE: "bg-cyan-100 text-cyan-800 border-cyan-200",
  ROOM: "bg-amber-100 text-amber-800 border-amber-200",
  TEACHER: "bg-rose-100 text-rose-800 border-rose-200",
  COURSE: "bg-teal-100 text-teal-800 border-teal-200",
  SETTINGS: "bg-slate-100 text-slate-800 border-slate-200",
};

const getActionBadgeClass = (action = "") => {
  const upper = action.toUpperCase();
  for (const [key, cls] of Object.entries(ACTION_CATEGORY_COLORS)) {
    if (upper.includes(key)) return cls;
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
};

const AuditLogs = () => {
  const { user, role, activeFaculty } = useAuthStore();
  const isSuperAdmin = role === 'admin';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [facultiesList, setFacultiesList] = useState([]);
  
  // Filters
  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isSuperAdmin) {
      facultiesService.getFaculties().then(res => {
        if (Array.isArray(res)) setFacultiesList(res);
      }).catch(() => {});
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchLogs();
  }, [selectedFaculty, filterAction]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const options = {
        days: 30,
        faculty: isSuperAdmin ? selectedFaculty : (user?.faculty || activeFaculty),
        action: filterAction,
      };
      const fetchedLogs = await getRecentLogs(options);
      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Error loading audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const uniqueActions = useMemo(() => {
    return [...new Set(logs.map(log => log.action).filter(Boolean))].sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;
      const matchesSearch = 
        (log.user && log.user.toLowerCase().includes(q)) || 
        (log.details && log.details.toLowerCase().includes(q)) ||
        (log.action && log.action.toLowerCase().includes(q)) ||
        (log.faculty_name && log.faculty_name.toLowerCase().includes(q)) ||
        (log.faculty && log.faculty.toLowerCase().includes(q));
      return matchesSearch;
    });
  }, [logs, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Top Header Banner */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl shadow-md">
              <Activity className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  System Audit Logs
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-full flex items-center gap-1">
                  <Shield size={12} /> {isSuperAdmin ? "Super Admin Full Access" : "Faculty Scoped"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                {isSuperAdmin 
                  ? "Track administrative events, timetable modifications, and account changes across all faculties"
                  : `Audit trail for ${user?.faculty ? user.faculty.replace(/_/g, ' ').toUpperCase() : 'your assigned faculty'}`
                }
              </p>
            </div>
          </div>

          {/* 30-Day Auto-Delete Policy Notice Badge */}
          <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-xs shrink-0">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1">
                <span>30-Day Rolling Retention</span>
              </div>
              <div className="text-[11px] text-amber-700 font-medium">Logs older than 30 days are automatically deleted</div>
            </div>
          </div>
        </div>

        {/* Sub-Admin Scoped Notice Banner */}
        {!isSuperAdmin && user?.faculty && (
          <div className="mb-6 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
            <Building2 className="w-6 h-6 text-indigo-600 shrink-0" />
            <div>
              <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                Faculty-Scoped Audit Trail: {user.faculty.replace(/_/g, ' ').toUpperCase()}
              </h3>
              <p className="text-xs text-indigo-700 mt-0.5 font-medium">
                You have permission to review activity, edits, and schedule modifications for your faculty database.
              </p>
            </div>
          </div>
        )}

        {/* ── Filter & Search Toolbar ──────────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden mb-8">
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-3.5 justify-between items-stretch md:items-center">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user email, action, details..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Super Admin Faculty Filter */}
              {isSuperAdmin && (
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <select
                    value={selectedFaculty}
                    onChange={(e) => setSelectedFaculty(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Faculties</option>
                    {facultiesList.map(f => (
                      <option key={f.slug} value={f.slug}>{f.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
                <Filter className="h-4 w-4 text-slate-500" />
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Action Types</option>
                  {uniqueActions.map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={fetchLogs}
                className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-xl shadow-xs transition-colors"
                title="Refresh Audit Logs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table View */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col justify-center items-center py-20 text-slate-500">
                <Loader2 className="h-9 w-9 text-indigo-600 animate-spin mb-2" />
                <p className="text-xs font-bold text-slate-700">Loading audit trail...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <Activity className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-base font-bold text-slate-700">No logs found matching your criteria</p>
                <p className="text-xs text-slate-400 mt-0.5">Logs are automatically retained for 30 days.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Timestamp</th>
                    <th className="px-6 py-3.5">User / Initiator</th>
                    {isSuperAdmin && <th className="px-6 py-3.5">Faculty</th>}
                    <th className="px-6 py-3.5">Action Type</th>
                    <th className="px-6 py-3.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Timestamp */}
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {log.timestamp instanceof Date ? log.timestamp.toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }) : String(log.timestamp)}
                      </td>

                      {/* User */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                            <User size={13} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{log.user}</div>
                            {log.user_role && (
                              <div className="text-[10px] text-slate-400 uppercase font-mono">{log.user_role}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Faculty (Super Admin Only) */}
                      {isSuperAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                            <Building2 size={11} className="text-slate-500" />
                            <span>{log.faculty_name || (log.faculty ? log.faculty.replace(/_/g, ' ').toUpperCase() : 'Engineering')}</span>
                          </span>
                        </td>
                      )}

                      {/* Action Type */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border tracking-wider shadow-2xs ${getActionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Details */}
                      <td className="px-6 py-4 text-slate-700 max-w-lg leading-snug">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer Summary */}
          {!loading && filteredLogs.length > 0 && (
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold">
              <div>Showing {filteredLogs.length} events (Last 30 Days)</div>
              <div className="text-[11px] text-slate-400">Strict 30-Day TTL Policy Active</div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AuditLogs;
