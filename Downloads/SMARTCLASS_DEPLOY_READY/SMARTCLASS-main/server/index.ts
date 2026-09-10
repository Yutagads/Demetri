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
import { syncTeacherAssignmentsFromSchedules } from './services/teacherAssignments.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

const PORT = Number(process.env.PORT || 3000)

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
      : 'NO (using local filesystem)'
  }`,
)

console.log('==========================================')

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin: true,
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
// UPLOADS DIRECTORY
// ============================================================

const uploadsDir = path.resolve(process.cwd(), 'uploads')

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
// VITE MIDDLEWARE / STATIC ASSETS
// ============================================================

async function mountFrontend() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: path.resolve(process.cwd(), 'client'),
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.resolve(process.cwd(), 'dist/public')
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath))
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'))
      })
    }
  }
}

// ============================================================
// START SERVER
// ============================================================

async function start() {
  try {
    await seedDatabase()

    // Repair legacy schedule-only teacher assignments before the API starts.
    // This is idempotent and safe on every restart.
    if (process.env.DATABASE_URL) {
      try {
        await syncTeacherAssignmentsFromSchedules()
      } catch (assignmentSyncError) {
        console.error('[TEACHER ASSIGNMENTS] Startup sync failed:', assignmentSyncError)
      }
    }

    await mountFrontend()

    app.listen(
      PORT,
      '0.0.0.0',
      () => {
        console.log('')
        console.log('==========================================')
        console.log(`🚀 SMARTCLASS running on port ${PORT}`)
        console.log('==========================================')
        console.log('')
        console.log('📋 Demo credentials:')
        console.log('  Admin:   username=admin     password=admin123')
        console.log('  Teacher: email=teacher@erlhs.edu.ph  password=teacher123')
        console.log('  Student: number=2024-00001  password=student123')
        console.log('')
      },
    )
  } catch (err) {
    console.error('❌ Failed to start server:', err)
  }
}

start()
