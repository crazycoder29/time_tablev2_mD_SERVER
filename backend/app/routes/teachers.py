from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

from app.models.models import TeacherCreate, TeacherOut
from app.core.database import (
    faculties_collection,
    get_faculty_collections,
    FacultyCollections,
)
from app.services.dependencies import get_current_user, require_role, get_faculty_context
from app.routes.audit_logs import log_action

router = APIRouter(prefix="/api/teachers", tags=["teachers"])

DEFAULT_TIME_SLOTS = [
    "7:00 AM - 7:55 AM", "7:55 AM - 8:50 AM", "8:50 AM - 9:45 AM",
    "10:30 AM - 11:25 AM", "11:25 AM - 12:20 PM", "12:20 PM - 1:15 PM",
    "1:15 PM - 2:10 PM", "2:10 PM - 3:05 PM", "3:05 PM - 4:00 PM", "4:00 PM - 4:55 PM"
]

DAYS_INDEX_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}


def teacher_to_out(doc: dict) -> TeacherOut:
    return TeacherOut(
        unid=doc["unid"],
        ID=doc.get("ID", ""),
        name=doc["name"],
        faculty=doc.get("faculty", ""),
        department=doc.get("department", ""),
    )


@router.get("/public-all", response_model=list[TeacherOut])
async def list_public_teachers(
    fc: FacultyCollections = Depends(get_faculty_context),
):
    """List all teachers of the contextual faculty database without requiring login."""
    teachers = await fc.teachers.find({}).sort("name", 1).to_list(length=None)
    return [teacher_to_out(t) for t in teachers]


@router.get("/public-lookup/{teacher_code}", response_model=TeacherOut)
async def public_teacher_lookup(
    teacher_code: str,
    fc: FacultyCollections = Depends(get_faculty_context),
):
    code_clean = teacher_code.strip()
    teacher = await fc.teachers.find_one({
        "$or": [
            {"ID": {"$regex": f"^{code_clean}$", "$options": "i"}},
            {"code": {"$regex": f"^{code_clean}$", "$options": "i"}},
            {"name": {"$regex": f"^{code_clean}$", "$options": "i"}},
            {"unid": str(code_clean)},
        ]
    })
    if not teacher:
        raise HTTPException(status_code=404, detail=f"Teacher code '{teacher_code}' not found")
    return teacher_to_out(teacher)


