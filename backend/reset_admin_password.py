import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.services.security import hash_password

async def main():
    try:
        client = AsyncIOMotorClient(settings.mongo_uri)
        db = client[settings.database_name]
        users = db["users"]
        
        email = "admin@dei.ac.in"
        new_password_hash = hash_password("admin123")
        
        result = await users.update_one(
            {"email": email},
            {"$set": {"password": new_password_hash}}
        )
        print(f"Updated admin user: matched={result.matched_count}, modified={result.modified_count}")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
