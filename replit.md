# SMARTCLASS

Classroom management system for Exequiel R. Lina High School (ERLHS). Handles attendance, academics, announcements, and student/teacher dashboards.

## Stack

- **Frontend**: React 18 + Vite (port 5000)
- **Backend**: Express + TypeScript via `tsx watch` (port 3001)
- **Database**: In-memory JSON (persisted to `data/db.json`) — no external DB required

## Running the app

```
npm run dev
```

Starts both the Vite dev server (port 5000) and the Express API (port 3001) concurrently.

## Demo credentials

| Role    | Login field | Value                      | Password    |
|---------|-------------|----------------------------|-------------|
| Admin   | username    | admin                      | admin123    |
| Teacher | email       | teacher@erlhs.edu.ph       | teacher123  |
| Student | student no. | 2024-00001                 | student123  |

## Project structure

```
client/      React frontend (Vite)
server/      Express API (TypeScript)
  routes/    API route handlers
  db.ts      In-memory JSON database
data/        Persisted db.json
uploads/     File uploads (auto-created)
prisma/      Schema file (not used at runtime — app uses JSON db)
```

## User preferences
