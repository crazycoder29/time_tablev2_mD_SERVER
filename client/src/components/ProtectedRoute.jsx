import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children }) => {
  const { user, role, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-gray-500 font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Restrict Admin and Sub-Admin routes
  const adminOnlyRoutes = ["/admin-settings", "/audit-logs"];
  if (adminOnlyRoutes.includes(location.pathname) && role !== "admin" && role !== "sub_admin") {
    return <Navigate to="/" replace />;
  }

  // Restrict Assign Load route to HOD, Sub-Admin and Admin accounts only
  if (location.pathname === "/assign-load" && role !== "admin" && role !== "sub_admin" && role !== "hod") {
    return <Navigate to="/" replace />;
  }


  return children;
};

export default ProtectedRoute;
