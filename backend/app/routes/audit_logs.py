from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query

from app.core.database import audit_logs_collection, normalize_faculty_slug
from app.services.dependencies import get_current_user, require_role

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


async def ensure_audit_log_ttl_index():
    """Ensure TTL index exists to automatically delete audit logs older than 30 days."""
    try:
        await audit_logs_collection.create_index(
            "timestamp",
            expireAfterSeconds=30 * 86400,  # 30 days = 2,592,000 seconds
            name="audit_logs_30_days_ttl"
        )
    except Exception as e:
        print(f"Notice: TTL index creation on audit_logs: {e}")


async def log_action(user: dict, action: str, details: str, faculty: str = "") -> None:
    """
    Log an administrative or system action.
    Stored for exactly 30 days before automatic deletion.
    """
    try:
        user_email = (user or {}).get("email") or "Unknown/System"
        user_role = (user or {}).get("role") or "system"
        user_faculty = faculty or (user or {}).get("faculty") or "engineering"
        user_faculty_slug = normalize_faculty_slug(user_faculty)

        now = datetime.now(timezone.utc)
        await audit_logs_collection.insert_one({
            "user": user_email,
            "user_role": user_role,
            "faculty": user_faculty_slug,
            "faculty_name": user_faculty.replace("_", " ").title(),
            "action": action.upper().strip(),
            "details": details,
            "timestamp": now,
        })
    except Exception as e:
        print(f"Error logging action: {e}")


@router.get("")
async def get_recent_logs(
    days: int = Query(30, ge=1, le=30),
    faculty: str | None = Query(None, description="Faculty filter for Super Admin ('all' or slug)"),
    action: str | None = Query(None, description="Action filter"),
    user: dict = Depends(require_role("admin", "sub_admin")),
):
    """
    Fetch audit logs from the last 30 days.
    - Super Admin: Can view all logs across all faculties or filter by faculty.
    - Sub Admin: Strictly scoped to their assigned faculty only.
    - Autodeletes logs older than 30 days.
    """
    # 1. Hard cleanup of any records older than 30 days
    cutoff_30_days = datetime.now(timezone.utc) - timedelta(days=30)
    try:
        await audit_logs_collection.delete_many({"timestamp": {"$lt": cutoff_30_days}})
    except Exception:
        pass

    # 2. Build query filter
    query_start = datetime.now(timezone.utc) - timedelta(days=days)
    query = {"timestamp": {"$gte": query_start}}

    user_role = user.get("role")
    if user_role == "sub_admin":
        # Sub Admin: Strictly scoped to their own faculty
        user_fac = user.get("faculty") or "engineering"
        user_fac_slug = normalize_faculty_slug(user_fac)
        query["$or"] = [
            {"faculty": user_fac_slug},
            {"faculty": user_fac},
            {"faculty": {"$regex": f"^{user_fac_slug}$", "$options": "i"}},
            {"faculty": {"$regex": f"^{user_fac}$", "$options": "i"}},
        ]
    elif user_role == "admin":
        # Super Admin: Can view all or filter by a specific faculty
        if faculty and faculty.lower() != "all":
            fac_slug = normalize_faculty_slug(faculty)
            query["$or"] = [
                {"faculty": fac_slug},
                {"faculty": faculty},
                {"faculty": {"$regex": f"^{fac_slug}$", "$options": "i"}},
                {"faculty": {"$regex": f"^{faculty}$", "$options": "i"}},
            ]

    if action and action.lower() != "all":
        query["action"] = action.upper().strip()

    cursor = audit_logs_collection.find(query).sort("timestamp", -1).limit(500)
    docs = await cursor.to_list(length=None)

    for d in docs:
        d["id"] = str(d.pop("_id"))
        ts = d.get("timestamp")
        if isinstance(ts, datetime):
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            d["timestamp"] = ts.isoformat()
        elif isinstance(ts, str):
            if not ts.endswith("Z") and "+" not in ts and "-" not in ts[-6:]:
                d["timestamp"] = f"{ts}Z"
        if "faculty" not in d:
            d["faculty"] = "engineering"
        if "faculty_name" not in d:
            d["faculty_name"] = d["faculty"].replace("_", " ").title()

    return docs