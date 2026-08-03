from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client = AsyncIOMotorClient(settings.mongo_uri)
db = client[settings.database_name]

# Collections, one handle per collection, reused everywhere
users_collection = db["users"]
rooms_collection = db["rooms"]
teachers_collection = db["teachers"]
courses_collection = db["courses"]
timetables_collection = db["timetables"]
schedules_collection = db["schedules"]
curriculums_collection = db["curriculums"]
settings_collection = db["settings"]
audit_logs_collection = db["audit_logs"]