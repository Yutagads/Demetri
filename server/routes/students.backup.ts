import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import { db, expandStudent, saveDb } from '../db.js'
import { deleteImageReference, deleteImageByUrl, uploadImage } from '../services/imageStorage.js'
import { requireAuth, requireRole } from '../middleware/auth.js'


// ── Cloudinary image uploads ────────────────────────────────────────────────
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
})

const router = Router()

function generateStudentCode() {
  return 'SC-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

function generateTempPassword() {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6).toUpperCase()
}

// Admin: list students
router.get('/', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { search, status, sectionId } = req.query
    let students = db.students

    if (search) {
      const q = String(search).toLowerCase()
      students = students.filter(s =>
        s.fullName.toLowerCase().includes(q) ||
        s.studentNumber.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      )
    }
    if (status) students = students.filter(s => s.status === String(status))
    if (sectionId) {
      const ids = new Set(
        db.studentSectionAssignments
          .filter(a => a.sectionId === String(sectionId))
          .map(a => a.studentId)
      )
      students = students.filter(s => ids.has(s.id))
    }

    const result = [...students]
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map(s => expandStudent(s, { includeUser: true }))

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Admin: create student
router.post('/', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      studentNumber: z.string().min(1),
      fullName: z.string().min(1),
      email: z.string().email(),
      gender: z.string().optional(),
      birthDate: z.string().optional(),
      contactNumber: z.string().optional(),
      guardianName: z.string().optional(),
      guardianContact: z.string().optional(),
      gradeLevelId: z.string().optional(),
      strandId: z.string().optional(),
      sectionId: z.string().optional(),
      academicYearId: z.string().optional(),
    }).parse(req.body)

    const existing = db.students.find(s => s.studentNumber === data.studentNumber || s.email === data.email)
    if (existing) return res.status(400).json({ error: 'Student number or email already exists' })

    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 12)
    const now = new Date().toISOString()

    const userId = uuidv4()
    db.users.push({
      id: userId,
      email: data.email,
      passwordHash,
      role: 'STUDENT',
      status: 'active',
      isFirstLogin: true,
      createdAt: now,
    })

    const studentId = uuidv4()
    const student = {
      id: studentId,
      userId,
      studentNumber: data.studentNumber,
      studentCode: generateStudentCode(),
      fullName: data.fullName,
      email: data.email,
      gender: data.gender,
      birthDate: data.birthDate,
      contactNumber: data.contactNumber,
      status: 'active',
      createdAt: now,
    }
    db.students.push(student)
    db.studentProfiles.push({
      id: uuidv4(),
      studentId,
      guardianName: data.guardianName,
      guardianContact: data.guardianContact,
      updatedAt: now,
    })

    if (data.sectionId && data.academicYearId && data.gradeLevelId) {
      db.studentSectionAssignments.push({
        id: uuidv4(),
        studentId,
        sectionId: data.sectionId,
        academicYearId: data.academicYearId,
        gradeLevelId: data.gradeLevelId,
        createdAt: now,
      })
    }

    res.json({ student, tempPassword })
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get single student
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const s = db.students.find(s => s.id === req.params.id)
    if (!s) return res.status(404).json({ error: 'Student not found' })
    // Students may only fetch their own record; admins and teachers can fetch any
    if (req.user!.role === 'STUDENT' && s.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    res.json(expandStudent(s, { includeUser: true }))
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Update student
router.put('/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      fullName: z.string().optional(),
      contactNumber: z.string().optional(),
      gender: z.string().optional(),
      birthDate: z.string().optional(),
    }).parse(req.body)

    const idx = db.students.findIndex(s => s.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    db.students[idx] = { ...db.students[idx], ...data }
    res.json(db.students[idx])
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Archive student
router.patch('/:id/archive', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const s = db.students.find(s => s.id === req.params.id)
    if (!s) return res.status(404).json({ error: 'Not found' })
    s.status = 'archived'
    const u = db.users.find(u => u.id === s.userId)
    if (u) u.status = 'inactive'
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Restore (unarchive) student
router.patch('/:id/restore', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const s = db.students.find(s => s.id === req.params.id)
    if (!s) return res.status(404).json({ error: 'Not found' })
    s.status = 'active'
    const u = db.users.find(u => u.id === s.userId)
    if (u) u.status = 'active'
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Reset password
router.post('/:id/reset-password', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const s = db.students.find(s => s.id === req.params.id)
    if (!s) return res.status(404).json({ error: 'Not found' })
    const tempPassword = generateTempPassword()
    const u = db.users.find(u => u.id === s.userId)
    if (u) {
      u.passwordHash = await bcrypt.hash(tempPassword, 12)
      u.isFirstLogin = true
    }
    res.json({ email: s.email, tempPassword })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Admin: bulk import students from CSV
router.post('/import', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { rows, dryRun, academicYearId, gradeLevelId, sectionId } = z.object({
      rows: z.array(z.object({
        studentNumber: z.string(),
        fullName: z.string(),
        email: z.string(),
        gender: z.string().optional().default(''),
        birthDate: z.string().optional().default(''),
        contactNumber: z.string().optional().default(''),
        guardianName: z.string().optional().default(''),
        guardianContact: z.string().optional().default(''),
      })),
      dryRun: z.boolean().default(true),
      academicYearId: z.string().optional(),
      gradeLevelId: z.string().optional(),
      sectionId: z.string().optional(),
    }).parse(req.body)

    const seenNumbers = new Set<string>()
    const seenEmails = new Set<string>()

    const results: Array<{
      rowNumber: number
      data: any
      status: 'valid' | 'error' | 'duplicate'
      errors: string[]
    }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // row 1 is header
      const errors: string[] = []

      if (!row.studentNumber?.trim()) errors.push('Student number is required')
      if (!row.fullName?.trim()) errors.push('Full name is required')
      if (!row.email?.trim()) errors.push('Email is required')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) errors.push('Invalid email format')

      const num = row.studentNumber?.trim()
      const email = row.email?.trim().toLowerCase()

      if (num && seenNumbers.has(num)) errors.push('Duplicate student number in file')
      if (email && seenEmails.has(email)) errors.push('Duplicate email in file')
      if (num && !seenNumbers.has(num) && db.students.find(s => s.studentNumber === num)) errors.push('Student number already exists in system')
      if (email && !seenEmails.has(email) && db.students.find(s => s.email === email)) errors.push('Email already exists in system')
      if (email && !seenEmails.has(email) && db.users.find(u => u.email === email)) errors.push('Email already in use')

      if (num) seenNumbers.add(num)
      if (email) seenEmails.add(email)

      const isDup = errors.some(e => e.includes('already') || e.includes('Duplicate'))
      results.push({ rowNumber, data: row, status: errors.length === 0 ? 'valid' : isDup ? 'duplicate' : 'error', errors })
    }

    const summary = {
      total: rows.length,
      valid: results.filter(r => r.status === 'valid').length,
      errors: results.filter(r => r.status === 'error').length,
      duplicates: results.filter(r => r.status === 'duplicate').length,
    }

    if (dryRun) return res.json({ rows: results, summary })

    // Actual import — only valid rows
    const credentials: Array<{ rowNumber: number; studentNumber: string; fullName: string; tempPassword: string }> = []
    const now = new Date().toISOString()

    for (const result of results) {
      if (result.status !== 'valid') continue
      const row = result.data
      const tempPassword = generateTempPassword()
      const passwordHash = await bcrypt.hash(tempPassword, 12)
      const userId = uuidv4()
      db.users.push({ id: userId, email: row.email.trim().toLowerCase(), passwordHash, role: 'STUDENT', status: 'active', isFirstLogin: true, createdAt: now })
      const studentId = uuidv4()
      db.students.push({
        id: studentId, userId, studentNumber: row.studentNumber.trim(), studentCode: generateStudentCode(),
        fullName: row.fullName.trim(), email: row.email.trim().toLowerCase(),
        gender: row.gender?.trim() || undefined, birthDate: row.birthDate?.trim() || undefined,
        contactNumber: row.contactNumber?.trim() || undefined, status: 'active', createdAt: now,
      })
      db.studentProfiles.push({ id: uuidv4(), studentId, guardianName: row.guardianName?.trim() || undefined, guardianContact: row.guardianContact?.trim() || undefined, updatedAt: now })
      if (sectionId && academicYearId && gradeLevelId) {
        db.studentSectionAssignments.push({ id: uuidv4(), studentId, sectionId, academicYearId, gradeLevelId, createdAt: now })
      }
      credentials.push({ rowNumber: result.rowNumber, studentNumber: row.studentNumber.trim(), fullName: row.fullName.trim(), tempPassword })
    }

    res.json({ imported: credentials.length, skipped: results.filter(r => r.status !== 'valid').length, credentials })
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Admin: reassign student to a section
router.patch('/:id/section', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      sectionId: z.string(),
      academicYearId: z.string(),
      gradeLevelId: z.string(),
    }).parse(req.body)

    const s = db.students.find(s => s.id === req.params.id)
    if (!s) return res.status(404).json({ error: 'Student not found' })

    // Remove any existing active assignment and replace with new one
    const existing = db.studentSectionAssignments.findIndex(a => a.studentId === s.id)
    const now = new Date().toISOString()
    const assignment = { id: uuidv4(), studentId: s.id, ...data, createdAt: now }

    if (existing !== -1) {
      db.studentSectionAssignments[existing] = assignment
    } else {
      db.studentSectionAssignments.push(assignment)
    }

    res.json(expandStudent(s, { includeUser: true }))
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    res.status(500).json({ error: 'Server error' })
  }
})

