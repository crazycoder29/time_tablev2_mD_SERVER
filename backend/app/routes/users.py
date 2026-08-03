from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime
from bson import ObjectId

from app.models.models import UserCreate, UserOut, UserUpdate, UserPasswordChange
from app.core.database import users_collection
from app.services.security import hash_password
from app.services.dependencies import require_role
from app.routes.audit_logs import log_action

router = APIRouter(prefix="/api/users", tags=["users"])

VALID_ROLES = {"admin", "hod", "timetable_incharge", "tt_incharge"}


@router.get("", response_model=list[UserOut])
async def list_users(current_user: dict = Depends(require_role("admin"))):
    cursor = users_collection.find().sort("name", 1)
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
            created_at=u.get("created_at") or datetime.utcnow(),
        ))
    return result


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, current_user: dict = Depends(require_role("admin"))):
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role. Must be admin, hod, or timetable_incharge")

    existing = await users_collection.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="User with this email already exists")

    user_doc = {
        "email": payload.email.lower(),
        "password": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": payload.role,
        "faculty": payload.faculty or "",
        "department": payload.department or "",
        "created_at": datetime.utcnow(),
    }

    res = await users_collection.insert_one(user_doc)
    user_id = str(res.inserted_id)

    await log_action(current_user, "CREATE_USER", f"Created user {payload.email} with role {payload.role}")

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
async def update_user(user_id: str, payload: UserUpdate, current_user: dict = Depends(require_role("admin"))):
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role. Must be admin, hod, or timetable_incharge")

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    existing = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if email is being taken by another user
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
        created_at=updated.get("created_at") or datetime.utcnow(),
    )


@router.put("/{user_id}/password")
async def change_user_password(user_id: str, payload: UserPasswordChange, current_user: dict = Depends(require_role("admin"))):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    if not payload.new_password or len(payload.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters long")

    existing = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    hashed = hash_password(payload.new_password.strip())
    await users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"password": hashed}})

    await log_action(current_user, "CHANGE_USER_PASSWORD", f"Changed password for user {existing['email']}")

    return {"status": "ok", "message": "Password updated successfully"}


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_role("admin"))):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    if str(current_user["_id"]) == str(user_id):
        raise HTTPException(status_code=400, detail="You cannot delete your own active admin account")

    existing = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    await users_collection.delete_one({"_id": ObjectId(user_id)})

    await log_action(current_user, "DELETE_USER", f"Deleted user {existing['email']}")

    return {"status": "ok", "message": "User deleted successfully"}
