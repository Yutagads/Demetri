import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { studentNumberSchema } from '../validation.js'

const router = Router()

function generateSessionCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

async function expandSession(id: string, includeRecords = true) {
  return prisma.attendanceSession.findUnique({
    where: { id },
    include: {
      subject: true,
      section: { include: { gradeLevel: true, strand: true } },
      teacher: true,
      attendanceRecords: includeRecords
        ? { include: { student: true }, orderBy: { timeRecorded: 'asc' } }
        : false,
    },
  })
}

async function getTeacher(userId: string) {
  return prisma.teacher.findUnique({ where: { userId } })
}

// Teacher: create attendance session
router.post('/sessions', requireAuth, requireRole('TEACHER'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      subjectId: z.string(),
      sectionId: z.string(),
      attendanceDate: z.string(),
    }).parse(req.body)

    const teacher = await getTeacher(req.user!.userId)
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' })

    const attendanceDate = new Date(data.attendanceDate)
    if (Number.isNaN(attendanceDate.getTime())) return res.status(400).json({ error: 'Invalid attendance date' })

    const session = await prisma.$transaction(async tx => {
      const created = await tx.attendanceSession.create({
        data: {
          id: uuidv4(),
          teacherId: teacher.id,
          subjectId: data.subjectId,
          sectionId: data.sectionId,
          attendanceDate,
          sessionStatus: 'open',
        },
      })

      const assignments = await tx.studentSectionAssignment.findMany({
        where: { sectionId: data.sectionId },
        select: { studentId: true },
      })

      if (assignments.length) {
        await tx.attendanceRecord.createMany({
          data: assignments.map(a => ({
            id: uuidv4(),
            studentId: a.studentId,
            sessionId: created.id,
            status: 'absent',
            timeRecorded: new Date(),
            verificationStatus: 'pending',
          })),
          skipDuplicates: true,
        })
      }

      return created
    })

    res.json(await expandSession(session.id, true))
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    console.error('[attendance] create session error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Teacher: list own sessions
router.get('/sessions', requireAuth, requireRole('TEACHER'), async (req: Request, res: Response) => {
  try {
    const teacher = await getTeacher(req.user!.userId)
    if (!teacher) return res.status(404).json({ error: 'Not found' })

    const sessions = await prisma.attendanceSession.findMany({
      where: { teacherId: teacher.id },
      orderBy: { attendanceDate: 'desc' },
      include: {
        subject: true,
        section: { include: { gradeLevel: true, strand: true } },
        teacher: true,
        attendanceRecords: { include: { student: true }, orderBy: { timeRecorded: 'asc' } },
      },
    })

    res.json(sessions)
  } catch (err) {
    console.error('[attendance] list sessions error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get session + records
router.get('/sessions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await expandSession(req.params.id, true)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    res.json(session)
  } catch (err) {
    console.error('[attendance] get session error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Update attendance record
router.patch('/records/:id', requireAuth, requireRole('TEACHER', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const { status } = z.object({ status: z.enum(['present', 'absent', 'late', 'excused']) }).parse(req.body)
    const record = await prisma.attendanceRecord.update({
      where: { id: req.params.id },
      data: {
        status,
        verificationStatus: 'verified',
        timeRecorded: new Date(),
      },
      include: { student: true, session: true },
    })
    res.json(record)
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    if (err.code === 'P2025') return res.status(404).json({ error: 'Attendance record not found' })
    console.error('[attendance] update record error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Teacher: generate session code
router.post('/sessions/:id/generate-code', requireAuth, requireRole('TEACHER'), async (req: Request, res: Response) => {
  try {
    const { password, expiryMinutes = 30 } = z.object({
      password: z.string(),
      expiryMinutes: z.number().min(1).max(1440).default(30),
    }).parse(req.body)

    const teacher = await getTeacher(req.user!.userId)
    if (!teacher) return res.status(404).json({ error: 'Not found' })

    const user = await prisma.user.findUnique({ where: { id: teacher.userId } })
    if (!user) return res.status(404).json({ error: 'Not found' })

    if (!await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid password' })
    }

    const session = await prisma.attendanceSession.findUnique({ where: { id: req.params.id } })
    if (!session) return res.status(404).json({ error: 'Session not found' })
    if (session.teacherId !== teacher.id) return res.status(403).json({ error: 'Forbidden' })

    let code = generateSessionCode()
    for (let i = 0; i < 20; i++) {
      const conflict = await prisma.attendanceSession.findFirst({ where: { sessionCode: code } })
      if (!conflict) break
      code = generateSessionCode()
    }

    const sessionExpiry = new Date(Date.now() + expiryMinutes * 60 * 1000)
    const updated = await prisma.attendanceSession.update({
      where: { id: session.id },
      data: { sessionCode: code, sessionExpiry },
    })

    res.json({ sessionCode: updated.sessionCode, expiresAt: updated.sessionExpiry })
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    console.error('[attendance] generate code error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Teacher/Admin: close session
router.patch('/sessions/:id/close', requireAuth, requireRole('TEACHER', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const session = await prisma.attendanceSession.findUnique({ where: { id: req.params.id } })
    if (!session) return res.status(404).json({ error: 'Not found' })

    if (req.user!.role === 'TEACHER') {
      const teacher = await getTeacher(req.user!.userId)
      if (!teacher || session.teacherId !== teacher.id) return res.status(403).json({ error: 'Forbidden' })
    }

    const updated = await prisma.attendanceSession.update({
      where: { id: session.id },
      data: { sessionStatus: 'closed' },
      include: {
        subject: true,
        section: { include: { gradeLevel: true, strand: true } },
        teacher: true,
        attendanceRecords: { include: { student: true } },
      },
    })

    res.json(updated)
  } catch (err) {
    console.error('[attendance] close session error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Public: verify session code
router.get('/public/:code', async (req: Request, res: Response) => {
  try {
    const session = await prisma.attendanceSession.findFirst({
      where: { sessionCode: req.params.code },
      include: {
        subject: true,
        section: { include: { gradeLevel: true, strand: true } },
        teacher: true,
        attendanceRecords: { include: { student: true } },
      },
    })

    if (!session) return res.status(404).json({ error: 'Invalid session code' })
    if (session.sessionStatus === 'closed') return res.status(400).json({ error: 'Session is closed' })
    if (session.sessionExpiry && session.sessionExpiry < new Date()) return res.status(400).json({ error: 'Session code has expired' })

    res.json(session)
  } catch (err) {
    console.error('[attendance] public session error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Student self-attendance via session code
router.post('/public/submit', async (req: Request, res: Response) => {
  try {
    const { sessionCode, studentNumber, password } = z.object({
      sessionCode: z.string().trim().length(6, 'Session code must be 6 characters.'),
      studentNumber: studentNumberSchema,
      password: z.string().min(1).max(128),
    }).parse(req.body)

    const session = await prisma.attendanceSession.findFirst({
      where: { sessionCode },
    })
    if (!session) return res.status(404).json({ error: 'Invalid session code' })
    if (session.sessionStatus === 'closed') return res.status(400).json({ error: 'Session is closed' })
    if (session.sessionExpiry && session.sessionExpiry < new Date()) return res.status(400).json({ error: 'Session has expired' })

    const student = await prisma.student.findUnique({
      where: { studentNumber },
    })
    if (!student) return res.status(401).json({ error: 'Student not found' })

    const assignment = await prisma.studentSectionAssignment.findFirst({
      where: { studentId: student.id, sectionId: session.sectionId },
    })
    if (!assignment) return res.status(403).json({ error: 'Student is not assigned to this section' })

    const user = await prisma.user.findUnique({ where: { id: student.userId } })
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const existing = await prisma.attendanceRecord.findFirst({
      where: { studentId: student.id, sessionId: session.id },
    })

    if (existing?.status === 'present') {
      return res.status(400).json({ error: 'Attendance already recorded' })
    }

    const record = existing
      ? await prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: { status: 'present', verificationStatus: 'verified', timeRecorded: new Date() },
        })
      : await prisma.attendanceRecord.create({
          data: {
            id: uuidv4(),
            studentId: student.id,
            sessionId: session.id,
            status: 'present',
            verificationStatus: 'verified',
            timeRecorded: new Date(),
          },
        })

    res.json({ success: true, record })
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    console.error('[attendance] public submit error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Admin: get all sessions
router.get('/admin/sessions', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.attendanceSession.findMany({
      orderBy: { attendanceDate: 'desc' },
      take: 100,
      include: {
        subject: true,
        section: { include: { gradeLevel: true, strand: true } },
        teacher: true,
        attendanceRecords: { include: { student: true }, orderBy: { timeRecorded: 'asc' } },
      },
    })
    res.json(sessions)
  } catch (err) {
    console.error('[attendance] admin sessions error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
