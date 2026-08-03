import { apiFetch } from "../api";

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

let cachedTeachers = null;
let lastTeachersFetch = 0;
const CACHE_DURATION = 15000; // 15 seconds

export function clearTeachersCache() {
  cachedTeachers = null;
  lastTeachersFetch = 0;
}

export async function listTeachers({ faculty, department } = {}, forceRefresh = false) {
  const now = Date.now();
  if (cachedTeachers && !forceRefresh && (now - lastTeachersFetch < CACHE_DURATION)) {
    console.log("⚡ [listTeachers] Returning cached teachers, saved reads!");
    let result = cachedTeachers;
    if (faculty) {
      const normFaculty = normalize(faculty).toLowerCase();
      result = result.filter(t => normalize(t.faculty).toLowerCase() === normFaculty);
    }
    if (department) {
      const normDept = normalize(department).toLowerCase();
      result = result.filter(t => normalize(t.department).toLowerCase() === normDept);
    }
    return result;
  }
  
  const params = new URLSearchParams();
  if (faculty) params.append("faculty", faculty);
  if (department) params.append("department", department);
  const qs = params.toString();

  // When caching, fetch ALL teachers (no filters) so cache is complete
  const allTeachers = await apiFetch("/api/teachers");
  cachedTeachers = allTeachers;
  lastTeachersFetch = Date.now();

  let result = cachedTeachers;
  if (faculty) {
    const normFaculty = normalize(faculty).toLowerCase();
    result = result.filter(t => normalize(t.faculty).toLowerCase() === normFaculty);
  }
  if (department) {
    const normDept = normalize(department).toLowerCase();
    result = result.filter(t => normalize(t.department).toLowerCase() === normDept);
  }
  return result;
}

export async function upsertTeacher(teacher) {
  clearTeachersCache();
  const unid = teacher.unid ?? Date.now();
  const payload = {
    unid,
    ID: normalize(teacher.ID),
    name: normalize(teacher.name),
    faculty: normalize(teacher.faculty),
    department: normalize(teacher.department),
  };

  await apiFetch("/api/teachers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unid;
}

export async function deleteTeacher(unid) {
  clearTeachersCache();
  await apiFetch(`/api/teachers/${unid}`, { method: "DELETE" });
}

export async function listFaculties(forceRefresh = false) {
  const teachers = await listTeachers({}, forceRefresh);
  const set = new Set();
  teachers.forEach((t) => {
    const faculty = normalize(t.faculty);
    if (faculty) set.add(faculty);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function listDepartments(faculty, forceRefresh = false) {
  if (!faculty) return [];
  const teachers = await listTeachers({ faculty }, forceRefresh);
  const set = new Set();
  teachers.forEach((t) => {
    const department = normalize(t.department);
    if (department) set.add(department);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
