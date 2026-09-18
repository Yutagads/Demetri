import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'
import multer from 'multer'
import nodemailer from 'nodemailer'
import { prisma } from '../prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { syncTeacherCompatibility, syncTeacherProfileCompatibility, syncUserCompatibility } from '../db.js'
import { deleteImageReference, deleteImageByUrl, uploadImage } from '../services/imageStorage.js'
import { emailSchema, nameSchema, optionalDateSchema, optionalPhoneSchema, optionalText, employeeIdSchema } from '../validation.js'
import { ensureTeacherSubjectAssignment, getEffectiveTeacherAssignments } from '../services/teacherAssignments.js'

const router = Router()

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
})

const smtpUser = process.env.SMTP_USER?.trim()
const smtpPass = process.env.SMTP_PASS?.trim()
const configuredFrontendUrl = process.env.FRONTEND_URL?.trim() || 'http://localhost:5173'
const frontendUrl = configuredFrontendUrl.replace(/\/$/, '').endsWith('/login')
  ? configuredFrontendUrl.replace(/\/$/, '')
  : `${configuredFrontendUrl.replace(/\/$/, '')}/login`

const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: smtpUser, pass: smtpPass },
})

function generateTempPassword() {
  return crypto.randomBytes(9).toString('base64url')
}

