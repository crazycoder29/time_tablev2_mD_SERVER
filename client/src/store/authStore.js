import { create } from "zustand";
import { apiFetch } from "../firebase/api";

export const useAuthStore = create((set, get) => ({
  user: null,
  role: null,
  activeFaculty: localStorage.getItem("planovate_active_faculty") || "engineering",
  activeSemester: localStorage.getItem("planovate_active_semester") || "odd",
  loading: true,
  error: null,
  
  setActiveFaculty: (slug) => {
    localStorage.setItem("planovate_active_faculty", slug);
    set({ activeFaculty: slug });
  },

  setActiveSemester: (sem) => {
    const normalized = sem === "even" ? "even" : "odd";
    localStorage.setItem("planovate_active_semester", normalized);
    set({ activeSemester: normalized });
  },

  initializeAuth: () => {
    // Check localStorage for existing session
    const token = localStorage.getItem("access_token");
    const storedUser = localStorage.getItem("user_data");
    const storedFaculty = localStorage.getItem("planovate_active_faculty") || "engineering";
    const storedSemester = localStorage.getItem("planovate_active_semester") || "odd";

    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        const currentFaculty = userData.faculty || storedFaculty || "engineering";
        set({
          user: userData,
          role: userData.role || "admin",
          activeFaculty: userData.role === "admin" ? (storedFaculty || "engineering") : currentFaculty,
          activeSemester: storedSemester,
          loading: false,
        });
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_data");
        set({ user: null, role: null, activeFaculty: "engineering", activeSemester: "odd", loading: false });
      }
    } else {
      set({ user: null, role: null, activeFaculty: "engineering", activeSemester: "odd", loading: false });
    }

    // Return a no-op unsubscribe
    return () => {};
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const { access_token, user } = data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("user_data", JSON.stringify(user));

      const faculty = user.faculty || localStorage.getItem("planovate_active_faculty") || "engineering";
      if (user.faculty && user.role !== "admin") {
        localStorage.setItem("planovate_active_faculty", user.faculty);
      }

      set({
        user,
        role: user.role || "admin",
        activeFaculty: user.role === "admin" ? (localStorage.getItem("planovate_active_faculty") || "engineering") : (user.faculty || "engineering"),
        activeSemester: localStorage.getItem("planovate_active_semester") || "odd",
        loading: false,
      });
      return user;
    } catch (error) {
      const errorMessage = error.message || "Failed to log in.";
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  signUpTeacher: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          name: email.split("@")[0],
          role: "teacher",
        }),
      });

      const { access_token, user } = data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("user_data", JSON.stringify(user));

      set({ user, role: "teacher", loading: false });
      return user;
    } catch (error) {
      const errorMessage = error.message || "Failed to sign up.";
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_data");
      set({ user: null, role: null, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
}));
