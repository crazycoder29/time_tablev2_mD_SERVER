import React, { useState, useEffect, useRef } from "react";
import { BookOpen, Plus, Trash2, Save, Search, Users, X } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { courseService, teacherService } from "../firebase/services";

const CourseLoad = () => {
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);

  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");

  const [newFaculty, setNewFaculty] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newSemester, setNewSemester] = useState("");

  const [isAddingFaculty, setIsAddingFaculty] = useState(false);
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);
  const [isAddingSemester, setIsAddingSemester] = useState(false);

  const [selectedCourseIndex, setSelectedCourseIndex] = useState(null);
  const [batchModalCourseIndex, setBatchModalCourseIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [teacherSearchQuery, setTeacherSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({
    ID: "",
    name: "",
    code: "",
    credits: "",
    teachers: [],
    hasBatches: false,
    batches: ["B1", "B2"]
  });

  const courseIdRef = useRef(null);
  const courseNameRef = useRef(null);
  const courseCodeRef = useRef(null);
  const courseCreditsRef = useRef(null);

  const handleCourseModalKeyDown = (e, currentField) => {
    const fields = [courseIdRef, courseNameRef, courseCodeRef, courseCreditsRef];
    const currentIndex = fields.findIndex(ref => ref.current === e.target);
    
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % fields.length;
      fields[nextIndex].current?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex === 0 ? fields.length - 1 : currentIndex - 1;
      fields[prevIndex].current?.focus();
    }
  };

  // Excel-style keyboard navigation for the courses table
  const handleTableKeyDown = (e, rowIndex, colIndex, totalCols) => {
    const tableEl = e.currentTarget.closest('table');
    if (!tableEl) return;
    const getInput = (r, c) =>
      tableEl.querySelector(`input[data-row="${r}"][data-col="${c}"]`);
    let nextInput = null;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey) {
        nextInput = colIndex < totalCols - 1 ? getInput(rowIndex, colIndex + 1) : getInput(rowIndex + 1, 0);
      } else {
        nextInput = colIndex > 0 ? getInput(rowIndex, colIndex - 1) : getInput(rowIndex - 1, totalCols - 1);
      }
    } else if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextInput = getInput(rowIndex + 1, colIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextInput = getInput(rowIndex - 1, colIndex);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextInput = colIndex < totalCols - 1 ? getInput(rowIndex, colIndex + 1) : getInput(rowIndex + 1, 0);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextInput = colIndex > 0 ? getInput(rowIndex, colIndex - 1) : getInput(rowIndex - 1, totalCols - 1);
    } else {
      return;
    }
    nextInput?.focus();
  };

  // ─── Duplicate / Conflict Validation ────────────────────────────────────────
  const validateNewCourse = async (candidate) => {
    const n = (s) => String(s ?? '').trim().toLowerCase();
    const cId   = n(candidate.ID);
    const cName = n(candidate.name);
    const cCode = n(candidate.code);
    const errors = [];
    const warnings = [];

    const ctx = `${selectedFaculty} › ${selectedDepartment} › Sem ${selectedSemester}`;

    // 1. Exact duplicate within same faculty + dept + semester
    const exactMatch = courses.find(
      (c) => n(c.ID) === cId && n(c.name) === cName && (cCode === '' || n(c.code) === cCode)
    );
    if (exactMatch) {
      errors.push(
        `Course "${candidate.name}" (ID: "${candidate.ID}"${candidate.code ? `, Code: "${candidate.code}"` : ''}) already exists in ${ctx}.\nExact duplicates are not allowed.`
      );
    }

    if (errors.length === 0) {
      // 2. Same ID, different name — within same context
      const idConflict = courses.find((c) => n(c.ID) === cId && n(c.name) !== cName);
      if (idConflict) {
        warnings.push(
          `⚠ Course ID "${candidate.ID}" is already used by "${idConflict.name}"${idConflict.code ? ` (Code: "${idConflict.code}")` : ''} in ${ctx}.\n` +
          `Are you referring to the same course? If not, please use a different ID.`
        );
      }

      // 3. Same code, different name/ID — within same context
      if (cCode) {
        const codeConflict = courses.find(
          (c) => n(c.code) === cCode && (n(c.ID) !== cId || n(c.name) !== cName)
        );
        if (codeConflict) {
          warnings.push(
            `⚠ Course code "${candidate.code}" is already used by "${codeConflict.name}" (ID: "${codeConflict.ID}") in ${ctx}.\n` +
            `Each course code should be unique within a semester. Consider using a different code.`
          );
        }
      }

      // 4. Same name, different ID/code — within same context
      const nameConflict = courses.find(
        (c) => n(c.name) === cName && (n(c.ID) !== cId || n(c.code) !== cCode)
      );
      if (nameConflict) {
        warnings.push(
          `⚠ A course named "${candidate.name}" already exists in ${ctx} with ID "${nameConflict.ID}"${nameConflict.code ? ` and code "${nameConflict.code}"` : ''}.\n` +
          `Is this the same course offered again? If so, reuse the existing ID and code.`
        );
      }

      // 5. Cross-semester: same code in another semester (same dept+faculty)
      if (cCode) {
        try {
          const deptCourses = await courseService.listCourses({ faculty: selectedFaculty, department: selectedDepartment });
          const crossSemByCode = deptCourses.find(
            (c) => n(c.code) === cCode && n(c.semester) !== n(selectedSemester)
          );
          if (crossSemByCode) {
            warnings.push(
              `ℹ Course code "${candidate.code}" already exists in Semester "${crossSemByCode.semester}" as "${crossSemByCode.name}" (ID: "${crossSemByCode.ID}").\n` +
              `This is common for recurring courses — just make sure the code is intentionally reused.`
            );
          }

          // 6. Cross-semester: same course name in another semester
          const crossSemByName = deptCourses.find(
            (c) => n(c.name) === cName && n(c.semester) !== n(selectedSemester)
          );
          if (crossSemByName && !crossSemByCode) {
            warnings.push(
              `ℹ A course named "${candidate.name}" already exists in Semester "${crossSemByName.semester}" with ID "${crossSemByName.ID}"${crossSemByName.code ? ` and code "${crossSemByName.code}"` : ''}.\n` +
              `If this is the same course repeated across semesters, consider using the same ID and code for consistency.`
            );
          }
        } catch (_) { /* cross-semester check is best-effort */ }
      }
    }

    return { errors, warnings };
  };
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchFaculties();
  }, []);

  const fetchFaculties = async () => {
    try {
      const data = await teacherService.listFaculties();
      setFaculties(data);
    } catch (error) {
      console.error("Error fetching faculties:", error);
    }
  };

  const fetchDepartments = async (faculty) => {
    try {
      const [teacherDepts, courseDepts] = await Promise.all([
        teacherService.listDepartments(faculty),
        courseService.listDepartments(faculty),
      ]);
      // Merge and deduplicate departments from both sources
      const merged = Array.from(new Set([...teacherDepts, ...courseDepts]))
        .sort((a, b) => a.localeCompare(b));
      setDepartments(merged);
      setSelectedDepartment("");
      setSemesters([]);
      setSelectedSemester("");
      setCourses([]);
      setFilteredCourses([]);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchSemesters = async (faculty, department) => {
    try {
      const data = await courseService.listSemesters({ faculty, department });
      setSemesters(data);
      setSelectedSemester("");
      setCourses([]);
      setFilteredCourses([]);
    } catch (error) {
      console.error("Error fetching semesters:", error);
    }
  };

  const fetchTeachers = async (faculty) => {
    try {
      // Fetch all teachers from the faculty (not filtered by department)
      // so teachers can be assigned to any course across departments
      const data = await teacherService.listTeachers({ faculty });
      setTeachers(data);
    } catch (error) {
      console.error("Error fetching teachers:", error);
    }
  };

  const fetchCourses = async (faculty, department, semester) => {
    try {
      const data = await courseService.listCourses({ faculty, department, semester });
      fetchTeachers(faculty);
      const updatedCourses = data.map((course) => ({
        ...course,
        isModified: false,
      }));
      setCourses(updatedCourses);
      setFilteredCourses(updatedCourses);
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCourses(courses);
    } else {
      const filtered = courses.filter(
        (course) =>
          course.ID?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.code?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCourses(filtered);
    }
  }, [searchQuery, courses]);

  const saveCourse = async (index) => {
    const course = courses[index];
    
    if (!selectedFaculty || !selectedDepartment || !selectedSemester) {
      alert("Please select Faculty, Department, and Semester first!");
      return;
    }

    if (!course.ID?.trim() || !course.name?.trim()) {
      alert("Please fill in Course ID and Name!");
      return;
    }

    try {
      const unid = await courseService.upsertCourse({
        unid: course.unid,
        ID: course.ID,
        name: course.name,
        code: course.code,
        credits: course.credits,
        teachers: course.teachers || [],
        faculty: selectedFaculty,
        semester: selectedSemester,
        department: selectedDepartment,
        hasBatches: !!course.hasBatches,
        batches: course.hasBatches ? (course.batches || []) : [],
        batchTeachers: course.batchTeachers || {},
      });

      const updatedCourses = [...courses];
      updatedCourses[index].unid = unid;
      updatedCourses[index].isModified = false;
      setCourses(updatedCourses);
      
      setSuccessMessage("Course saved successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error saving course:", error);
      alert("Failed to save course.");
    }
  };

  const handleUpdateAll = async () => {
    if (!selectedFaculty || !selectedDepartment || !selectedSemester) {
      alert("Please select Faculty, Department, and Semester first!");
      return;
    }

    const modifiedCourses = courses.filter(c => c.isModified || !c.unid);
    
    if (modifiedCourses.length === 0) {
      alert("No changes to save!");
      return;
    }

    const invalidCourses = modifiedCourses.filter(c => !c.ID?.trim() || !c.name?.trim());
    if (invalidCourses.length > 0) {
      alert("Please fill in all Course ID and Name fields!");
      return;
    }

    if (!window.confirm(`Save ${modifiedCourses.length} course(s)?`)) {
      return;
    }

    try {
      setSaving(true);
      
      for (const course of modifiedCourses) {
        await courseService.upsertCourse({
          unid: course.unid,
          ID: course.ID,
          name: course.name,
          code: course.code,
          credits: course.credits,
          teachers: course.teachers || [],
          faculty: selectedFaculty,
          semester: selectedSemester,
          department: selectedDepartment,
          hasBatches: !!course.hasBatches,
          batches: course.hasBatches ? (course.batches || []) : [],
          batchTeachers: course.batchTeachers || {},
        });
      }

      setSuccessMessage(`Successfully saved ${modifiedCourses.length} course(s)!`);
      setTimeout(() => setSuccessMessage(""), 3000);
      
      await fetchCourses(selectedFaculty, selectedDepartment, selectedSemester);
    } catch (error) {
      console.error("Error updating courses:", error);
      alert("Failed to save courses. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async (index) => {
    const course = courses[index];
  
    if (!course.unid) {
      const updatedCourses = courses.filter((_, i) => i !== index);
      setCourses(updatedCourses);
      return;
    }

    if (!window.confirm("Delete this course?")) {
      return;
    }
  
    try {
      await courseService.deleteCourse(course.unid);
      const updatedCourses = courses.filter((_, i) => i !== index);
      setCourses(updatedCourses);
      setSuccessMessage("Course deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error deleting course:", error);
      alert("Failed to delete course.");
    }
  };

  const openAddCourseModal = () => {
    setNewCourse({
      ID: "",
      name: "",
      code: "",
      credits: "",
      teachers: [],
      hasBatches: false,
      batches: ["B1", "B2"]
    });
    setIsAddCourseModalOpen(true);
  };

  const closeAddCourseModal = () => {
    setIsAddCourseModalOpen(false);
    setNewCourse({
      ID: "",
      name: "",
      code: "",
      credits: "",
      teachers: [],
      hasBatches: false,
      batches: ["B1", "B2"]
    });
  };

  const saveNewCourse = async (addMore = false) => {
    if (!selectedFaculty || !selectedDepartment || !selectedSemester) {
      alert("Please select Faculty, Department, and Semester first!");
      return;
    }

    if (!newCourse.ID?.trim() || !newCourse.name?.trim()) {
      alert("Please fill in Course ID and Name!");
      return;
    }

    // ── Duplicate / Conflict Check ──────────────────────────────────────────
    const { errors, warnings } = await validateNewCourse(newCourse);
    if (errors.length > 0) {
      alert(`❌ Cannot Save\n\n${errors.join('\n\n')}`);
      return;
    }
    if (warnings.length > 0) {
      const proceed = window.confirm(
        `⚠ Potential Duplicate Warning\n\n${warnings.join('\n\n')}\n\nDo you still want to create this course?`
      );
      if (!proceed) return;
    }
    // ───────────────────────────────────────────────────────────────────────


    try {
      const unid = await courseService.upsertCourse({
        unid: null,
        ID: newCourse.ID,
        name: newCourse.name,
        code: newCourse.code,
        credits: newCourse.credits,
        teachers: newCourse.teachers || [],
        faculty: selectedFaculty,
        semester: selectedSemester,
        department: selectedDepartment,
        hasBatches: !!newCourse.hasBatches,
        batches: newCourse.hasBatches ? (newCourse.batches || []) : [],
      });

      if (newCourse.hasBatches && newCourse.batches?.length > 0) {
        await courseService.splitBatches({ courseUnid: unid, batches: newCourse.batches });
      }

      setSuccessMessage("Course added successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
      
      await fetchCourses(selectedFaculty, selectedDepartment, selectedSemester);

      if (addMore) {
        setNewCourse({
          ID: "",
          name: "",
          code: "",
          credits: "",
          teachers: [],
          hasBatches: false,
          batches: ["B1", "B2"]
        });
      } else {
        closeAddCourseModal();
      }
    } catch (error) {
      console.error("Error adding course:", error);
      alert("Failed to add course.");
    }
  };

  const updateCourseField = (index, field, value) => {
    const updatedCourses = [...courses];
    updatedCourses[index][field] = value;
    updatedCourses[index].isModified = true;
    setCourses(updatedCourses);
  };

  const handleAddFaculty = async () => {
    if (!newFaculty.trim()) {
      alert("Please enter a faculty name!");
      return;
    }
    
    setSelectedFaculty(newFaculty);
    setFaculties([...faculties, newFaculty]);
    setNewFaculty("");
    setIsAddingFaculty(false);
    fetchDepartments(newFaculty);
  };

  const cancelAddFaculty = () => {
    setNewFaculty("");
    setIsAddingFaculty(false);
  };

  const handleAddDepartment = async () => {
    if (!newDepartment.trim()) {
      alert("Please enter a department name!");
      return;
    }
    
    setSelectedDepartment(newDepartment);
    setDepartments([...departments, newDepartment]);
    setNewDepartment("");
    setIsAddingDepartment(false);
    fetchSemesters(selectedFaculty, newDepartment);
  };

  const cancelAddDepartment = () => {
    setNewDepartment("");
    setIsAddingDepartment(false);
  };

  const handleAddSemester = async () => {
    if (!newSemester.trim()) {
      alert("Please enter a semester!");
      return;
    }
    
    setSelectedSemester(newSemester);
    setSemesters([...semesters, newSemester]);
    setNewSemester("");
    setIsAddingSemester(false);
    fetchCourses(selectedFaculty, selectedDepartment, newSemester);
  };

  const cancelAddSemester = () => {
    setNewSemester("");
    setIsAddingSemester(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-6 h-6 text-gray-700" />
              <h1 className="text-2xl font-semibold text-gray-900">
                Courses Management
              </h1>
            </div>
            <p className="text-sm text-gray-600">Manage courses by faculty, department, and semester</p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-800 px-4 py-3 text-sm">
              {successMessage}
            </div>
          )}

          {/* Selection Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Faculty Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide">Faculty</label>
                {!isAddingFaculty ? (
                  <>
                    <select
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                      value={selectedFaculty}
                      onChange={(e) => {
                        setSelectedFaculty(e.target.value);
                        fetchDepartments(e.target.value);
                      }}
                    >
                      <option value="">Select Faculty</option>
                      {faculties.map((faculty, index) => (
                        <option key={index} value={faculty}>{faculty}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setIsAddingFaculty(true)}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Faculty
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                      placeholder="Enter new faculty name"
                      value={newFaculty}
                      onChange={(e) => setNewFaculty(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddFaculty()}
                      autoFocus
                    />
                    <button
                      onClick={handleAddFaculty}
                      className="px-3 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelAddFaculty}
                      className="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Department Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide">Department</label>
                {!isAddingDepartment ? (
                  <>
                    <select
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={selectedDepartment}
                      onChange={(e) => {
                        setSelectedDepartment(e.target.value);
                        fetchSemesters(selectedFaculty, e.target.value);
                      }}
                      disabled={!selectedFaculty}
                    >
                      <option value="">Select Department</option>
                      {departments.map((department, index) => (
                        <option key={index} value={department}>{department}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setIsAddingDepartment(true)}
                      disabled={!selectedFaculty}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Department
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                      placeholder="Enter new department name"
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddDepartment()}
                      autoFocus
                    />
                    <button
                      onClick={handleAddDepartment}
                      className="px-3 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelAddDepartment}
                      className="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Semester Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide">Semester</label>
                {!isAddingSemester ? (
                  <>
                    <select
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={selectedSemester}
                      onChange={(e) => {
                        setSelectedSemester(e.target.value);
                        fetchCourses(selectedFaculty, selectedDepartment, e.target.value);
                      }}
                      disabled={!selectedFaculty || !selectedDepartment}
                    >
                      <option value="">Select Semester</option>
                      {semesters.map((sem, index) => (
                        <option key={index} value={sem}>{sem}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setIsAddingSemester(true)}
                      disabled={!selectedFaculty || !selectedDepartment}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Semester
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                      placeholder="Enter new semester"
                      value={newSemester}
                      onChange={(e) => setNewSemester(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSemester()}
                      autoFocus
                    />
                    <button
                      onClick={handleAddSemester}
                      className="px-3 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelAddSemester}
                      className="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search and Actions */}
          {selectedFaculty && selectedDepartment && selectedSemester && (
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex-1 max-w-md relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search courses by ID, name, or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={openAddCourseModal}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Course
                </button>
                <button
                  onClick={handleUpdateAll}
                  disabled={saving || courses.filter(c => c.isModified || !c.unid).length === 0}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : `Update All ${courses.filter(c => c.isModified || !c.unid).length > 0 ? `(${courses.filter(c => c.isModified || !c.unid).length})` : ""}`}
                </button>
              </div>
            </div>
          )}

          {/* Courses Table */}
          {selectedFaculty && selectedDepartment && selectedSemester && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Course ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Course Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-20">Credits</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Batches</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Teachers</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCourses.map((course, index) => {
                      const actualIndex = courses.findIndex(c => c.unid === course.unid || (c.ID === course.ID && c.name === course.name));
                      return (
                        <tr key={course.unid || index} className={course.isModified ? "bg-amber-50" : ""}>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              data-row={index}
                              data-col={0}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                              value={course.ID || ""}
                              onChange={(e) => updateCourseField(actualIndex, "ID", e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, index, 0, 4)}
                              placeholder="Course ID"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              data-row={index}
                              data-col={1}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                              value={course.name || ""}
                              onChange={(e) => updateCourseField(actualIndex, "name", e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, index, 1, 4)}
                              placeholder="Course Name"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              data-row={index}
                              data-col={2}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                              value={course.code || ""}
                              onChange={(e) => updateCourseField(actualIndex, "code", e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, index, 2, 4)}
                              placeholder="Code"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              data-row={index}
                              data-col={3}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                              value={course.credits || ""}
                              onChange={(e) => updateCourseField(actualIndex, "credits", e.target.value)}
                              onKeyDown={(e) => handleTableKeyDown(e, index, 3, 4)}
                              placeholder="Credits"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setBatchModalCourseIndex(actualIndex)}
                              className={`w-full px-3 py-1.5 text-xs rounded border transition-colors flex items-center justify-center gap-1.5 ${
                                course.hasBatches && course.batches?.length > 0
                                  ? "bg-blue-50 text-blue-800 border-blue-300 font-semibold"
                                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              {course.hasBatches && course.batches?.length > 0
                                ? `${course.batches.length} Batches (${course.batches.join(', ')})`
                                : "Config Batches"}
                            </button>
                          </td>
                          <td className="px-4 py-3 relative">
                            <button
                              className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                              onClick={() => setSelectedCourseIndex(actualIndex)}
                            >
                              <Users className="w-3.5 h-3.5" />
                              {Array.isArray(course.teachers) && course.teachers.length > 0
                                ? `${course.teachers.length} Selected`
                                : "Select Teachers"}
                            </button>

                            {selectedCourseIndex === actualIndex && (
                              <>
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => { setSelectedCourseIndex(null); setTeacherSearchQuery(""); }}
                                />
                                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50" style={{ maxHeight: "350px", overflowY: "auto" }}>
                                  <div className="p-3">
                                  <div className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">Select Teachers</div>
                                  <input
                                    type="text"
                                    placeholder="Search teachers..."
                                    value={teacherSearchQuery}
                                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 mb-2"
                                    autoFocus
                                  />
                                  <div className="space-y-2">
                                    {teachers.filter((teacher) => {
                                      if (!teacherSearchQuery.trim()) return true;
                                      const label = typeof teacher === "string" ? teacher : (teacher?.name ?? teacher?.ID ?? "");
                                      return label.toLowerCase().includes(teacherSearchQuery.toLowerCase());
                                    }).map((teacher, idx) => {
                                      const teacherKey =
                                        typeof teacher === "string"
                                          ? teacher
                                          : (teacher?.unid ?? teacher?.ID ?? teacher?.name ?? "");
                                      const teacherLabel =
                                        typeof teacher === "string"
                                          ? teacher
                                          : (teacher?.name ?? teacher?.ID ?? teacher?.unid ?? "Unknown");
                                      const selectedTeachers = Array.isArray(course.teachers)
                                        ? course.teachers
                                        : [];

                                      return (
                                        <label key={teacherKey || idx} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
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
                                            className="rounded border-gray-300"
                                          />
                                          <span className="text-gray-700">{teacherLabel}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  <button
                                    className="mt-3 w-full px-3 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
                                    onClick={() => { setSelectedCourseIndex(null); setTeacherSearchQuery(""); }}
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                              </>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => saveCourse(actualIndex)}
                                className="inline-flex items-center justify-center px-2 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
                                title={course.unid ? "Update" : "Save"}
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteCourse(actualIndex)}
                                className="inline-flex items-center justify-center p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCourses.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 text-center text-sm text-gray-500">
                          {searchQuery ? "No courses match your search." : "No courses found. Click 'Add Row' to create a new course."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <Footer />

      {/* Add Course Modal */}
      {isAddCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add New Course</h2>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Course ID *</label>
                <input
                  ref={courseIdRef}
                  type="text"
                  value={newCourse.ID}
                  onChange={(e) => setNewCourse({ ...newCourse, ID: e.target.value })}
                  onKeyDown={handleCourseModalKeyDown}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                  placeholder="Enter course ID"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Course Name *</label>
                <input
                  ref={courseNameRef}
                  type="text"
                  value={newCourse.name}
                  onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                  onKeyDown={handleCourseModalKeyDown}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                  placeholder="Enter course name"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Code</label>
                <input
                  ref={courseCodeRef}
                  type="text"
                  value={newCourse.code}
                  onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                  onKeyDown={handleCourseModalKeyDown}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                  placeholder="Enter course code"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Credits</label>
                <input
                  ref={courseCreditsRef}
                  type="text"
                  value={newCourse.credits}
                  onChange={(e) => setNewCourse({ ...newCourse, credits: e.target.value })}
                  onKeyDown={handleCourseModalKeyDown}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                  placeholder="Enter credits"
                />
              </div>

              {/* Batch Available Configuration */}
              <div className="pt-2 border-t border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newCourse.hasBatches}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setNewCourse((prev) => ({
                        ...prev,
                        hasBatches: checked,
                        batches: checked ? (prev.batches?.length ? prev.batches : ["B1", "B2"]) : [],
                      }));
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-gray-800">Batch Available?</span>
                </label>

                {newCourse.hasBatches && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-blue-900 uppercase">Number of Batches:</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={newCourse.batches?.length || 2}
                        onChange={(e) => {
                          const count = Math.max(1, parseInt(e.target.value) || 1);
                          setNewCourse((prev) => {
                            const curBatches = prev.batches || [];
                            const newBatches = Array.from({ length: count }, (_, i) => curBatches[i] || `B${i + 1}`);
                            return { ...prev, batches: newBatches };
                          });
                        }}
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded text-center bg-white"
                      />
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-gray-700 mb-1.5">Batch Names:</span>
                      <div className="grid grid-cols-2 gap-2">
                        {(newCourse.batches || []).map((bName, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 font-mono w-4">{idx + 1}.</span>
                            <input
                              type="text"
                              value={bName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewCourse((prev) => {
                                  const updated = [...(prev.batches || [])];
                                  updated[idx] = val;
                                  return { ...prev, batches: updated };
                                });
                              }}
                              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                              placeholder={`B${idx + 1}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={closeAddCourseModal}
                className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => saveNewCourse(true)}
                className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
              >
                Save and Add More
              </button>
              <button
                onClick={() => saveNewCourse(false)}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
              >
                Save and Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch & Teacher Allotment Modal for Listed Course */}
      {batchModalCourseIndex !== null && courses[batchModalCourseIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Batches & Teacher Allotment
                </h3>
                <p className="text-xs text-gray-500">
                  {courses[batchModalCourseIndex].name} ({courses[batchModalCourseIndex].ID || "No ID"})
                </p>
              </div>
              <button
                onClick={() => setBatchModalCourseIndex(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!courses[batchModalCourseIndex].hasBatches}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateCourseField(batchModalCourseIndex, "hasBatches", checked);
                    if (checked && (!courses[batchModalCourseIndex].batches || courses[batchModalCourseIndex].batches.length === 0)) {
                      updateCourseField(batchModalCourseIndex, "batches", ["B1", "B2"]);
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-sm font-semibold text-gray-800">Enable Batches for this Course?</span>
              </label>

              {courses[batchModalCourseIndex].hasBatches && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-blue-900 uppercase">Number of Batches:</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={courses[batchModalCourseIndex].batches?.length || 2}
                      onChange={(e) => {
                        const count = Math.max(1, parseInt(e.target.value) || 1);
                        const curBatches = courses[batchModalCourseIndex].batches || [];
                        const newBatches = Array.from({ length: count }, (_, i) => curBatches[i] || `B${i + 1}`);
                        updateCourseField(batchModalCourseIndex, "batches", newBatches);
                      }}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded text-center bg-white"
                    />
                  </div>

                  <div className="space-y-3">
                    <span className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Batch Names & Teacher Allotment:
                    </span>
                    {(courses[batchModalCourseIndex].batches || []).map((bName, bIdx) => {
                      const batchTeachersObj = courses[batchModalCourseIndex].batchTeachers || {};
                      const assignedTeachers = batchTeachersObj[bName] || [];

                      return (
                        <div key={bIdx} className="p-3 bg-white border border-gray-200 rounded-lg space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 w-6">#{bIdx + 1}</span>
                            <input
                              type="text"
                              value={bName}
                              onChange={(e) => {
                                const newName = e.target.value;
                                const updatedBatches = [...(courses[batchModalCourseIndex].batches || [])];
                                const oldName = updatedBatches[bIdx];
                                updatedBatches[bIdx] = newName;
                                
                                const updatedBatchTeachers = { ...(courses[batchModalCourseIndex].batchTeachers || {}) };
                                if (oldName && updatedBatchTeachers[oldName]) {
                                  updatedBatchTeachers[newName] = updatedBatchTeachers[oldName];
                                  delete updatedBatchTeachers[oldName];
                                }
                                updateCourseField(batchModalCourseIndex, "batches", updatedBatches);
                                updateCourseField(batchModalCourseIndex, "batchTeachers", updatedBatchTeachers);
                              }}
                              className="px-2.5 py-1 text-sm border border-gray-300 rounded font-semibold text-blue-900 w-28"
                              placeholder={`B${bIdx + 1}`}
                            />
                            <span className="text-xs text-gray-500 font-medium">Assigned Teachers ({assignedTeachers.length})</span>
                          </div>

                          <div className="p-2 border border-gray-100 bg-gray-50 rounded max-h-36 overflow-y-auto space-y-1">
                            {teachers.map((teacher, tIdx) => {
                              const tKey = typeof teacher === "string" ? teacher : (teacher?.unid ?? teacher?.ID ?? teacher?.name);
                              const tName = typeof teacher === "string" ? teacher : (teacher?.name ?? teacher?.ID ?? "Unknown");
                              const isChecked = assignedTeachers.includes(tKey);

                              return (
                                <label key={tKey || tIdx} className="flex items-center gap-2 text-xs text-gray-700 hover:bg-gray-100 p-1 rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      let newAssigned = [...assignedTeachers];
                                      if (e.target.checked) {
                                        if (!newAssigned.includes(tKey)) newAssigned.push(tKey);
                                      } else {
                                        newAssigned = newAssigned.filter((t) => t !== tKey);
                                      }
                                      const updatedBatchTeachers = {
                                        ...(courses[batchModalCourseIndex].batchTeachers || {}),
                                        [bName]: newAssigned,
                                      };
                                      updateCourseField(batchModalCourseIndex, "batchTeachers", updatedBatchTeachers);
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                  <span>{tName}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setBatchModalCourseIndex(null)}
                className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const targetCourse = courses[batchModalCourseIndex];
                  await saveCourse(batchModalCourseIndex);
                  if (targetCourse?.hasBatches && targetCourse?.batches?.length > 0) {
                    await courseService.splitBatches({
                      courseUnid: targetCourse.unid,
                      batches: targetCourse.batches,
                    });
                    await fetchCourses(selectedFaculty, selectedDepartment, selectedSemester);
                  }
                  setBatchModalCourseIndex(null);
                }}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm"
              >
                Save & Generate Batch Courses
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseLoad;
