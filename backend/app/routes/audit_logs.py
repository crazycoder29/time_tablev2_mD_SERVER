from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query

from app.core.database import audit_logs_collection
from app.services.dependencies import get_current_user, require_role

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


async def log_action(user: dict, action: str, details: str) -> None:
    """
    Mirrors logAction from auditLogs.js. Fire-and-forget by design —
    original wraps this in try/except and only console.errors on failure,
    never lets a logging failure break the actual write it's attached to.
    Callers should NOT await-and-raise; call this, don't let it block the
    real response if it fails.
    """
    try:
        user_email = (user or {}).get("email") or "Unknown/System"
        await audit_logs_collection.insert_one({
            "user": user_email,
            "action": action,
            "details": details,
            "timestamp": datetime.now(timezone.utc),
        })
    except Exception as e:
        print(f"Error logging action: {e}")


@router.get("")
async def get_recent_logs(days: int = Query(30), user: dict = Depends(require_role("admin"))):
    past_date = datetime.now(timezone.utc) - timedelta(days=days)
    cursor = audit_logs_collection.find(
        {"timestamp": {"$gte": past_date}}
    ).sort("timestamp", -1)

    docs = await cursor.to_list(length=None)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return docs