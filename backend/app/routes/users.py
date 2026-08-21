from fastapi import APIRouter, HTTPException, Depends, status, Request
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional

from app.models.models import UserCreate, UserOut, UserUpdate, UserPasswordChange
from app.core.database import users_collection, normalize_faculty_slug
from app.services.security import hash_password
from app.services.dependencies import require_role, get_current_user
from app.routes.audit_logs import log_action

router = APIRouter(prefix="/api/users", tags=["users"])

VALID_ROLES = {"admin", "sub_admin", "hod", "timetable_incharge", "tt_incharge", "teacher", "student"}


@router.get("", response_model=list[UserOut])
async def list_users(
    faculty: Optional[str] = None,
    current_user: dict = Depends(require_role("admin", "sub_admin")),
):
    """
    List users:
    - Super Admin: can view all users, or filter by faculty.
    - Sub Admin: strictly sees users belonging to their assigned faculty.
    """
    user_role = current_user.get("role", "")
    query = {}

    if user_role == "sub_admin":
        user_fac = current_user.get("faculty") or "engineering"
        user_fac_slug = normalize_faculty_slug(user_fac)
        query = {
            "$or": [
                {"faculty": user_fac},
                {"faculty": user_fac_slug},
                {"faculty": {"$regex": f"^{user_fac}$", "$options": "i"}},
            ]
        }
    elif faculty and faculty != "all":
        norm_fac = normalize_faculty_slug(faculty)
        query = {
            "$or": [
                {"faculty": faculty},
                {"faculty": norm_fac},
                {"faculty": {"$regex": f"^{faculty}$", "$options": "i"}},
            ]
        }

    cursor = users_collection.find(query).sort("name", 1)
    users = await cursor.to_list(length=None)

    result = []
    for u in users:
        result.append(UserOut(
            id=str(u["_id"]),
            email=u.get("email", ""),
            name=u.get("name", ""),
            role=u.get("role", "timetable_incharge"),
            faculty=u.get("faculty", ""),
            department=u.get("department", ""),
            created_at=u.get("created_at") or datetime.now(timezone.utc),
        ))
    return result


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, current_user: dict = Depends(require_role("admin", "sub_admin"))):
    """Create a new user account."""
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role specified")

    user_role = current_user.get("role", "")
    assigned_faculty = payload.faculty or ""

    if user_role == "sub_admin":
        # Sub admins cannot create Super Admin accounts
        if payload.role == "admin":
            raise HTTPException(status_code=403, detail="Sub Admin cannot create Super Admin accounts")
        # Sub admin can only create accounts inside their own faculty
        assigned_faculty = current_user.get("faculty") or "engineering"

    existing = await users_collection.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="User with this email already exists")

    user_doc = {
        "email": payload.email.lower(),
        "password": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": payload.role,
        "faculty": assigned_faculty,
        "department": payload.department or "",
        "created_at": datetime.now(timezone.utc),
    }

    res = await users_collection.insert_one(user_doc)
    user_id = str(res.inserted_id)

    await log_action(
        current_user,
        "CREATE_USER",
        f"Created user {payload.email} with role {payload.role} in faculty '{assigned_faculty}'",
    )

    return UserOut(
        id=user_id,
        email=user_doc["email"],
        name=user_doc["name"],
        role=user_doc["role"],
        faculty=user_doc["faculty"],
        department=user_doc["department"],
        created_at=user_doc["created_at"],
    )


@router.put("/{user_id}", response_model=UserOut)
async def update_user(user_id: str, payload: UserUpdate, current_user: dict = Depends(require_role("admin", "sub_admin"))):
    """Update user information and role."""
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role specified")

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    existing = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    user_role = current_user.get("role", "")
    if user_role == "sub_admin":
        # Ensure target user is in sub_admin's faculty
        user_fac = normalize_faculty_slug(current_user.get("faculty") or "")
        target_fac = normalize_faculty_slug(existing.get("faculty") or "")
        if user_fac != target_fac:
            raise HTTPException(status_code=403, detail="Cannot edit user from another faculty")
        if payload.role == "admin":
            raise HTTPException(status_code=403, detail="Cannot assign Super Admin role")
        payload.faculty = current_user.get("faculty")

    # Check if email is taken by another user
    email_check = await users_collection.find_one({"email": payload.email.lower(), "_id": {"$ne": ObjectId(user_id)}})
    if email_check:
        raise HTTPException(status_code=409, detail="Email is already used by another user")

    update_fields = {
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "role": payload.role,
        "faculty": payload.faculty or "",
        "department": payload.department or "",
    }

    await users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_fields})
    updated = await users_collection.find_one({"_id": ObjectId(user_id)})

    await log_action(current_user, "UPDATE_USER", f"Updated user {payload.email} (Role: {payload.role})")

    return UserOut(
        id=str(updated["_id"]),
        email=updated["email"],
        name=updated["name"],
        role=updated["role"],
        faculty=updated.get("faculty", ""),
        department=updated.get("department", ""),
        created_at=updated.get("created_at") or datetime.now(timezone.utc),
    )


@router.put("/{user_id}/password")
async def change_user_password(user_id: str, payload: UserPasswordChange, current_user: dict = Depends(require_role("admin", "sub_admin"))):
    """Change password for a user."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    if not payload.new_password or len(payload.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters long")

    existing = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.get("role") == "sub_admin":
        user_fac = normalize_faculty_slug(current_user.get("faculty") or "")
        target_fac = normalize_faculty_slug(existing.get("faculty") or "")
        if user_fac != target_fac:
            raise HTTPException(status_code=403, detail="Cannot change password for user from another faculty")

    hashed = hash_password(payload.new_password.strip())
    await users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"password": hashed}})

    await log_action(current_user, "CHANGE_USER_PASSWORD", f"Changed password for user {existing['email']}")

    return {"status": "ok", "message": "Password updated successfully"}


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_role("admin", "sub_admin"))):
    """Delete a user account."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    if str(current_user["_id"]) == str(user_id):
        raise HTTPException(status_code=400, detail="You cannot delete your own active account")

    existing = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.get("role") == "sub_admin":
        user_fac = normalize_faculty_slug(current_user.get("faculty") or "")
        target_fac = normalize_faculty_slug(existing.get("faculty") or "")
        if user_fac != target_fac:
            raise HTTPException(status_code=403, detail="Cannot delete user from another faculty")
        if existing.get("role") == "admin":
            raise HTTPException(status_code=403, detail="Cannot delete Super Admin account")

    await users_collection.delete_one({"_id": ObjectId(user_id)})

    await log_action(current_user, "DELETE_USER", f"Deleted user {existing['email']}")

    return {"status": "ok", "message": "User deleted successfully"}

