/**
 * Settings service — backed by local FastAPI backend
 */

import { apiFetch } from "../api";

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
  return await apiFetch("/api/settings/all");
}

/**
 * Get export document header settings (institution name, faculty name)
 */
export async function getExportHeader() {
  return await apiFetch("/api/settings/export-header");
}

/**
 * Save export document header settings
 */
export async function saveExportHeader({ institutionName, facultyName }) {
  return await apiFetch("/api/settings/export-header", {
    method: "POST",
    body: JSON.stringify({ institutionName, facultyName }),
  });
}
