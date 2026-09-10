# SMARTCLASS Direct Supabase / Cloudinary Architecture

This revision converts the remaining normal runtime CRUD routes away from the in-memory compatibility database as the source of truth.

## Direct Supabase/Prisma runtime routes
- `server/routes/structure.ts`
  - Academic years
  - Grade levels
  - Strands
  - Sections
  - Subjects
  - Class schedules
  - Section students
- `server/routes/attendance.ts`
  - Attendance sessions
  - Attendance records
  - Session codes
  - Student self-attendance
  - Admin attendance listing
- `server/routes/presentations.ts`
  - Presentation metadata
  - Teacher uploads
  - Linking and deletion
- `server/routes/announcements.ts`
  - Announcement categories
  - Announcements
  - Announcement media references
  - Public/admin reads
- `server/routes/settings.ts`
  - System settings
  - Public settings
  - School logo reference
  - Admin account update
  - Dashboard stats
- `server/routes/academic.ts`
  - Already Prisma/Supabase-backed in the supplied latest backend.
- `server/routes/students.ts`
  - Already Prisma/Supabase-backed in the supplied latest backend.
- `server/routes/teachers.ts`
  - Already Prisma/Supabase-backed in the supplied latest backend.
- `server/routes/auth.ts`
  - Already Prisma/Supabase-backed in the supplied latest backend.

## Persistence safety
`server/index.ts` no longer auto-calls the legacy `saveDb()` after every mutating HTTP response. This prevents stale in-memory compatibility data from overwriting newer PostgreSQL records.

The legacy compatibility store in `server/db.ts` remains for startup/seed/demo tooling and the explicit legacy backup export/import workflow. Normal application CRUD is not supposed to use it as the source of truth.

## Cloudinary
New media upload paths continue to use the existing Cloudinary services:
- student profile picture/banner
- teacher profile picture
- school logo
- announcement image/PDF
- teacher presentation/document uploads

New media is uploaded before changing the DB reference. If the DB write fails, the newly uploaded Cloudinary object is removed.

## Remaining intentional legacy maintenance feature
`/api/settings/backup/import` is intentionally not treated as normal CRUD. It is a whole-database compatibility snapshot restore and remains a special maintenance workflow. It is not part of the direct runtime data path.

## Validation
TypeScript validation was run successfully with:
`tsc --noEmit`

A full Vite/Prisma generation build must be re-run on the user's Windows machine after `npm install`, because the execution environment used here does not have the Windows-native dependency binaries/network access needed for Prisma engine download.
