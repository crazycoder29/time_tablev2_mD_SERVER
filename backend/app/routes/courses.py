from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime

from app.models.models import CourseCreate, CourseOut
from app.core.database import courses_collection
from app.services.dependencies import get_current_user, require_role
from app.routes.audit_logs import log_action

router = APIRouter(prefix="/api/courses", tags=["courses"])


def course_to_out(doc: dict) -> CourseOut:
    return CourseOut(
        unid=doc["unid"],
        ID=doc.get("ID", ""),
        name=doc["name"],
        code=doc.get("code", ""),
        credits=doc.get("credits", ""),
        teachers=doc.get("teachers", []),
        faculty=doc.get("faculty", ""),
        department=doc.get("department", ""),
        semester=doc.get("semester", ""),
        hasBatches=bool(doc.get("hasBatches", False)),
        batches=doc.get("batches", []),
        batchTeachers=doc.get("batchTeachers", {}),
        batchName=doc.get("batchName"),
        parentCourseId=doc.get("parentCourseId"),
    )


@router.get("/public-all", response_model=list[CourseOut])
async def list_public_courses():
    courses = await courses_collection.find().to_list(length=None)
    return [course_to_out(c) for c in courses]


@router.get("", response_model=list[CourseOut])
async def list_courses(
    faculty: str | None = None,
    department: str | None = None,
    semester: str | None = None,
    user: dict = Depends(get_current_user),
):
    query = {}
    if faculty:
        query["faculty"] = {"$regex": f"^{faculty}$", "$options": "i"}
    if department:
        query["department"] = {"$regex": f"^{department}$", "$options": "i"}
    if semester:
        query["semester"] = {"$regex": f"^{semester}$", "$options": "i"}
    courses = await courses_collection.find(query).to_list(length=None)
    return [course_to_out(c) for c in courses]


@router.get("/departments", response_model=list[str])
async def list_departments(faculty: str, user: dict = Depends(get_current_user)):
    departments = await courses_collection.distinct(
        "department", {"faculty": {"$regex": f"^{faculty}$", "$options": "i"}}
    )
    return sorted(d for d in departments if d)


@router.get("/semesters", response_model=list[str])
async def list_semesters(
    faculty: str,
    department: str,
    user: dict = Depends(get_current_user),
):
    semesters = await courses_collection.distinct(
        "semester",
        {
            "faculty": {"$regex": f"^{faculty}$", "$options": "i"},
            "department": {"$regex": f"^{department}$", "$options": "i"},
        },
    )
    return sorted(s for s in semesters if s)


@router.post("/split-batches", response_model=list[CourseOut])
async def split_course_batches(
    payload: dict,
    user: dict = Depends(require_role("admin", "tt_incharge", "hod")),
):
    course_unid = payload.get("courseUnid")
    batches = payload.get("batches", ["B1", "B2"])
    if not course_unid:
        raise HTTPException(status_code=400, detail="courseUnid is required")

    parent = await courses_collection.find_one({
        "$or": [{"_id": course_unid}, {"unid": course_unid}, {"unid": str(course_unid)}]
    })
    if not parent:
        raise HTTPException(status_code=404, detail="Parent course not found")

    # Mark parent as having batches
    await courses_collection.update_one(
        {"_id": parent["_id"]},
        {"$set": {"hasBatches": True, "batches": batches}}
    )

    created_courses = []
    now_ms = int(datetime.utcnow().timestamp() * 1000)

    for idx, b_name in enumerate(batches):
        b_unid = f"{parent['unid']}_b_{b_name}"
        b_name_clean = b_name.strip()
        base_title = parent["name"].split(" (")[0]
        full_name = f"{base_title} ({b_name_clean})"
        b_id = f"{parent.get('ID', '')}-{b_name_clean}" if parent.get("ID") else full_name

        b_doc = {
            "_id": b_unid,
            "unid": b_unid,
            "ID": b_id,
            "name": full_name,
            "code": parent.get("code", ""),
            "credits": parent.get("credits", ""),
            "teachers": parent.get("batchTeachers", {}).get(b_name_clean, parent.get("teachers", [])),
            "faculty": parent.get("faculty", ""),
            "department": parent.get("department", ""),
            "semester": parent.get("semester", ""),
            "hasBatches": True,
            "batches": batches,
            "batchTeachers": parent.get("batchTeachers", {}),
            "batchName": b_name_clean,
            "parentCourseId": parent["unid"],
        }

        existing_b = await courses_collection.find_one({"_id": b_unid})
        if existing_b:
            await courses_collection.update_one({"_id": b_unid}, {"$set": b_doc})
        else:
            await courses_collection.insert_one(b_doc)
        
        created_courses.append(course_to_out(b_doc))

    # Remove standalone parent course so ONLY separate batch courses remain
    if not parent.get("batchName"):
        await courses_collection.delete_one({"_id": parent["_id"]})

    await log_action(user, "split_course_batches", f"Split course {parent.get('name')} into {len(batches)} batch courses")
    return created_courses


@router.post("", response_model=CourseOut, status_code=201)
async def upsert_course(
    payload: CourseCreate,
    user: dict = Depends(require_role("admin", "tt_incharge", "hod")),
):
    unid = payload.unid or int(datetime.utcnow().timestamp() * 1000)

    doc = {
        "_id": unid,
        "unid": unid,
        "ID": payload.ID.strip(),
        "name": payload.name.strip(),
        "code": payload.code.strip(),
        "credits": payload.credits.strip(),
        "teachers": payload.teachers,
        "faculty": payload.faculty.strip(),
        "department": payload.department.strip(),
        "semester": payload.semester.strip(),
        "hasBatches": payload.hasBatches,
        "batches": payload.batches,
        "batchTeachers": payload.batchTeachers,
        "batchName": payload.batchName,
        "parentCourseId": payload.parentCourseId,
    }

    existing = await courses_collection.find_one({
        "$or": [{"_id": unid}, {"unid": unid}, {"unid": str(unid)}]
    })
    if existing:
        actual_id = existing["_id"]
        update_fields = {k: v for k, v in doc.items() if k != "_id"}
        await courses_collection.update_one({"_id": actual_id}, {"$set": update_fields})
    else:
        await courses_collection.insert_one(doc)

    saved = await courses_collection.find_one({
        "$or": [{"_id": unid}, {"unid": unid}, {"unid": str(unid)}]
    })
    course_label = saved.get("code") or saved.get("name")
    await log_action(user, "upsert_course", f"Course {course_label} updated/created")
    return course_to_out(saved)

@router.delete("/{unid_str}", status_code=204)
async def delete_course(unid_str: str, user: dict = Depends(require_role("admin", "tt_incharge", "hod"))):
    try:
        unid = int(unid_str)
    except ValueError:
        unid = unid_str
        
    result = await courses_collection.delete_many({
        "$or": [{"_id": unid}, {"unid": unid}, {"unid": str(unid)}]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    await log_action(user, "delete_course", f"Course ID {unid} deleted")