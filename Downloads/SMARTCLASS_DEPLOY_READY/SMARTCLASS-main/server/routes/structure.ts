import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { nameSchema, optionalText, colorSchema, scheduleDaySchema, timeSchema, validateScheduleTimes } from '../validation.js'
import { ensureTeacherSubjectAssignment } from '../services/teacherAssignments.js'

const router = Router()

function parseOptionalDate(value?: string) {
  if (!value || !value.trim()) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`)
  return date
}

async function expandSection(sectionId: string) {
  return prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      gradeLevel: true,
      strand: true,
    },
  })
}

// Academic Years
router.get('/academic-years', requireAuth, async (_req, res: Response) => {
  try {
    const years = await prisma.academicYear.findMany({
      orderBy: { name: 'desc' },
    })
    res.json(years)
  } catch (err) {
    console.error('[structure] list academic years error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/academic-years', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      name: nameSchema('Academic year').max(50),
      startDate: z.string().trim().optional(),
      endDate: z.string().trim().optional(),
      isCurrent: z.boolean().optional(),
    }).parse(req.body)
    const startDate = parseOptionalDate(data.startDate)
    const endDate = parseOptionalDate(data.endDate)
    if (startDate && endDate && startDate > endDate) return res.status(400).json({ error: 'Academic year start date must be before or equal to the end date.' })

    const year = await prisma.$transaction(async tx => {
      if (data.isCurrent) {
        await tx.academicYear.updateMany({ data: { isCurrent: false } })
      }

      return tx.academicYear.create({
        data: {
          id: uuidv4(),
          name: data.name,
          startDate,
          endDate,
          isCurrent: !!data.isCurrent,
          status: 'active',
        },
      })
    })

    res.json(year)
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    if (err.code === 'P2002') return res.status(409).json({ error: 'Academic year already exists' })
    console.error('[structure] create academic year error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Grade Levels
router.get('/grade-levels', requireAuth, async (_req, res: Response) => {
  try {
    const levels = await prisma.gradeLevel.findMany({
      orderBy: { order: 'asc' },
      include: {
        strands: true,
        sections: {
          include: { strand: true },
          orderBy: { name: 'asc' },
        },
      },
    })
    res.json(levels)
  } catch (err) {
    console.error('[structure] list grade levels error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/grade-levels', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({ name: nameSchema('Grade level').max(50), order: z.number().int().min(1).max(20) }).parse(req.body)
    const level = await prisma.gradeLevel.create({ data: { id: uuidv4(), ...data } })
    res.json(level)
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    if (err.code === 'P2002') return res.status(409).json({ error: 'Grade level already exists' })
    console.error('[structure] create grade level error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Strands
router.post('/strands', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({ name: nameSchema('Strand').max(100), gradeLevelId: z.string().trim().min(1) }).parse(req.body)
    const strand = await prisma.strand.create({ data: { id: uuidv4(), ...data } })
    res.json(strand)
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    if (err.code === 'P2002') return res.status(409).json({ error: 'Strand already exists for this grade level' })
    console.error('[structure] create strand error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Sections
router.get('/sections', requireAuth, async (_req, res: Response) => {
  try {
    const sections = await prisma.section.findMany({
      orderBy: { name: 'asc' },
      include: {
        gradeLevel: true,
        strand: true,
      },
    })
    res.json(sections)
  } catch (err) {
    console.error('[structure] list sections error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/sections', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      name: nameSchema('Section name'),
      gradeLevelId: z.string().trim().min(1),
      strandId: z.string().trim().min(1).optional(),
    }).parse(req.body)

    const section = await prisma.section.create({
      data: {
        id: uuidv4(),
        name: data.name,
        gradeLevelId: data.gradeLevelId,
        strandId: data.strandId || null,
        status: 'active',
      },
      include: {
        gradeLevel: true,
        strand: true,
      },
    })

    res.json(section)
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    if (err.code === 'P2002') return res.status(409).json({ error: 'Section already exists for this grade level' })
    console.error('[structure] create section error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Subjects
router.get('/subjects', requireAuth, async (_req, res: Response) => {
  try {
    const subjects = await prisma.subject.findMany({ orderBy: { name: 'asc' } })
    res.json(subjects)
  } catch (err) {
    console.error('[structure] list subjects error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/subjects', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      name: nameSchema('Subject name'),
      code: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Subject code contains invalid characters.'),
      description: optionalText('Description', 500),
    }).parse(req.body)

    const subject = await prisma.subject.create({
      data: {
        id: uuidv4(),
        ...data,
        status: 'active',
      },
    })

    res.json(subject)
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    if (err.code === 'P2002') return res.status(409).json({ error: 'Subject code already exists' })
    console.error('[structure] create subject error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Schedules — publish endpoint must come BEFORE /:id routes
router.post('/schedules/publish', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { sectionId, academicYearId } = z.object({
      sectionId: z.string(),
      academicYearId: z.string(),
    }).parse(req.body)

    const result = await prisma.classSchedule.updateMany({
      where: { sectionId, academicYearId },
      data: { status: 'published' },
    })

    res.json({ published: result.count })
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    console.error('[structure] publish schedules error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/schedules', requireAuth, async (req: Request, res: Response) => {
  try {
    const { teacherId, sectionId, academicYearId, status } = req.query
    const schedules = await prisma.classSchedule.findMany({
      where: {
        ...(teacherId ? { teacherId: String(teacherId) } : {}),
        ...(sectionId ? { sectionId: String(sectionId) } : {}),
        ...(academicYearId ? { academicYearId: String(academicYearId) } : {}),
        ...(status ? { status: String(status) } : {}),
      },
      orderBy: { uploadedAt: 'desc' },
      include: {
        subject: true,
        teacher: true,
        section: { include: { gradeLevel: true, strand: true } },
        academicYear: true,
      },
    })
    res.json(schedules)
  } catch (err) {
    console.error('[structure] list schedules error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/schedules', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      subjectId: z.string().trim().min(1),
      teacherId: z.string().trim().min(1),
      sectionId: z.string().trim().min(1),
      academicYearId: z.string().trim().min(1),
      dayOfWeek: scheduleDaySchema.optional(),
      startTime: timeSchema.optional(),
      endTime: timeSchema.optional(),
      description: optionalText('Description', 500),
      color: colorSchema.optional(),
      scheduleImage: z.string().url().refine(v => v.startsWith('https://res.cloudinary.com/'), 'Schedule image must be a Cloudinary URL.').optional(),
    }).parse(req.body)

    const timeError = validateScheduleTimes(data.startTime, data.endTime)
    if (timeError) return res.status(400).json({ error: timeError })

    const schedule = await prisma.$transaction(async tx => {
      // A class schedule is also a teacher's teaching assignment. Keep both
      // records synchronized so Subject, Presentation, Attendance, and other
      // teacher-portal modules all see the same assignment after re-login.
      const assignment = await ensureTeacherSubjectAssignment({
        teacherId: data.teacherId,
        subjectId: data.subjectId,
        sectionId: data.sectionId,
        academicYearId: data.academicYearId,
      }, tx)

      return tx.classSchedule.create({
        data: {
          id: uuidv4(),
          subjectId: data.subjectId,
          teacherId: data.teacherId,
          sectionId: data.sectionId,
          academicYearId: data.academicYearId,
          assignmentId: assignment.id,
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
          description: data.description,
          color: data.color,
          scheduleImage: data.scheduleImage,
          status: 'draft',
        },
        include: {
          subject: true,
          teacher: true,
          section: { include: { gradeLevel: true, strand: true } },
          academicYear: true,
        },
      })
    })

    res.json(schedule)
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    console.error('[structure] create schedule error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/schedules/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      subjectId: z.string().trim().min(1).optional(),
      teacherId: z.string().trim().min(1).optional(),
      sectionId: z.string().trim().min(1).optional(),
      academicYearId: z.string().trim().min(1).optional(),
      dayOfWeek: scheduleDaySchema.optional(),
      startTime: timeSchema.optional(),
      endTime: timeSchema.optional(),
      description: optionalText('Description', 500),
      color: colorSchema.optional(),
      status: z.enum(['draft', 'published', 'archived']).optional(),
      scheduleImage: z.string().url().refine(v => v.startsWith('https://res.cloudinary.com/'), 'Schedule image must be a Cloudinary URL.').optional(),
    }).parse(req.body)

    const timeError = validateScheduleTimes(data.startTime, data.endTime)
    if (timeError) return res.status(400).json({ error: timeError })

    const schedule = await prisma.$transaction(async tx => {
      const existing = await tx.classSchedule.findUnique({ where: { id: req.params.id } })
      if (!existing) return null

      const teacherId = data.teacherId ?? existing.teacherId
      const subjectId = data.subjectId ?? existing.subjectId
      const sectionId = data.sectionId ?? existing.sectionId
      const academicYearId = data.academicYearId ?? existing.academicYearId

      const assignment = await ensureTeacherSubjectAssignment({
        teacherId,
        subjectId,
        sectionId,
        academicYearId,
      }, tx)

      return tx.classSchedule.update({
        where: { id: req.params.id },
        data: { ...data, assignmentId: assignment.id },
        include: {
          subject: true,
          teacher: true,
          section: { include: { gradeLevel: true, strand: true } },
          academicYear: true,
        },
      })
    })

    if (!schedule) return res.status(404).json({ error: 'Schedule not found' })

    res.json(schedule)
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Schedule not found' })
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    console.error('[structure] update schedule error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/schedules/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    await prisma.classSchedule.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Schedule not found' })
    console.error('[structure] delete schedule error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Students in a section — accessible by any authenticated user
router.get('/section-students/:sectionId', requireAuth, async (req: Request, res: Response) => {
  try {
    const assignments = await prisma.studentSectionAssignment.findMany({
      where: { sectionId: req.params.sectionId },
      include: {
        student: { include: { profile: true } },
      },
    })

    const canViewProfile = req.user!.role === 'ADMIN' || req.user!.role === 'TEACHER'
    const students = assignments
      .map(a => a.student)
      .filter(s => s.status !== 'archived')
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map(s => ({
        id: s.id,
        fullName: s.fullName,
        studentNumber: s.studentNumber,
        status: s.status,
        profile: canViewProfile && s.profile ? {
          profilePicture: s.profile.profilePicture,
          address: s.profile.address,
          guardianName: s.profile.guardianName,
          guardianContact: s.profile.guardianContact,
          emergencyContact: s.profile.emergencyContact,
          bloodType: s.profile.bloodType,
          weight: s.profile.weight,
          height: s.profile.height,
        } : null,
      }))

    res.json(students)
  } catch (err) {
    console.error('[structure] section students error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
