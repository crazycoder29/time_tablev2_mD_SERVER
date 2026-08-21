from pydantic import ConfigDict
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

# ── What a client sends when registering ────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # "admin", "hod", "teacher", "tt_incharge", "student"
    faculty: Optional[str] = ""
    department: Optional[str] = ""

# ── What a client sends when logging in ─────────────────────────────────
class UserLogin(BaseModel):
    email: EmailStr
    password: str

# ── What the API sends back, never includes the password ────────────────
class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    faculty: str = ""
    department: str = ""
    created_at: datetime

# ── What actually gets stored in MongoDB ─────────────────────────────────
class UserInDB(BaseModel):
    email: str
    password: str  # hashed, never plaintext
    name: str
    role: str
    faculty: str = ""
    department: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ── Token response after successful login/register ───────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# ── Admin User Management Schemas ────────────────────────────────────────
class UserUpdate(BaseModel):
    name: str
    email: EmailStr
    role: str
    faculty: Optional[str] = ""
    department: Optional[str] = ""

class UserPasswordChange(BaseModel):
    new_password: str



# ── Rooms ──────────────────────────────────────────────────────────────────
class DayAvailability(BaseModel):
    time: list[str] = []

class Availability(BaseModel):
    mon: DayAvailability = DayAvailability()
    tue: DayAvailability = DayAvailability()
    wed: DayAvailability = DayAvailability()
    thu: DayAvailability = DayAvailability()
    fri: DayAvailability = DayAvailability()
    sat: DayAvailability = DayAvailability()

class RoomCreate(BaseModel):
    unid: Optional[str | int] = None   # if not given, we generate one
    ID: str = ""
    name: str
    capacity: int
    floor: str = ""
    faculty: str = ""
    availability: Optional[dict] = None  # {"day": {"mon": {"time": []}, ...}}

class RoomOut(BaseModel):
    unid: str | int
    ID: str = ""
    name: str
    capacity: int
    floor: str = ""
    faculty: str = ""
    availability: dict


# ── Teachers ─────────────────────────────────────────────────────────────
class TeacherCreate(BaseModel):
    unid: Optional[str | int] = None
    ID: str = ""
    name: str
    faculty: str = ""
    department: str = ""

class TeacherOut(BaseModel):
    unid: str | int
    ID: str = ""
    name: str
    faculty: str = ""
    department: str = ""

# ── Courses ──────────────────────────────────────────────────────────────
class CourseCreate(BaseModel):
    unid: Optional[str | int] = None
    ID: str = ""
    name: str
    code: str = ""
    credits: str = ""
    teachers: list[str | int] = []   # list of teacher unids
    faculty: str = ""
    department: str = ""
    semester: str = ""
    hasBatches: bool = False
    batches: list[str] = []
    batchTeachers: dict[str, list[str | int]] = {}
    batchName: Optional[str] = None
    parentCourseId: Optional[str | int] = None

class CourseOut(BaseModel):
    unid: str | int
    ID: str = ""
    name: str
    code: str = ""
    credits: str = ""
    teachers: list[str | int] = []
    faculty: str = ""
    department: str = ""
    semester: str = ""
    hasBatches: bool = False
    batches: list[str] = []
    batchTeachers: dict[str, list[str | int]] = {}
    batchName: Optional[str] = None
    parentCourseId: Optional[str | int] = None

# ── Schedules ────────────────────────────────────────────────────────────
class ScheduleItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    timetableId: str
    tableId: str
    rowIndex: int = 0
    colIndex: int = 0
    batchIndex: int = 0
    day: str = ""
    time: str = ""
    class_: str = Field("", alias="class")
    branch: str = ""
    batch: str = ""
    type: str = ""
    courseId: str = ""
    teacherId: str = ""   # NOTE: may be a comma-separated list of unids, kept as-is
    roomId: str = ""
    remark: Optional[str] = None


class SaveSchedulesRequest(BaseModel):
    timetableId: str
    schedules: list[ScheduleItem] = []


# ── Timetables ───────────────────────────────────────────────────────────
class TimetableMetaIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = ""
    class_: str = Field(..., alias="class")
    branch: str
    faculty: str = ""
    department: str = ""
    semester: str
    type: str
    days: list[str] = []
    timeSlots: list[str] = []


class SaveTimetableRequest(BaseModel):
    meta: TimetableMetaIn
    tables: list[str] = []
    days: list[str] = []
    timeSlots: list[str] = []
    batchesByTable: dict = {}
    batchDataByTable: dict = {}

# ── Curriculums ──────────────────────────────────────────────────────────
class CurriculumIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    className: str
    branch: str
    semester: str
    type: str
    courses: list[dict] = []
    # NOTE: `courses` entries are polymorphic — either
    #   {unid, name, code, credits}          (manual entry, Curriculum.jsx)
    # or
    #   {courseId, teacherIds: [...]}         (auto-extracted, CurriculumModal.jsx)
    # Left as list[dict] on purpose so neither flow's payload gets coerced/rejected.

# ── Settings ─────────────────────────────────────────────────────────────
class SaveProgramsRequest(BaseModel):
    programs: list[str] = []


class BranchEntry(BaseModel):
    name: str
    programs: list[str] = []


class SaveBranchesRequest(BaseModel):
    branches: list[BranchEntry] = []


class ExportHeaderSettings(BaseModel):
    institute_name: str = "DAYALBAGH EDUCATIONAL INSTITUTE"
    faculty_name: str = "ENGINEERING FACULTY"


# ── Faculties ────────────────────────────────────────────────────────────
class FacultyCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    code: Optional[str] = ""
    description: Optional[str] = ""
    institute_name: Optional[str] = "DAYALBAGH EDUCATIONAL INSTITUTE"
    current_semester: Optional[str] = "odd"


class FacultyUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    institute_name: Optional[str] = None
    current_semester: Optional[str] = None


class FacultySemesterUpdate(BaseModel):
    semester: str  # "odd" or "even"


class FacultyOut(BaseModel):
    id: str
    name: str
    slug: str
    code: str = ""
    description: str = ""
    database_name: str
    institute_name: str = "DAYALBAGH EDUCATIONAL INSTITUTE"
    current_semester: str = "odd"
    created_at: datetime
    user_count: int = 0


# ── Audit Logs ───────────────────────────────────────────────────────────
class AuditLogEntry(BaseModel):
    user: str
    action: str
    details: str
    timestamp: datetime