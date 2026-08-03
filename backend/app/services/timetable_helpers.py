import re

DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]


def normalize(value) -> str:
    return re.sub(r"\s+", " ", str(value if value is not None else "").strip())


def safe_id(value) -> str:
    s = normalize(value).lower()
    s = s.replace("/", "-")
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^a-z0-9_-]", "", s)
    return s[:180]


def cell_key(row_index: int, col_index: int) -> str:
    return f"{row_index}-{col_index}"


def data_key(row_index: int, col_index: int, batch_index: int) -> str:
    return f"{row_index}-{col_index}-{batch_index}"


def get_batch_count(batches_for_table: dict, row_index: int, col_index: int) -> int:
    count = (batches_for_table or {}).get(cell_key(row_index, col_index))
    return count if isinstance(count, int) and count > 0 else 1


def generate_timetable_id(class_name, branch, semester, type_) -> str:
    from fastapi import HTTPException

    cls, br, sem, tp = safe_id(class_name), safe_id(branch), safe_id(semester), safe_id(type_)
    if not (cls and br and sem and tp):
        raise HTTPException(status_code=400, detail="Timetable requires class, branch, semester and type")
    return f"tt_{cls}__{br}__{sem}__{tp}"


def prepare_timetable_payload(meta: dict, days, time_slots) -> dict:
    timetable_id = generate_timetable_id(meta.get("class"), meta.get("branch"), meta.get("semester"), meta.get("type"))
    return {
        "unid": timetable_id,
        "timetableId": timetable_id,
        "name": normalize(meta.get("name")) or f"Timetable {timetable_id}",
        "class": normalize(meta.get("class")),
        "branch": normalize(meta.get("branch")),
        "faculty": normalize(meta.get("faculty")),
        "department": normalize(meta.get("department")),
        "semester": normalize(meta.get("semester")),
        "type": normalize(meta.get("type")),
        "days": [normalize(d) for d in (days if days else DEFAULT_DAYS)],
        "timeSlots": [normalize(t) for t in (time_slots or [])],
    }


def build_schedule_occurrences(
    timetable_id: str,
    meta: dict,
    tables: list,
    days: list,
    time_slots: list,
    batches_by_table: dict,
    batch_data_by_table: dict,
) -> list[dict]:
    normalized_days = [normalize(d) for d in (days or DEFAULT_DAYS)]
    normalized_slots = [normalize(t) for t in (time_slots or [])]
    table_ids = tables or list((batches_by_table or {}).keys())

    occurrences = []
    for table_id in table_ids:
        batches_for_table = (batches_by_table or {}).get(table_id, {})
        data_for_table = (batch_data_by_table or {}).get(table_id, {})

        for row_index in range(len(normalized_slots)):
            for col_index in range(len(normalized_days)):
                count = get_batch_count(batches_for_table, row_index, col_index)
                for batch_index in range(count):
                    entry = data_for_table.get(data_key(row_index, col_index, batch_index), {}) or {}

                    batch = normalize(entry.get("batchName"))
                    course_id = str(entry["courseId"]) if entry.get("courseId") else ""
                    teacher_id = str(entry["teacherId"]) if entry.get("teacherId") else ""
                    room_id = str(entry["roomId"]) if entry.get("roomId") else ""
                    course = normalize(entry.get("course"))
                    teacher = normalize(entry.get("teacher"))
                    room = normalize(entry.get("room"))
                    remark = entry.get("remark") if "remark" in entry else None

                    # skip truly empty cells, same rule as the JS version
                    if not any([batch, course_id, teacher_id, room_id, course, teacher, room]) and not remark:
                        continue

                    occ = {
                        "timetableId": timetable_id,
                        "tableId": normalize(table_id),
                        "rowIndex": row_index,
                        "colIndex": col_index,
                        "batchIndex": batch_index,
                        "day": normalized_days[col_index] if col_index < len(normalized_days) else "",
                        "time": normalized_slots[row_index] if row_index < len(normalized_slots) else "",
                        "class": normalize(meta.get("class")),
                        "branch": normalize(meta.get("branch")),
                        "semester": normalize(meta.get("semester")),  # NOTE: dropped before save, see below
                        "batch": batch,
                        "type": normalize(meta.get("type")),
                        "courseId": course_id,
                        "teacherId": teacher_id,
                        "roomId": room_id,
                    }
                    if remark is not None:
                        occ["remark"] = remark
                    occurrences.append(occ)
    return occurrences


def reconstruct_timetable_from_schedules(schedules: list[dict]):
    batches_by_table: dict = {}
    batch_data_by_table: dict = {}

    for o in schedules:
        table_id = o.get("tableId") or "Table 1"
        batches_by_table.setdefault(table_id, {})
        batch_data_by_table.setdefault(table_id, {})

        cell = cell_key(o.get("rowIndex", 0), o.get("colIndex", 0))
        current_count = batches_by_table[table_id].get(cell, 1)
        batches_by_table[table_id][cell] = max(current_count, (o.get("batchIndex") or 0) + 1)

        entry = {"batchName": o.get("batch") or ""}
        if o.get("courseId"):
            entry["courseId"] = str(o["courseId"])
        if o.get("teacherId"):
            entry["teacherId"] = str(o["teacherId"])
        if o.get("roomId"):
            entry["roomId"] = str(o["roomId"])
        if "remark" in o:
            entry["remark"] = o["remark"]

        batch_data_by_table[table_id][
            data_key(o.get("rowIndex", 0), o.get("colIndex", 0), o.get("batchIndex", 0))
        ] = entry

    return batches_by_table, batch_data_by_table