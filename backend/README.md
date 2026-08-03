# Planovate Backend API

Backend API for **Planovate**, a university timetable management system built using **FastAPI** and **MongoDB**.

This backend provides authentication, resource management (teachers, rooms, courses), curriculum management, timetable generation, schedule storage, application settings, and audit logging.

---

# Project Purpose

Planovate is designed to help educational institutions create and manage class timetables while reducing scheduling conflicts.

The backend exposes REST APIs used by the frontend for:

- Authentication
- User management
- Teacher management
- Room management
- Course management
- Curriculum management
- Timetable metadata
- Schedule storage
- Application settings
- Audit logs

---

# Technology Stack

- Python 3.11+
- FastAPI
- MongoDB
- Motor (Async MongoDB Driver)
- Pydantic v2
- JWT Authentication
- bcrypt Password Hashing

---

# Project Structure

```
backend/
│
├── app/
│   ├── core/
│   │      config.py
│   │      database.py
│   │
│   ├── models/
│   │      models.py
│   │
│   ├── routes/
│   │      auth.py
│   │      teachers.py
│   │      rooms.py
│   │      courses.py
│   │      curriculums.py
│   │      timetables.py
│   │      schedules.py
│   │      settings.py
│   │      audit_logs.py
│   │
│   ├── services/
│   │      security.py
│   │      dependencies.py
│   │      timetable_helpers.py
│   │
│   └── main.py
│
├── requirements.txt
└── README.md
```

---

# Architecture

```
Client
   │
   ▼
FastAPI Router
   │
   ▼
Business Logic
   │
   ▼
MongoDB
```

Authentication happens through JWT Bearer Tokens.

Most routes require authentication.

Certain routes additionally require specific roles.

---

# Environment Variables

Create a `.env` file inside the backend directory.

```
mongo_uri=mongodb://localhost:27017

database_name=deitimetable

jwt_secret=YOUR_SECRET_KEY

jwt_algorithm=HS256

access_token_expire_minutes=10080
```

---

# Installation

Clone repository

```bash
git clone <repository-url>
```

Move inside backend

```bash
cd backend
```

Create virtual environment

```bash
python -m venv .venv
```

Activate

Windows

```bash
.venv\Scripts\activate
```

Linux/Mac

```bash
source .venv/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

---

# Running the Server

```bash
uvicorn app.main:app --reload
```

Server starts at

```
http://localhost:8000
```

Swagger UI

```
http://localhost:8000/docs
```

OpenAPI JSON

```
http://localhost:8000/openapi.json
```

Health Check

```
GET /api
```

Response

```json
{
  "status":"ok",
  "message":"Planovate FastAPI backend running"
}
```

---

# Authentication

Authentication uses JWT Bearer Tokens.

Workflow:

```
Register
    ↓
Login
    ↓
Receive JWT
    ↓
Add Authorization Header
    ↓
Access Protected APIs
```

Authorization header

```
Authorization: Bearer <access_token>
```

---

# User Roles

Supported roles

| Role | Description |
|-------|------------|
| admin | Full access |
| tt_incharge | Timetable management |
| hod | Department Head |
| teacher | Faculty |
| student | Read only |

Only

- admin
- tt_incharge

can modify timetable resources.

---

# MongoDB Collections

```
users

teachers

rooms

courses

curriculums

timetables

schedules

settings

audit_logs
```

---

# API Reference

---

## Authentication

Base URL

```
/api/auth
```

### Register

```
POST /register
```

Public

Creates a new user.

---

### Login

```
POST /login
```

Public

Returns JWT token.

---

## Teachers

Base URL

```
/api/teachers
```

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | / | List teachers |
| GET | /faculties | Faculty list |
| GET | /departments | Department list |
| POST | / | Create / Update teacher |
| DELETE | /{unid} | Delete teacher |

GET supports

```
faculty

department
```

query parameters.

---

## Rooms

Base URL

```
/api/rooms
```

| Method | Endpoint |
|---------|----------|
| GET | / |
| GET | /faculties |
| POST | / |
| DELETE | /{unid} |

GET supports

```
faculty
```

filter.

---

## Courses

Base URL

```
/api/courses
```

| Method | Endpoint |
|---------|----------|
| GET | / |
| GET | /departments |
| GET | /semesters |
| POST | / |
| DELETE | /{unid} |

Filters

```
faculty

