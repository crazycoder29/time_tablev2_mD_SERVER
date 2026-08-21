import re
from dataclasses import dataclass
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from app.core.config import settings

client = AsyncIOMotorClient(settings.mongo_uri)
master_db = client[settings.database_name]
db = master_db  # Default DB alias

# Central collections stored in master database
users_collection: AsyncIOMotorCollection = master_db["users"]
faculties_collection: AsyncIOMotorCollection = master_db["faculties"]

# Default / Fallback collections (for Engineering / backward compatibility)
rooms_collection = master_db["rooms"]
teachers_collection = master_db["teachers"]
courses_collection = master_db["courses"]
timetables_collection = master_db["timetables"]
schedules_collection = master_db["schedules"]
curriculums_collection = master_db["curriculums"]
settings_collection = master_db["settings"]
audit_logs_collection = master_db["audit_logs"]


def normalize_faculty_slug(name_or_slug: str) -> str:
    """Normalize a faculty name or slug into a safe lowercase alphanumeric identifier."""
    if not name_or_slug:
        return "engineering"
    s = name_or_slug.strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s-]+", "_", s)
    return s or "engineering"


def normalize_semester(semester: str) -> str:
    """Normalize semester into 'odd' or 'even'."""
    if not semester:
        return "odd"
    s = str(semester).strip().lower()
    return "even" if "even" in s else "odd"


@dataclass
class FacultyCollections:
    slug: str
    semester: str
    db_name: str
    db: AsyncIOMotorDatabase
    rooms: AsyncIOMotorCollection
    teachers: AsyncIOMotorCollection
    courses: AsyncIOMotorCollection
    timetables: AsyncIOMotorCollection
    schedules: AsyncIOMotorCollection
    curriculums: AsyncIOMotorCollection
    settings: AsyncIOMotorCollection
    audit_logs: AsyncIOMotorCollection


_collections_cache: dict[str, FacultyCollections] = {}


def get_faculty_db_name(faculty_slug: str, semester_type: str = "odd") -> str:
    """
    Return the database name for a given faculty slug and semester (odd/even).
    
    Engineering:
      - Odd semester: 'deitimetable' (100% preservation of existing default data)
      - Even semester: 'deitimetable_even'
    
    Other Faculties (e.g. Arts, Commerce):
      - Odd semester: 'deitimetable_{slug}_odd' (or 'deitimetable_{slug}')
      - Even semester: 'deitimetable_{slug}_even'
    """
    slug = normalize_faculty_slug(faculty_slug)
    sem = normalize_semester(semester_type)

    if slug in ["engineering", "default", "deitimetable", "master"]:
        if sem == "even":
            return f"{settings.database_name}_even"
        return settings.database_name

    if sem == "even":
        return f"{settings.database_name}_{slug}_even"
    return f"{settings.database_name}_{slug}_odd"


def get_faculty_db(faculty_slug: str, semester_type: str = "odd") -> AsyncIOMotorDatabase:
    """Get the Motor database handle for a given faculty and semester."""
    db_name = get_faculty_db_name(faculty_slug, semester_type)
    return client[db_name]


def get_faculty_collections(faculty_slug: str, semester_type: str = "odd") -> FacultyCollections:
    """Get all collection handles scoped to a specific faculty's isolated semester database."""
    slug = normalize_faculty_slug(faculty_slug)
    sem = normalize_semester(semester_type)
    cache_key = f"{slug}:{sem}"

    if cache_key in _collections_cache:
        return _collections_cache[cache_key]

    f_db_name = get_faculty_db_name(slug, sem)
    f_db = client[f_db_name]

    fc = FacultyCollections(
        slug=slug,
        semester=sem,
        db_name=f_db_name,
        db=f_db,
        rooms=f_db["rooms"],
        teachers=f_db["teachers"],
        courses=f_db["courses"],
        timetables=f_db["timetables"],
        schedules=f_db["schedules"],
        curriculums=f_db["curriculums"],
        settings=f_db["settings"],
        audit_logs=f_db["audit_logs"],
    )
    _collections_cache[cache_key] = fc
    return fc