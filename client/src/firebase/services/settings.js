/**
 * Settings service — backed by local FastAPI backend
 */

import { apiFetch } from "../api";
import { setExportHeader } from "../../utils/exportSettings";

/**
 * Get all programs (class names like B.Tech, M.Tech)
 */
export async function getPrograms() {
  return await apiFetch("/api/settings/programs");
}

/**
 * Save programs list
 */
export async function savePrograms(programs) {
  await apiFetch("/api/settings/programs", {
    method: "POST",
    body: JSON.stringify({ programs }),
  });
}

/**
 * Get all branches with their associated programs
 */
export async function getBranches() {
  return await apiFetch("/api/settings/branches");
}

/**
 * Save branches list
 * Each branch has: { name, programs: [] }
 */
export async function saveBranches(branches) {
  await apiFetch("/api/settings/branches", {
    method: "POST",
    body: JSON.stringify({ branches }),
  });
}

/**
 * Get all settings at once
 */
export async function getAllSettings() {
  const data = await apiFetch("/api/settings/all");
  if (data && data.export_header) {
    setExportHeader(data.export_header);
  }
  return data;
}

/**
 * Get export header settings
 */
export async function getExportHeader() {
  const data = await apiFetch("/api/settings/export-header");
  if (data) {
    setExportHeader(data);
  }
  return data;
}

/**
 * Save export header settings (Admin only)
 */
export async function saveExportHeader(header) {
  const payload = {
    institute_name: header.institute_name || header.instituteName,
    faculty_name: header.faculty_name || header.facultyName,
  };
  const data = await apiFetch("/api/settings/export-header", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (data) {
    setExportHeader(data);
  }
  return data;
}