department

semester
```

---

## Curriculum

Base URL

```
/api/curriculums
```

| Method | Endpoint |
|---------|----------|
| GET | / |
| GET | /{curriculum_id} |
| POST | / |
| DELETE | /{curriculum_id} |

Curriculum IDs are automatically generated from

```
Class
Branch
Semester
Type
```

---

## Timetables

Base URL

```
/api/timetables
```

| Method | Endpoint |
|---------|----------|
| GET | / |
| GET | /all-meta |
| GET | /{id} |
| POST | /preset |
| PUT | /{id}/meta |
| POST | /save |
| DELETE | /{id} |

Supports

```
faculty

department

semester
```

filters.

---

## Schedules

Base URL

```
/api/schedules
```

| Method | Endpoint |
|---------|----------|
| GET | / |
| GET | /all |
| POST | / |
| DELETE | /by-timetable/{id} |
| DELETE | /{schedule_id} |

The POST endpoint completely synchronizes schedules.

Meaning:

- new schedules inserted
- existing updated
- removed schedules deleted automatically

---

## Settings

Base URL

```
/api/settings
```

| Method | Endpoint |
|---------|----------|
| GET | /programs |
| POST | /programs |
| GET | /branches |
| POST | /branches |
| GET | /all |

Stores application configuration.

---

## Audit Logs

Base URL

```
/api/audit-logs
```

| Method | Endpoint |
|---------|----------|
| GET | / |

Supports

```
days=30
```

query parameter.

---

# Resource IDs

Several resources use numeric timestamps as unique IDs.

Examples

```
Teacher.unid

Room.unid

Course.unid
```

Timetables use deterministic string IDs

Example

```
tt_btech__cse__5__regular
```

Schedules use generated IDs

```
<timetable>__<table>-<row>-<column>-<batch>
```

---

# Security

Passwords

- bcrypt hashed

Authentication

- JWT

Authorization

- Role Based Access Control

---

# Data Relationships

```
Faculty
   │
   ├────────► Department
                    │
                    ├────────► Teachers
                    │
                    ├────────► Courses
                    │
                    └────────► Timetables
                                   │
                                   └────────► Schedules
```

---

# Timetable Saving Flow

```
Frontend

        │

        ▼

POST /timetables/save

        │

        ▼

Save timetable metadata

        │

        ▼

Generate schedule entries

        │

        ▼

Insert / Update schedules

        │

        ▼

Delete removed schedule entries

        │

        ▼

Return summary
```

---

# Authentication Requirements

Public endpoints

```
POST /api/auth/register

POST /api/auth/login

GET /api
```

Everything else requires

```
Authorization: Bearer <JWT>
```

Write operations additionally require

```
admin

or

tt_incharge
```

---

# Design Decisions

- Async MongoDB operations using Motor.
- JWT contains only user ID and role.
- Timetable IDs are deterministic rather than random.
- Schedule documents are normalized for efficient querying.
- Audit logging is intentionally non-blocking so failures never interrupt user operations.
- Timetable metadata and schedule data are stored separately.
- API follows REST conventions with JSON payloads.

---

# Known Behaviors

- Updating timetable metadata to produce a new timetable ID creates a new timetable document but does **not** migrate existing schedules to the new ID. This mirrors the behavior of the original Firebase implementation.
- Schedule synchronization deletes any schedule entries that are omitted from the latest save payload.
- `POST` endpoints for Teachers, Rooms, and Courses act as **upsert** operations: providing an existing `unid` updates the resource; omitting it creates a new one.

---

# Future Improvements

- Refresh token support
- Pagination
- Rate limiting
- File import/export
- Soft deletes
- API versioning
- Unit and integration tests
- Docker deployment
- CI/CD pipeline

---

# Summary

Planovate Backend is an asynchronous FastAPI REST API for university timetable management. It provides secure JWT-based authentication, role-based authorization, CRUD operations for academic resources, normalized timetable and schedule storage, application settings, and audit logging, all backed by MongoDB using Motor.