import { apiFetch } from "../api";

/**
 * Server handles audit logging automatically on every write operation.
 */
export const logAction = async (action, details) => {
  // Server handles audit logging automatically
};

export const getRecentLogs = async (options = 30) => {
  try {
    let days = 30;
    let faculty = null;
    let action = null;

    if (typeof options === "number") {
      days = options;
    } else if (options && typeof options === "object") {
      days = options.days || 30;
      faculty = options.faculty || null;
      action = options.action || null;
    }

    const params = new URLSearchParams();
    params.set("days", Math.min(days, 30));
    if (faculty && faculty !== "all") params.set("faculty", faculty);
    if (action && action !== "all") params.set("action", action);

    const parseUtcDate = (val) => {
      if (!val) return new Date();
      if (val instanceof Date) return val;
      let str = String(val).trim();
      if (!str.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(str)) {
        str += "Z";
      }
      return new Date(str);
    };

    const logs = await apiFetch(`/api/audit-logs?${params.toString()}`);
    return (logs || []).map(log => ({
      ...log,
      timestamp: parseUtcDate(log.timestamp),
    }));
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return [];
  }

};
