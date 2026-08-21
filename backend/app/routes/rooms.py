import re
import json
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone

from app.models.models import RoomCreate, RoomOut
from app.core.database import (
    faculties_collection,
    get_faculty_collections,
    normalize_faculty_slug,
    normalize_semester,
    FacultyCollections,
)
from app.services.dependencies import get_current_user, require_role, get_faculty_context
from app.routes.audit_logs import log_action

router = APIRouter(prefix="/api/rooms", tags=["rooms"])

DEFAULT_AVAILABILITY = {
    "day": {
        "mon": {"time": []}, "tue": {"time": []}, "wed": {"time": []},
        "thu": {"time": []}, "fri": {"time": []}, "sat": {"time": []},
    }
}

DEFAULT_TIME_SLOTS = [
    "7:00 AM - 7:55 AM", "7:55 AM - 8:50 AM", "8:50 AM - 9:45 AM",
    "10:30 AM - 11:25 AM", "11:25 AM - 12:20 PM", "12:20 PM - 1:15 PM",
    "1:15 PM - 2:10 PM", "2:10 PM - 3:05 PM", "3:05 PM - 4:00 PM", "4:00 PM - 4:55 PM"
]

DAYS_INDEX_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}

FACULTY_PALETTES = [
    {"bg": "#2563EB", "border": "#1D4ED8", "text": "#FFFFFF", "badge": "bg-blue-600"},      # Engineering - Royal Blue
    {"bg": "#DB2777", "border": "#BE185D", "text": "#FFFFFF", "badge": "bg-pink-600"},      # Arts - Deep Pink / Rose
    {"bg": "#059669", "border": "#047857", "text": "#FFFFFF", "badge": "bg-emerald-600"},   # Commerce - Emerald
    {"bg": "#7C3AED", "border": "#6D28D9", "text": "#FFFFFF", "badge": "bg-purple-600"},    # Science - Violet
    {"bg": "#D97706", "border": "#B45309", "text": "#FFFFFF", "badge": "bg-amber-600"},     # Social Sciences - Amber
    {"bg": "#0891B2", "border": "#0E7490", "text": "#FFFFFF", "badge": "bg-cyan-600"},      # Education - Cyan
    {"bg": "#DC2626", "border": "#B91C1C", "text": "#FFFFFF", "badge": "bg-red-600"},       # Other 1
    {"bg": "#4F46E5", "border": "#4338CA", "text": "#FFFFFF", "badge": "bg-indigo-600"},    # Other 2
]


def parse_single_time_to_minutes(h: int, m: int, period: str | None) -> int:
    """
    Convert (hour, minute, period) to minutes from midnight using academic daytime heuristics:
    - 7:00 to 11:59 is morning AM (unless explicitly PM)
    - 12:00 is Noon 12 PM
    - 1:00 to 6:59 is afternoon PM (unless explicitly AM)
    """
    if period:
        p = period.upper().strip()
        if p == "PM" and h < 12:
            h += 12
        elif p == "AM" and h == 12:
            h = 0
    else:
        if 1 <= h <= 6:
            h += 12
    return h * 60 + m


def parse_time_slot_to_minutes(time_str: str) -> tuple[int, int]:
    """
    Parse time slot string (e.g. '7:00 AM - 7:55 AM' or '11:25 - 12:20 PM' or '08:00 - 09:00')
    into absolute (start_minutes_from_midnight, end_minutes_from_midnight).
    """
    if not time_str:
        return 480, 535
    cleaned = str(time_str).strip()
    match = re.search(
        r"(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\s*[-–to]+\s*(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?",
        cleaned,
        re.IGNORECASE,
    )
    if not match:
        return 480, 535

    h1, m1, p1, h2, m2, p2 = match.groups()
    h1, m1 = int(h1), int(m1)
    h2, m2 = int(h2), int(m2)

    start_min = parse_single_time_to_minutes(h1, m1, p1)
    end_min = parse_single_time_to_minutes(h2, m2, p2)

    if end_min <= start_min:
        end_min = start_min + 55
    return start_min, end_min