function optionalDate(value?: string | null) {
  if (!value || !value.trim()) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`)
  return date
}

async function sendTeacherCredentialsEmail(params: {
  email: string
  fullName: string
  employeeId?: string | null
  tempPassword: string
}) {
  if (!smtpUser || !smtpPass) {
    console.warn('[TEACHERS] SMTP is not configured; credentials were created but no email was sent.')
    return
  }

  await mailTransporter.sendMail({
    from: `"SMARTCLASS" <${smtpUser}>`,
    to: params.email,
    subject: 'SMARTCLASS Teacher Account Credentials',
    replyTo: smtpUser,
    headers: {
      'X-Priority': '1',
      Importance: 'high',
    },
    text: `
Hello ${params.fullName},

Your SMARTCLASS teacher account has been created.

Email: ${params.email}
${params.employeeId ? `Employee ID: ${params.employeeId}\n` : ''}Temporary Password: ${params.tempPassword}

LOGIN TO SMARTCLASS:
${frontendUrl}

This is a temporary password. You will be required to create a new password after your first successful login.

Regards,
SMARTCLASS Administration
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:12px;padding:32px;">
    <h2 style="margin-top:0;">SMARTCLASS Teacher Account</h2>
    <p>Hello ${params.fullName},</p>
    <p>Your SMARTCLASS teacher account has been successfully created.</p>
    <div style="background:#f9fafb;border-radius:10px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 10px;"><strong>Email:</strong> ${params.email}</p>
      ${params.employeeId ? `<p style="margin:0 0 10px;"><strong>Employee ID:</strong> ${params.employeeId}</p>` : ''}
      <p style="margin:0;"><strong>Temporary Password:</strong> ${params.tempPassword}</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${frontendUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold;">LOGIN TO SMARTCLASS</a>
    </div>
    <p style="font-size:13px;color:#6b7280;word-break:break-all;">Login link: ${frontendUrl}</p>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:15px;">
      <strong style="color:#c2410c;">Important:</strong> This is a temporary password. You must create a new password after your first successful login.
    </div>
    <p style="font-size:13px;color:#6b7280;margin-top:24px;">If you did not expect this account, please contact the school administrator.</p>
    <p>Regards,<br><strong>SMARTCLASS Administration</strong></p>
  </div>
</body>
</html>
    `.trim(),
  })
}

async function getTeacher(id: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      user: true,
      profile: true,
      classSchedules: {
        include: {
          subject: true,
          section: { include: { gradeLevel: true, strand: true } },
          academicYear: true,
        },
      },
    },
  })

  if (!teacher) return null

  return {
    ...teacher,
    subjectAssignments: await getEffectiveTeacherAssignments(teacher.id),
  }
}

function duplicateEmail(res: Response) {
  return res.status(409).json({
    error: 'An account with this email already exists.',
  })
}

// GET /api/teachers
router.get('/', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search || '').trim()
    const status = String(req.query.status || '').trim()

    const teachers = await prisma.teacher.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { employeeId: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { fullName: 'asc' },
      include: {
        user: true,
        profile: true,
        subjectAssignments: {
          include: {
            subject: true,
            section: { include: { gradeLevel: true, strand: true } },
            academicYear: true,
          },
        },
      },
    })

    const teachersWithAssignments = await Promise.all(
      teachers.map(async teacher => ({
        ...teacher,
        subjectAssignments: await getEffectiveTeacherAssignments(teacher.id),
      })),
    )

    res.json(teachersWithAssignments)
  } catch (err) {
    console.error('[TEACHERS] Failed to list teachers:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/teachers
router.post('/', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      fullName: nameSchema('Full Name'),
      email: emailSchema,
      employeeId: employeeIdSchema,
      department: z.string().trim().min(1, 'Department is required.').max(100),
      contactNumber: optionalPhoneSchema.refine(v => !!v?.trim(), 'Contact number is required.'),
    }).parse(req.body)

    const email = data.email.toLowerCase()

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return duplicateEmail(res)

    if (data.employeeId) {
      const existingEmployee = await prisma.teacher.findUnique({ where: { employeeId: data.employeeId } })
      if (existingEmployee) {
        return res.status(409).json({ error: 'An account with this employee ID already exists.' })
      }
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    const created = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: 'TEACHER',
          status: 'active',
          isFirstLogin: true,
        },
      })

      const teacher = await tx.teacher.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          employeeId: data.employeeId || null,
          fullName: data.fullName,
          email,
          department: data.department || null,
          contactNumber: data.contactNumber || null,
          status: 'active',
        },
        include: { profile: true, user: true },
      })

      await tx.teacherProfile.create({ data: { id: crypto.randomUUID(), teacherId: teacher.id } })
      return { user, teacher }
    })

    syncUserCompatibility(created.user)
    syncTeacherCompatibility(created.teacher)
    const profile = await prisma.teacherProfile.findUnique({ where: { teacherId: created.teacher.id } })
    if (profile) syncTeacherProfileCompatibility(profile)

    try {
      void sendTeacherCredentialsEmail({
        email,
        fullName: data.fullName,
        employeeId: data.employeeId || null,
        tempPassword,
      })
    } catch (mailError) {
      console.error('[TEACHERS] Account created but credential email failed:', mailError)
    }

    res.status(201).json({
      ...created.teacher,
      tempPassword,
      email,
    })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : String(err.meta?.target || '')
      if (target.includes('email')) return duplicateEmail(res)
      if (target.includes('employeeId')) return res.status(409).json({ error: 'An account with this employee ID already exists.' })
    }
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid request.' })
    console.error('[TEACHERS] Failed to create teacher:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/teachers/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const teacher = await getTeacher(req.params.id)
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' })

    if (req.user!.role === 'TEACHER' && teacher.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    res.json(teacher)
  } catch (err) {
    console.error('[TEACHERS] Failed to load teacher:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/teachers/:id
router.put('/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      fullName: nameSchema('Full Name').optional(),
      department: z.string().trim().max(100).optional(),
      contactNumber: optionalPhoneSchema,
    }).parse(req.body)

    const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id } })
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' })

    const updated = await prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.department !== undefined ? { department: data.department || null } : {}),
        ...(data.contactNumber !== undefined ? { contactNumber: data.contactNumber || null } : {}),
      },
      include: { user: true, profile: true },
    })

    syncTeacherCompatibility(updated)
    res.json(updated)
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid request.' })
    console.error('[TEACHERS] Failed to update teacher:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/teachers/:id/archive
router.patch('/:id/archive', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id } })
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' })

    const updated = await prisma.$transaction(async tx => {
      const t = await tx.teacher.update({ where: { id: teacher.id }, data: { status: 'archived' }, include: { user: true, profile: true } })
      await tx.user.update({ where: { id: teacher.userId }, data: { status: 'inactive' } })
      return t
    })

    syncTeacherCompatibility(updated)
    if (updated.user) syncUserCompatibility(updated.user)
    res.json({ success: true })
  } catch (err) {
    console.error('[TEACHERS] Failed to archive teacher:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/teachers/:id/reset-password
router.post('/:id/reset-password', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id }, include: { user: true } })
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' })

    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    const user = await prisma.user.update({
      where: { id: teacher.userId },
      data: { passwordHash, isFirstLogin: true, failedLoginAttempts: 0, lockedUntil: null },
    })

    syncUserCompatibility(user)

    try {
      void sendTeacherCredentialsEmail({
        email: teacher.email,
        fullName: teacher.fullName,
        employeeId: teacher.employeeId,
        tempPassword,
      })
    } catch (mailError) {
      console.error('[TEACHERS] Password reset email failed:', mailError)
    }

    res.json({ success: true, email: teacher.email, tempPassword })
  } catch (err) {
    console.error('[TEACHERS] Failed to reset password:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/teachers/:id/assignments
router.post('/:id/assignments', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      subjectId: z.string().min(1),
      sectionId: z.string().min(1),
      academicYearId: z.string().min(1),
    }).parse(req.body)

    const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id } })
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' })

    const assignment = await ensureTeacherSubjectAssignment({
      teacherId: teacher.id,
      ...data,
    })

    res.status(201).json(assignment)
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'This teacher assignment conflicts with an existing record.' })
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid request.' })
    console.error('[TEACHERS] Failed to add assignment:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/teachers/:id/profile
router.patch('/:id/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id }, include: { profile: true } })
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' })

    const isOwner = req.user!.role === 'TEACHER' && teacher.userId === req.user!.userId
    if (!isOwner && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })

    const data = z.object({
      gender: optionalText('Gender', 30),
      birthDate: optionalDateSchema('Birth date'),
      contactNumber: optionalPhoneSchema,
      department: z.string().trim().max(100).optional(),
    }).parse(req.body)

    const profile = await prisma.teacherProfile.upsert({
      where: { teacherId: teacher.id },
      create: {
        id: crypto.randomUUID(),
        teacherId: teacher.id,
        gender: data.gender || null,
        birthDate: optionalDate(data.birthDate),
      },
      update: {
        ...(data.gender !== undefined ? { gender: data.gender || null } : {}),
        ...(data.birthDate !== undefined ? { birthDate: optionalDate(data.birthDate) } : {}),
      },
    })

    syncTeacherProfileCompatibility(profile)

    if (data.contactNumber !== undefined || data.department !== undefined) {
      const updatedTeacher = await prisma.teacher.update({
        where: { id: teacher.id },
        data: {
          ...(data.contactNumber !== undefined ? { contactNumber: data.contactNumber || null } : {}),
          ...(data.department !== undefined ? { department: data.department || null } : {}),
        },
      })
      syncTeacherCompatibility(updatedTeacher)
    }

    const updated = await getTeacher(teacher.id)
    res.json(updated)
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid request.' })
    console.error('[TEACHERS] Failed to update teacher profile:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/teachers/:id/avatar
router.post('/:id/avatar', requireAuth, avatarUpload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [{ id: req.params.id }, { userId: req.params.id }],
      },
      include: { profile: true },
    })
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' })

    const isOwner = (req.user!.role === 'TEACHER' && (teacher.userId === req.user!.userId || teacher.id === req.user!.userId)) || req.user!.role === 'ADMIN'
    if (!isOwner) return res.status(403).json({ error: 'Forbidden' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const stored = await uploadImage({
      buffer: req.file.buffer,
      folder: 'employees',
      claimedMimeType: req.file.mimetype,
      maxBytes: 5 * 1024 * 1024,
    })

    try {
      const profile = await prisma.teacherProfile.upsert({
        where: { teacherId: teacher.id },
        create: { id: crypto.randomUUID(), teacherId: teacher.id, profilePicture: stored.url },
        update: { profilePicture: stored.url },
      })

      syncTeacherProfileCompatibility(profile)

      if (teacher.profile?.profilePicture && teacher.profile.profilePicture !== stored.url) {
        await deleteImageReference(teacher.profile.profilePicture).catch(error => console.warn('[TEACHERS] Failed to delete old avatar:', error))
      }

      const updated = await getTeacher(teacher.id)
      res.json(updated)
    } catch (dbError) {
      await deleteImageByUrl(stored.url).catch(() => undefined)
      throw dbError
    }
  } catch (err) {
    console.error('[TEACHERS] Failed to upload avatar:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/teachers/:id/banner
router.post('/:id/banner', requireAuth, bannerUpload.single('banner'), async (req: Request, res: Response) => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [{ id: req.params.id }, { userId: req.params.id }],
      },
      include: { profile: true },
    })
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' })

    const isOwner = (req.user!.role === 'TEACHER' && (teacher.userId === req.user!.userId || teacher.id === req.user!.userId)) || req.user!.role === 'ADMIN'
    if (!isOwner) return res.status(403).json({ error: 'Forbidden' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const stored = await uploadImage({
      buffer: req.file.buffer,
      folder: 'employees',
      claimedMimeType: req.file.mimetype,
      maxBytes: 8 * 1024 * 1024,
    })

    const oldBanner = (teacher.profile as any)?.bannerImage

    try {
      let profile: any
      try {
        profile = await (prisma.teacherProfile as any).upsert({
          where: { teacherId: teacher.id },
          create: { id: crypto.randomUUID(), teacherId: teacher.id, bannerImage: stored.url },
          update: { bannerImage: stored.url },
        })
      } catch {
        // Fallback for in-memory / non-migrated column
        profile = { id: teacher.profile?.id || crypto.randomUUID(), teacherId: teacher.id, bannerImage: stored.url }
      }

      syncTeacherProfileCompatibility(profile)

      if (oldBanner && oldBanner !== stored.url) {
        await deleteImageReference(oldBanner).catch(error => console.warn('[TEACHERS] Failed to delete old banner:', error))
      }

      const updated = await getTeacher(teacher.id)
      res.json(updated)
    } catch (dbError) {
      await deleteImageByUrl(stored.url).catch(() => undefined)
      throw dbError
    }
  } catch (err) {
    console.error('[TEACHERS] Failed to upload banner:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
