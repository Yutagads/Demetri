import 'dotenv/config'

import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

import { seedDatabase } from './db.js'
import authRoutes from './routes/auth.js'
import studentRoutes from './routes/students.js'
import teacherRoutes from './routes/teachers.js'
import attendanceRoutes from './routes/attendance.js'
import announcementRoutes from './routes/announcements.js'
import academicRoutes from './routes/academic.js'
import structureRoutes from './routes/structure.js'
import settingsRoutes from './routes/settings.js'
import presentationRoutes from './routes/presentations.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

const PORT = parseInt(
  process.env.API_PORT || '3001',
  10,
)

// ============================================================
// ENVIRONMENT CHECK
// ============================================================

console.log('==========================================')
console.log('SMARTCLASS SERVER')
console.log('==========================================')

console.log(
  `📧 Gmail configured: ${
    process.env.SMTP_USER ? 'YES' : 'NO'
  }`,
)

console.log(
  `🔐 Gmail App Password configured: ${
    process.env.SMTP_PASS ? 'YES' : 'NO'
  }`,
)

console.log(
  `🌐 Frontend URL: ${
    process.env.FRONTEND_URL ||
    'http://localhost:5173/login'
  }`,
)

console.log(
  `🗄️ Database URL configured: ${
    process.env.DATABASE_URL ? 'YES' : 'NO'
  }`,
)

console.log(
  `☁️ Cloudinary image storage configured: ${
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
      ? 'YES'
      : 'NO'
  }`,
)

console.log('==========================================')

// ============================================================
// CORS
// ============================================================

// Allow the Vite dev server and Replit preview domain.
const allowedOrigins = [
  'http://localhost:5000',
  'http://0.0.0.0:5000',
  'http://localhost:5173',
  'http://0.0.0.0:5173',

  process.env.CLIENT_URL || '',

  ...(process.env.REPLIT_DEV_DOMAIN
    ? [
        `https://${process.env.REPLIT_DEV_DOMAIN}`,
      ]
    : []),
].filter(Boolean)

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
)

// ============================================================
// BODY PARSING
// ============================================================

app.use(
  express.json({
    limit: '10mb',
  }),
)

app.use(
  express.urlencoded({
    extended: true,
  }),
)

app.use(cookieParser())

// ============================================================
// PERSISTENCE ARCHITECTURE
// ============================================================
// Normal runtime CRUD routes persist directly through Prisma to Supabase.
// The legacy compatibility snapshot is kept for startup/backup/demo tooling,
// but is deliberately not auto-saved after every HTTP mutation. This prevents
// stale in-memory data from overwriting newer PostgreSQL data.

// ============================================================
// UPLOADS DIRECTORY
// ============================================================

const uploadsDir = path.join(
  __dirname,
  '../uploads',
)

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, {
    recursive: true,
  })
}

app.use(
  '/uploads',
  express.static(uploadsDir),
)

// ============================================================
// API ROUTES
// ============================================================

app.use(
  '/api/auth',
  authRoutes,
)

app.use(
  '/api/students',
  studentRoutes,
)

app.use(
  '/api/teachers',
  teacherRoutes,
)

app.use(
  '/api/attendance',
  attendanceRoutes,
)

app.use(
  '/api/announcements',
  announcementRoutes,
)

app.use(
  '/api/academic',
  academicRoutes,
)

app.use(
  '/api/structure',
  structureRoutes,
)

app.use(
  '/api/settings',
  settingsRoutes,
)

app.use(
  '/api/presentations',
  presentationRoutes,
)

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  '/api/health',
  (_req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
    })
  },
)

// ============================================================
// START SERVER
// ============================================================

seedDatabase()
  .then(async () => {
    // ========================================================
    // START EXPRESS
    // ========================================================

    app.listen(
      PORT,
      '0.0.0.0',
      () => {
        console.log('')
        console.log(
          '==========================================',
        )
        console.log(
          `🚀 SMARTCLASS API running on port ${PORT}`,
        )
        console.log(
          '☁️ Using Supabase PostgreSQL via Prisma',
        )
        console.log(
          '==========================================',
        )

        console.log('')
        console.log(
          '📋 Demo credentials:',
        )

        console.log(
          '  Admin:   username=admin     password=admin123',
        )

        console.log(
          '  Teacher: email=teacher@erlhs.edu.ph  password=teacher123',
        )

        console.log(
          '  Student: number=2024-00001  password=student123',
        )

        console.log('')

        // ======================================================
        // EMAIL STATUS
        // ======================================================
if (
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
) {
  console.log(
    '📧 Gmail SMTP: CONFIGURED',
  )

  console.log(
    `📨 Gmail account: ${process.env.SMTP_USER}`,
  )
} else {
  console.log(
    '⚠️ Gmail SMTP: NOT CONFIGURED',
  )

  console.log(
    '⚠️ Check SMTP_USER and SMTP_PASS in .env',
  )
}

        console.log('')
      },
    )
  })
  .catch((err) => {
    console.error(
      '❌ Failed to seed database:',
      err,
    )

    process.exit(1)
  })