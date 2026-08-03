import React, { useState, useEffect } from "react";
import { BookOpen, Search, Users, Save, Filter, ClipboardList, CheckCircle2, XCircle, Download, ChevronDown } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { courseService, teacherService } from "../firebase/services";
import { exportCourseListToPdf, exportCourseListToExcel } from "../utils/courseExport";

const ManageAllCourses = () => {
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedCourseIndex, setSelectedCourseIndex] = useState(null);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [allCourses, allTeachers] = await Promise.all([
        courseService.listCourses(),
        teacherService.listTeachers(),
      ]);
      
      const updatedCourses = allCourses.map((course) => ({
        ...course,
        isModified: false,
      }));
      
      setCourses(updatedCourses);
      setTeachers(allTeachers);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    let result = [...courses];

    // Filter by search query
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (course) =>
          course.ID?.toLowerCase().includes(query) ||
          course.name?.toLowerCase().includes(query) ||
          course.code?.toLowerCase().includes(query) ||
          course.department?.toLowerCase().includes(query) ||
          course.semester?.toString().toLowerCase().includes(query)
      );
    }

    // Filter by unassigned status
    if (showOnlyUnassigned) {
      result = result.filter(
        (course) => !course.teachers || course.teachers.length === 0
      );
    }

    setFilteredCourses(result);
  }, [searchQuery, showOnlyUnassigned, courses]);

  const updateCourseField = (index, field, value) => {
    const updatedCourses = [...courses];
    updatedCourses[index][field] = value;
    updatedCourses[index].isModified = true;
    setCourses(updatedCourses);
  };

  const saveCourse = async (index) => {
    const course = courses[index];
    
    try {
      setSaving(true);
      await courseService.upsertCourse({
        ...course,
      });

      const updatedCourses = [...courses];
      updatedCourses[index].isModified = false;
      setCourses(updatedCourses);
      
      setSuccessMessage("Course assignment saved successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error saving course:", error);
      alert("Failed to save course assignment.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateModified = async () => {
    const modifiedCourses = courses.filter(c => c.isModified);
    if (modifiedCourses.length === 0) return;

    try {
      setSaving(true);
      for (const course of modifiedCourses) {
        await courseService.upsertCourse(course);
      }
      
      const updatedCourses = courses.map(c => ({...c, isModified: false}));
      setCourses(updatedCourses);
      
      setSuccessMessage(`Successfully updated ${modifiedCourses.length} course(s)!`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error updating courses:", error);
      alert("Failed to update courses.");
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = () => {
    exportCourseListToPdf(courses, teachers, "dei-course-list");
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    exportCourseListToExcel(courses, teachers, "dei-course-list");
    setShowExportMenu(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Page Header */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <ClipboardList className="w-6 h-6 text-gray-700" />
                <h1 className="text-2xl font-semibold text-gray-900">
                  Master Course List
                </h1>
              </div>
              <p className="text-sm text-gray-600">Ensure all courses from every branch and semester have assigned teachers</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm">
                 <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">{courses.filter(c => c.teachers && c.teachers.length > 0).length} Assigned</span>
                 </div>
                 <div className="w-px h-4 bg-gray-200"></div>
                 <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium">{courses.filter(c => !c.teachers || c.teachers.length === 0).length} Unassigned</span>
                 </div>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-800 px-4 py-3 text-sm flex justify-between items-center animate-in fade-in slide-in-from-top-2">
              <span>{successMessage}</span>
              <button onClick={() => setSuccessMessage("")} className="text-green-600 hover:text-green-800">×</button>
            </div>
          )}

          {/* Controls */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full max-w-xl relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search courses by code, name, branch, or semester..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all shadow-sm"
              />
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${showOnlyUnassigned ? "bg-red-500" : "bg-gray-200"}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={showOnlyUnassigned}
                    onChange={(e) => setShowOnlyUnassigned(e.target.checked)}
                  />
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showOnlyUnassigned ? "translate-x-5.5" : "translate-x-1"}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">Show Unassigned Only</span>
              </label>
              
              <button
                onClick={handleUpdateModified}
                disabled={saving || courses.filter(c => c.isModified).length === 0}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : `Update All (${courses.filter(c => c.isModified).length})`}
              </button>

              {courses.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2 font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Export
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  
                  {showExportMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowExportMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        <button
                          onClick={handleExportPdf}
                          className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 text-left"
                        >
                          <Download className="w-4 h-4" />
                          Export as PDF
                        </button>
                        <button
                          onClick={handleExportExcel}
                          className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 text-left border-t border-gray-100"
                        >
                          <Download className="w-4 h-4" />
                          Export as Excel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Courses Table */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-500 text-sm">Loading master course list...</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Course Detail</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Branch & Semester</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Teachers</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCourses.map((course, index) => {
                      const actualIndex = courses.findIndex(c => c.unid === course.unid);
                      const isUnassigned = !course.teachers || course.teachers.length === 0;
                      
                      return (
                        <tr 
                          key={course.unid || index} 
                          className={`${course.isModified ? "bg-amber-50" : "hover:bg-gray-50"} transition-colors`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{course.name}</span>
                                {course.batchName && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                    Batch {course.batchName}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs text-gray-500 font-mono">{course.code || "No Code"}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-700">{course.department}</span>
                              <span className="text-xs text-gray-500 mt-0.5">Semester {course.semester}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 relative">
                            <button
                              className={`w-full px-3 py-1.5 text-sm bg-white border ${isUnassigned ? "border-red-200 text-red-600 italic" : "border-gray-300 text-gray-700"} rounded hover:bg-gray-50 transition-colors flex items-center justify-between gap-2`}
                              onClick={() => setSelectedCourseIndex(actualIndex)}
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">
                                  {Array.isArray(course.teachers) && course.teachers.length > 0
                                    ? `${course.teachers.length} Teacher${course.teachers.length > 1 ? 's' : ''}`
                                    : "Allot Teacher"}
                                </span>
                              </div>
                              <Filter className="w-3 h-3 text-gray-400" />
                            </button>

                            {selectedCourseIndex === actualIndex && (
                              <>
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => { setSelectedCourseIndex(null); setTeacherSearchQuery(""); }}
                                />
                                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                                  <div className="p-3">
                                    <div className="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wider px-1">Assign Teacher</div>
                                    <div className="relative mb-3">
                                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                      <input
                                        type="text"
                                        placeholder="Search by name..."
                                        value={teacherSearchQuery}
                                        onChange={(e) => setTeacherSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 transition-all shadow-inner"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                                      {teachers.filter((teacher) => {
                                        if (!teacherSearchQuery.trim()) return true;
                                        const label = typeof teacher === "string" ? teacher : (teacher?.name ?? "");
                                        return label.toLowerCase().includes(teacherSearchQuery.toLowerCase());
                                      }).map((teacher, idx) => {
                                        const teacherKey = typeof teacher === "string" ? teacher : teacher?.unid;
                                        const teacherLabel = typeof teacher === "string" ? teacher : (teacher?.name ?? "Unknown");
                                        const selectedTeachers = Array.isArray(course.teachers) ? course.teachers : [];

                                        return (
                                          <label key={teacherKey || idx} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded-md transition-colors group">
                                            <input
                                              type="checkbox"
                                              checked={teacherKey ? selectedTeachers.includes(teacherKey) : false}
                                              onChange={(e) => {
                                                let updatedTeachers = [...selectedTeachers];
                                                if (!teacherKey) return;

                                                if (e.target.checked) {
                                                  if (!updatedTeachers.includes(teacherKey)) {
                                                    updatedTeachers.push(teacherKey);
                                                  }
                                                } else {
                                                  updatedTeachers = updatedTeachers.filter((t) => t !== teacherKey);
                                                }
                                                updateCourseField(actualIndex, "teachers", updatedTeachers);
                                              }}
                                              className="rounded border-gray-300 text-gray-900 focus:ring-gray-400 transition-all"
                                            />
                                            <span className="text-gray-700 group-hover:text-gray-900">{teacherLabel}</span>
                                          </label>
                                        );
                                      })}
                                      {teachers.length === 0 && <p className="text-xs text-center py-4 text-gray-500">No teachers found.</p>}
                                    </div>
                                    <button
                                      className="mt-3 w-full px-3 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors font-medium shadow-sm"
                                      onClick={() => { setSelectedCourseIndex(null); setTeacherSearchQuery(""); }}
                                    >
                                      Done
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isUnassigned ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Unassigned
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Assigned
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => saveCourse(actualIndex)}
                              disabled={!course.isModified || saving}
                              className={`inline-flex items-center justify-center p-2 rounded-full transition-all ${course.isModified ? "bg-gray-900 text-white shadow-md hover:bg-gray-800" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                              title="Save Changes"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && filteredCourses.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center">
                            <BookOpen className="w-12 h-12 text-gray-200 mb-4" />
                            <p className="text-gray-500 font-medium">No courses match your filters.</p>
                            <button 
                              onClick={() => {setSearchQuery(""); setShowOnlyUnassigned(false);}}
                              className="mt-2 text-sm text-gray-900 underline hover:text-gray-600"
                            >
                              Clear all filters
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ManageAllCourses;
