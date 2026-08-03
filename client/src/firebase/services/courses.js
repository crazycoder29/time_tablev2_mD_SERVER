import { apiFetch } from "../api";

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

let cachedCourses = null;
let lastCoursesFetch = 0;
const CACHE_DURATION = 15000; // 15 seconds

export function clearCoursesCache() {
  cachedCourses = null;
  lastCoursesFetch = 0;
}

export async function listCourses({ faculty, department, semester } = {}, forceRefresh = false) {
  const now = Date.now();
  if (cachedCourses && !forceRefresh && (now - lastCoursesFetch < CACHE_DURATION)) {
    console.log("⚡ [listCourses] Returning cached courses, saved reads!");
    let result = cachedCourses;
    if (faculty) {
      const normFaculty = normalize(faculty).toLowerCase();
      result = result.filter(c => normalize(c.faculty).toLowerCase() === normFaculty);
    }
    if (department) {
      const normDept = normalize(department).toLowerCase();
      result = result.filter(c => normalize(c.department).toLowerCase() === normDept);
    }
    if (semester) {
      const normSem = normalize(semester).toLowerCase();
      result = result.filter(c => normalize(c.semester).toLowerCase() === normSem);
    }
    return result;
  }
  
  // Fetch ALL courses for caching
  const allCourses = await apiFetch("/api/courses");
  cachedCourses = allCourses;
  lastCoursesFetch = Date.now();
  
  let result = cachedCourses;
  if (faculty) {
    const normFaculty = normalize(faculty).toLowerCase();
    result = result.filter(c => normalize(c.faculty).toLowerCase() === normFaculty);
  }
  if (department) {
    const normDept = normalize(department).toLowerCase();
    result = result.filter(c => normalize(c.department).toLowerCase() === normDept);
  }
  if (semester) {
    const normSem = normalize(semester).toLowerCase();
    result = result.filter(c => normalize(c.semester).toLowerCase() === normSem);
  }
  return result;
}

export async function upsertCourse(course) {
  clearCoursesCache();
  const unid = course.unid ?? Date.now();
  const payload = {
    unid,
    ID: normalize(course.ID),
    name: normalize(course.name),
    code: normalize(course.code),
    credits: normalize(course.credits),
    teachers: Array.isArray(course.teachers) ? course.teachers : [],
    faculty: normalize(course.faculty),
    department: normalize(course.department),
    semester: normalize(course.semester),
    hasBatches: !!course.hasBatches,
    batches: Array.isArray(course.batches) ? course.batches : [],
    batchTeachers: course.batchTeachers || {},
    batchName: course.batchName || null,
    parentCourseId: course.parentCourseId || null,
  };

  const res = await apiFetch("/api/courses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res?.unid || unid;
}

export async function splitBatches({ courseUnid, batches }) {
  clearCoursesCache();
  return await apiFetch("/api/courses/split-batches", {
    method: "POST",
    body: JSON.stringify({ courseUnid, batches }),
  });
}

export async function deleteCourse(unid) {
  clearCoursesCache();
  await apiFetch(`/api/courses/${unid}`, { method: "DELETE" });
}

export async function listDepartments(faculty, forceRefresh = false) {
  if (!faculty) return [];
  const courses = await listCourses({ faculty }, forceRefresh);
  const set = new Set();
  courses.forEach((c) => {
    const department = normalize(c.department);
    if (department) set.add(department);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function listSemesters({ faculty, department } = {}, forceRefresh = false) {
  if (!faculty || !department) return [];
  const courses = await listCourses({ faculty, department }, forceRefresh);
  const set = new Set();
  courses.forEach((c) => {
    const semester = normalize(c.semester);
    if (semester) set.add(semester);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
