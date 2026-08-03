import React, { useState, useEffect } from "react";
import { Grid, Save, CheckCircle2, Search } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { courseService, teacherService } from "../firebase/services";

const AssignLoad = () => {
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);

  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");

  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Teacher Header Toolbar Options
  const [compactMode, setCompactMode] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");

  // Track modified course allotments locally: { courseUnid: [teacherUnids] }
  const [allotments, setAllotments] = useState({});
  const [modifiedCourses, setModifiedCourses] = useState(new Set());

  useEffect(() => {
    fetchInitialOptions();
  }, []);

  const fetchInitialOptions = async () => {
    try {
      const allCourses = await courseService.listCourses();
      const facSet = new Set();
      allCourses.forEach((c) => {
        if (c.faculty?.trim()) facSet.add(c.faculty.trim());
      });
      const facList = Array.from(facSet).sort();
      setFaculties(facList);
      if (facList.length > 0) {
        setSelectedFaculty(facList[0]);
        fetchDepartments(facList[0]);
      }
    } catch (error) {
      console.error("Error fetching initial options:", error);
    }
  };

  const fetchDepartments = async (faculty) => {
    try {
      const depts = await courseService.listDepartments(faculty);
      setDepartments(depts);
      if (depts.length > 0) {
        setSelectedDepartment(depts[0]);
        fetchSemesters(faculty, depts[0]);
        fetchMatrixData(faculty, depts[0], "");
      } else {
        setSelectedDepartment("");
        setSemesters([]);
        setTeachers([]);
        setCourses([]);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchSemesters = async (faculty, department) => {
    try {
      const sems = await courseService.listSemesters({ faculty, department });
      setSemesters(sems);
    } catch (error) {
      console.error("Error fetching semesters:", error);
    }
  };

  const fetchMatrixData = async (faculty, department, semester) => {
    if (!faculty || !department) return;
    try {
      setLoading(true);
      const [fetchedCourses, fetchedTeachers] = await Promise.all([
        courseService.listCourses({ faculty, department, semester: semester || undefined }),
        teacherService.listTeachers(),
      ]);

      setTeachers(fetchedTeachers);
      setCourses(fetchedCourses);

      // Build initial allotments map
      const initialMap = {};
      fetchedCourses.forEach((c) => {
        initialMap[c.unid] = Array.isArray(c.teachers) ? [...c.teachers] : [];
      });
      setAllotments(initialMap);
      setModifiedCourses(new Set());
      setLoading(false);
    } catch (error) {
      console.error("Error fetching matrix data:", error);
      setLoading(false);
    }
  };

  const toggleTeacherAllotment = (courseUnid, teacherUnid) => {
    const currentTeachers = allotments[courseUnid] || [];
    const isAssigned = currentTeachers.includes(teacherUnid);
    const updatedTeachers = isAssigned
      ? currentTeachers.filter((t) => String(t) !== String(teacherUnid))
      : [...currentTeachers, teacherUnid];

    setAllotments((prev) => ({
      ...prev,
      [courseUnid]: updatedTeachers,
    }));

    setModifiedCourses((prev) => {
      const next = new Set(prev);
      next.add(courseUnid);
      return next;
    });
  };

  const handleSaveAllotments = async () => {
    if (modifiedCourses.size === 0) {
      alert("No changes to save!");
      return;
    }

    try {
      setSaving(true);
      const coursesToSave = courses.filter((c) => modifiedCourses.has(c.unid));

      for (const course of coursesToSave) {
        const newTeacherList = allotments[course.unid] || [];
        await courseService.upsertCourse({
          ...course,
          teachers: newTeacherList,
        });
      }

      setSuccessMessage(`Successfully updated allotments for ${coursesToSave.length} course(s)!`);
      setTimeout(() => setSuccessMessage(""), 3500);
      setModifiedCourses(new Set());
      await fetchMatrixData(selectedFaculty, selectedDepartment, selectedSemester);
    } catch (error) {
      console.error("Error saving allotments:", error);
      alert(`Failed to save load allotments: ${error.message || "Forbidden or server error"}`);
    } finally {
      setSaving(false);
    }
  };

  // Filter teachers based on toolbar options (search term)
  const filteredTeachers = teachers.filter((teacher) => {
    if (teacherSearch.trim()) {
      const q = teacherSearch.trim().toLowerCase();
      const codeMatch = (teacher.ID || "").toLowerCase().includes(q);
      const nameMatch = (teacher.name || "").toLowerCase().includes(q);
      if (!codeMatch && !nameMatch) return false;
    }
    return true;
  });

  // Compute load summary for teachers
  const getTeacherLoadCount = (teacherUnid) => {
    let count = 0;
    Object.values(allotments).forEach((teacherList) => {
      if (teacherList.includes(teacherUnid)) count++;
    });
    return count;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Page Title */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Grid className="w-6 h-6 text-gray-700" />
                <h1 className="text-2xl font-semibold text-gray-900">
                  HOD Assign Load Matrix
                </h1>
              </div>
              <p className="text-sm text-gray-600">
                Map teachers to courses and batch sections across your branch
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveAllotments}
                disabled={saving || modifiedCourses.size === 0}
                className="px-4 py-2 text-sm bg-gray-900 text-white font-medium rounded-lg shadow-sm hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : `Save Allotments ${modifiedCourses.size > 0 ? `(${modifiedCourses.size})` : ""}`}
              </button>
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-800 px-4 py-3 text-sm rounded shadow-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              {successMessage}
            </div>
          )}

          {/* Selection Filter Bar */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Faculty Select */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Faculty
                </label>
                <select
                  value={selectedFaculty}
                  onChange={(e) => {
                    setSelectedFaculty(e.target.value);
                    fetchDepartments(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
                >
                  <option value="">Select Faculty</option>
                  {faculties.map((fac, idx) => (
                    <option key={idx} value={fac}>{fac}</option>
                  ))}
                </select>
              </div>

              {/* Department / Branch Select */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Branch / Department
                </label>
                <select
                  value={selectedDepartment}
                  disabled={!selectedFaculty}
                  onChange={(e) => {
                    setSelectedDepartment(e.target.value);
                    fetchSemesters(selectedFaculty, e.target.value);
                    fetchMatrixData(selectedFaculty, e.target.value, selectedSemester);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white disabled:bg-gray-100"
                >
                  <option value="">Select Branch</option>
                  {departments.map((dept, idx) => (
                    <option key={idx} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Semester Filter (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Semester (Optional Filter)
                </label>
                <select
                  value={selectedSemester}
                  disabled={!selectedDepartment}
                  onChange={(e) => {
                    setSelectedSemester(e.target.value);
                    fetchMatrixData(selectedFaculty, selectedDepartment, e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white disabled:bg-gray-100"
                >
                  <option value="">All Semesters</option>
                  {semesters.map((sem, idx) => (
                    <option key={idx} value={sem}>Semester {sem}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Teacher Header Options Toolbar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-6 flex-wrap">
              {/* Option 1: Hide names (Short forms / Code only) */}
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={compactMode}
                  onChange={(e) => setCompactMode(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Hide names (Show teacher codes only)</span>
              </label>
            </div>

            {/* Option 3: Search Bar */}
            <div className="relative min-w-[260px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search teacher by code or name..."
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
              />
            </div>
          </div>

          {/* Load Matrix Container */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 text-sm font-medium">Loading Branch Teacher-Course Matrix...</p>
              </div>
            ) : courses.length === 0 || filteredTeachers.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm">
                No matching courses or teachers found. Try adjusting your filters or search query.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-gray-100 shadow-sm z-20">
                    <tr>
                      {/* Top Left Header Cell */}
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-b border-r border-gray-300 min-w-[260px] bg-gray-100 sticky left-0 z-30">
                        Course / Batch
                      </th>

                      {/* X-Axis: Teacher Column Headers */}
                      {filteredTeachers.map((teacher, idx) => {
                        const tUnid = teacher.unid;
                        const tCode = teacher.ID || `T${idx + 1}`;
                        const tName = teacher.name || "Unknown";
                        const loadCount = getTeacherLoadCount(tUnid);

                        return (
                          <th
                            key={tUnid || idx}
                            className={`px-3 py-3 text-center border-b border-r border-gray-300 bg-gray-100 ${
                              compactMode ? "min-w-[75px]" : "min-w-[130px]"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-bold text-gray-900 font-mono bg-white px-2 py-0.5 rounded border border-gray-200 shadow-2xs">
                                {tCode}
                              </span>
                              {!compactMode && (
                                <span className="text-xs font-medium text-gray-700 truncate max-w-[120px]" title={tName}>
                                  {tName}
                                </span>
                              )}
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                                {loadCount}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 bg-white">
                    {courses.map((course, cIdx) => {
                      const isModified = modifiedCourses.has(course.unid);
                      const courseTeachers = allotments[course.unid] || [];

                      return (
                        <tr
                          key={course.unid || cIdx}
                          className={`${isModified ? "bg-amber-50" : "hover:bg-gray-50"} transition-colors`}
                        >
                          {/* Y-Axis: Course Row Header */}
                          <td className="px-6 py-3.5 border-r border-gray-200 bg-white sticky left-0 z-10 shadow-2xs">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{course.name}</span>
                                {course.batchName && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                    Batch {course.batchName}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500 font-mono">{course.code || "No Code"}</span>
                                <span className="text-xs text-gray-400">• Sem {course.semester}</span>
                              </div>
                            </div>
                          </td>

                          {/* Matrix Checkbox Cells */}
                          {filteredTeachers.map((teacher, tIdx) => {
                            const tUnid = teacher.unid;
                            const isAssigned = courseTeachers.includes(tUnid);

                            return (
                              <td
                                key={tUnid || tIdx}
                                className="px-3 py-3 text-center border-r border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors"
                                onClick={() => toggleTeacherAllotment(course.unid, tUnid)}
                              >
                                <div className="flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={isAssigned}
                                    onChange={() => {}} // Handled by <td> onClick
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AssignLoad;
