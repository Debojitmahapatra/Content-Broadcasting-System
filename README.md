# Content Broadcasting System – GrubPac

A RESTful backend API that allows teachers to upload educational content, principals to approve or reject submissions, and a public broadcast endpoint that serves the currently active content per subject using a deterministic rotation algorithm.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (ESM) |
| Framework | Express 5 |
| Database | PostgreSQL 15+ via Sequelize ORM |
| Cache (optional) | Redis via ioredis |
| Auth | JWT (jsonwebtoken) + bcrypt |
| File Upload | Multer (local disk storage) |
| Validation | express-validator |
| Security | helmet, cors, express-rate-limit |

---

## Prerequisites

- Node.js >= 20
- PostgreSQL >= 15 (running locally or remote)
- Redis (optional — set `ENABLE_CACHE=true` in `.env` to activate)

---

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd "Backend Developer Assignment – GrubPac/backend"
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
PORT=3000

DB_NAME=grubpac_db
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432

JWT_SECRET=your_super_secret_jwt_key

# Optional Redis caching
ENABLE_CACHE=false
REDIS_URL=redis://localhost:6379
```

### 4. Create the database

```bash
psql -U postgres -c "CREATE DATABASE grubpac_db;"
```

### 5. Run migrations (sync tables)

```bash
npm run db:migrate
```

### 6. Seed the default principal account

```bash
npm run db:seed
```

This creates a default principal: `principal@grubpac.com` / `Admin@1234`

### 7. Start the server

```bash
# Production
npm start

# Development (with file watcher)
npm run dev
```

Server runs at `http://localhost:3000`

---

## API Documentation

Import the Postman collection from:

```
src/docs/ContentBroadcastingSystem.postman_collection.json
```

### Endpoint Summary

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | No | Any | Register a new user |
| POST | `/api/auth/login` | No | Any | Login and receive JWT |
| POST | `/api/content/upload` | Yes | Teacher | Upload content with file |
| GET | `/api/content/my-uploads` | Yes | Teacher | List own uploads |
| GET | `/api/content/:id` | Yes | Any | Get content by ID |
| GET | `/api/approval/pending` | Yes | Principal | List pending submissions |
| POST | `/api/approval/approve/:contentId` | Yes | Principal | Approve content |
| POST | `/api/approval/reject/:contentId` | Yes | Principal | Reject with reason |
| GET | `/api/broadcast/live/:teacherId` | No | Public | Get currently active content |
| GET | `/health` | No | Public | Health check |

---

## Deployment

The API is deployed on Render:

> **Base URL:** `https://grubpac-api.onrender.com` *(update with your actual URL)*

---

## Assumptions Made

1. A teacher can only upload content — they cannot approve their own submissions.
2. The broadcast endpoint is intentionally public (no auth) to allow display screens to poll without managing tokens.
3. Content `start_time` / `end_time` defines the window during which a piece is eligible to appear in the rotation. Content outside this window is silently skipped.
4. Each content item rotates for a fixed 5-minute slot by default (`duration_minutes = 5`).
5. The rotation cycle is anchored to `subject_schedules.created_at`, making it deterministic and stateless — any server instance will compute the same active item for the same timestamp.
6. Only one `SubjectSchedule` row exists per subject; it is created on first approval for that subject.
7. File storage is local (`/uploads`). For production, swap to S3 (see architecture notes).
8. Redis caching is opt-in via `ENABLE_CACHE=true`. The app runs fully without Redis.

---

## Edge Cases Handled

- Duplicate email registration returns `409 Conflict`.
- Login with wrong credentials returns a generic `401` (no user enumeration).
- Approving/rejecting already-processed content returns `400` with a clear message.
- Broadcast for a teacher with no approved content returns `{ message: "No content available" }` (not a 404).
- Content whose time window has expired is excluded from the rotation automatically.
- Upload rate limit: 30 uploads/hour per user. Broadcast rate limit: 100 req/min per IP.
- File type validation rejects anything that is not an image or PDF.
- Rotation with a single item loops that item continuously.
- Negative modulo edge case in rotation offset is handled with `((elapsed % total) + total) % total`.

---

## Bonus Features Implemented

- **Redis caching** for broadcast responses (opt-in, graceful fallback when Redis is unavailable).
- **Rate limiting** — separate limiters for upload (per user) and broadcast (per IP).
- **Subject filter** on broadcast endpoint (`?subject=Maths`).
- **Next content preview** — broadcast response includes `nextContent` so display screens can pre-load.
- **`remainingSeconds`** — tells the client exactly when to refresh for the next item.
- **Rotation prediction** (`getNextContentTime`) — calculates when a specific content piece will next be active.
- **Helmet** security headers on all responses.
- **Global error handler** with `AppError` class for consistent error shape.
- **`asyncWrapper`** utility eliminates try/catch boilerplate in every controller.
