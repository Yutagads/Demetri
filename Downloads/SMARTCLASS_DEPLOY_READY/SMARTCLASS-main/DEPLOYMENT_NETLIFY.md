# Netlify Deployment Notes

## Recommended architecture

Deploy the Vite/React frontend to Netlify and keep the Express/Prisma API on a Node-capable backend host (for example Render, Railway, Fly.io, or another Node service).

This project accepts image/document uploads through Express before sending them to Cloudinary. Netlify Functions have a buffered request/response payload limit of 6 MB, and binary requests effectively reduce that to about 4.5 MB because of base64 overhead. The current presentation upload endpoint allows files up to 50 MB, so moving the existing upload API unchanged into a Netlify Function would break larger uploads.

## Frontend build settings

- Build command: `npm run build:web`
- Publish directory: `dist/public`
- Node version: `20.19.3`
- Frontend API variable: `VITE_API_BASE_URL=https://YOUR-BACKEND-DOMAIN.example.com/api`

## Backend environment variables

Set these on the API host, never in the browser bundle:

- `DATABASE_URL`
- `DIRECT_URL` (if using a separate Prisma CLI/direct connection)
- `JWT_SECRET`
- `SESSION_SECRET` if used as a fallback
- `FRONTEND_URL=https://YOUR-NETLIFY-SITE.netlify.app`
- `CLIENT_URL=https://YOUR-NETLIFY-SITE.netlify.app`
- `SMTP_USER`
- `SMTP_PASS`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER=smartclass/images`

## Pre-deploy checks

1. `npm install`
2. `npx prisma generate`
3. `npm run build`
4. Start the API and verify `GET /api/health` returns `{ "status": "ok" }`.
5. Set `VITE_API_BASE_URL` in Netlify.
6. Deploy the site.
7. Verify login, `/api/auth/me`, profile picture upload, teacher/student file uploads, and CSV import against the deployed API.