// Admin: remove student from section
router.delete('/:id/section', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const s = db.students.find(s => s.id === req.params.id)
    if (!s) return res.status(404).json({ error: 'Student not found' })

    const idx = db.studentSectionAssignments.findIndex(a => a.studentId === s.id)
    if (idx !== -1) db.studentSectionAssignments.splice(idx, 1)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Student: self-update profile fields
router.patch('/:id/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const s = db.students.find(s => s.id === req.params.id)
    if (!s) return res.status(404).json({ error: 'Student not found' })

    // Must be the student themselves or an admin
    const isOwner = req.user!.role === 'STUDENT' && s.userId === req.user!.userId
    const isAdmin = req.user!.role === 'ADMIN'
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' })

    const data = z.object({
      contactNumber: z.string().optional(),
      gender: z.string().optional(),
      birthDate: z.string().optional(),
      address: z.string().optional(),
      guardianName: z.string().optional(),
      guardianContact: z.string().optional(),
      emergencyContact: z.string().optional(),
      biography: z.string().optional(),
      bloodType: z.string().trim().max(10).optional(),
      weight: z.preprocess(v => (v === '' || v == null ? null : Number(v)), z.number().positive().nullable().optional()),
      height: z.preprocess(v => (v === '' || v == null ? null : Number(v)), z.number().positive().nullable().optional()),
    }).parse(req.body)

    const now = new Date().toISOString()

    // Update student record
    const si = db.students.findIndex(st => st.id === s.id)
    if (si !== -1) {
      if (data.contactNumber !== undefined) db.students[si].contactNumber = data.contactNumber
      if (data.gender !== undefined) db.students[si].gender = data.gender
      if (data.birthDate !== undefined) db.students[si].birthDate = data.birthDate
    }

    // Update or create student profile
    const pi = db.studentProfiles.findIndex(p => p.studentId === s.id)
    if (pi !== -1) {
      if (data.address !== undefined) db.studentProfiles[pi].address = data.address
      if (data.guardianName !== undefined) db.studentProfiles[pi].guardianName = data.guardianName
      if (data.guardianContact !== undefined) db.studentProfiles[pi].guardianContact = data.guardianContact
      if (data.emergencyContact !== undefined) db.studentProfiles[pi].emergencyContact = data.emergencyContact
      if (data.biography !== undefined) db.studentProfiles[pi].biography = data.biography
      if (data.bloodType !== undefined) db.studentProfiles[pi].bloodType = data.bloodType || undefined
      if (data.weight !== undefined) db.studentProfiles[pi].weight = data.weight || undefined
      if (data.height !== undefined) db.studentProfiles[pi].height = data.height || undefined
      db.studentProfiles[pi].updatedAt = now
    } else {
      db.studentProfiles.push({
        id: uuidv4(),
        studentId: s.id,
        address: data.address,
        guardianName: data.guardianName,
        guardianContact: data.guardianContact,
        emergencyContact: data.emergencyContact,
        biography: data.biography,
        bloodType: data.bloodType,
        weight: data.weight ?? undefined,
        height: data.height ?? undefined,
        updatedAt: now,
      })
    }

    await saveDb()
    res.json(expandStudent(db.students[si !== -1 ? si : 0], { includeUser: false }))
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    res.status(500).json({ error: 'Server error' })
  }
})

