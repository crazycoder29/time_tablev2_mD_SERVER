from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from app.models.models import TimetableMetaIn, SaveTimetableRequest
from app.core.database import timetables_collection, schedules_collection
from app.services.dependencies import get_current_user, require_role
from app.routes.audit_logs import log_action
from app.services.timetable_helpers import (
    normalize,
    generate_timetable_id,
    prepare_timetable_payload,
    build_schedule_occurrences,
    reconstruct_timetable_from_schedules,
    DEFAULT_DAYS,
)
from app.routes.schedules import schedule_doc_id

router = APIRouter(prefix="/api/timetables", tags=["timetables"])


def _strip_id(doc: dict) -> dict:
    doc_id = doc.pop("_id", None)
    if doc_id:
        if "timetableId" not in doc:
            doc["timetableId"] = str(doc_id)
        if "unid" not in doc:
            doc["unid"] = str(doc_id)
    return doc


@router.get("")
async def list_timetables(
    faculty: str | None = None,
    department: str | None = None,
    semester: str | None = None,
    user: dict = Depends(get_current_user),
):
    query = {}
    if faculty:
        query["faculty"] = normalize(faculty)
    if department:
        query["department"] = normalize(department)
    if semester:
        query["semester"] = normalize(semester)

    docs = await timetables_collection.find(query).sort("updatedAt", -1).limit(50).to_list(length=None)
    return [_strip_id(d) for d in docs]


@router.get("/all-meta")
async def list_all_timetables_meta(user: dict = Depends(get_current_user)):
    docs = [_strip_id(d) for d in await timetables_collection.find().to_list(length=None)]

    def sort_key(d):
        try:
            sem = float(d.get("semester") or 0)
        except ValueError:
            sem = 0
        return (d.get("class", ""), d.get("branch", ""), sem)

    docs.sort(key=sort_key)
    return docs


@router.get("/{timetable_id}")
async def load_timetable(timetable_id: str, user: dict = Depends(get_current_user)):
    meta = await timetables_collection.find_one({
        "$or": [{"_id": timetable_id}, {"timetableId": timetable_id}, {"unid": timetable_id}]
    })
    if meta is None:
        return None
    meta = _strip_id(meta)

    schedules = [_strip_id(s) for s in await schedules_collection.find({"timetableId": timetable_id}).to_list(length=None)]
    batches_by_table, batch_data_by_table = reconstruct_timetable_from_schedules(schedules)
    tables = list(batches_by_table.keys()) or ["Table 1"]

    return {
        "meta": meta,
        "tables": tables,
        "days": meta.get("days") or DEFAULT_DAYS,
        "timeSlots": meta.get("timeSlots") or [],
        "batchesByTable": batches_by_table,
        "batchDataByTable": batch_data_by_table,
    }


@router.post("/preset", status_code=201)
async def create_timetable_preset(meta: TimetableMetaIn, user: dict = Depends(require_role("admin", "tt_incharge"))):
    timetable_id = generate_timetable_id(meta.class_, meta.branch, meta.semester, meta.type)
    if await timetables_collection.find_one({
        "$or": [{"_id": timetable_id}, {"timetableId": timetable_id}, {"unid": timetable_id}]
    }):
        raise HTTPException(
            status_code=409,
            detail=f"A timetable for {meta.class_} / {meta.branch} / Sem {meta.semester} / {meta.type} already exists.",
        )

    now = datetime.now(timezone.utc)
    doc = {
        "_id": timetable_id,
        "unid": timetable_id,
        "timetableId": timetable_id,
        "name": normalize(meta.name) or f"Timetable {timetable_id}",
        "class": normalize(meta.class_),
        "branch": normalize(meta.branch),
        "faculty": normalize(meta.faculty),
        "department": normalize(meta.department),
        "semester": normalize(meta.semester),
        "type": normalize(meta.type),
        "days": [normalize(d) for d in (meta.days or DEFAULT_DAYS)],
        "timeSlots": [normalize(t) for t in (meta.timeSlots or [])],
        "updatedAt": now,
        "createdAt": now,
    }
    await timetables_collection.insert_one(doc)
    await log_action(user, "create_timetable_preset", f"Timetable preset created: {timetable_id}")
    return _strip_id(doc)