def room_to_out(doc: dict) -> RoomOut:
    return RoomOut(
        unid=doc["unid"],
        ID=doc.get("ID", ""),
        name=doc["name"],
        capacity=doc["capacity"],
        floor=doc.get("floor", ""),
        faculty=doc.get("faculty", ""),
        availability=doc.get("availability", DEFAULT_AVAILABILITY),
    )


@router.get("", response_model=list[RoomOut])
async def list_rooms(
    faculty: str | None = None,
    fc: FacultyCollections = Depends(get_faculty_context),
):
    query = {}
    if faculty:
        query["faculty"] = {"$regex": f"^{faculty}$", "$options": "i"}
    rooms = await fc.rooms.find(query).to_list(length=None)
    return [room_to_out(r) for r in rooms]


@router.get("/faculties", response_model=list[str])
async def list_faculties(
    user: dict = Depends(get_current_user),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    faculties = await fc.rooms.distinct("faculty")
    return sorted(f for f in faculties if f)


@router.get("/central-occupancy")
async def get_central_room_occupancy(
    semesters: str | None = Query(None, description="Per-faculty semester overrides (e.g. 'engineering:odd,arts:even' or JSON)"),
    user: dict = Depends(require_role("admin")),
):
    """
    Super Admin Central Room Occupancy Aggregator:
    Queries rooms and schedules across ALL faculty databases.
    Resolves schedule foreign keys (roomId -> room name, courseId, teacherId, timetableId),
    merges rooms of the exact same name, provides dynamic time coordinates, and supports
    custom semester contributions per faculty.
    """
    # Parse per-faculty semester overrides if passed
    semester_overrides: dict[str, str] = {}
    if semesters:
        try:
            trimmed = semesters.strip()
            if trimmed.startswith("{"):
                semester_overrides = json.loads(trimmed)
            else:
                for pair in trimmed.split(","):
                    if ":" in pair:
                        k, v = pair.split(":", 1)
                        semester_overrides[normalize_faculty_slug(k)] = normalize_semester(v)
                    elif "=" in pair:
                        k, v = pair.split("=", 1)
                        semester_overrides[normalize_faculty_slug(k)] = normalize_semester(v)
        except Exception as err:
            print("Failed to parse semester overrides:", err)

    # 1. Fetch all registered faculties
    cursor = faculties_collection.find({})
    faculties_docs = await cursor.to_list(length=100)

    if not faculties_docs:
        faculties_docs = [{
            "_id": "engineering",
            "name": "Faculty of Engineering",
            "slug": "engineering",
            "code": "ENG",
            "current_semester": "odd",
        }]

    # Assign colors & metadata to faculties
    faculty_meta_map = {}
    faculties_list = []
    for idx, f in enumerate(faculties_docs):
        slug = f.get("slug", str(f.get("_id", "")))
        palette = FACULTY_PALETTES[idx % len(FACULTY_PALETTES)]
        active_sem = semester_overrides.get(slug) or f.get("current_semester", "odd")
        meta = {
            "slug": slug,
            "name": f.get("name", slug.title()),
            "code": f.get("code", slug.upper()[:4]),
            "current_semester": active_sem,
            "color": palette["bg"],
            "borderColor": palette["border"],
            "textColor": palette["text"],
            "badgeClass": palette["badge"],
        }
        faculty_meta_map[slug] = meta
        faculty_meta_map[f.get("name", "").strip().lower()] = meta
        faculties_list.append(meta)

    # 2. Iterate through faculties and aggregate rooms & resolved schedules
    raw_rooms_by_name: dict[str, dict] = {}
    all_schedules: list[dict] = []
    earliest_minute = 420  # 7:00 AM
    latest_minute = 1080   # 6:00 PM

    for f in faculties_docs:
        slug = f.get("slug", str(f.get("_id", "")))
        active_sem = semester_overrides.get(slug) or f.get("current_semester", "odd")
        fc = get_faculty_collections(slug, active_sem)
        fac_meta = faculty_meta_map.get(slug, {
            "slug": slug,
            "name": slug.title(),
            "code": slug.upper()[:4],
            "current_semester": active_sem,
            "color": "#2563EB",
            "borderColor": "#1D4ED8",
            "textColor": "#FFFFFF",
            "badgeClass": "bg-blue-600",
        })

        # Preload rooms, courses, teachers, and timetables for fast in-memory resolution
        try:
            faculty_rooms = await fc.rooms.find({}).to_list(length=None)
        except Exception:
            faculty_rooms = []

        try:
            faculty_courses = await fc.courses.find({}).to_list(length=None)
        except Exception:
            faculty_courses = []

        try:
            faculty_teachers = await fc.teachers.find({}).to_list(length=None)
        except Exception:
            faculty_teachers = []

        try:
            faculty_timetables = await fc.timetables.find({}).to_list(length=None)
        except Exception:
            faculty_timetables = []

        try:
            faculty_schedules = await fc.schedules.find({}).to_list(length=None)
        except Exception:
            faculty_schedules = []

        # Build ID lookup maps
        room_unid_map = {}
        for r in faculty_rooms:
            r_name = (r.get("name") or "").strip()
            if not r_name:
                continue
            if r.get("unid") is not None:
                room_unid_map[str(r.get("unid"))] = r_name
            if r.get("_id") is not None:
                room_unid_map[str(r.get("_id"))] = r_name
            if r.get("ID"):
                room_unid_map[str(r.get("ID"))] = r_name
            room_unid_map[r_name.lower()] = r_name

            norm_key = r_name.lower()
            if norm_key not in raw_rooms_by_name:
                raw_rooms_by_name[norm_key] = {
                    "name": r_name,
                    "normalized_name": norm_key,
                    "capacity": r.get("capacity", 30),
                    "floors": [r.get("floor")] if r.get("floor") else [],
                    "faculties": [slug],
                    "faculty_names": [fac_meta["name"]],
                    "availability": r.get("availability", DEFAULT_AVAILABILITY),
                }
            else:
                existing_entry = raw_rooms_by_name[norm_key]
                if slug not in existing_entry["faculties"]:
                    existing_entry["faculties"].append(slug)
                    existing_entry["faculty_names"].append(fac_meta["name"])
                if r.get("capacity", 0) > existing_entry["capacity"]:
                    existing_entry["capacity"] = r.get("capacity", 0)
                if r.get("floor") and r.get("floor") not in existing_entry["floors"]:
                    existing_entry["floors"].append(r.get("floor"))

        course_unid_map = {}
        for c in faculty_courses:
            code = (c.get("code") or c.get("ID") or "").strip()
            cname = (c.get("name") or "").strip()
            display = f"{code} {cname}".strip() or code or cname
            info = {"code": code, "name": cname, "display": display}
            if c.get("unid") is not None:
                course_unid_map[str(c.get("unid"))] = info
            if c.get("_id") is not None:
                course_unid_map[str(c.get("_id"))] = info
            if c.get("ID"):
                course_unid_map[str(c.get("ID"))] = info

        teacher_unid_map = {}
        for t in faculty_teachers:
            tname = (t.get("name") or "").strip()
            if t.get("unid") is not None:
                teacher_unid_map[str(t.get("unid"))] = tname
            if t.get("_id") is not None:
                teacher_unid_map[str(t.get("_id"))] = tname
            if t.get("ID"):
                teacher_unid_map[str(t.get("ID"))] = tname

        timetable_map = {}
        for tt in faculty_timetables:
            tt_id = str(tt.get("_id") or tt.get("id") or "")
            meta = tt.get("meta") or {}
            timetable_map[tt_id] = meta

        # Process each schedule and resolve all identifiers
        for s in faculty_schedules:
            # 1. Resolve Room
            raw_room_id = str(s.get("roomId") or s.get("room") or s.get("roomName") or "").strip()
            if not raw_room_id:
                continue

            room_name = room_unid_map.get(raw_room_id) or room_unid_map.get(raw_room_id.lower()) or raw_room_id
            norm_room = room_name.lower()

            if norm_room not in raw_rooms_by_name:
                raw_rooms_by_name[norm_room] = {
                    "name": room_name,
                    "normalized_name": norm_room,
                    "capacity": 30,
                    "floors": [],
                    "faculties": [slug],
                    "faculty_names": [fac_meta["name"]],
                    "availability": DEFAULT_AVAILABILITY,
                }
            elif slug not in raw_rooms_by_name[norm_room]["faculties"]:
                raw_rooms_by_name[norm_room]["faculties"].append(slug)
                raw_rooms_by_name[norm_room]["faculty_names"].append(fac_meta["name"])

            # 2. Resolve Day
            day_str = s.get("day")
            if not day_str:
                col_idx = s.get("colIndex", 0)
                day_str = DAYS_INDEX_MAP.get(col_idx, "Mon")
            day_str = str(day_str).capitalize()[:3]

            # 3. Resolve Timetable Meta
            tt_id = str(s.get("timetableId") or "")
            tt_meta = timetable_map.get(tt_id, {})
            class_name = s.get("class") or tt_meta.get("class", "")
            branch_name = s.get("branch") or tt_meta.get("branch", "")
            semester_val = s.get("semester") or tt_meta.get("semester", "")
            batch_val = s.get("batch") or ""

            # 4. Resolve Time Slot
            time_slot = s.get("time") or s.get("timeSlot")
            if not time_slot:
                row_idx = s.get("rowIndex", 0)
                tt_slots = tt_meta.get("timeSlots") or []
                if isinstance(tt_slots, list) and row_idx < len(tt_slots):
                    time_slot = tt_slots[row_idx]
                elif row_idx < len(DEFAULT_TIME_SLOTS):
                    time_slot = DEFAULT_TIME_SLOTS[row_idx]
                else:
                    time_slot = "8:00 AM - 8:55 AM"

            start_min, end_min = parse_time_slot_to_minutes(time_slot)
            if start_min < earliest_minute and start_min >= 360:  # >= 6:00 AM
                earliest_minute = start_min
            if end_min > latest_minute and end_min <= 1320:       # <= 10:00 PM
                latest_minute = end_min

            # 5. Resolve Course
            raw_course_id = str(s.get("courseId") or s.get("course") or "").strip()
            course_info = course_unid_map.get(raw_course_id, {})
            course_code = course_info.get("code") or s.get("courseCode") or raw_course_id
            course_name = course_info.get("name") or s.get("courseName") or ""

            # 6. Resolve Teacher
            raw_teacher_id = str(s.get("teacherId") or s.get("teacher") or "").strip()
            teacher_name = teacher_unid_map.get(raw_teacher_id) or s.get("teacherName") or raw_teacher_id

            sched_entry = {
                "id": str(s.get("_id", f"{slug}_{norm_room}_{day_str}_{start_min}")),
                "timetableId": tt_id,
                "roomName": room_name,
                "roomNormalized": norm_room,
                "day": day_str,
                "timeSlot": time_slot,
                "startMinute": start_min,
                "endMinute": end_min,
                "durationMinutes": end_min - start_min,
                "courseCode": course_code,
                "courseName": course_name,
                "teacherName": teacher_name,
                "class": class_name,
                "branch": branch_name,
                "semester": semester_val,
                "batch": batch_val,
                "faculty": slug,
                "facultyName": fac_meta["name"],
                "facultyCode": fac_meta["code"],
                "facultySemester": active_sem,
                "facultyColor": fac_meta["color"],
                "facultyBorderColor": fac_meta["borderColor"],
                "facultyTextColor": fac_meta["textColor"],
                "facultyBadgeClass": fac_meta["badgeClass"],
            }
            all_schedules.append(sched_entry)

    # 3. Format rooms list and flag shared rooms
    formatted_rooms = []
    for norm_key, r_info in sorted(raw_rooms_by_name.items(), key=lambda x: x[1]["name"]):
        is_shared = len(r_info["faculties"]) > 1
        formatted_rooms.append({
            "name": r_info["name"],
            "normalized_name": norm_key,
            "capacity": r_info["capacity"],
            "floor": ", ".join(r_info["floors"]) if r_info["floors"] else "",
            "faculties": r_info["faculties"],
            "faculty_names": r_info["faculty_names"],
            "is_shared": is_shared,
            "availability": r_info["availability"],
        })

    # Precise Collision Detection (Only genuine multi-minute overlaps between distinct classes)
    for i, s1 in enumerate(all_schedules):
        s1["hasCollision"] = False
        for j, s2 in enumerate(all_schedules):
            if i == j:
                continue
            if s1["roomNormalized"] != s2["roomNormalized"] or s1["day"] != s2["day"]:
                continue

            # Don't flag duplicate batch rows within the same class/timetable
            if s1.get("timetableId") and s2.get("timetableId") and s1["timetableId"] == s2["timetableId"]:
                continue
            if s1.get("faculty") == s2.get("faculty") and s1.get("class") and s1.get("class") == s2.get("class") and s1.get("courseCode") == s2.get("courseCode"):
                continue

            overlap_start = max(s1["startMinute"], s2["startMinute"])
            overlap_end = min(s1["endMinute"], s2["endMinute"])
            
            # Require at least 3 minutes of actual overlap (avoids 11:25-11:25 edge touches)
            if overlap_end - overlap_start > 2:
                s1["hasCollision"] = True
                s1["collisionWith"] = s2["facultyName"]
                s1["collisionCourse"] = s2["courseCode"] or s2["courseName"] or "Class"
                s1["collisionTime"] = s2["timeSlot"]
                break

    return {
        "faculties": faculties_list,
        "rooms": formatted_rooms,
        "schedules": all_schedules,
        "timeBounds": {
            "minMinute": earliest_minute,
            "maxMinute": latest_minute,
            "totalMinutes": latest_minute - earliest_minute,
        },
        "stats": {
            "totalRooms": len(formatted_rooms),
            "sharedRoomsCount": sum(1 for r in formatted_rooms if r["is_shared"]),
            "totalFaculties": len(faculties_list),
            "totalBookings": len(all_schedules),
        },
    }


@router.post("", response_model=RoomOut, status_code=201)
async def upsert_room(
    payload: RoomCreate,
    user: dict = Depends(require_role("admin", "sub_admin", "tt_incharge")),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    unid = payload.unid or int(datetime.now(timezone.utc).timestamp() * 1000)

    doc = {
        "_id": unid,
        "unid": unid,
        "ID": payload.ID.strip(),
        "name": payload.name.strip(),
        "capacity": payload.capacity,
        "floor": payload.floor.strip(),
        "faculty": payload.faculty.strip(),
        "availability": payload.availability or DEFAULT_AVAILABILITY,
    }

    existing = await fc.rooms.find_one({
        "$or": [{"_id": unid}, {"unid": unid}, {"unid": str(unid)}]
    })
    if existing:
        actual_id = existing["_id"]
        update_fields = {k: v for k, v in doc.items() if k != "_id"}
        await fc.rooms.update_one({"_id": actual_id}, {"$set": update_fields})
    else:
        await fc.rooms.insert_one(doc)

    saved = await fc.rooms.find_one({
        "$or": [{"_id": unid}, {"unid": unid}, {"unid": str(unid)}]
    })
    await log_action(user, "upsert_room", f"Room {saved['name']} updated/created in faculty '{fc.slug}'")
    return room_to_out(saved)


@router.delete("/{unid_str}", status_code=204)
async def delete_room(
    unid_str: str,
    user: dict = Depends(require_role("admin", "sub_admin", "tt_incharge")),
    fc: FacultyCollections = Depends(get_faculty_context),
):
    try:
        unid = int(unid_str)
    except ValueError:
        unid = unid_str

    result = await fc.rooms.delete_many({
        "$or": [{"_id": unid}, {"unid": unid}, {"unid": str(unid)}]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    await log_action(user, "delete_room", f"Deleted room unid {unid_str} in faculty '{fc.slug}'")
    return None