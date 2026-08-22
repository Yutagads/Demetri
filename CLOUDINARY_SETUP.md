# SMARTCLASS Cloudinary storage

SMARTCLASS stores new application media in Cloudinary. Supabase remains the PostgreSQL database/authentication provider; the database stores URLs/references, not new media binaries.

## Environment
```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=smartclass/images
```
Keep `CLOUDINARY_API_SECRET` server-side only.

## Upload flow
```text
Frontend -> Express API -> Cloudinary -> secure_url -> Supabase/DB reference
```
Images use Cloudinary image uploads; PDFs, Word/PowerPoint documents and other non-image presentation files use Cloudinary raw uploads; videos use Cloudinary video uploads. Multer uses memory-only handling for these uploads. Database backup import and CSV account-import data are not treated as application media and therefore are not stored in Cloudinary.

## Covered media upload points
- Admin school logo
- Student profile picture and banner
- Teacher profile picture
- Admin announcement images and PDFs
- Teacher/student presentation materials (images, PDF, PPT/PPTX, DOC/DOCX, supported video files)

New Cloudinary uploads are committed before the database reference changes. If the DB update fails, the new object is removed. Old Cloudinary objects are removed only after the new DB reference is saved.

## Legacy migration
The existing image migration remains available with `npm run migrate:images`. Existing legacy local PDFs/documents are preserved until explicitly replaced or migrated.