@router.put("/{old_timetable_id}/meta")
async def update_timetable_meta(
    old_timetable_id: str,
    meta: TimetableMetaIn,
    user: dict = Depends(require_role("admin", "tt_incharge")),
):
    new_timetable_id = generate_timetable_id(meta.class_, meta.branch, meta.semester, meta.type)
    now = datetime.now(timezone.utc)

    payload = {
        "unid": new_timetable_id,
        "timetableId": new_timetable_id,
        "name": normalize(meta.name) or f"Timetable {new_timetable_id}",
        "class": normalize(meta.class_),
        "branch": normalize(meta.branch),
        "faculty": normalize(meta.faculty),
        "department": normalize(meta.department),
        "semester": normalize(meta.semester),
        "type": normalize(meta.type),
        "days": [normalize(d) for d in (meta.days or DEFAULT_DAYS)],
        "timeSlots": [normalize(t) for t in (meta.timeSlots or [])],
        "updatedAt": now,
    }

    if old_timetable_id == new_timetable_id:
        await timetables_collection.update_one(
            {"$or": [{"_id": new_timetable_id}, {"timetableId": new_timetable_id}, {"unid": new_timetable_id}]}, 
            {"$set": payload}
        )
    else:
        old_doc = await timetables_collection.find_one({
            "$or": [{"_id": old_timetable_id}, {"timetableId": old_timetable_id}, {"unid": old_timetable_id}]
        }) or {}
        actual_old_id = old_doc.pop("_id", old_timetable_id)
        merged = {**old_doc, **payload, "_id": new_timetable_id}
        await timetables_collection.insert_one(merged)
        await timetables_collection.delete_one({"_id": actual_old_id})
        # Matching original behavior exactly: existing schedules still carry
        # old_timetable_id and are NOT moved to the new id. That's a real gap
        # in the current Firebase app too (renaming orphans schedules) —
        # preserving it rather than fixing it, per scope.

    saved = await timetables_collection.find_one({
        "$or": [{"_id": new_timetable_id}, {"timetableId": new_timetable_id}, {"unid": new_timetable_id}]
    })
    await log_action(user, "update_timetable_meta", f"Timetable metadata updated: {new_timetable_id}")
    return _strip_id(saved)


@router.post("/save")
async def save_timetable(payload: SaveTimetableRequest, user: dict = Depends(require_role("admin", "tt_incharge"))):
    meta_dict = payload.meta.model_dump(by_alias=True)
    timetable_id = generate_timetable_id(
        meta_dict.get("class"), meta_dict.get("branch"), meta_dict.get("semester"), meta_dict.get("type")
    )
    prepared = prepare_timetable_payload(meta_dict, payload.days, payload.timeSlots)
    now = datetime.now(timezone.utc)

    await timetables_collection.update_one(
        {"$or": [{"_id": timetable_id}, {"timetableId": timetable_id}, {"unid": timetable_id}]},
        {"$set": {**prepared, "updatedAt": now}, "$setOnInsert": {"createdAt": now, "_id": timetable_id}},
        upsert=True,
    )

    tables = list((payload.batchesByTable or {}).keys()) or payload.tables
    schedules = build_schedule_occurrences(
        timetable_id=timetable_id,
        meta=prepared,
        tables=tables,
        days=prepared["days"],
        time_slots=prepared["timeSlots"],
        batches_by_table=payload.batchesByTable,
        batch_data_by_table=payload.batchDataByTable,
    )

    existing_ids = {
        d["_id"] for d in await schedules_collection.find({"timetableId": timetable_id}).to_list(length=None)
    }
    new_ids = set()

    for occ in schedules:
        occ.pop("semester", None)  # not persisted — matches original saveSchedules behavior
        occ["updatedAt"] = now
        doc_id = schedule_doc_id(timetable_id, occ["tableId"], occ["rowIndex"], occ["colIndex"], occ["batchIndex"])
        new_ids.add(doc_id)
        await schedules_collection.update_one({"_id": doc_id}, {"$set": occ}, upsert=True)

    orphaned = existing_ids - new_ids
    if orphaned:
        await schedules_collection.delete_many({"_id": {"$in": list(orphaned)}})

    saved_meta = await timetables_collection.find_one({
        "$or": [{"_id": timetable_id}, {"timetableId": timetable_id}, {"unid": timetable_id}]
    })
    await log_action(user, "save_timetable", f"Timetable {timetable_id} saved/updated")
    return {
        "timetableId": timetable_id,
        "meta": _strip_id(saved_meta),
        "schedulesSaved": len(new_ids),
        "schedulesDeleted": len(orphaned),
    }


@router.delete("/{timetable_id}", status_code=204)
async def delete_timetable(timetable_id: str, user: dict = Depends(require_role("admin", "tt_incharge"))):
    await schedules_collection.delete_many({"timetableId": timetable_id})
    result = await timetables_collection.delete_many({
        "$or": [{"_id": timetable_id}, {"timetableId": timetable_id}, {"unid": timetable_id}]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Timetable not found")
    await log_action(user, "delete_timetable", f"Timetable {timetable_id} deleted")