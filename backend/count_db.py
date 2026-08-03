import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def main():
    try:
        client = AsyncIOMotorClient(settings.mongo_uri)
        db = client[settings.database_name]
        
        collections = [
            "users", "rooms", "teachers", "courses", "timetables", 
            "schedules", "curriculums", "settings", "audit_logs"
        ]
        
        print("Database counts:")
        for name in collections:
            count = await db[name].count_documents({})
            print(f"- {name}: {count}")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
