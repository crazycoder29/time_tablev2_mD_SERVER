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
