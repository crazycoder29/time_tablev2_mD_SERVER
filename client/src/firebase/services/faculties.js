import { apiFetch } from "../api";

/**
 * List all registered faculties
 */
export async function getFaculties() {
  try {
    return await apiFetch("/api/faculties");
  } catch (err) {
    console.error("Error fetching faculties:", err);
    return [
      {
        id: "engineering",
        name: "Faculty of Engineering",
        slug: "engineering",
        code: "ENG",
        description: "Dayalbagh Educational Institute Faculty of Engineering",
        database_name: "deitimetable",
        institute_name: "DAYALBAGH EDUCATIONAL INSTITUTE",
        current_semester: "odd",
        user_count: 0,
      },
    ];
  }
}

/**
 * Create a new faculty (Super Admin only)
 */
export async function createFaculty(data) {
  return await apiFetch("/api/faculties", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update faculty metadata (Super Admin only)
 */
export async function updateFaculty(slug, data) {
  return await apiFetch(`/api/faculties/${slug}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Delete a faculty (Super Admin only)
 */
export async function deleteFaculty(slug) {
  return await apiFetch(`/api/faculties/${slug}`, {
    method: "DELETE",
  });
}

/**
 * Switch faculty semester (odd / even)
 */
export async function switchFacultySemester(slug, semester) {
  return await apiFetch(`/api/faculties/${slug}/semester`, {
    method: "POST",
    body: JSON.stringify({ semester }),
  });
}

export const facultiesService = {
  getFaculties,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  switchFacultySemester,
};

export default facultiesService;
