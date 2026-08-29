from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from app.models.models import SaveProgramsRequest, SaveBranchesRequest, SaveExportHeaderRequest
from app.core.database import settings_collection
from app.services.dependencies import get_current_user, require_role
from app.routes.audit_logs import log_action

router = APIRouter(prefix="/api/settings", tags=["settings"])

DEFAULT_EXPORT_HEADER = {
    "institutionName": "DAYALBAGH EDUCATIONAL INSTITUTE",
    "facultyName": "ENGINEERING FACULTY"
}


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


@router.get("/export-header")
async def get_export_header(user: dict = Depends(get_current_user)):
    doc = await settings_collection.find_one({"_id": "exportHeader"})
    if doc is None or "data" not in doc:
        return DEFAULT_EXPORT_HEADER
    return {
        "institutionName": doc["data"].get("institutionName", DEFAULT_EXPORT_HEADER["institutionName"]),
        "facultyName": doc["data"].get("facultyName", DEFAULT_EXPORT_HEADER["facultyName"]),
    }


@router.post("/export-header")
async def save_export_header(payload: SaveExportHeaderRequest, user: dict = Depends(require_role("admin", "tt_incharge"))):
    now = datetime.now(timezone.utc)
    header_data = {
        "institutionName": payload.institutionName.strip() or DEFAULT_EXPORT_HEADER["institutionName"],
        "facultyName": payload.facultyName.strip() or DEFAULT_EXPORT_HEADER["facultyName"],
    }
    doc = {"data": header_data, "updatedAt": now}
    await settings_collection.replace_one({"_id": "exportHeader"}, doc, upsert=True)
    await log_action(user, "update_settings", f"Export header updated: {header_data['institutionName']} / {header_data['facultyName']}")
    return header_data


@router.get("/all")
async def get_all_settings(user: dict = Depends(get_current_user)):
    programs_doc = await settings_collection.find_one({"_id": "programs"})
    branches_doc = await settings_collection.find_one({"_id": "branches"})
    export_header_doc = await settings_collection.find_one({"_id": "exportHeader"})
    
    header_data = DEFAULT_EXPORT_HEADER
    if export_header_doc and "data" in export_header_doc:
        header_data = {
            "institutionName": export_header_doc["data"].get("institutionName", DEFAULT_EXPORT_HEADER["institutionName"]),
            "facultyName": export_header_doc["data"].get("facultyName", DEFAULT_EXPORT_HEADER["facultyName"]),
        }

    return {
        "programs": (programs_doc or {}).get("list", []),
        "branches": (branches_doc or {}).get("list", []),
        "exportHeader": header_data,
    }