// Student: upload own profile picture
router.post('/:id/avatar', requireAuth, avatarUpload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const s = db.students.find(s => s.id === req.params.id)
    if (!s) return res.status(404).json({ error: 'Student not found' })

    const isOwner = req.user!.role === 'STUDENT' && s.userId === req.user!.userId
    const isAdmin = req.user!.role === 'ADMIN'
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' })

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const now = new Date().toISOString()
    const stored = await uploadImage({ buffer: req.file.buffer, folder: 'students', claimedMimeType: req.file.mimetype, maxBytes: 5 * 1024 * 1024 })

    const pi = db.studentProfiles.findIndex(p => p.studentId === s.id)
    const old = pi !== -1 ? db.studentProfiles[pi].profilePicture : undefined
    if (pi !== -1) {
      db.studentProfiles[pi].profilePicture = stored.url
      db.studentProfiles[pi].updatedAt = now
    } else {
      db.studentProfiles.push({ id: uuidv4(), studentId: s.id, profilePicture: stored.url, updatedAt: now })
    }
    try {
      await saveDb()
    } catch (dbError) {
      if (pi !== -1) db.studentProfiles[pi].profilePicture = old
      else db.studentProfiles.pop()
      await deleteImageByUrl(stored.url).catch(() => undefined)
      throw dbError
    }
    if (old && old !== stored.url) await deleteImageReference(old).catch(() => undefined)

    const si = db.students.findIndex(st => st.id === s.id)
    res.json(expandStudent(db.students[si !== -1 ? si : 0], { includeUser: false }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Student: upload own banner image
router.post('/:id/banner', requireAuth, bannerUpload.single('banner'), async (req: Request, res: Response) => {
  try {
    const s = db.students.find(s => s.id === req.params.id)
    if (!s) return res.status(404).json({ error: 'Student not found' })

    const isOwner = req.user!.role === 'STUDENT' && s.userId === req.user!.userId
    const isAdmin = req.user!.role === 'ADMIN'
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' })

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const now = new Date().toISOString()
    const stored = await uploadImage({ buffer: req.file.buffer, folder: 'students', claimedMimeType: req.file.mimetype, maxBytes: 8 * 1024 * 1024 })

    const pi = db.studentProfiles.findIndex(p => p.studentId === s.id)
    const old = pi !== -1 ? db.studentProfiles[pi].bannerImage : undefined
    if (pi !== -1) {
      db.studentProfiles[pi].bannerImage = stored.url
      db.studentProfiles[pi].updatedAt = now
    } else {
      db.studentProfiles.push({ id: uuidv4(), studentId: s.id, bannerImage: stored.url, updatedAt: now })
    }
    try {
      await saveDb()
    } catch (dbError) {
      if (pi !== -1) db.studentProfiles[pi].bannerImage = old
      else db.studentProfiles.pop()
      await deleteImageByUrl(stored.url).catch(() => undefined)
      throw dbError
    }
    if (old && old !== stored.url) await deleteImageReference(old).catch(() => undefined)

    const si = db.students.findIndex(st => st.id === s.id)
    res.json(expandStudent(db.students[si !== -1 ? si : 0], { includeUser: false }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Student: get own final grades
router.get('/:id/grades', requireAuth, async (req: Request, res: Response) => {
  try {
    const s = db.students.find(s => s.id === req.params.id)
    if (!s) return res.status(404).json({ error: 'Student not found' })
    if (req.user!.role === 'STUDENT' && s.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { academicYearId, gradingPeriod } = req.query
    let grades = db.finalGrades.filter(g => g.studentId === req.params.id)
    if (academicYearId) grades = grades.filter(g => g.academicYearId === String(academicYearId))
    if (gradingPeriod) grades = grades.filter(g => g.gradingPeriod === String(gradingPeriod))

    const result = grades.map(g => ({
      ...g,
      subject: db.subjects.find(s => s.id === g.subjectId) || null,
      section: db.sections.find(s => s.id === g.sectionId) || null,
      academicYear: db.academicYears.find(y => y.id === g.academicYearId) || null,
    }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Student: get own attendance
router.get('/:id/attendance', requireAuth, async (req: Request, res: Response) => {
  try {
    const s = db.students.find(s => s.id === req.params.id)
    if (!s) return res.status(404).json({ error: 'Student not found' })
    if (req.user!.role === 'STUDENT' && s.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const records = db.attendanceRecords
      .filter(r => r.studentId === req.params.id)
      .map(r => ({
        ...r,
        session: (() => {
          const sess = db.attendanceSessions.find(s => s.id === r.sessionId)
          if (!sess) return null
          return {
            ...sess,
            subject: db.subjects.find(s => s.id === sess.subjectId) || null,
            section: db.sections.find(s => s.id === sess.sectionId) || null,
          }
        })(),
      }))
      .sort((a, b) => new Date(b.timeRecorded).getTime() - new Date(a.timeRecorded).getTime())
    res.json(records)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Student: get own scores
router.get('/:id/scores', requireAuth, async (req: Request, res: Response) => {
  try {
    const s = db.students.find(s => s.id === req.params.id)
    if (!s) return res.status(404).json({ error: 'Student not found' })
    if (req.user!.role === 'STUDENT' && s.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const scores = db.studentScores
      .filter(s => s.studentId === req.params.id)
      .map(s => ({
        ...s,
        activity: (() => {
          const act = db.academicActivities.find(a => a.id === s.activityId)
          if (!act) return null
          return {
            ...act,
            subject: db.subjects.find(sub => sub.id === act.subjectId) || null,
            section: db.sections.find(sec => sec.id === act.sectionId) || null,
          }
        })(),
      }))
      .sort((a, b) => new Date(b.dateRecorded).getTime() - new Date(a.dateRecorded).getTime())
    res.json(scores)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
