# SMARTCLASS Validation Audit — Updated

## Status

Validation coverage has been strengthened across the main account, profile, password, academic structure, attendance, announcement, CSV-import, schedule, and upload paths.

A clean production TypeScript/Vite build could not be executed in this analysis runtime because dependency installation did not complete and the workspace has no complete local `node_modules` toolchain. The changes below should be build-checked locally before deployment.

## Validation policy now enforced

### Passwords
- Minimum 8 characters.
- Maximum 128 characters.
- At least one uppercase letter.
- At least one lowercase letter.
- At least one number.
- At least one special character.
- Enforced server-side for password changes and admin password updates.
- Mirrored in the change-password and admin account UI.

### Philippine phone numbers
- Accepts either `09XXXXXXXXX` (11 digits) or the equivalent `+63 9XX XXX XXXX` form.
- Used for student/teacher create/update/profile paths and school contact settings.

### Names / IDs / Email
- Names: 2–100 characters with safe letter/punctuation set.
- Student numbers: 4–25 characters, alphanumeric/underscore/hyphen.
- Employee IDs: 3–25 characters, alphanumeric/underscore/hyphen.
- Email: valid email syntax and max 254 characters.

### Dates / measurements
- Birth dates must be valid, not in the future, and represent an age between 2 and 110.
- Student profile weight and height are bounded to practical positive ranges.

### Academic structure
- Grade level order is bounded.
- Subject codes have a restricted format and max length.
- Section/strand/subject names are bounded.
- Academic year start/end dates are ordered correctly.

### Schedules
- Allowed days: Monday–Saturday.
- `HH:mm` time format enforced.
- Start time must be earlier than end time.
- Status is restricted to `draft`, `published`, or `archived`.
- Schedule image references must be Cloudinary HTTPS URLs.
- Description and color fields are bounded/validated.

### Academic activities / sheets
- Activity titles/category/score ranges are bounded.
- Imported sheet names/headers/cells/row counts are bounded.
- Student score values must be finite and non-negative, with the existing total-score upper bound preserved by the route.

### CSV student import
- Up to 5,000 rows.
- Per-row validation for student number, name, email, phone, guardian phone, and birth date.
- Duplicate student numbers/emails within the file are reported.
- Existing system duplicates remain rejected.
- Invalid rows still receive row-level error messages rather than failing the entire import payload at schema parse time.

### Attendance
- Session codes are fixed at 6 characters.
- Student numbers and passwords are bounded.
- Attendance status remains enum-restricted.

### Announcements
- Category/title/text fields are length-bounded.
- Priority is bounded to a non-negative integer range.

### Files
- Existing image uploads use byte-level image signature validation.
- PDF and Office document uploads now receive basic content-signature checks before Cloudinary upload.

## Remaining deployment note

The project should continue using Netlify for the Vite frontend and a separate Node-capable host for the Express API. The Express API currently supports uploads larger than Netlify Function request limits.
