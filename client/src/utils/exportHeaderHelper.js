/**
 * Centralized helper for export document headers (Institution Name, Faculty/Department Name).
 * Provides cached synchronous access for PDF/Excel/Word generators and asynchronous fetching
 * from the FastAPI backend settings API.
 */

import { getExportHeader } from "../firebase/services/settings";

export const DEFAULT_EXPORT_HEADER = {
  institutionName: "DAYALBAGH EDUCATIONAL INSTITUTE",
  facultyName: "ENGINEERING FACULTY",
};

const STORAGE_KEY = "dei_export_header_settings";

let cachedExportHeader = null;

/**
 * Get current cached export header settings synchronously.
 * Falls back to localStorage, then default values.
 */
export function getCachedExportHeader() {
  if (cachedExportHeader) return cachedExportHeader;

  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        cachedExportHeader = {
          institutionName: parsed.institutionName?.trim() || DEFAULT_EXPORT_HEADER.institutionName,
          facultyName: parsed.facultyName?.trim() || DEFAULT_EXPORT_HEADER.facultyName,
        };
        return cachedExportHeader;
      }
    }
  } catch (e) {
    console.error("Error reading export header from storage:", e);
  }

  cachedExportHeader = { ...DEFAULT_EXPORT_HEADER };
  return cachedExportHeader;
}

/**
 * Set and save cached export header settings to localStorage and notify listeners.
 */
export function setCachedExportHeader(header) {
  cachedExportHeader = {
    institutionName: header?.institutionName?.trim() || DEFAULT_EXPORT_HEADER.institutionName,
    facultyName: header?.facultyName?.trim() || DEFAULT_EXPORT_HEADER.facultyName,
  };

  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedExportHeader));
      window.dispatchEvent(new CustomEvent("exportHeaderUpdated", { detail: cachedExportHeader }));
    }
  } catch (e) {
    console.error("Error saving export header to storage:", e);
  }

  return cachedExportHeader;
}

/**
 * Fetch the latest export header settings from the backend and update the cache.
 */
export async function fetchExportHeader() {
  try {
    const data = await getExportHeader();
    if (data && typeof data === "object") {
      return setCachedExportHeader(data);
    }
  } catch (err) {
    console.warn("Failed to fetch export header from server, using local cache/defaults:", err);
  }
  return getCachedExportHeader();
}

/**
 * Resolves the export header from an optional override parameter or cached settings.
 */
export function resolveExportHeader(override) {
  const current = getCachedExportHeader();
  return {
    institutionName: override?.institutionName?.trim() || current.institutionName || DEFAULT_EXPORT_HEADER.institutionName,
    facultyName: override?.facultyName?.trim() || current.facultyName || DEFAULT_EXPORT_HEADER.facultyName,
  };
}
