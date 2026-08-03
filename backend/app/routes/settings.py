from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from app.models.models import SaveProgramsRequest, SaveBranchesRequest
from app.core.database import settings_collection
from app.services.dependencies import get_current_user, require_role
from app.routes.audit_logs import log_action

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/programs")
async def get_programs(user: dict = Depends(get_current_user)):
    doc = await settings_collection.find_one({"_id": "programs"})
    if doc is None:
        return []
    return doc.get("list", [])


@router.post("/programs")
async def save_programs(payload: SaveProgramsRequest, user: dict = Depends(require_role("admin", "tt_incharge"))):
    now = datetime.now(timezone.utc)
    doc = {"list": payload.programs, "updatedAt": now}
    await settings_collection.replace_one({"_id": "programs"}, doc, upsert=True)
    await log_action(user, "update_settings", "Programs list updated")
    return doc.get("list", [])


@router.get("/branches")
async def get_branches(user: dict = Depends(get_current_user)):
    doc = await settings_collection.find_one({"_id": "branches"})
    if doc is None:
        return []
    return doc.get("list", [])


@router.post("/branches")
async def save_branches(payload: SaveBranchesRequest, user: dict = Depends(require_role("admin", "tt_incharge"))):
    now = datetime.now(timezone.utc)
    branch_list = [b.model_dump() for b in payload.branches]
    doc = {"list": branch_list, "updatedAt": now}
    await settings_collection.replace_one({"_id": "branches"}, doc, upsert=True)
    await log_action(user, "update_settings", "Branches list updated")
    return branch_list


@router.get("/all")
async def get_all_settings(user: dict = Depends(get_current_user)):
    programs_doc = await settings_collection.find_one({"_id": "programs"})
    branches_doc = await settings_collection.find_one({"_id": "branches"})
    return {
        "programs": (programs_doc or {}).get("list", []),
        "branches": (branches_doc or {}).get("list", []),
    }