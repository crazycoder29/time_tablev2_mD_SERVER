from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from app.models.models import CurriculumIn
from app.core.database import FacultyCollections
from app.services.dependencies import get_current_user, require_role, get_faculty_context
from app.services.timetable_helpers import normalize
from app.routes.audit_logs import log_action

router = APIRouter(prefix="/api/curriculums", tags=["curriculums"])


def generate_curriculum_id(class_name: str, branch: str, semester: str, type_: str) -> str:
    return normalize(f"{class_name}_{branch}_{semester}_{type_}")


def _strip_id(doc: dict) -> dict:
    doc_id = doc.pop("_id", None)
    if doc_id and "curriculumId" not in doc:
        doc["curriculumId"] = str(doc_id)
    return doc


@router.get("")
async def list_curriculums(
    user: dict = Depends(get_current_user),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    docs = await fc.curriculums.find().to_list(length=None)
    return [_strip_id(d) for d in docs]


@router.get("/{curriculum_id}")
async def get_curriculum(
    curriculum_id: str,
    user: dict = Depends(get_current_user),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    doc = await fc.curriculums.find_one({
        "$or": [{"_id": curriculum_id}, {"curriculumId": curriculum_id}, {"unid": curriculum_id}]
    })
    if doc is None:
        return None
    return _strip_id(doc)


@router.post("")
async def save_curriculum(
    payload: CurriculumIn,
    user: dict = Depends(require_role("admin", "sub_admin", "tt_incharge")),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    curriculum_id = generate_curriculum_id(payload.className, payload.branch, payload.semester, payload.type)
    now = datetime.now(timezone.utc)

    doc = {
        "curriculumId": curriculum_id,
        "class": normalize(payload.className),
        "branch": normalize(payload.branch),
        "semester": normalize(payload.semester),
        "type": normalize(payload.type),
        "courses": payload.courses or [],
        "updatedAt": now,
        "createdAt": now,
    }

    await fc.curriculums.update_one(
        {"$or": [{"_id": curriculum_id}, {"curriculumId": curriculum_id}, {"unid": curriculum_id}]}, 
        {"$set": doc}, 
        upsert=True
    )

    saved = await fc.curriculums.find_one({
        "$or": [{"_id": curriculum_id}, {"curriculumId": curriculum_id}, {"unid": curriculum_id}]
    })
    await log_action(user, "save_curriculum", f"Curriculum {curriculum_id} saved in '{fc.slug}'")
    return _strip_id(saved)


@router.delete("/{curriculum_id}", status_code=204)
async def delete_curriculum(
    curriculum_id: str,
    user: dict = Depends(require_role("admin", "sub_admin", "tt_incharge")),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    result = await fc.curriculums.delete_many({
        "$or": [{"_id": curriculum_id}, {"curriculumId": curriculum_id}, {"unid": curriculum_id}]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    await log_action(user, "delete_curriculum", f"Curriculum {curriculum_id} deleted in '{fc.slug}'")