@router.get("/public-schedule/{teacher_code}")
async def public_teacher_schedule_cross_db(teacher_code: str):
    """
    Scans ALL registered faculty databases and both semesters (Odd/Even) for the given teacher code/acronym.
    When found, automatically resolves full schedules, courses, rooms, and timetable metadata from that database.
    If teacher_code == 'all', compiles all teachers across all databases!
    """
    code_clean = teacher_code.strip()
    if not code_clean:
        raise HTTPException(status_code=400, detail="Teacher code or 'all' is required")

    # Fetch all registered faculties
    cursor = faculties_collection.find({})
    faculties_docs = await cursor.to_list(length=100)
    if not faculties_docs:
        faculties_docs = [{
            "_id": "engineering",
            "slug": "engineering",
            "name": "Faculty of Engineering",
            "institute_name": "DAYALBAGH EDUCATIONAL INSTITUTE",
            "current_semester": "odd",
        }]

    is_all_query = code_clean.lower() in ("all", "*", "bulk")

    async def get_teacher_full_data(fc, teacher_doc, fac_info, sem_type):
        t_unid = str(teacher_doc["unid"])
        t_id = str(teacher_doc.get("ID") or "").strip()
        t_name = str(teacher_doc.get("name") or "").strip()

        # Find schedules referencing this teacher
        or_conds = [
            {"teacherId": t_unid},
            {"teacherId": {"$regex": f"(^|,)\\s*{t_unid}\\s*(,|$)"}},
        ]
        if t_id:
            or_conds.extend([
                {"teacherId": t_id},
                {"teacherId": {"$regex": f"(^|,)\\s*{t_id}\\s*(,|$)"}},
            ])
        if t_name:
            or_conds.append({"teacherId": {"$regex": f"^{t_name}$", "$options": "i"}})

        schedules = await fc.schedules.find({"$or": or_conds}).to_list(length=None)

        courses = await fc.courses.find({}).to_list(length=None)
        rooms = await fc.rooms.find({}).to_list(length=None)
        timetables = await fc.timetables.find({}).to_list(length=None)

        course_map = {}
        for c in courses:
            c_code = (c.get("code") or c.get("ID") or "").strip()
            c_name = (c.get("name") or "").strip()
            c_batch = (c.get("batchName") or "").strip()
            val = {"code": c_code, "name": c_name, "batch": c_batch}
            if c.get("unid"): course_map[str(c["unid"])] = val
            if c.get("ID"): course_map[str(c["ID"])] = val
            if c.get("code"): course_map[str(c["code"])] = val

        room_map = {}
        for r in rooms:
            r_name = (r.get("name") or r.get("ID") or "").strip()
            if r.get("unid"): room_map[str(r["unid"])] = r_name
            if r.get("ID"): room_map[str(r["ID"])] = r_name

        timetable_map = {}
        for tt in timetables:
            tt_id = str(tt.get("_id") or tt.get("id") or tt.get("timetableId") or "")
            meta = tt.get("meta") or {}
            timetable_map[tt_id] = {
                "class": tt.get("class") or meta.get("class", ""),
                "branch": tt.get("branch") or meta.get("branch", ""),
                "semester": tt.get("semester") or meta.get("semester", ""),
                "type": tt.get("type") or meta.get("type", ""),
                "timeSlots": tt.get("timeSlots") or meta.get("timeSlots", []),
            }

        max_row = 0
        enriched = []
        for s in schedules:
            row_idx = s.get("rowIndex", 0)
            if row_idx > max_row:
                max_row = row_idx

            tt_id = str(s.get("timetableId") or "")
            tt_info = timetable_map.get(tt_id, {})
            
            c_key = str(s.get("courseId") or s.get("course") or "").strip()
            c_info = course_map.get(c_key, {})
            course_code = c_info.get("code") or s.get("code") or s.get("courseCode") or s.get("course") or ""
            course_name = c_info.get("name") or s.get("course") or course_code

            r_key = str(s.get("roomId") or s.get("room") or "").strip()
            room_name = room_map.get(r_key, s.get("room") or r_key)

            day_str = s.get("day")
            if not day_str:
                day_str = DAYS_INDEX_MAP.get(s.get("colIndex", 0), "Mon")

            time_str = s.get("time") or s.get("timeSlot")
            if not time_str:
                tt_slots = tt_info.get("timeSlots") or []
                if isinstance(tt_slots, list) and row_idx < len(tt_slots):
                    time_str = tt_slots[row_idx]
                elif row_idx < len(DEFAULT_TIME_SLOTS):
                    time_str = DEFAULT_TIME_SLOTS[row_idx]
                else:
                    time_str = "8:00 AM - 8:55 AM"

            class_name = s.get("class") or tt_info.get("class", "")
            branch_name = s.get("branch") or tt_info.get("branch", "")
            sem_name = s.get("semester") or tt_info.get("semester", "")
            type_name = s.get("type") or tt_info.get("type", "")
            batch_name = s.get("batch") or c_info.get("batch", "")

            enriched.append({
                "unid": str(s.get("_id", "")),
                "timetableId": tt_id,
                "rowIndex": row_idx,
                "colIndex": s.get("colIndex", 0),
                "day": day_str,
                "time": time_str,
                "class": class_name,
                "branch": branch_name,
                "semester": sem_name,
                "type": type_name,
                "batch": batch_name,
                "code": course_code,
                "course": course_name,
                "room": room_name,
                "teacherId": str(teacher_doc["unid"]),
            })

        all_unique_slots = set()
        for tt in timetables:
            tt_slots = tt.get("timeSlots") or (tt.get("meta") or {}).get("timeSlots") or []
            if isinstance(tt_slots, list):
                for slot in tt_slots:
                    if slot and str(slot).strip():
                        all_unique_slots.add(str(slot).strip())

        def parse_slot_minutes(t_str):
            import re
            m = re.search(r"(\d+):(\d+)\s*(am|pm)?", str(t_str), re.IGNORECASE)
            if not m: return 0
            h = int(m.group(1))
            m_min = int(m.group(2))
            ampm = m.group(3).lower() if m.group(3) else None
            if ampm:
                if ampm == "pm" and h < 12: h += 12
                if ampm == "am" and h == 12: h = 0
            else:
                if 1 <= h <= 6: h += 12
            return h * 60 + m_min

        if len(all_unique_slots) >= len(DEFAULT_TIME_SLOTS):
            slots = sorted(list(all_unique_slots), key=parse_slot_minutes)
        else:
            # Always ensure the full standard academic timetable day slots are returned
            combined = set(DEFAULT_TIME_SLOTS).union(all_unique_slots)
            slots = sorted(list(combined), key=parse_slot_minutes)

        return {
            "teacher": teacher_to_out(teacher_doc).dict(),
            "faculty_name": fac_info.get("name", fac_info.get("slug", "").title()),
            "institute_name": fac_info.get("institute_name", "DAYALBAGH EDUCATIONAL INSTITUTE"),
            "semester": sem_type,
            "schedules": enriched,
            "timeSlots": slots,
        }


    # If user wants ALL teachers across all databases
    if is_all_query:
        all_results = []
        for fac in faculties_docs:
            slug = fac.get("slug", str(fac.get("_id", "")))
            active_sem = fac.get("current_semester", "odd")
            # Pull for the saved active semester of each faculty
            fc = get_faculty_collections(slug, active_sem)
            try:
                teachers = await fc.teachers.find({}).to_list(length=None)
                for t in teachers:
                    data = await get_teacher_full_data(fc, t, fac, active_sem)
                    all_results.append(data)
            except Exception:
                pass
        if not all_results:
            raise HTTPException(status_code=404, detail="No teachers found in any database")
        return {"mode": "all", "teachers": all_results}

    # Search for specific teacher: Prioritize the faculty's SAVED active semester
    for fac in faculties_docs:
        slug = fac.get("slug", str(fac.get("_id", "")))
        active_sem = fac.get("current_semester", "odd")
        # Try active semester first
        fc_active = get_faculty_collections(slug, active_sem)
        try:
            teacher = await fc_active.teachers.find_one({
                "$or": [
                    {"ID": {"$regex": f"^{code_clean}$", "$options": "i"}},
                    {"code": {"$regex": f"^{code_clean}$", "$options": "i"}},
                    {"name": {"$regex": f"^{code_clean}$", "$options": "i"}},
                    {"unid": str(code_clean)},
                ]
            })
            if teacher:
                data = await get_teacher_full_data(fc_active, teacher, fac, active_sem)
                data["mode"] = "single"
                return data
        except Exception:
            pass

    # Fallback to alternate semester if not found in active semester
    for fac in faculties_docs:
        slug = fac.get("slug", str(fac.get("_id", "")))
        active_sem = fac.get("current_semester", "odd")
        alt_sem = "even" if active_sem == "odd" else "odd"
        fc_alt = get_faculty_collections(slug, alt_sem)
        try:
            teacher = await fc_alt.teachers.find_one({
                "$or": [
                    {"ID": {"$regex": f"^{code_clean}$", "$options": "i"}},
                    {"code": {"$regex": f"^{code_clean}$", "$options": "i"}},
                    {"name": {"$regex": f"^{code_clean}$", "$options": "i"}},
                    {"unid": str(code_clean)},
                ]
            })
            if teacher:
                data = await get_teacher_full_data(fc_alt, teacher, fac, alt_sem)
                data["mode"] = "single"
                return data
        except Exception:
            pass


    raise HTTPException(
        status_code=404, 
        detail=f"Teacher '{teacher_code}' was not found in any faculty database. Please check your teacher code or acronym."
    )


