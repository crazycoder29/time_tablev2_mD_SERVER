/**
 * Export Settings Utility
 * Centralizes the Institute Name & Faculty Name used across all PDF / Excel exports.
 * Defaults to "DAYALBAGH EDUCATIONAL INSTITUTE" and "ENGINEERING FACULTY".
 */

export const DEFAULT_EXPORT_HEADER = {
  instituteName: "DAYALBAGH EDUCATIONAL INSTITUTE",
  facultyName: "ENGINEERING FACULTY",
};

const STORAGE_KEY = "planovate_export_header";

let cachedHeader = null;

/**
 * Returns the current export header synchronously.
 * Reads from in-memory cache, then localStorage, falling back to default.
 */
export function getExportHeader() {
  if (cachedHeader) {
    return cachedHeader;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.instituteName || parsed.facultyName)) {
        cachedHeader = {
          instituteName: parsed.instituteName?.trim() || DEFAULT_EXPORT_HEADER.instituteName,
          facultyName: parsed.facultyName?.trim() || DEFAULT_EXPORT_HEADER.facultyName,
        };
        return cachedHeader;
      }
    }
  } catch (e) {
    // Ignore JSON parse / storage errors
  }
  return DEFAULT_EXPORT_HEADER;
}

/**
 * Sets and caches the export header locally.
 */
export function setExportHeader(header) {
  if (!header) return DEFAULT_EXPORT_HEADER;
  const instituteName = (header.instituteName || header.institute_name || "").trim() || DEFAULT_EXPORT_HEADER.instituteName;
  const facultyName = (header.facultyName || header.faculty_name || "").trim() || DEFAULT_EXPORT_HEADER.facultyName;

  cachedHeader = { instituteName, facultyName };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedHeader));
  } catch (e) {
    // Ignore storage quota errors
  }

  // Dispatch custom event for reactive components if needed
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("exportHeaderUpdated", { detail: cachedHeader }));
  }
  return cachedHeader;
}
