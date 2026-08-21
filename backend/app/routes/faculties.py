from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from app.models.models import FacultyCreate, FacultyOut, FacultyUpdate, FacultySemesterUpdate
from app.core.database import (
    faculties_collection,
    users_collection,
    get_faculty_db_name,
    get_faculty_collections,
    normalize_faculty_slug,
    normalize_semester,
)
from app.core.config import settings
from app.services.dependencies import get_current_user, require_role
from app.routes.audit_logs import log_action

router = APIRouter(prefix="/api/faculties", tags=["faculties"])

DEFAULT_ENGINEERING_FACULTY = {
    "_id": "engineering",
    "name": "Faculty of Engineering",
    "slug": "engineering",
    "code": "ENG",
    "description": "Dayalbagh Educational Institute Faculty of Engineering",
    "database_name": settings.database_name,
    "institute_name": "DAYALBAGH EDUCATIONAL INSTITUTE",
    "current_semester": "odd",
    "created_at": datetime.now(timezone.utc),
}


async def ensure_default_faculty_seeded():
    """Ensure at least the default Engineering Faculty exists in the master database."""
    count = await faculties_collection.count_documents({})
    if count == 0:
        await faculties_collection.replace_one(
            {"_id": "engineering"},
            DEFAULT_ENGINEERING_FACULTY,
            upsert=True,
        )


@router.get("/public", response_model=list[FacultyOut])
async def list_public_faculties():
    """List registered faculties publicly without requiring login."""
    await ensure_default_faculty_seeded()
    cursor = faculties_collection.find({})
    faculties = await cursor.to_list(length=100)

    result = []
    for f in faculties:
        slug = f.get("slug", str(f.get("_id", "")))
        name = f.get("name", slug.title())
        current_sem = f.get("current_semester", "odd")
        result.append(
            FacultyOut(
                id=str(f["_id"]),
                name=f.get("name", "Faculty"),
                slug=slug,
                code=f.get("code", ""),
                description=f.get("description", ""),
                database_name=get_faculty_db_name(slug, current_sem),
                institute_name=f.get("institute_name", "DAYALBAGH EDUCATIONAL INSTITUTE"),
                current_semester=current_sem,
                created_at=f.get("created_at", datetime.now(timezone.utc)),
                user_count=0,
            )
        )
    return result


@router.get("", response_model=list[FacultyOut])
async def list_faculties(user: dict = Depends(get_current_user)):
    """List all registered faculties and their active statistics."""
    await ensure_default_faculty_seeded()
    cursor = faculties_collection.find({})
    faculties = await cursor.to_list(length=100)

    result = []
    for f in faculties:
        slug = f.get("slug", str(f.get("_id", "")))
        name = f.get("name", slug.title())
        current_sem = f.get("current_semester", "odd")
        # Count users associated with this faculty (by slug or name)
        user_count = await users_collection.count_documents({
            "$or": [
                {"faculty": slug},
                {"faculty": name},
                {"faculty": {"$regex": f"^{slug}$", "$options": "i"}},
            ]
        })
        result.append(
            FacultyOut(
                id=str(f["_id"]),
                name=f.get("name", "Faculty"),
                slug=slug,
                code=f.get("code", ""),
                description=f.get("description", ""),
                database_name=get_faculty_db_name(slug, current_sem),
                institute_name=f.get("institute_name", "DAYALBAGH EDUCATIONAL INSTITUTE"),
                current_semester=current_sem,
                created_at=f.get("created_at", datetime.now(timezone.utc)),
                user_count=user_count,
            )
        )
    return result



@router.post("", response_model=FacultyOut, status_code=status.HTTP_201_CREATED)
async def create_faculty(payload: FacultyCreate, user: dict = Depends(require_role("admin"))):
    """
    Create a new faculty and initialize its isolated MongoDB database.
    (Super Admin only)
    """
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Faculty name is required")

    slug = normalize_faculty_slug(payload.slug or payload.name)
    existing = await faculties_collection.find_one({"$or": [{"_id": slug}, {"slug": slug}]})
    if existing:
        raise HTTPException(status_code=400, detail=f"Faculty with slug '{slug}' already exists")

    sem = normalize_semester(payload.current_semester or "odd")
    db_name = get_faculty_db_name(slug, sem)
    now = datetime.now(timezone.utc)
    institute = payload.institute_name.strip() if payload.institute_name else "DAYALBAGH EDUCATIONAL INSTITUTE"

    doc = {
        "_id": slug,
        "name": payload.name.strip(),
        "slug": slug,
        "code": (payload.code or "").strip().upper(),
        "description": (payload.description or "").strip(),
        "database_name": db_name,
        "institute_name": institute,
        "current_semester": sem,
        "created_at": now,
        "created_by": user.get("email"),
    }

    await faculties_collection.insert_one(doc)

    # Initialize default settings & export header in the new isolated database
    fc = get_faculty_collections(slug, sem)
    await fc.settings.replace_one(
        {"_id": "programs"},
        {"list": ["B.Tech", "M.Tech"], "updatedAt": now},
        upsert=True,
    )
    await fc.settings.replace_one(
        {"_id": "export_header"},
        {
            "institute_name": institute,
            "faculty_name": payload.name.strip().upper(),
            "updatedAt": now,
        },
        upsert=True,
    )

    await log_action(
        user,
        "create_faculty",
        f"Created new faculty '{payload.name}' with isolated database '{db_name}'",
    )

    return FacultyOut(
        id=slug,
        name=doc["name"],
        slug=slug,
        code=doc["code"],
        description=doc["description"],
        database_name=db_name,
        institute_name=institute,
        current_semester=sem,
        created_at=now,
        user_count=0,
    )


