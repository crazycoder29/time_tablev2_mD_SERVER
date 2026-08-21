from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from app.models.models import SaveProgramsRequest, SaveBranchesRequest, ExportHeaderSettings
from app.core.database import FacultyCollections
from app.services.dependencies import get_current_user, require_role, get_faculty_context
from app.routes.audit_logs import log_action

router = APIRouter(prefix="/api/settings", tags=["settings"])

DEFAULT_EXPORT_HEADER = {
    "institute_name": "DAYALBAGH EDUCATIONAL INSTITUTE",
    "faculty_name": "ENGINEERING FACULTY",
}


@router.get("/programs")
async def get_programs(
    user: dict = Depends(get_current_user),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    doc = await fc.settings.find_one({"_id": "programs"})
    if doc is None:
        return []
    return doc.get("list", [])


@router.post("/programs")
async def save_programs(
    payload: SaveProgramsRequest,
    user: dict = Depends(require_role("admin", "sub_admin", "tt_incharge")),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    now = datetime.now(timezone.utc)
    doc = {"list": payload.programs, "updatedAt": now}
    await fc.settings.replace_one({"_id": "programs"}, doc, upsert=True)
    await log_action(user, "update_settings", f"Programs list updated for faculty '{fc.slug}'")
    return doc.get("list", [])


@router.get("/branches")
async def get_branches(
    user: dict = Depends(get_current_user),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    doc = await fc.settings.find_one({"_id": "branches"})
    if doc is None:
        return []
    return doc.get("list", [])


@router.post("/branches")
async def save_branches(
    payload: SaveBranchesRequest,
    user: dict = Depends(require_role("admin", "sub_admin", "tt_incharge")),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    now = datetime.now(timezone.utc)
    branch_list = [b.model_dump() for b in payload.branches]
    doc = {"list": branch_list, "updatedAt": now}
    await fc.settings.replace_one({"_id": "branches"}, doc, upsert=True)
    await log_action(user, "update_settings", f"Branches list updated for faculty '{fc.slug}'")
    return branch_list


@router.get("/export-header")
async def get_export_header(
    user: dict = Depends(get_current_user),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    doc = await fc.settings.find_one({"_id": "export_header"})
    if doc is None:
        return {
            "institute_name": DEFAULT_EXPORT_HEADER["institute_name"],
            "faculty_name": fc.slug.upper().replace("_", " "),
        }
    return {
        "institute_name": doc.get("institute_name", DEFAULT_EXPORT_HEADER["institute_name"]),
        "faculty_name": doc.get("faculty_name", fc.slug.upper().replace("_", " ")),
    }


@router.post("/export-header")
async def save_export_header(
    payload: ExportHeaderSettings,
    user: dict = Depends(require_role("admin", "sub_admin")),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    now = datetime.now(timezone.utc)
    inst_name = payload.institute_name.strip() if payload.institute_name else DEFAULT_EXPORT_HEADER["institute_name"]
    fac_name = payload.faculty_name.strip() if payload.faculty_name else fc.slug.upper().replace("_", " ")
    doc = {
        "institute_name": inst_name,
        "faculty_name": fac_name,
        "updatedAt": now,
    }
    await fc.settings.replace_one({"_id": "export_header"}, doc, upsert=True)
    await log_action(user, "update_export_header", f"Export header updated for '{fc.slug}': {inst_name} | {fac_name}")
    return {
        "institute_name": inst_name,
        "faculty_name": fac_name,
    }


@router.get("/all")
async def get_all_settings(
    user: dict = Depends(get_current_user),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    programs_doc = await fc.settings.find_one({"_id": "programs"})
    branches_doc = await fc.settings.find_one({"_id": "branches"})
    header_doc = await fc.settings.find_one({"_id": "export_header"})
    return {
        "programs": (programs_doc or {}).get("list", []),
        "branches": (branches_doc or {}).get("list", []),
        "export_header": {
            "institute_name": (header_doc or {}).get("institute_name", DEFAULT_EXPORT_HEADER["institute_name"]),
            "faculty_name": (header_doc or {}).get("faculty_name", fc.slug.upper().replace("_", " ")),
        },
    }
