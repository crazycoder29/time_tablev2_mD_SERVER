import React, { useState, useEffect } from "react";
import { 
  Plus, X, Trash2, Save, Settings, BookOpen, GitBranch, Loader2, 
  Clock, Pencil, Calendar, ChevronDown, ChevronUp, Users, UserPlus, 
  Key, Shield, Search, Check, AlertCircle, RefreshCw, FileText, 
  Building2, RotateCcw, FileSpreadsheet, Download, Sparkles, Database, ExternalLink
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { settingsService, timetableService, usersService, facultiesService } from "../firebase/services";
import { useAuthStore } from "../store/authStore";

const DEFAULT_TIME_SLOTS = [
  "7:00 AM - 7:55 AM", "7:55 AM - 8:50 AM", "8:50 AM - 9:45 AM",
  "10:30 AM - 11:25 AM", "11:25 AM - 12:20 PM", "12:20 PM - 1:15 PM",
  "1:15 PM - 2:10 PM", "2:10 PM - 3:05 PM", "3:05 PM - 4:00 PM", "4:00 PM - 4:55 PM"
];
const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMPTY_PRESET = { class: "", branch: "", semester: "", type: "full-time", days: ["Mon","Tue","Wed","Thu","Fri","Sat"], timeSlots: [...DEFAULT_TIME_SLOTS] };

const convert24to12 = (time24) => {
  if (!time24) return "";
  const [hourStr, minStr] = time24.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minStr} ${ampm}`;
};

const EMPTY_USER_FORM = {
  name: "",
  email: "",
  password: "",
  role: "timetable_incharge",
  faculty: "engineering",
  department: ""
};

const EMPTY_FACULTY_FORM = {
  name: "",
  code: "",
  description: "",
  institute_name: "DAYALBAGH EDUCATIONAL INSTITUTE",
};

const AdminSettings = () => {
  const { user: currentUser, role: currentRole, activeFaculty, setActiveFaculty, activeSemester, setActiveSemester } = useAuthStore();
  const isSuperAdmin = currentRole === "admin";
  const [activeTab, setActiveTab] = useState("users"); // "users" | "faculties" | "settings" | "exportHeader"


  // ── Faculty Management State ─────────────────────────────────────────────
  const [faculties, setFaculties] = useState([]);
  const [facultiesLoading, setFacultiesLoading] = useState(true);
  const [showCreateFacultyModal, setShowCreateFacultyModal] = useState(false);
  const [createFacultyForm, setCreateFacultyForm] = useState(EMPTY_FACULTY_FORM);
  const [createFacultySubmitting, setCreateFacultySubmitting] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [editFacultySubmitting, setEditFacultySubmitting] = useState(false);

  // ── User Management State ────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userError, setUserError] = useState("");
  const [userSuccess, setUserSuccess] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [facultyFilter, setFacultyFilter] = useState("all");

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    ...EMPTY_USER_FORM,
    faculty: currentUser?.faculty || "engineering",
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState(null); // { id, name, email, role, faculty, department }
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Change Password Modal
  const [passwordUser, setPasswordUser] = useState(null); // { id, name, email }
  const [newPassword, setNewPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // ── System Config State ──────────────────────────────────────────────────
  const [programs, setPrograms] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Timetable Presets
  const [presets, setPresets] = useState([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [editingPreset, setEditingPreset] = useState(null);
  const [addingPreset, setAddingPreset] = useState(false);
  const [newPreset, setNewPreset] = useState(EMPTY_PRESET);
  const [presetError, setPresetError] = useState("");
  const [presetSaving, setPresetSaving] = useState(false);
  const [expandedPreset, setExpandedPreset] = useState(null);
  const [newTimeSlot, setNewTimeSlot] = useState("");
  const [newSlotStart, setNewSlotStart] = useState("");
  const [newSlotEnd, setNewSlotEnd] = useState("");
  
  // New program form
  const [newProgram, setNewProgram] = useState("");
  const [addingProgram, setAddingProgram] = useState(false);
  
  // New branch form
  const [newBranch, setNewBranch] = useState({ name: "", programs: [] });
  const [addingBranch, setAddingBranch] = useState(false);

  // ── Exporter Header State ───────────────────────────────────────────────
  const [instituteName, setInstituteName] = useState("DAYALBAGH EDUCATIONAL INSTITUTE");
  const [facultyName, setFacultyName] = useState("ENGINEERING FACULTY");
  const [headerLoading, setHeaderLoading] = useState(true);
  const [headerSaving, setHeaderSaving] = useState(false);
  const [headerSavedMessage, setHeaderSavedMessage] = useState("");

  useEffect(() => {
    loadFaculties();
    loadUsers();
    loadSettings();
    loadPresets();
    loadExportHeaderSettings();
  }, []);

  const loadFaculties = async () => {
    try {
      setFacultiesLoading(true);
      const data = await facultiesService.getFaculties();
      if (Array.isArray(data)) {
        setFaculties(data);
      }
    } catch (err) {
      console.error("Error loading faculties:", err);
    } finally {
      setFacultiesLoading(false);
    }
  };

  const handleCreateFaculty = async (e) => {
    e.preventDefault();
    setUserError("");
    setUserSuccess("");

    if (!createFacultyForm.name.trim()) {
      setUserError("Faculty Name is required.");
      return;
    }

    try {
      setCreateFacultySubmitting(true);
      const created = await facultiesService.createFaculty(createFacultyForm);
      setUserSuccess(`Faculty "${created.name}" created successfully with isolated database "${created.database_name}"!`);
      setShowCreateFacultyModal(false);
      setCreateFacultyForm(EMPTY_FACULTY_FORM);
      await loadFaculties();
    } catch (err) {
      console.error("Error creating faculty:", err);
      setUserError(err.message || "Failed to create faculty.");
    } finally {
      setCreateFacultySubmitting(false);
    }
  };

  const handleUpdateFaculty = async (e) => {
    e.preventDefault();
    setUserError("");
    setUserSuccess("");

    if (!editingFaculty || !editingFaculty.name.trim()) {
      setUserError("Faculty Name is required.");
      return;
    }

    try {
      setEditFacultySubmitting(true);
      await facultiesService.updateFaculty(editingFaculty.slug, {
        name: editingFaculty.name,
        code: editingFaculty.code,
        description: editingFaculty.description,
        institute_name: editingFaculty.institute_name,
      });
      setUserSuccess(`Faculty "${editingFaculty.name}" updated successfully!`);
      setEditingFaculty(null);
      await loadFaculties();
    } catch (err) {
      console.error("Error updating faculty:", err);
      setUserError(err.message || "Failed to update faculty.");
    } finally {
      setEditFacultySubmitting(false);
    }
  };

  const handleDeleteFaculty = async (fac) => {
    if (fac.slug === "engineering" || fac.slug === "default") {
      alert("The default Engineering Faculty cannot be removed.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${fac.name}" from the faculty registry?\n\nExisting isolated data in database "${fac.database_name}" will remain archived.`)) {
      return;
    }

    try {
      setUserError("");
      await facultiesService.deleteFaculty(fac.slug);
      setUserSuccess(`Faculty "${fac.name}" removed successfully.`);
      await loadFaculties();
    } catch (err) {
      console.error("Error deleting faculty:", err);
      setUserError(err.message || "Failed to delete faculty.");
    }
  };

  const handleSwitchFacultySemester = async (facSlug, targetSem) => {
    try {
      setUserSuccess("");
      setUserError("");
      await facultiesService.switchFacultySemester(facSlug, targetSem);
      if (activeFaculty === facSlug) {
        setActiveSemester(targetSem);
      }
      setUserSuccess(`Academic semester for faculty "${facSlug}" switched to "${targetSem.toUpperCase()} SEMESTER" (Database isolated).`);
      await loadFaculties();
    } catch (err) {
      console.error("Error switching semester:", err);
      setUserError(err.message || "Failed to switch academic semester.");
    }
  };

  const loadExportHeaderSettings = async () => {

    try {
      setHeaderLoading(true);
      const data = await settingsService.getExportHeader();
      if (data) {
        setInstituteName(data.institute_name || "DAYALBAGH EDUCATIONAL INSTITUTE");
        setFacultyName(data.faculty_name || "ENGINEERING FACULTY");
      }
    } catch (err) {
      console.error("Error loading export header:", err);
    } finally {
      setHeaderLoading(false);
    }
  };

  const handleSaveExportHeader = async (e) => {
    if (e) e.preventDefault();
    try {
      setHeaderSaving(true);
      setHeaderSavedMessage("");
      const updated = await settingsService.saveExportHeader({
        institute_name: instituteName.trim() || "DAYALBAGH EDUCATIONAL INSTITUTE",
        faculty_name: facultyName.trim() || "ENGINEERING FACULTY",
      });
      setInstituteName(updated.institute_name);
      setFacultyName(updated.faculty_name);
      setHeaderSavedMessage("Exporter header settings saved successfully! Applied to all file exports.");
      setUserSuccess("Exporter header configuration saved successfully! All PDF and Excel exports now reflect this header.");
      setTimeout(() => setHeaderSavedMessage(""), 5000);
    } catch (err) {
      console.error("Error saving export header:", err);
      setUserError(err.message || "Failed to save export header settings");
    } finally {
      setHeaderSaving(false);
    }
  };

  const handleResetExportHeader = () => {
    setInstituteName("DAYALBAGH EDUCATIONAL INSTITUTE");
    setFacultyName("ENGINEERING FACULTY");
  };

  // ── User Management Actions ──────────────────────────────────────────────
  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      setUserError("");
      const data = await usersService.listUsers();
      setUsers(data || []);
    } catch (err) {
      console.error("Error loading users:", err);
      setUserError(err.message || "Failed to fetch user list.");
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserError("");
    setUserSuccess("");

    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setUserError("Name, Email, and Password are required.");
      return;
    }

    try {
      setCreateSubmitting(true);
      await usersService.createUser(createForm);
      setUserSuccess(`User ${createForm.email} created successfully!`);
      setCreateForm({
        ...EMPTY_USER_FORM,
        faculty: currentUser?.faculty || "engineering",
      });
      setShowCreateModal(false);
      await loadUsers();
      await loadFaculties();
    } catch (err) {
      setUserError(err.message || "Failed to create user.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setUserError("");
    setUserSuccess("");

    if (!editingUser.name.trim() || !editingUser.email.trim()) {
      setUserError("Name and Email are required.");
      return;
    }

    try {
      setEditSubmitting(true);
      await usersService.updateUser(editingUser.id, {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        faculty: editingUser.faculty || "",
        department: editingUser.department || "",
      });
      setUserSuccess(`User ${editingUser.email} updated successfully!`);
      setEditingUser(null);
      await loadUsers();
      await loadFaculties();
    } catch (err) {
      setUserError(err.message || "Failed to update user.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setUserError("");
    setUserSuccess("");

    if (!newPassword || newPassword.length < 4) {
      setUserError("Password must be at least 4 characters long.");
      return;
    }

    try {
      setPasswordSubmitting(true);
      await usersService.changeUserPassword(passwordUser.id, newPassword);
      setUserSuccess(`Password for ${passwordUser.email} updated successfully!`);
      setPasswordUser(null);
      setNewPassword("");
    } catch (err) {
      setUserError(err.message || "Failed to change password.");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleDeleteUser = async (userToDelete) => {
    if (userToDelete.id === currentUser?.id) {
      alert("Security restriction: You cannot delete your own active account.");
      return;
    }

    if (!confirm(`Are you sure you want to delete user "${userToDelete.email}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setUserError("");
      setUserSuccess("");
      await usersService.deleteUser(userToDelete.id);
      setUserSuccess(`User ${userToDelete.email} deleted successfully.`);
      await loadUsers();
      await loadFaculties();
    } catch (err) {
      setUserError(err.message || "Failed to delete user.");
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "sub_admin":
        return "bg-indigo-100 text-indigo-800 border-indigo-200 font-semibold";
      case "hod":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "timetable_incharge":
      case "tt_incharge":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatRoleLabel = (role) => {
    switch (role) {
      case "admin": return "Super Admin";
      case "sub_admin": return "Sub Admin (Faculty)";
      case "hod": return "HOD";
      case "timetable_incharge":
      case "tt_incharge": return "Timetable Incharge";
      default: return role;
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(userSearch.toLowerCase())) ||
      (u.faculty && u.faculty.toLowerCase().includes(userSearch.toLowerCase()));
    
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesFaculty = facultyFilter === "all" || (u.faculty && u.faculty.toLowerCase() === facultyFilter.toLowerCase());
    return matchesSearch && matchesRole && matchesFaculty;
  });


  // ── Preset Actions ────────────────────────────────────────────────────────
  const loadPresets = async () => {
    try {
      setPresetsLoading(true);
      const data = await timetableService.listAllTimetablesMeta();
      setPresets(data);
    } catch (e) {
      console.error("Error loading presets:", e);
    } finally {
      setPresetsLoading(false);
    }
  };

  const handleAddPreset = async () => {
    setPresetError("");
    if (!newPreset.class.trim() || !newPreset.branch.trim() || !newPreset.semester.trim()) {
      setPresetError("Class, Branch and Semester are required."); return;
    }
    try {
      setPresetSaving(true);
      await timetableService.createTimetablePreset(newPreset);
      setNewPreset(EMPTY_PRESET);
      setAddingPreset(false);
      await loadPresets();
    } catch (e) {
      setPresetError(e.message || "Failed to create preset.");
    } finally {
      setPresetSaving(false);
    }
  };

  const handleStartEdit = (preset) => {
    setEditingPreset({ originalId: preset.timetableId, data: { ...preset, days: preset.days || ["Mon","Tue","Wed","Thu","Fri","Sat"], timeSlots: preset.timeSlots || [...DEFAULT_TIME_SLOTS] } });
    setPresetError("");
  };

  const handleSaveEdit = async () => {
    setPresetError("");
    const { originalId, data } = editingPreset;
    if (!data.class.trim() || !data.branch.trim() || !data.semester.trim()) {
      setPresetError("Class, Branch and Semester are required."); return;
    }
    try {
      setPresetSaving(true);
      await timetableService.updateTimetableMeta(originalId, data);
      setEditingPreset(null);
      await loadPresets();
    } catch (e) {
      setPresetError(e.message || "Failed to save.");
    } finally {
      setPresetSaving(false);
    }
  };

  const handleDeletePreset = async (timetableId) => {
    if (!confirm(`Delete timetable preset "${timetableId}"?\n\nThis only removes the preset. Existing schedules are NOT deleted.`)) return;
    try {
      setPresetSaving(true);
      await timetableService.deleteTimetable(timetableId);
      await loadPresets();
    } catch (e) {
      alert("Failed to delete preset: " + e.message);
    } finally {
      setPresetSaving(false);
    }
  };

  const toggleDay = (day, isEdit) => {
    if (isEdit) {
      setEditingPreset(prev => {
        const days = prev.data.days.includes(day) ? prev.data.days.filter(d => d !== day) : [...prev.data.days, day];
        return { ...prev, data: { ...prev.data, days } };
      });
    } else {
      setNewPreset(prev => {
        const days = prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day];
        return { ...prev, days };
      });
    }
  };

  const addTimeSlot = (isEdit) => {
    if (!newSlotStart || !newSlotEnd) {
      alert("Please select both start and end times.");
      return;
    }
    const startStr = convert24to12(newSlotStart);
    const endStr = convert24to12(newSlotEnd);
    const slot = `${startStr} - ${endStr}`;
    if (isEdit) {
      setEditingPreset(prev => ({ ...prev, data: { ...prev.data, timeSlots: [...(prev.data.timeSlots || []), slot] } }));
    } else {
      setNewPreset(prev => ({ ...prev, timeSlots: [...prev.timeSlots, slot] }));
    }
    setNewSlotStart("");
    setNewSlotEnd("");
  };

  const removeTimeSlot = (idx, isEdit) => {
    if (isEdit) {
      setEditingPreset(prev => ({ ...prev, data: { ...prev.data, timeSlots: prev.data.timeSlots.filter((_, i) => i !== idx) } }));
    } else {
      setNewPreset(prev => ({ ...prev, timeSlots: prev.timeSlots.filter((_, i) => i !== idx) }));
    }
  };

  // ── Programs & Branches Actions ──────────────────────────────────────────
  const loadSettings = async () => {
    try {
      setLoading(true);
      const [programsData, branchesData] = await Promise.all([
        settingsService.getPrograms(),
        settingsService.getBranches(),
      ]);
      setPrograms(programsData);
      setBranches(branchesData);
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProgram = async () => {
    if (!newProgram.trim()) return;
    if (programs.includes(newProgram.trim())) {
      alert("This program already exists");
      return;
    }
    try {
      setSaving(true);
      const updatedPrograms = [...programs, newProgram.trim()];
      await settingsService.savePrograms(updatedPrograms);
      setPrograms(updatedPrograms);
      setNewProgram("");
      setAddingProgram(false);
    } catch (error) {
      console.error("Error adding program:", error);
      alert("Failed to add program");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProgram = async (programToDelete) => {
    if (!confirm(`Are you sure you want to delete "${programToDelete}"?`)) return;
    try {
      setSaving(true);
      const updatedPrograms = programs.filter((p) => p !== programToDelete);
      const updatedBranches = branches.map((branch) => ({
        ...branch,
        programs: branch.programs.filter((p) => p !== programToDelete),
      }));
      await Promise.all([
        settingsService.savePrograms(updatedPrograms),
        settingsService.saveBranches(updatedBranches),
      ]);
      setPrograms(updatedPrograms);
      setBranches(updatedBranches);
    } catch (error) {
      console.error("Error deleting program:", error);
      alert("Failed to delete program");
    } finally {
      setSaving(false);
    }
  };

  const handleAddBranch = async () => {
    if (!newBranch.name.trim()) { alert("Please enter a branch name"); return; }
    if (newBranch.programs.length === 0) { alert("Please select at least one program"); return; }
    if (branches.some((b) => b.name === newBranch.name.trim())) { alert("This branch already exists"); return; }

    try {
      setSaving(true);
      const updatedBranches = [...branches, { name: newBranch.name.trim(), programs: newBranch.programs }];
      await settingsService.saveBranches(updatedBranches);
      setBranches(updatedBranches);
      setNewBranch({ name: "", programs: [] });
      setAddingBranch(false);
    } catch (error) {
      console.error("Error adding branch:", error);
      alert("Failed to add branch");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBranch = async (branchName) => {
    if (!confirm(`Are you sure you want to delete "${branchName}"?`)) return;
    try {
      setSaving(true);
      const updatedBranches = branches.filter((b) => b.name !== branchName);
      await settingsService.saveBranches(updatedBranches);
      setBranches(updatedBranches);
    } catch (error) {
      console.error("Error deleting branch:", error);
      alert("Failed to delete branch");
    } finally {
      setSaving(false);
    }
  };

  const toggleProgramForBranch = (program) => {
    setNewBranch((prev) => {
      const programs = prev.programs.includes(program)
        ? prev.programs.filter((p) => p !== program)
        : [...prev.programs, program];
      return { ...prev, programs };
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Settings className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Admin Console</h1>
            </div>
            <p className="text-gray-600">User accounts, roles, access permissions, and academic configurations</p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-white border border-gray-200 p-1.5 rounded-xl shadow-sm overflow-x-auto">
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all shrink-0 ${
                activeTab === "users"
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Users className="w-4 h-4" />
              User Management
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab("faculties")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all shrink-0 ${
                  activeTab === "faculties"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Building2 className="w-4 h-4" />
                Faculty Management
              </button>
            )}
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all shrink-0 ${
                activeTab === "settings"
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Programs & Presets
            </button>
            <button
              onClick={() => setActiveTab("exportHeader")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all shrink-0 ${
                activeTab === "exportHeader"
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <FileText className="w-4 h-4" />
              Exporter Header
            </button>
          </div>
        </div>

        {/* Sub-Admin Dedicated Faculty Context Banner */}
        {!isSuperAdmin && (
          <div className="mb-6 bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                <Building2 size={20} />
              </div>
              <div>
                <div className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                  <span>Faculty Admin: {currentUser?.faculty ? currentUser.faculty.replace(/_/g, " ").toUpperCase() : "FACULTY"}</span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-900 border border-indigo-300">
                    Isolated DB
                  </span>
                </div>
                <p className="text-xs text-indigo-700 mt-0.5">
                  All settings, users, and schedules apply strictly to your assigned faculty database with zero cross-faculty collision.
                </p>
              </div>
            </div>

            {/* Semester Switcher for Sub Admin */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-xs">
              <span className="text-xs font-bold text-slate-600">Semester:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-extrabold uppercase ${
                activeSemester === "even" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {activeSemester === "even" ? "Even Sem" : "Odd Sem"}
              </span>
              <button
                onClick={() => handleSwitchFacultySemester(currentUser?.faculty || activeFaculty, activeSemester === "even" ? "odd" : "even")}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline ml-1"
              >
                Switch to {activeSemester === "even" ? "Odd" : "Even"}
              </button>
            </div>
          </div>
        )}

        {/* Global Notifications */}

        {userError && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{userError}</p>
            </div>
            <button onClick={() => setUserError("")} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {userSuccess && (
          <div className="mb-6 bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 text-emerald-700">
              <Check className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{userSuccess}</p>
            </div>
            <button onClick={() => setUserSuccess("")} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── USER MANAGEMENT TAB ────────────────────────────────────────── */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users by name, email, department..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Super Admin</option>
                  <option value="sub_admin">Sub Admin (Faculty)</option>
                  <option value="hod">HOD</option>
                  <option value="timetable_incharge">Timetable Incharge</option>
                </select>
                {isSuperAdmin && faculties.length > 0 && (
                  <select
                    value={facultyFilter}
                    onChange={(e) => setFacultyFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Faculties</option>
                    {faculties.map((f) => (
                      <option key={f.slug} value={f.slug}>{f.name}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => { loadUsers(); loadFaculties(); }}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
                  title="Refresh users"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => {
                  setCreateForm({
                    ...EMPTY_USER_FORM,
                    faculty: currentUser?.faculty || "engineering",
                  });
                  setUserError("");
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                Create New User
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {usersLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                  <p className="text-sm font-medium">Loading registered users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-16 px-4 text-gray-500">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-base font-semibold text-gray-700">No users found</p>
                  <p className="text-sm text-gray-500 mt-1">Try refining your search or add a new user.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        <th className="px-6 py-3.5">User</th>
                        <th className="px-6 py-3.5">Role</th>
                        <th className="px-6 py-3.5">Faculty / Department</th>
                        <th className="px-6 py-3.5">Created Date</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{u.name}</div>
                                <div className="text-xs text-gray-500">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeClass(u.role)}`}>
                              <Shield className="w-3 h-3" />
                              {formatRoleLabel(u.role)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {u.faculty || u.department ? (
                              <span>
                                {u.faculty && (
                                  <span className="font-semibold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded text-xs mr-1.5 border border-indigo-100 uppercase">
                                    {u.faculty}
                                  </span>
                                )}
                                {u.department && <span className="text-gray-700">{u.department}</span>}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">Not set</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-xs">
                            {new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingUser({ ...u })}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Details & Role"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setPasswordUser(u);
                                  setNewPassword("");
                                }}
                                className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Change Password"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                disabled={u.id === currentUser?.id}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                title={u.id === currentUser?.id ? "Cannot delete your own account" : "Delete User"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FACULTY MANAGEMENT TAB (SUPER ADMIN ONLY) ───────────────────── */}
        {isSuperAdmin && activeTab === "faculties" && (
          <div className="space-y-6">
            {/* Header & Stats Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">Total Registered Faculties</span>
                  <Building2 className="w-6 h-6 text-indigo-200" />
                </div>
                <div className="text-3xl font-black">{faculties.length}</div>
                <p className="text-xs text-indigo-100 mt-1">Multi-tenant institutional hierarchy</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-100">Database Isolation</span>
                  <Database className="w-6 h-6 text-blue-200" />
                </div>
                <div className="text-3xl font-black">{faculties.length} DBs</div>
                <p className="text-xs text-blue-100 mt-1">Zero cross-faculty data collision</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Active Faculty Context</span>
                  <Sparkles className="w-6 h-6 text-emerald-200" />
                </div>
                <div className="text-2xl font-black capitalize truncate">{activeFaculty.replace(/_/g, " ")}</div>
                <p className="text-xs text-emerald-100 mt-1">Currently controlling this database</p>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Faculty Databases & Isolation</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Each faculty operates on an independent MongoDB database with dedicated timetables, rooms, staff, and settings.
                </p>
              </div>
              <button
                onClick={() => {
                  setCreateFacultyForm(EMPTY_FACULTY_FORM);
                  setShowCreateFacultyModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add New Faculty
              </button>
            </div>

            {/* Faculties Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {facultiesLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                  <p className="text-sm font-medium">Loading faculties...</p>
                </div>
              ) : faculties.length === 0 ? (
                <div className="text-center py-16 px-4 text-gray-500">
                  <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-base font-semibold text-gray-700">No faculties registered</p>
                  <p className="text-sm text-gray-500 mt-1">Click "Add New Faculty" to provision a new faculty database.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        <th className="px-6 py-3.5">Faculty Name</th>
                        <th className="px-6 py-3.5">Code / Slug</th>
                        <th className="px-6 py-3.5">Active Semester</th>
                        <th className="px-6 py-3.5">Isolated Database</th>
                        <th className="px-6 py-3.5">Members</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {faculties.map((f) => {
                        const isCurrentActive = activeFaculty === f.slug;
                        const currentSem = f.current_semester || "odd";
                        const nextSem = currentSem === "even" ? "odd" : "even";
                        return (
                          <tr key={f.id || f.slug} className={`transition-colors ${isCurrentActive ? 'bg-indigo-50/50' : 'hover:bg-gray-50/80'}`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                  isCurrentActive ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {f.code || f.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-900 flex items-center gap-2">
                                    <span>{f.name}</span>
                                    {isCurrentActive && (
                                      <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                                        Active Context
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">{f.description || f.institute_name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-gray-600">
                              <span className="bg-gray-100 px-2 py-1 rounded font-semibold text-gray-800">{f.slug}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                                  currentSem === "even"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                }`}>
                                  {currentSem === "even" ? "Even Sem" : "Odd Sem"}
                                </span>
                                <button
                                  onClick={() => handleSwitchFacultySemester(f.slug, nextSem)}
                                  className="text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:underline"
                                  title={`Switch to ${nextSem} semester`}
                                >
                                  Switch to {nextSem}
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 w-fit">
                                <Database size={12} className="text-emerald-600" />
                                <span>{f.database_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-gray-600">
                              <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full font-bold">
                                <Users size={12} /> {f.user_count || 0} users
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!isCurrentActive ? (
                                  <button
                                    onClick={() => {
                                      setActiveFaculty(f.slug);
                                      window.location.reload();
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                                  >
                                    Switch Context
                                  </button>
                                ) : (
                                  <span className="text-xs text-emerald-600 font-bold px-2 py-1">
                                    Current
                                  </span>
                                )}
                                <button
                                  onClick={() => setEditingFaculty({ ...f })}
                                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit Faculty"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                {f.slug !== "engineering" && f.slug !== "default" && (
                                  <button
                                    onClick={() => handleDeleteFaculty(f)}
                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete Faculty Registry"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}


        {/* ── SYSTEM CONFIGURATION TAB ───────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Programs Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Programs</h2>
                  </div>
                  {!addingProgram && (
                    <button
                      onClick={() => setAddingProgram(true)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      Add Program
                    </button>
                  )}
                </div>

                {addingProgram && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProgram}
                        onChange={(e) => setNewProgram(e.target.value)}
                        placeholder="e.g., B.Tech, M.Tech, BCA"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        onKeyPress={(e) => e.key === "Enter" && handleAddProgram()}
                      />
                      <button
                        onClick={handleAddProgram}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setAddingProgram(false); setNewProgram(""); }}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {programs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No programs defined yet</div>
                  ) : (
                    programs.map((program) => (
                      <div key={program} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                        <span className="font-medium text-gray-900">{program}</span>
                        <button
                          onClick={() => handleDeleteProgram(program)}
                          disabled={saving}
                          className="text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Branches Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Branches</h2>
                  </div>
                  {!addingBranch && (
                    <button
                      onClick={() => setAddingBranch(true)}
                      disabled={saving || programs.length === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      title={programs.length === 0 ? "Add programs first" : ""}
                    >
                      <Plus className="w-4 h-4" />
                      Add Branch
                    </button>
                  )}
                </div>

                {addingBranch && (
                  <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Branch Name</label>
                      <input
                        type="text"
                        value={newBranch.name}
                        onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                        placeholder="e.g., Computer Science, Electrical"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Associated Programs</label>
                      <div className="flex flex-wrap gap-2">
                        {programs.map((program) => (
                          <button
                            key={program}
                            type="button"
                            onClick={() => toggleProgramForBranch(program)}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                              newBranch.programs.includes(program)
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {program}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleAddBranch}
                        disabled={saving}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" /> Save Branch
                      </button>
                      <button
                        onClick={() => { setAddingBranch(false); setNewBranch({ name: "", programs: [] }); }}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {branches.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No branches defined yet</div>
                  ) : (
                    branches.map((branch) => (
                      <div key={branch.name} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-gray-900 text-sm">{branch.name}</h3>
                          <button
                            onClick={() => handleDeleteBranch(branch.name)}
                            disabled={saving}
                            className="text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {branch.programs.map((program) => (
                            <span key={program} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {program}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Timetable Presets Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Timetable Presets</h2>
                </div>
                {!addingPreset && (
                  <button
                    onClick={() => { setAddingPreset(true); setPresetError(""); }}
                    disabled={presetSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" /> Add Preset
                  </button>
                )}
              </div>

              {presetError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                  {presetError}
                </div>
              )}

              {/* Add Preset Form */}
              {addingPreset && (
                <div className="mb-6 p-5 bg-purple-50 rounded-xl border border-purple-200 space-y-4">
                  <h3 className="font-semibold text-purple-900 text-sm">Create New Timetable Preset</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Class *</label>
                      <input type="text" value={newPreset.class} onChange={e => setNewPreset({...newPreset, class: e.target.value})}
                        placeholder="e.g. B.Tech CS 3rd Year" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Branch *</label>
                      <input type="text" value={newPreset.branch} onChange={e => setNewPreset({...newPreset, branch: e.target.value})}
                        placeholder="e.g. Computer Science" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Semester *</label>
                      <input type="text" value={newPreset.semester} onChange={e => setNewPreset({...newPreset, semester: e.target.value})}
                        placeholder="e.g. V" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                      <select value={newPreset.type} onChange={e => setNewPreset({...newPreset, type: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 bg-white">
                        <option value="full-time">Full Time</option>
                        <option value="part-time">Part Time</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Teaching Days</label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_DAYS.map(day => (
                        <button key={day} type="button" onClick={() => toggleDay(day, false)}
                          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                            newPreset.days.includes(day) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}>{day}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Time Slots</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {newPreset.timeSlots.map((slot, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs">
                          <Clock className="w-3 h-3 text-purple-600" />{slot}
                          <button onClick={() => removeTimeSlot(i, false)} className="text-red-400 hover:text-red-600 ml-1"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 max-w-md bg-purple-50/50 p-2.5 rounded-xl border border-purple-100">
                      <div className="flex-1 min-w-[120px]">
                        <span className="block text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">Start Time</span>
                        <input type="time" value={newSlotStart} onChange={e => setNewSlotStart(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <span className="block text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">End Time</span>
                        <input type="time" value={newSlotEnd} onChange={e => setNewSlotEnd(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                      </div>
                      <button type="button" onClick={() => addTimeSlot(false)}
                        className="mt-5 p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-sm flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={handleAddPreset} disabled={presetSaving}
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                      {presetSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Create Preset
                    </button>
                    <button onClick={() => { setAddingPreset(false); setPresetError(""); }} disabled={presetSaving}
                      className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              )}

              {/* Presets List */}
              {presetsLoading ? (
                <div className="flex justify-center py-8 text-gray-500"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>
              ) : presets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No timetable presets defined yet</div>
              ) : (
                <div className="space-y-2">
                  {presets.map((preset) => {
                    const isEditing = editingPreset?.originalId === preset.timetableId;
                    const isExpanded = expandedPreset === preset.timetableId;
                    return (
                      <div key={preset.timetableId} className={`border rounded-xl overflow-hidden transition-colors ${
                        isEditing ? 'border-purple-400 bg-purple-50/50' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}>
                        {!isEditing ? (
                          <div className="flex items-center justify-between p-3.5 gap-3">
                            <button onClick={() => setExpandedPreset(isExpanded ? null : preset.timetableId)}
                              className="flex items-center gap-2 flex-1 text-left">
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                              <span className="font-semibold text-gray-900 text-sm">{preset.class}</span>
                              <span className="text-gray-400">•</span>
                              <span className="text-sm text-gray-700">{preset.branch}</span>
                              <span className="text-gray-400">•</span>
                              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Sem {preset.semester}</span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                preset.type === 'full-time' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>{preset.type}</span>
                            </button>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleStartEdit(preset)} disabled={presetSaving || !!editingPreset || addingPreset}
                                className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-30">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeletePreset(preset.timetableId)} disabled={presetSaving || !!editingPreset || addingPreset}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Edit Form */
                          <div className="p-4 space-y-4">
                            <h4 className="font-semibold text-purple-800 text-sm">Editing Preset: {editingPreset.originalId}</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Class *</label>
                                <input type="text" value={editingPreset.data.class}
                                  onChange={e => setEditingPreset(prev => ({...prev, data: {...prev.data, class: e.target.value}}))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Branch *</label>
                                <input type="text" value={editingPreset.data.branch}
                                  onChange={e => setEditingPreset(prev => ({...prev, data: {...prev.data, branch: e.target.value}}))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Semester *</label>
                                <input type="text" value={editingPreset.data.semester}
                                  onChange={e => setEditingPreset(prev => ({...prev, data: {...prev.data, semester: e.target.value}}))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                                <select value={editingPreset.data.type}
                                  onChange={e => setEditingPreset(prev => ({...prev, data: {...prev.data, type: e.target.value}}))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                                  <option value="full-time">Full Time</option>
                                  <option value="part-time">Part Time</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-2">Days</label>
                              <div className="flex flex-wrap gap-2">
                                {ALL_DAYS.map(day => (
                                  <button key={day} type="button" onClick={() => toggleDay(day, true)}
                                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                      editingPreset.data.days.includes(day) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300'
                                    }`}>{day}</button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-2">Time Slots</label>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {editingPreset.data.timeSlots.map((slot, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 rounded text-xs">
                                    <Clock className="w-3 h-3 text-purple-600" />{slot}
                                    <button onClick={() => removeTimeSlot(i, true)} className="text-red-400 hover:text-red-600 ml-1"><X className="w-3 h-3" /></button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 bg-purple-50/50 p-2.5 rounded-xl border border-purple-100">
                                <div className="flex-1 min-w-[120px]">
                                  <span className="block text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">Start Time</span>
                                  <input type="time" value={newSlotStart} onChange={e => setNewSlotStart(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                </div>
                                <div className="flex-1 min-w-[120px]">
                                  <span className="block text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">End Time</span>
                                  <input type="time" value={newSlotEnd} onChange={e => setNewSlotEnd(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                </div>
                                <button type="button" onClick={() => addTimeSlot(true)}
                                  className="mt-5 p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-sm flex items-center justify-center">
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={handleSaveEdit} disabled={presetSaving}
                                className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                                {presetSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                              </button>
                              <button onClick={() => { setEditingPreset(null); setPresetError(""); }} disabled={presetSaving}
                                className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                            </div>
                          </div>
                        )}
                        {isExpanded && !isEditing && (
                          <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2 bg-gray-50/50">
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs font-medium text-gray-500 mr-1">Days:</span>
                              {(preset.days || []).map(d => <span key={d} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{d}</span>)}
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500">Time Slots ({(preset.timeSlots||[]).length}):</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(preset.timeSlots || []).map((s, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded flex items-center gap-1">
                                    <Clock className="w-3 h-3" />{s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EXPORTER HEADER EDITOR TAB ──────────────────────────────────── */}
        {activeTab === "exportHeader" && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider text-blue-200 mb-3 border border-white/15">
                  <Sparkles className="w-3.5 h-3.5" />
                  Admin Global Export Configuration
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                  Timetable Exporter Header Editor
                </h2>
                <p className="text-blue-100/90 text-sm leading-relaxed">
                  Customize the official Institute Name and Faculty subtitle printed in the header of all generated PDF timetables, room schedules, teacher occupancy reports, and master directories across the entire system.
                </p>
              </div>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden lg:flex items-center justify-center w-28 h-28 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm pointer-events-none">
                <FileText className="w-14 h-14 text-blue-200/50" />
              </div>
            </div>

            {headerLoading ? (
              <div className="bg-white rounded-xl p-12 border border-gray-200 shadow-sm flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-sm font-medium text-gray-600">Loading exporter header settings...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Form & Configuration */}
                <div className="lg:col-span-6 space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between border-b pb-4 mb-5">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-blue-600" />
                          Header Details
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Set the exact titles to render at the top of all documents.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetExportHeader}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                        title="Reset fields to default Institute & Faculty names"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Defaults
                      </button>
                    </div>

                    <form onSubmit={handleSaveExportHeader} className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          Institute Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={instituteName}
                          onChange={(e) => setInstituteName(e.target.value)}
                          placeholder="e.g., DAYALBAGH EDUCATIONAL INSTITUTE"
                          className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1.5">
                          Primary top headline printed in bold uppercase (Font Size: 13pt–16pt depending on layout).
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          Faculty / Sub-Header Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={facultyName}
                          onChange={(e) => setFacultyName(e.target.value)}
                          placeholder="e.g., ENGINEERING FACULTY"
                          className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1.5">
                          Secondary sub-header line displayed directly underneath the Institute Name.
                        </p>
                      </div>

                      {headerSavedMessage && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          {headerSavedMessage}
                        </div>
                      )}

                      <div className="pt-4 border-t flex items-center justify-between gap-3">
                        <button
                          type="submit"
                          disabled={headerSaving}
                          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
                        >
                          {headerSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving Changes...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              Save & Apply to All Exports
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Scope of Application Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-indigo-600" />
                      Applied Across All Export Modules
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-600 font-medium">
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/70">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Timetable Management (PDF/Doc)
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/70">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Room Occupancy (Full & Mobile)
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/70">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Teacher Occupancy & Schedules
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/70">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Class Occupancy (Full & Mobile)
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/70">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Room Availability (All Views)
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/70">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Staff & Course Directories
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Interactive Document Mockup */}
                <div className="lg:col-span-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between border-b pb-4 mb-4">
                      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        Live PDF Export Preview
                      </h3>
                      <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                        Real-time Layout
                      </span>
                    </div>

                    <div className="flex-1 bg-slate-100 border border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center">
                      {/* Document Sheet Simulation */}
                      <div className="w-full max-w-lg bg-white rounded-lg shadow-md border border-slate-300 p-6 flex flex-col transition-all">
                        {/* Branded Header */}
                        <div className="text-center space-y-1 pb-3">
                          <div 
                            className="font-bold tracking-tight text-slate-800 break-words"
                            style={{ fontSize: "15px", color: "rgb(30, 41, 59)" }}
                          >
                            {(instituteName || "DAYALBAGH EDUCATIONAL INSTITUTE").toUpperCase()}
                          </div>
                          <div 
                            className="font-bold tracking-normal break-words"
                            style={{ fontSize: "11px", color: "rgb(100, 116, 139)" }}
                          >
                            {(facultyName || "ENGINEERING FACULTY").toUpperCase()}
                          </div>
                          <div 
                            className="font-bold tracking-tight pt-1 break-words"
                            style={{ fontSize: "13px", color: "rgb(30, 41, 59)" }}
                          >
                            B.TECH. - COMPUTER SCIENCE & ENGINEERING - SEMESTER V
                          </div>
                        </div>

                        {/* Thin Divider Line matching exact PDF design */}
                        <div className="w-full h-[1px] bg-slate-200 my-2"></div>

                        {/* Sample Mini Table */}
                        <div className="mt-3 border border-slate-200 rounded overflow-hidden text-[10px]">
                          <div className="grid grid-cols-4 bg-slate-800 text-white font-bold text-center py-1 px-1">
                            <div>Period / Day</div>
                            <div>Monday</div>
                            <div>Tuesday</div>
                            <div>Wednesday</div>
                          </div>
                          <div className="grid grid-cols-4 border-t border-slate-200 text-center py-1.5 px-1 bg-slate-50 text-slate-700">
                            <div className="font-semibold text-slate-900">08:00 - 08:55</div>
                            <div className="text-blue-700 font-medium">CS-501 (LT-1)</div>
                            <div className="text-blue-700 font-medium">CS-502 (LT-2)</div>
                            <div className="text-blue-700 font-medium">CS-503 (LT-1)</div>
                          </div>
                          <div className="grid grid-cols-4 border-t border-slate-200 text-center py-1.5 px-1 bg-white text-slate-700">
                            <div className="font-semibold text-slate-900">08:55 - 09:50</div>
                            <div className="text-emerald-700 font-medium">CS-504 (Lab-A)</div>
                            <div className="text-blue-700 font-medium">CS-501 (LT-1)</div>
                            <div className="text-purple-700 font-medium">CS-505 (LT-3)</div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                          <span>A4 Landscape / Portrait</span>
                          <span>Formatting preserved 100%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── CREATE FACULTY MODAL (SUPER ADMIN ONLY) ────────────────────── */}
      {showCreateFacultyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                Add New Faculty & Isolated DB
              </h3>
              <button onClick={() => setShowCreateFacultyModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFaculty} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Faculty Name *</label>
                <input
                  type="text"
                  required
                  value={createFacultyForm.name}
                  onChange={(e) => setCreateFacultyForm({ ...createFacultyForm, name: e.target.value })}
                  placeholder="e.g. Faculty of Arts"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Full official name of the faculty / department.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Faculty Code</label>
                  <input
                    type="text"
                    value={createFacultyForm.code}
                    onChange={(e) => setCreateFacultyForm({ ...createFacultyForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. ARTS"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Short Slug</label>
                  <input
                    type="text"
                    value={createFacultyForm.slug || ""}
                    onChange={(e) => setCreateFacultyForm({ ...createFacultyForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    placeholder="e.g. arts"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Institute Name</label>
                <input
                  type="text"
                  value={createFacultyForm.institute_name}
                  onChange={(e) => setCreateFacultyForm({ ...createFacultyForm, institute_name: e.target.value })}
                  placeholder="DAYALBAGH EDUCATIONAL INSTITUTE"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={createFacultyForm.description}
                  onChange={(e) => setCreateFacultyForm({ ...createFacultyForm, description: e.target.value })}
                  placeholder="Brief description or notes for this faculty"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                />
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Database size={13} className="text-indigo-600" />
                  Automatic Database Isolation
                </div>
                <p className="text-[11px] text-indigo-700">
                  Creating this faculty provisions an isolated MongoDB database and default academic settings with zero data collision.
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={createFacultySubmitting}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {createFacultySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Faculty & Database
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateFacultyModal(false)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT FACULTY MODAL ───────────────────────────────────────────── */}
      {editingFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" />
                Edit Faculty Details
              </h3>
              <button onClick={() => setEditingFaculty(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateFaculty} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Faculty Name *</label>
                <input
                  type="text"
                  required
                  value={editingFaculty.name}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={editingFaculty.code || ""}
                    onChange={(e) => setEditingFaculty({ ...editingFaculty, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Database Name</label>
                  <input
                    type="text"
                    readOnly
                    value={editingFaculty.database_name || ""}
                    className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-sm font-mono text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Institute Name</label>
                <input
                  type="text"
                  value={editingFaculty.institute_name || "DAYALBAGH EDUCATIONAL INSTITUTE"}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, institute_name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingFaculty.description || ""}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, description: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={editFacultySubmitting}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {editFacultySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Faculty
                </button>
                <button
                  type="button"
                  onClick={() => setEditingFaculty(null)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE USER MODAL ────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Create New User Account
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Dr. A. K. Sharma"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="user@dei.ac.in"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned Role *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="timetable_incharge">Timetable Incharge</option>
                  <option value="hod">HOD (Head of Department)</option>
                  <option value="sub_admin">Sub Admin (Faculty Admin)</option>
                  {isSuperAdmin && <option value="admin">Super Admin (Institutional)</option>}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Faculty *</label>
                  {isSuperAdmin ? (
                    <select
                      value={createForm.faculty}
                      onChange={(e) => setCreateForm({ ...createForm, faculty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                      {faculties.map((f) => (
                        <option key={f.slug} value={f.slug}>{f.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      readOnly
                      value={currentUser?.faculty || "engineering"}
                      className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-sm text-gray-600 capitalize cursor-not-allowed"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={createForm.department}
                    onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                    placeholder="Electrical"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {createSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL ──────────────────────────────────────────────── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-600" />
                Edit User Details & Role
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned Role *</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="timetable_incharge">Timetable Incharge</option>
                  <option value="hod">HOD (Head of Department)</option>
                  <option value="sub_admin">Sub Admin (Faculty Admin)</option>
                  {isSuperAdmin && <option value="admin">Super Admin (Institutional)</option>}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Faculty</label>
                  {isSuperAdmin ? (
                    <select
                      value={editingUser.faculty || "engineering"}
                      onChange={(e) => setEditingUser({ ...editingUser, faculty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                      {faculties.map((f) => (
                        <option key={f.slug} value={f.slug}>{f.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      readOnly
                      value={editingUser.faculty || currentUser?.faculty || "engineering"}
                      className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-sm text-gray-600 capitalize cursor-not-allowed"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={editingUser.department || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD MODAL ────────────────────────────────────────── */}
      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600" />
                Change Password for {passwordUser.name}
              </h3>
              <button onClick={() => setPasswordUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-800 border border-amber-200">
                Updating password for <strong>{passwordUser.email}</strong>. User will use this new password to sign in immediately.
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 4 chars)"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {passwordSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  Update Password
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordUser(null)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      <Footer />
    </div>
  );
};

export default AdminSettings;
