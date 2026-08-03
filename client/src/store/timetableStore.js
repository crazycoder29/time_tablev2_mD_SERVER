import { create } from 'zustand';
import { courseService, roomService, teacherService, timetableService, roomBookingService, teacherBookingService } from '../firebase/services';

/**
 * Zustand Store for Timetable Global State
 * 
 * Benefits:
 * - Data is fetched only once and shared across all components
 * - No re-fetching when switching between tabs
 * - Improved performance and reduced API calls
 * - Centralized state management
 */
const useTimetableStore = create((set, get) => ({
  // Options data
  courseOptions: [],
  teacherOptions: [],
  roomOptions: [],
  semesterOptions: [],
  // Raw objects (needed for curriculum-aware filtering in cells)
  allCoursesRaw: [],
  allTeachersRaw: [],
  allRoomsRaw: [],
  
  // Room bookings cache (roomId -> [{ day, time, timetableId, class, branch }])
  roomBookings: {},
  isRoomBookingsLoaded: false,
  isLoadingRoomBookings: false,
  
  // Teacher bookings cache (teacherId -> [{ day, time, timetableId, class, branch }])
  teacherBookings: {},
  isTeacherBookingsLoaded: false,
  isLoadingTeacherBookings: false,
  
  // Timetables cache
  allTimetables: [],
  isTimetablesLoaded: false,
  isLoadingTimetables: false,
  
  // Loading states
  isOptionsLoaded: false,
  isLoadingOptions: false,
  
  // Fetch options (called once)
  fetchOptions: async () => {
    // If already loaded or currently loading, skip
    if (get().isOptionsLoaded || get().isLoadingOptions) {
      return;
    }
    
    set({ isLoadingOptions: true });
    
    try {
      const [courses, teachers, rooms] = await Promise.all([
        courseService.listCourses(),
        teacherService.listTeachers(),
        roomService.listRooms(),
      ]);

      const courseOptions = (courses ?? [])
        .map((c) => c?.ID || c?.code || c?.name || "")
        .filter(Boolean);

      const semesterOptions = Array.from(
        new Set(
          (courses ?? [])
            .map((c) => String(c?.semester ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));

      const teacherOptions = (teachers ?? [])
        .map((t) => t?.ID || t?.name || t?.unid || "")
        .filter(Boolean);

      const roomOptions = (rooms ?? [])
        .map((r) => {
          if (r?.ID && r?.faculty) {
            return `${r.ID} ${r.faculty}`;
          }
          return r?.ID || r?.name || r?.unid || "";
        })
        .filter(Boolean);

      set({
        courseOptions,
        semesterOptions,
        teacherOptions,
        roomOptions,
        allCoursesRaw: courses ?? [],
        allTeachersRaw: teachers ?? [],
        allRoomsRaw: rooms ?? [],
        isOptionsLoaded: true,
        isLoadingOptions: false,
      });
    } catch (error) {
      console.error("Error loading options:", error);
      set({ isLoadingOptions: false });
    }
  },
  
  // Reset/refetch if needed
  refetchOptions: async () => {
    set({ isOptionsLoaded: false });
    await get().fetchOptions();
  },
  
  // Fetch room bookings from schedules collection
  fetchRoomBookings: async () => {
    if (get().isLoadingRoomBookings) return;
    
    set({ isLoadingRoomBookings: true });
    
    try {
      const bookings = await roomBookingService.getAllRoomBookings();
      set({
        roomBookings: bookings || {},
        isRoomBookingsLoaded: true,
        isLoadingRoomBookings: false,
      });
    } catch (error) {
      console.error("Error loading room bookings:", error);
      set({ isLoadingRoomBookings: false });
    }
  },
  
  // Force refresh room bookings (e.g., after saving a timetable)
  refetchRoomBookings: async () => {
    set({ isRoomBookingsLoaded: false });
    await get().fetchRoomBookings();
  },

  // Fetch teacher bookings from schedules collection
  fetchTeacherBookings: async () => {
    if (get().isLoadingTeacherBookings) return;
    
    set({ isLoadingTeacherBookings: true });
    
    try {
      const bookings = await teacherBookingService.getAllTeacherBookings();
      set({
        teacherBookings: bookings || {},
        isTeacherBookingsLoaded: true,
        isLoadingTeacherBookings: false,
      });
    } catch (error) {
      console.error("Error loading teacher bookings:", error);
      set({ isLoadingTeacherBookings: false });
    }
  },
  
  // Force refresh teacher bookings (e.g., after saving a timetable)
  refetchTeacherBookings: async () => {
    set({ isTeacherBookingsLoaded: false });
    await get().fetchTeacherBookings();
  },
  
  // Fetch all timetables (for browse modal)
  fetchTimetables: async () => {
    // If already loaded or currently loading, skip
    if (get().isTimetablesLoaded || get().isLoadingTimetables) {
      return;
    }
    
    set({ isLoadingTimetables: true });
    
    try {
      const timetables = await timetableService.listTimetables();
      set({
        allTimetables: timetables || [],
        isTimetablesLoaded: true,
        isLoadingTimetables: false,
      });
    } catch (error) {
      console.error("Error loading timetables:", error);
      set({ isLoadingTimetables: false });
    }
  },
  
  // Reset/refetch timetables if needed
  refetchTimetables: async () => {
    set({ isTimetablesLoaded: false });
    await get().fetchTimetables();
  },
}));

export default useTimetableStore;

