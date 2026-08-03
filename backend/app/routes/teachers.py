from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime

from app.models.models import TeacherCreate, TeacherOut
from app.core.database import teachers_collection
from app.services.dependencies import get_current_user, require_role
from app.routes.audit_logs import log_action

router = APIRouter(prefix="/api/teachers", tags=["teachers"])


def teacher_to_out(doc: dict) -> TeacherOut:
    return TeacherOut(
        unid=doc["unid"],
        ID=doc.get("ID", ""),
        name=doc["name"],
        faculty=doc.get("faculty", ""),
        department=doc.get("department", ""),
    )


@router.get("/public-lookup/{teacher_code}", response_model=TeacherOut)
async def public_teacher_lookup(teacher_code: str):
    code_clean = teacher_code.strip()
    teacher = await teachers_collection.find_one({
        "$or": [
            {"ID": {"$regex": f"^{code_clean}$", "$options": "i"}},
            {"code": {"$regex": f"^{code_clean}$", "$options": "i"}},
            {"name": {"$regex": f"^{code_clean}$", "$options": "i"}},
            {"unid": str(code_clean)}
        ]
    })
    if not teacher:
        raise HTTPException(status_code=404, detail=f"Teacher code '{teacher_code}' not found")
    return teacher_to_out(teacher)


@router.get("", response_model=list[TeacherOut])
async def list_teachers(
    faculty: str | None = None,
    department: str | None = None,
    user: dict = Depends(get_current_user),
):
    query = {}
    if faculty:
        query["faculty"] = {"$regex": f"^{faculty}$", "$options": "i"}
    if department:
        query["department"] = {"$regex": f"^{department}$", "$options": "i"}
    teachers = await teachers_collection.find(query).to_list(length=None)
    return [teacher_to_out(t) for t in teachers]


@router.get("/faculties", response_model=list[str])
async def list_faculties(user: dict = Depends(get_current_user)):
    faculties = await teachers_collection.distinct("faculty")
    return sorted(f for f in faculties if f)


@router.get("/departments", response_model=list[str])
async def list_departments(faculty: str, user: dict = Depends(get_current_user)):
    departments = await teachers_collection.distinct("department", {"faculty": {"$regex": f"^{faculty}$", "$options": "i"}})
    return sorted(d for d in departments if d)


@router.post("", response_model=TeacherOut, status_code=201)
async def upsert_teacher(
    payload: TeacherCreate,
    user: dict = Depends(require_role("admin", "tt_incharge")),
):
    unid = payload.unid or int(datetime.utcnow().timestamp() * 1000)

    doc = {
        "_id": unid,
        "unid": unid,
        "ID": payload.ID.strip(),
        "name": payload.name.strip(),
        "faculty": payload.faculty.strip(),
        "department": payload.department.strip(),
    }

    existing = await teachers_collection.find_one({
        "$or": [{"_id": unid}, {"unid": unid}, {"unid": str(unid)}]
    })
    if existing:
        actual_id = existing["_id"]
        update_fields = {k: v for k, v in doc.items() if k != "_id"}
        await teachers_collection.update_one({"_id": actual_id}, {"$set": update_fields})
    else:
        await teachers_collection.insert_one(doc)

    saved = await teachers_collection.find_one({
        "$or": [{"_id": unid}, {"unid": unid}, {"unid": str(unid)}]
    })
    await log_action(user, "upsert_teacher", f"Teacher {saved['name']} updated/created")
    return teacher_to_out(saved)


@router.delete("/{unid_str}", status_code=204)
async def delete_teacher(unid_str: str, user: dict = Depends(require_role("admin", "tt_incharge"))):
    try:
        unid = int(unid_str)
    except ValueError:
        unid = unid_str
        
    result = await teachers_collection.delete_many({
        "$or": [{"_id": unid}, {"unid": unid}, {"unid": str(unid)}]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Teacher not found")
    await log_action(user, "delete_teacher", f"Teacher ID {unid} deleted")