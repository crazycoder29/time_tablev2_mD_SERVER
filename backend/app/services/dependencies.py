from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from bson import ObjectId
from bson.errors import InvalidId

from app.services.security import decode_access_token
from app.core.database import (
    users_collection,
    get_faculty_collections,
    normalize_faculty_slug,
    normalize_semester,
    FacultyCollections
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_error

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_error

    try:
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
    except InvalidId:
        raise credentials_error

    if user is None:
        raise credentials_error

    return user


def require_role(*allowed_roles: str):
    """
    Role check decorator: allows specified roles.
    Maps "admin" to allow super admins, and checks exact matching.
    """
    async def role_checker(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get("role", "")
        # Super admin always passes if "admin" is allowed
        if "admin" in allowed_roles and user_role == "admin":
            return user

        # Normalize role aliases (e.g. tt_incharge vs timetable_incharge)
        aliases = {
            "timetable_incharge": "tt_incharge",
            "tt_incharge": "tt_incharge",
            "sub_admin": "sub_admin",
            "faculty_admin": "sub_admin",
        }
        normalized_user_role = aliases.get(user_role, user_role)
        normalized_allowed = [aliases.get(r, r) for r in allowed_roles]

        if normalized_user_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user
    return role_checker


async def get_faculty_context(request: Request, user: dict = Depends(get_current_user)) -> FacultyCollections:
    """
    Resolves the faculty and semester database context for the active request.
    - Super Admin: can switch context via X-Faculty-Context and X-Semester-Context headers.
    - Sub Admin & Faculty Staff: strictly locked to their assigned user['faculty'], can switch X-Semester-Context.
    """
    user_role = user.get("role", "")
    assigned_faculty = user.get("faculty") or ""

    if user_role == "admin":
        header_faculty = request.headers.get("x-faculty-context") or request.query_params.get("faculty")
        target_slug = header_faculty or assigned_faculty or "engineering"
    else:
        target_slug = assigned_faculty or "engineering"

    target_semester = (
        request.headers.get("x-semester-context")
        or request.query_params.get("semester")
        or "odd"
    )

    return get_faculty_collections(target_slug, target_semester)