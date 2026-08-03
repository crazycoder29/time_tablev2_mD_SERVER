import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./index.css";
import TeacherLoad from "./pages/TeacherLoad";
import Home from "./pages/Home";
import CourseLoad from "./pages/CourseLoad";
import RoomLoad from "./pages/RoomLoad";
import Curriculum from "./pages/Curriculum";
import Timetable from "./pages/TimetableManagement";
import BulkUpload from "./pages/BulkUpload";
import Manage from "./pages/Manage";
import RoomOccupancy from "./pages/RoomOccupancy";
import TeacherOccupancy from "./pages/TeacherOccupancy";
import ClassOccupancy from "./pages/ClassOccupancy";
import AdminSettings from "./pages/AdminSettings";
import ManageAllCourses from "./pages/ManageAllCourses";
import AssignLoad from "./pages/AssignLoad";
// import DataMigration from "./temp/DataMigration";
import Login from "./pages/Login";
import AuditLogs from "./pages/AuditLogs";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuthStore } from "./store/authStore";

const AppRoutes = () => {
  const initializeAuth = useAuthStore(state => state.initializeAuth);

  useEffect(() => {
    const unsubscribe = initializeAuth();
    return () => unsubscribe();
  }, [initializeAuth]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/teacher-load" element={<ProtectedRoute><TeacherLoad /></ProtectedRoute>} />
        <Route path="/course-load" element={<ProtectedRoute><CourseLoad /></ProtectedRoute>} />
        <Route path="/room-load" element={<ProtectedRoute><RoomLoad /></ProtectedRoute>} />
        <Route path="/curriculum" element={<ProtectedRoute><Curriculum /></ProtectedRoute>} />
        <Route path="/timetable" element={<ProtectedRoute><Timetable /></ProtectedRoute>} />
        <Route path="/room-occupancy" element={<ProtectedRoute><RoomOccupancy /></ProtectedRoute>} />
        <Route path="/teacher-occupancy" element={<ProtectedRoute><TeacherOccupancy /></ProtectedRoute>} />
        <Route path="/class-occupancy" element={<ProtectedRoute><ClassOccupancy /></ProtectedRoute>} />
        <Route path="/manage" element={<ProtectedRoute><Manage /></ProtectedRoute>} />
        <Route path="/admin-settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
        <Route path="/manage-all-courses" element={<ProtectedRoute><ManageAllCourses /></ProtectedRoute>} />
        <Route path="/assign-load" element={<ProtectedRoute><AssignLoad /></ProtectedRoute>} />
        <Route path="/bulk-upload" element={<ProtectedRoute><BulkUpload /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
        {/* <Route path="/data-migration" element={<ProtectedRoute><DataMigration /></ProtectedRoute>} /> */}
      </Routes>
    </Router>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppRoutes />
  </React.StrictMode>
);