@router.post("/{slug}/semester", response_model=FacultyOut)
async def switch_faculty_semester(slug: str, payload: FacultySemesterUpdate, user: dict = Depends(require_role("admin", "sub_admin"))):
    """
    Switch the active academic semester ('odd' or 'even') for a faculty.
    Creates and isolates a dedicated database for that semester.
    """
    norm_slug = normalize_faculty_slug(slug)
    user_role = user.get("role", "")
    user_faculty = normalize_faculty_slug(user.get("faculty", ""))

    # Sub-admin can only switch semester for their own assigned faculty
    if user_role != "admin" and user_faculty != norm_slug:
        raise HTTPException(status_code=403, detail="Cannot switch semester for another faculty")

    target_sem = normalize_semester(payload.semester)
    existing = await faculties_collection.find_one({"$or": [{"_id": norm_slug}, {"slug": norm_slug}]})
    if not existing:
        raise HTTPException(status_code=404, detail="Faculty not found")

    new_db_name = get_faculty_db_name(norm_slug, target_sem)
    now = datetime.now(timezone.utc)

    await faculties_collection.update_one(
        {"_id": existing["_id"]},
        {"$set": {"current_semester": target_sem, "database_name": new_db_name, "updated_at": now}},
    )

    # Initialize default settings in the new semester DB if uninitialized
    fc = get_faculty_collections(norm_slug, target_sem)
    programs_doc = await fc.settings.find_one({"_id": "programs"})
    if not programs_doc:
        await fc.settings.replace_one(
            {"_id": "programs"},
            {"list": ["B.Tech", "M.Tech", "B.Sc", "B.A", "B.Com"], "updatedAt": now},
            upsert=True,
        )
    header_doc = await fc.settings.find_one({"_id": "export_header"})
    if not header_doc:
        await fc.settings.replace_one(
            {"_id": "export_header"},
            {
                "institute_name": existing.get("institute_name", "DAYALBAGH EDUCATIONAL INSTITUTE"),
                "faculty_name": existing.get("name", "FACULTY").upper(),
                "updatedAt": now,
            },
            upsert=True,
        )

    await log_action(
        user,
        "switch_semester",
        f"Switched semester for faculty '{norm_slug}' to '{target_sem}' (database: '{new_db_name}')",
    )

    updated = await faculties_collection.find_one({"_id": existing["_id"]})
    return FacultyOut(
        id=str(updated["_id"]),
        name=updated.get("name", norm_slug),
        slug=norm_slug,
        code=updated.get("code", ""),
        description=updated.get("description", ""),
        database_name=new_db_name,
        institute_name=updated.get("institute_name", "DAYALBAGH EDUCATIONAL INSTITUTE"),
        current_semester=target_sem,
        created_at=updated.get("created_at", now),
        user_count=0,
    )


@router.put("/{slug}", response_model=FacultyOut)
async def update_faculty(slug: str, payload: FacultyUpdate, user: dict = Depends(require_role("admin"))):
    """Update faculty details (Super Admin only)."""
    norm_slug = normalize_faculty_slug(slug)
    existing = await faculties_collection.find_one({"$or": [{"_id": norm_slug}, {"slug": norm_slug}]})
    if not existing:
        raise HTTPException(status_code=404, detail="Faculty not found")

    update_fields = {}
    if payload.name is not None and payload.name.strip():
        update_fields["name"] = payload.name.strip()
    if payload.code is not None:
        update_fields["code"] = payload.code.strip().upper()
    if payload.description is not None:
        update_fields["description"] = payload.description.strip()
    if payload.institute_name is not None and payload.institute_name.strip():
        update_fields["institute_name"] = payload.institute_name.strip()
    if payload.current_semester is not None:
        sem = normalize_semester(payload.current_semester)
        update_fields["current_semester"] = sem
        update_fields["database_name"] = get_faculty_db_name(norm_slug, sem)

    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc)
        await faculties_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": update_fields},
        )

    updated = await faculties_collection.find_one({"_id": existing["_id"]})
    await log_action(user, "update_faculty", f"Updated faculty '{norm_slug}' details")

    return FacultyOut(
        id=str(updated["_id"]),
        name=updated.get("name", norm_slug),
        slug=norm_slug,
        code=updated.get("code", ""),
        description=updated.get("description", ""),
        database_name=updated.get("database_name", get_faculty_db_name(norm_slug)),
        institute_name=updated.get("institute_name", "DAYALBAGH EDUCATIONAL INSTITUTE"),
        current_semester=updated.get("current_semester", "odd"),
        created_at=updated.get("created_at", datetime.now(timezone.utc)),
        user_count=0,
    )


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faculty(slug: str, user: dict = Depends(require_role("admin"))):
    """Delete a faculty from registry (Super Admin only)."""
    norm_slug = normalize_faculty_slug(slug)
    if norm_slug in ["engineering", "default"]:
        raise HTTPException(status_code=400, detail="Cannot delete default Engineering Faculty")

    result = await faculties_collection.delete_one({"$or": [{"_id": norm_slug}, {"slug": norm_slug}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Faculty not found")

    await log_action(user, "delete_faculty", f"Deleted faculty '{norm_slug}'")
    return None
