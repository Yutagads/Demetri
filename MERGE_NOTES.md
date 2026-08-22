# SMARTCLASS merge notes

## Merge strategy
- Backend source, Prisma schema/configuration, server routes and latest database-sync fixes came from `backend.zip`.
- The complete React `client/` tree came from the team's `Front End.zip`, including its newer UI/admin/student/teacher pages and new helper components.
- The frontend team's bearer-token support in `client/src/lib/api.ts` is retained; the backend middleware accepts both cookies and `Authorization: Bearer ...`.
- The team-only `AdminStudentAccountStatus.tsx` page was wired into `AdminPortal.tsx`.

## Supabase coverage
- Auth, students, teachers and academic routes use the latest backend's Prisma/Supabase integration.
- Admin settings, announcements, schedules/academic structure, attendance and presentation compatibility routes use the backend compatibility store, which is loaded from and persisted back to Supabase through `saveDb()`.
- Missing persistence calls were added to structure/attendance/announcement mutations so those admin changes are written back to Supabase instead of only changing process memory.

## Cloudinary coverage
New uploads now use Cloudinary for: school logo; student avatar/banner; teacher avatar; announcement image/PDF; teacher/student presentation uploads including PDF, Word/PowerPoint and supported videos. A generic `server/services/assetStorage.ts` handles image/raw/video uploads and deletion. Database backup import and CSV account import remain non-media data operations.

## Credentials/config required
Fill these in `.env` (server-side only):
`DATABASE_URL`, `SMTP_USER`, `SMTP_PASS`, `FRONTEND_URL`, optional `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`.

## Validation
`npx tsc --noEmit` passes in the merge workspace. A full Vite production build was not re-run in this environment because the supplied archive's platform-specific `node_modules`/Rollup optional binary set is environment-dependent; run `npm install` on the target Windows machine, then `npm run build`.
