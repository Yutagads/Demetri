import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../prisma.js'
import { db, resetDatabase } from '../db.js'
import { deleteImageReference, deleteImageByUrl, uploadImage } from '../services/imageStorage.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { passwordSchema, optionalPhoneSchema, emailSchema } from '../validation.js'

const router = Router()

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

const PUBLIC_KEYS = [
  'schoolName', 'schoolLogo', 'schoolAddress', 'schoolTagline',
  'schoolContactNumber', 'schoolContactEmail', 'currentAcademicYear',
  'currentSemester', 'systemVersion', 'slideRotationInterval',
  'tabRotationInterval', 'weatherLatitude', 'weatherLongitude',
  'weatherLocation', 'kioskIdleTimeout', 'passingGrade', 'gradingPeriods',
  'currentGradingPeriod',
]

const DEFAULT_SETTINGS: Record<string, string> = {
  schoolName: 'SMARTCLASS',
  schoolLogo: '',
  schoolAddress: 'Exequiel R. Lina High School',
  schoolTagline: 'Learning today, leading tomorrow.',
  schoolContactNumber: '',
  schoolContactEmail: '',
  passingGrade: '75',
  gradingPeriods: '4',
  currentGradingPeriod: '1st',
  slideRotationInterval: '6',
  tabRotationInterval: '30',
  weatherLatitude: '14.5995',
  weatherLongitude: '120.9842',
  weatherLocation: 'Manila',
  kioskIdleTimeout: '10',
  forceFirstLoginPasswordChange: 'true',
  maxLoginAttempts: '5',
  lockoutDuration: '15',
}

const INTEGER_RANGES: Record<string, [number, number]> = {
  passingGrade: [0, 100],
  gradingPeriods: [1, 4],
  slideRotationInterval: [1, 3600],
  tabRotationInterval: [1, 3600],
  kioskIdleTimeout: [1, 1440],
  maxLoginAttempts: [1, 100],
  lockoutDuration: [1, 1440],
  inactivityTimeout: [1, 1440],
  sessionCodeExpiry: [1, 1440],
}

function validateUpdates(updates: Record<string, string>) {
  for (const [key, value] of Object.entries(updates)) {
    if (value.length > 500) throw new Error(`${key} is too long`)
    const range = INTEGER_RANGES[key]
    if (range) {
      const n = Number(value)
      if (!Number.isInteger(n) || n < range[0] || n > range[1]) {
        throw new Error(`${key} must be a whole number from ${range[0]} to ${range[1]}`)
      }
    }
    if (key === 'schoolContactNumber' && value) optionalPhoneSchema.parse(value)
    if (key === 'schoolContactEmail' && value) emailSchema.parse(value)
    if (key === 'currentGradingPeriod' && !['1st', '2nd', '3rd', '4th'].includes(value)) {
      throw new Error('Current grading period is invalid')
    }
    if (key === 'forceFirstLoginPasswordChange' && !['true', 'false'].includes(value)) {
      throw new Error('Force first-login password change must be true or false')
    }
  }
}

async function ensureDefaultSettings() {
  await Promise.all(Object.entries(DEFAULT_SETTINGS).map(([key, value]) =>
    prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { id: uuidv4(), key, value },
    })
  ))
}

async function getSettingsMap(publicOnly = false) {
  await ensureDefaultSettings()
  const settings = await prisma.systemSetting.findMany({
    where: publicOnly ? { key: { in: PUBLIC_KEYS } } : undefined,
    orderBy: { key: 'asc' },
  })
  return Object.fromEntries(settings.map(s => [s.key, s.value]))
}

async function applyUpdates(updates: Record<string, string>) {
  validateUpdates(updates)
  await prisma.$transaction(
    Object.entries(updates).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { id: uuidv4(), key, value },
      })
    )
  )
}

