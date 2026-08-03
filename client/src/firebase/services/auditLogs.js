import { apiFetch } from "../api";

/**
 * No-op: the backend logs actions server-side on every write operation.
 * Kept as export so existing callers don't break.
 */
export const logAction = async (action, details) => {
  // Server handles audit logging automatically
};

export const getRecentLogs = async (days = 30) => {
  try {
    const logs = await apiFetch(`/api/audit-logs?days=${days}`);
    return (logs || []).map(log => ({
      ...log,
      timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
    }));
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return [];
  }
};
