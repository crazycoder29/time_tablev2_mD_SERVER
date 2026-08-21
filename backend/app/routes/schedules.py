from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query

from app.models.models import SaveSchedulesRequest
from app.core.database import FacultyCollections
from app.services.dependencies import get_current_user, require_role, get_faculty_context
from app.services.timetable_helpers import normalize, safe_id

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


def schedule_doc_id(timetable_id: str, table_id: str, row_index: int, col_index: int, batch_index: int) -> str:
    return safe_id(f"{timetable_id}__{table_id}-{row_index}-{col_index}-{batch_index}")


def _strip_id(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_schedules_by_timetable(
    timetableId: str = Query(...),
    user: dict = Depends(get_current_user),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    docs = await fc.schedules.find({"timetableId": str(timetableId)}).to_list(length=None)
    return [_strip_id(d) for d in docs]


@router.get("/public-all")
async def list_public_schedules(fc: FacultyCollections = Depends(get_faculty_context)):
    docs = await fc.schedules.find().to_list(length=None)
    return [_strip_id(d) for d in docs]


@router.get("/all")
async def list_all_schedules(
    user: dict = Depends(get_current_user),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    docs = await fc.schedules.find().to_list(length=None)
    return [_strip_id(d) for d in docs]


@router.post("")
async def save_schedules(
    payload: SaveSchedulesRequest,
    user: dict = Depends(require_role("admin", "sub_admin", "tt_incharge")),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    timetable_id = payload.timetableId
    if not timetable_id:
        raise HTTPException(status_code=400, detail="timetableId is required")

    existing_docs = await fc.schedules.find({"timetableId": timetable_id}).to_list(length=None)
    existing_ids = {d["_id"] for d in existing_docs}

    now = datetime.now(timezone.utc)
    new_ids = set()

    for s in payload.schedules:
        doc_id = schedule_doc_id(timetable_id, s.tableId, s.rowIndex, s.colIndex, s.batchIndex)
        new_ids.add(doc_id)

        doc = {
            "timetableId": timetable_id,
            "tableId": normalize(s.tableId),
            "rowIndex": s.rowIndex,
            "colIndex": s.colIndex,
            "batchIndex": s.batchIndex,
            "day": normalize(s.day),
            "time": normalize(s.time),
            "class": normalize(s.class_),
            "branch": normalize(s.branch),
            "batch": normalize(s.batch),
            "type": normalize(s.type),
            "updatedAt": now,
            "courseId": str(s.courseId) if s.courseId else "",
            "teacherId": str(s.teacherId) if s.teacherId else "",
            "roomId": str(s.roomId) if s.roomId else "",
        }
        if s.remark is not None:
            doc["remark"] = s.remark

        await fc.schedules.update_one({"_id": doc_id}, {"$set": doc}, upsert=True)

    # delete orphaned entries
    orphaned = existing_ids - new_ids
    if orphaned:
        await fc.schedules.delete_many({"_id": {"$in": list(orphaned)}})

    return {"saved": len(new_ids), "deleted": len(orphaned)}


@router.delete("/by-timetable/{timetable_id}", status_code=204)
async def delete_schedules_by_timetable(
    timetable_id: str,
    user: dict = Depends(require_role("admin", "sub_admin", "tt_incharge")),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    await fc.schedules.delete_many({"timetableId": timetable_id})


@router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: str,
    user: dict = Depends(require_role("admin", "sub_admin", "tt_incharge")),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    result = await fc.schedules.delete_one({"_id": schedule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")