router.get('/public', async (_req, res: Response) => {
  try {
    res.json(await getSettingsMap(true))
  } catch (err) {
    console.error('[settings] public error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/', requireAuth, requireRole('ADMIN'), async (_req, res: Response) => {
  try {
    res.json(await getSettingsMap(false))
  } catch (err) {
    console.error('[settings] list error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const updates = z.record(z.string(), z.string()).parse(req.body) as Record<string, string>
    await applyUpdates(updates)
    res.json({ success: true })
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    res.status(400).json({ error: err.message || 'Invalid settings' })
  }
})

router.post('/logo', requireAuth, requireRole('ADMIN'), logoUpload.single('logo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please upload a PNG, JPG, GIF, WebP, or SVG logo.' })

    const stored = await uploadImage({
      buffer: req.file.buffer,
      folder: 'school',
      claimedMimeType: req.file.mimetype,
      maxBytes: 5 * 1024 * 1024,
    })

    const current = await prisma.systemSetting.findUnique({ where: { key: 'schoolLogo' } })
    const previous = current?.value || ''

    try {
      await applyUpdates({ schoolLogo: stored.url })
    } catch (dbError) {
      await deleteImageByUrl(stored.url).catch(() => undefined)
      throw dbError
    }

    if (previous && previous !== stored.url) {
      await deleteImageReference(previous).catch(err => console.warn('[IMAGE] Failed to delete old school logo:', err))
    }

    res.json({ schoolLogo: stored.url })
  } catch (err: any) {
    console.error('[IMAGE] School logo upload failed:', err)
    res.status(400).json({ error: err.message || 'Could not upload school logo.' })
  }
})

router.delete('/logo', requireAuth, requireRole('ADMIN'), async (_req, res: Response) => {
  try {
    const current = await prisma.systemSetting.findUnique({ where: { key: 'schoolLogo' } })
    const previous = current?.value || ''
    await applyUpdates({ schoolLogo: '' })
    if (previous) await deleteImageReference(previous).catch(err => console.warn('[IMAGE] Failed to delete school logo:', err))
    res.json({ success: true })
  } catch (err: any) {
    console.error('[IMAGE] School logo deletion failed:', err)
    res.status(500).json({ error: 'Could not remove school logo.' })
  }
})

/*
 * Backup import/export remain explicit administrative maintenance operations.
 * They are intentionally separate from normal CRUD persistence and may still
 * use the compatibility snapshot maintained by server/db.ts.
 */
router.get('/backup/export', requireAuth, requireRole('ADMIN'), (_req, res: Response) => {
  const payload = {
    format: 'smartclass-json-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: db,
  }
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="smartclass-backup-${new Date().toISOString().slice(0, 10)}.json"`)
  res.send(JSON.stringify(payload, null, 2))
})

router.post('/backup/import', requireAuth, requireRole('ADMIN'), backupUpload.single('backup'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please choose a backup JSON file.' })
    const parsed = JSON.parse(req.file.buffer.toString('utf8'))
    const incoming = parsed?.format === 'smartclass-json-backup' ? parsed.data : parsed
    const keys = Object.keys(db)
    if (!incoming || keys.some(key => !Array.isArray(incoming[key]))) {
      return res.status(400).json({ error: 'This is not a valid SMARTCLASS backup.' })
    }
    // Legacy compatibility snapshot restore. Normal runtime CRUD remains direct-to-Postgres.
    for (const key of keys) (db as any)[key] = incoming[key]
    return res.status(501).json({ error: 'Full backup import requires the dedicated migration workflow and is not enabled in direct-Supabase mode.' })
  } catch (err: any) {
    res.status(400).json({ error: err instanceof SyntaxError ? 'Backup file is not valid JSON.' : (err.message || 'Could not restore backup.') })
  }
})

router.post('/reset-demo', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  await resetDatabase()
  res.json({ success: true, message: 'Demo data has been restored.' })
})

router.put('/admin-account', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      username: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9._-]+$/, 'Username may contain only letters, numbers, dot, underscore, and hyphen.').optional(),
      currentPassword: z.string().min(1).max(128),
      newPassword: passwordSchema.optional(),
    }).refine(d => d.username || d.newPassword, { message: 'Enter a username or a new password.' }).parse(req.body)

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user || user.role !== 'ADMIN') return res.status(404).json({ error: 'Admin account not found.' })

    if (!await bcrypt.compare(data.currentPassword, user.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' })
    }

    if (data.username) {
      const conflict = await prisma.user.findFirst({
        where: {
          id: { not: user.id },
          role: 'ADMIN',
          username: { equals: data.username },
        },
      })
      if (conflict) return res.status(409).json({ error: 'That username is already in use.' })
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.username ? { username: data.username } : {}),
        ...(data.newPassword ? { passwordHash: await bcrypt.hash(data.newPassword, 12), isFirstLogin: false } : {}),
      },
    })

    res.json({ success: true, username: updated.username })
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    if (err.code === 'P2002') return res.status(409).json({ error: 'That username is already in use.' })
    console.error('[settings] admin account update error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/dashboard-stats', requireAuth, requireRole('ADMIN'), async (_req, res: Response) => {
  try {
    const [totalStudents, totalTeachers, totalSections, totalSubjects] = await Promise.all([
      prisma.student.count({ where: { status: 'active' } }),
      prisma.teacher.count({ where: { status: 'active' } }),
      prisma.section.count({ where: { status: 'active' } }),
      prisma.subject.count({ where: { status: 'active' } }),
    ])

    res.json({ totalStudents, totalTeachers, totalSections, totalSubjects })
  } catch (err) {
    console.error('[settings] dashboard stats error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
