import { create } from "zustand";
import { apiFetch } from "../firebase/api";

export const useAuthStore = create((set) => ({
  user: null,
  role: null,
  loading: true,
  error: null,
  
  initializeAuth: () => {
    // Check localStorage for existing session
    const token = localStorage.getItem("access_token");
    const storedUser = localStorage.getItem("user_data");

    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        set({ user: userData, role: userData.role || "admin", loading: false });
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_data");
        set({ user: null, role: null, loading: false });
      }
    } else {
      set({ user: null, role: null, loading: false });
    }

    // Return a no-op unsubscribe to match Firebase onAuthStateChanged interface
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

      set({ user, role: user.role || "admin", loading: false });
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

  // Password reset is not supported by the local backend yet.
  // Uncomment and implement when a backend route is added.
  // resetPassword: async (email) => {
  //   set({ loading: true, error: null });
  //   try {
  //     await apiFetch("/api/auth/reset-password", {
  //       method: "POST",
  //       body: JSON.stringify({ email }),
  //     });
  //     set({ loading: false });
  //   } catch (error) {
  //     const errorMessage = error.message || "Failed to send password reset email.";
  //     set({ error: errorMessage, loading: false });
  //     throw new Error(errorMessage);
  //   }
  // },
}));