@router.get("", response_model=list[TeacherOut])
async def list_teachers(
    faculty: str | None = None,
    department: str | None = None,
    user: dict = Depends(get_current_user),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    query = {}
    if faculty:
        query["faculty"] = {"$regex": f"^{faculty}$", "$options": "i"}
    if department:
        query["department"] = {"$regex": f"^{department}$", "$options": "i"}
    teachers = await fc.teachers.find(query).to_list(length=None)
    return [teacher_to_out(t) for t in teachers]


@router.get("/faculties", response_model=list[str])
async def list_faculties(
    user: dict = Depends(get_current_user),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    faculties = await fc.teachers.distinct("faculty")
    return sorted(f for f in faculties if f)


@router.get("/departments", response_model=list[str])
async def list_departments(
    faculty: str,
    user: dict = Depends(get_current_user),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    departments = await fc.teachers.distinct("department", {"faculty": {"$regex": f"^{faculty}$", "$options": "i"}})
    return sorted(d for d in departments if d)


@router.post("", response_model=TeacherOut, status_code=201)
async def upsert_teacher(
    payload: TeacherCreate,
    user: dict = Depends(require_role("admin", "sub_admin", "tt_incharge")),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    unid = payload.unid or int(datetime.now(timezone.utc).timestamp() * 1000)

    doc = {
        "_id": unid,
        "unid": unid,
        "ID": payload.ID.strip(),
        "name": payload.name.strip(),
        "faculty": payload.faculty.strip(),
        "department": payload.department.strip(),
    }

    existing = await fc.teachers.find_one({
        "$or": [{"_id": unid}, {"unid": unid}, {"unid": str(unid)}]
    })
    if existing:
        actual_id = existing["_id"]
        update_fields = {k: v for k, v in doc.items() if k != "_id"}
        await fc.teachers.update_one({"_id": actual_id}, {"$set": update_fields})
    else:
        await fc.teachers.insert_one(doc)

    saved = await fc.teachers.find_one({
        "$or": [{"_id": unid}, {"unid": unid}, {"unid": str(unid)}]
    })
    await log_action(user, "upsert_teacher", f"Teacher {saved['name']} updated/created in faculty '{fc.slug}'")
    return teacher_to_out(saved)


@router.delete("/{unid_str}", status_code=204)
async def delete_teacher(
    unid_str: str,
    user: dict = Depends(require_role("admin", "sub_admin", "tt_incharge")),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    try:
        unid = int(unid_str)
    except ValueError:
        unid = unid_str

    result = await fc.teachers.delete_many({
        "$or": [{"_id": unid}, {"unid": unid}, {"unid": str(unid)}]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Teacher not found")
    await log_action(user, "delete_teacher", f"Deleted teacher unid {unid_str} in faculty '{fc.slug}'")
    return None