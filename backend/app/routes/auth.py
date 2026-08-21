from fastapi import APIRouter, HTTPException, status
from datetime import datetime, timezone

from app.models.models import UserCreate, UserLogin, UserOut, Token
from app.core.database import users_collection
from app.services.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

VALID_ROLES = {"admin", "sub_admin", "hod", "timetable_incharge", "tt_incharge", "teacher", "student"}


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate):
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    existing = await users_collection.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_doc = {
        "email": payload.email.lower(),
        "password": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": payload.role,
        "faculty": payload.faculty or "",
        "department": payload.department or "",
        "created_at": datetime.now(timezone.utc),
    }

    result = await users_collection.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_access_token({"sub": user_id, "role": payload.role, "faculty": payload.faculty or ""})

    user_out = UserOut(
        id=user_id,
        email=user_doc["email"],
        name=user_doc["name"],
        role=user_doc["role"],
        faculty=user_doc["faculty"],
        department=user_doc["department"],
        created_at=user_doc["created_at"],
    )
    from app.routes.audit_logs import log_action
    await log_action(user_doc, "USER_REGISTER", f"New user registered: {user_doc['email']} (Role: {user_doc['role']})", faculty=user_doc["faculty"])
    return Token(access_token=token, user=user_out)


@router.post("/login", response_model=Token)
async def login(payload: UserLogin):
    user = await users_collection.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id, "role": user["role"], "faculty": user.get("faculty", "")})

    user_out = UserOut(
        id=user_id,
        email=user["email"],
        name=user["name"],
        role=user["role"],
        faculty=user.get("faculty", ""),
        department=user.get("department", ""),
        created_at=user.get("created_at") or datetime.now(timezone.utc),
    )
    from app.routes.audit_logs import log_action
    await log_action(user, "AUTH_LOGIN", f"User {user['email']} logged in (Role: {user['role']})", faculty=user.get("faculty", ""))
    return Token(access_token=token, user=user_out)
