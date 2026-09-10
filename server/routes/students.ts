import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import nodemailer from 'nodemailer'

import { prisma } from '../prisma.js'
import {
  syncStudentCompatibility,
  syncStudentProfileCompatibility,
  syncUserCompatibility,
} from '../db.js'
import {
  requireAuth,
  requireRole,
} from '../middleware/auth.js'
import { deleteImageReference, deleteImageByUrl, uploadImage } from '../services/imageStorage.js'
import { emailSchema, nameSchema, optionalDateSchema, optionalMeasurement, optionalPhoneSchema, optionalText, studentNumberSchema } from '../validation.js'

const router = Router()


// ============================================================
// IMAGE UPLOADS
// ============================================================
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
})

// ============================================================
// STUDENT CODE
// ============================================================

function generateStudentCode() {
  return (
    'SC-' +
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()
  )
}

// ============================================================
// TEMPORARY PASSWORD
// ============================================================

function generateTempPassword() {
  return (
    Math.random()
      .toString(36)
      .substring(2, 10) +
    Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()
  )
}

// ============================================================
// OPTIONAL DATE
// ============================================================

function optionalDate(
  value?: string | null,
) {
  if (!value || !String(value).trim()) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

// ============================================================
// HTML ESCAPE
// ============================================================
function escapeHtml(
  value: string,
) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}


// ============================================================
// GMAIL SMTP CONFIGURATION
// ============================================================
const smtpUser =
  process.env.SMTP_USER?.trim()

const smtpPass =
  process.env.SMTP_PASS?.trim()

const frontendUrl =
  process.env.FRONTEND_URL?.trim() ||
  'http://localhost:5173/login'

// ============================================================
// GMAIL TRANSPORTER
// ============================================================

const mailTransporter =
  nodemailer.createTransport({
    service: 'gmail',

    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

// ============================================================
// SMTP STARTUP CHECK
// ============================================================

if (!smtpUser || !smtpPass) {
  console.error('')
  console.error(
    '==============================================',
  )
  console.error(
    '⚠️ GMAIL SMTP: NOT CONFIGURED',
  )
  console.error(
    '⚠️ Check SMTP_USER and SMTP_PASS in .env',
  )
  console.error(
    '==============================================',
  )
  console.error('')
} else {
  mailTransporter.verify(
    (
      error,
    ) => {
      if (error) {
        console.error('')
        console.error(
          '==============================================',
        )
        console.error(
          '❌ GMAIL SMTP CONNECTION FAILED',
        )
        console.error(
          error,
        )
        console.error(
          '==============================================',
        )
        console.error('')
      } else {
        console.log('')
        console.log(
          '==============================================',
        )
        console.log(
          '✅ GMAIL SMTP CONNECTION SUCCESSFUL',
        )
        console.log(
          `📧 SMTP USER: ${smtpUser}`,
        )
        console.log(
          '==============================================',
        )
        console.log('')
      }
    },
  )
}

// ============================================================
// SEND STUDENT CREDENTIALS EMAIL
// ============================================================

async function sendStudentCredentialsEmail(
  params: {
    email: string
    fullName: string
    studentNumber: string
    tempPassword: string
  },
) {
  const {
    email,
    fullName,
    studentNumber,
    tempPassword,
  } = params

  // ----------------------------------------------------------
  // CHECK SMTP CONFIGURATION
  // ----------------------------------------------------------

  if (!smtpUser || !smtpPass) {
    throw new Error(
      'SMTP_USER and SMTP_PASS are not configured in .env',
    )
  }

  // ----------------------------------------------------------
  // LOGIN URL
  // ----------------------------------------------------------

  const loginUrl =
    frontendUrl

  // ----------------------------------------------------------
  // SEND EMAIL
  // ----------------------------------------------------------

   const info =
    await mailTransporter.sendMail({
      from: `"SMARTCLASS" <${smtpUser}>`,

      to: email,

      subject:
        'SMARTCLASS Student Account Credentials',

      text: `
Hello ${fullName},

Your SMARTCLASS student account has been successfully created.

Student Number:
${studentNumber}

Temporary Password:
${tempPassword}

Login:
${loginUrl}

IMPORTANT:
This is a temporary password.

You will be required to change your password when you log in for the first time.

If you did not expect this account, please contact the school administrator.

Regards,
SMARTCLASS Administration
      `.trim(),

      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>
    SMARTCLASS Student Account
  </title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f3f4f6;
    font-family:Arial,Helvetica,sans-serif;
  "
>
<div
    style="
      max-width:600px;
      margin:40px auto;
      padding:20px;
    "
  >

    <div
      style="
        background:#ffffff;
        border-radius:14px;
        padding:35px;
        box-shadow:
          0 4px 20px
          rgba(0,0,0,0.08);
      "
    >

      <h1
        style="
          margin-top:0;
          color:#1d4ed8;
          text-align:center;
        "
      >
        SMARTCLASS
      </h1>

      <h2
        style="
          color:#111827;
          text-align:center;
        "
      >
        Student Account Created
      </h2>

      <p
        style="
          color:#374151;
          font-size:15px;
          line-height:1.6;
        "
      >
        Hello
        <strong>
          ${escapeHtml(fullName)}
        </strong>,
      </p>

      <p
        style="
          color:#374151;
          font-size:15px;
          line-height:1.6;
        "
      >
        Your SMARTCLASS student account
        has been successfully created.
      </p>

      <div
        style="
          background:#f9fafb;
          border:1px solid #e5e7eb;
          border-radius:10px;
          padding:20px;
          margin:25px 0;
        "
      >

        <p
          style="
            margin:0 0 12px 0;
            color:#6b7280;
            font-size:13px;
          "
        >
          STUDENT NUMBER
        </p>

        <p
          style="
            margin:0 0 20px 0;
            color:#111827;
            font-size:20px;
            font-weight:bold;
          "
        >
          ${escapeHtml(studentNumber)}
        </p>

        <p
          style="
            margin:0 0 12px 0;
            color:#6b7280;
            font-size:13px;
          "
        >
          TEMPORARY PASSWORD
        </p>

        <p
          style="
            margin:0;
            color:#111827;
            font-size:20px;
            font-weight:bold;
            letter-spacing:1px;
          "
        >
          ${escapeHtml(tempPassword)}
        </p>

      </div>

      <div
        style="
          text-align:center;
          margin:30px 0;
        "
      >

        <a
          href="${escapeHtml(loginUrl)}"
          style="
            display:inline-block;
            background:#2563eb;
            color:#ffffff;
            text-decoration:none;
            padding:13px 25px;
            border-radius:8px;
            font-weight:bold;
          "
        >
          LOGIN TO SMARTCLASS
        </a>

      </div>

      <div
        style="
          background:#fff7ed;
          border:1px solid #fed7aa;
          border-radius:8px;
          padding:15px;
          margin-top:25px;
        "
      >

        <strong
          style="
            color:#c2410c;
          "
        >
          Important:
        </strong>

        <p
          style="
            color:#7c2d12;
            margin:8px 0 0 0;
            font-size:14px;
            line-height:1.5;
          "
        >
          This is a temporary password.
          You will be required to change
          your password after your first login.
        </p>

      </div>

      <p
        style="
          color:#6b7280;
          font-size:13px;
          line-height:1.5;
          margin-top:30px;
        "
      >
        If you did not expect this account,
        please contact the school administrator.
      </p>

      <p
        style="
          color:#374151;
          font-size:14px;
          margin-top:25px;
        "
      >
        Regards,<br />
        <strong>
          SMARTCLASS Administration
        </strong>
      </p>

    </div>

  </div>

</body>
</html>
      `.trim(),
    })

  console.log(
    `✅ Student credentials email sent to ${email}`,
  )

  console.log(
    `📨 Message ID: ${info.messageId}`,
  )

  return info
}

// ============================================================
// GET STUDENT
// ============================================================

async function getStudent(
  id: string,
) {
  return prisma.student.findUnique({
    where: {
      id,
    },

    include: {
      user: true,

      profile: true,

      sectionAssignments: {
        orderBy: {
          createdAt: 'desc',
        },

        include: {
          academicYear: true,
          gradeLevel: true,

          section: {
            include: {
              gradeLevel: true,
              strand: true,
            },
          },
        },
      },
    },
  })
}

// ============================================================
// FORMAT STUDENT
// ============================================================

function formatStudent(
  student: any,
  includeUser = true,
) {
  if (!student) {
    return null
  }

  const {
    user,
    profile,
    sectionAssignments,
    ...base
  } = student

  return {
    ...base,

    ...(includeUser
      ? {
          user,
        }
      : {}),

    profile:
      profile ?? null,

    sectionAssignments:
      sectionAssignments ?? [],
  }
}

// ============================================================
// ADMIN: LIST STUDENTS
// ============================================================

router.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const search = req.query.search
        ? String(req.query.search).trim()
        : ''
      const status = req.query.status
        ? String(req.query.status)
        : undefined
      const sectionId = req.query.sectionId
        ? String(req.query.sectionId)
        : undefined

      const students = await prisma.student.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(sectionId
            ? { sectionAssignments: { some: { sectionId } } }
            : {}),
          ...(search
            ? {
                OR: [
                  { fullName: { contains: search, mode: 'insensitive' } },
                  { studentNumber: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { fullName: 'asc' },
        include: {
          user: true,
          profile: true,
          sectionAssignments: {
            orderBy: { createdAt: 'desc' },
            include: {
              academicYear: true,
              gradeLevel: true,
              section: {
                include: {
                  gradeLevel: true,
                  strand: true,
                },
              },
            },
          },
        },
      })

      res.json(students.map((student) => formatStudent(student, true)))
    } catch (err: any) {
      console.error('[STUDENTS] List students error:', err)
      res.status(500).json({ error: 'Server error' })
    }
  },
)
// ============================================================
// ADMIN: CREATE STUDENT
// ============================================================

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const data =
        z
          .object({
            studentNumber:
              z.string().min(1),

            fullName:
              z.string().min(1),

            email:
              z.string().email(),

            gender:
              z.string().optional(),

            birthDate:
              z.string().optional(),

            contactNumber:
              z.string().optional(),

            guardianName:
              z.string().optional(),

            guardianContact:
              z.string().optional(),

            gradeLevelId:
              z.string().optional(),

            strandId:
              z.string().optional(),

            sectionId:
              z.string().optional(),

            academicYearId:
              z.string().optional(),
          })
          .parse(req.body)

      const email =
        data.email
          .trim()
          .toLowerCase()

      const studentNumber =
        data.studentNumber.trim()

      // --------------------------------------------------------
      // DUPLICATE CHECK
      // --------------------------------------------------------

      const [
        existingStudent,
        existingUser,
      ] = await Promise.all([
        prisma.student.findFirst({
          where: {
            OR: [
              {
                studentNumber,
              },

              {
                email,
              },
            ],
          },
        }),

        prisma.user.findFirst({
          where: {
            email,
          },
        }),
      ])

      if (existingUser) {
        return res.status(409).json({
          error: 'An account with this email already exists.',
          field: 'email',
        })
      }

      if (existingStudent) {
        return res.status(409).json({
          error:
            existingStudent.studentNumber === studentNumber
              ? 'A student with this student number already exists.'
              : 'An account with this email already exists.',
          field:
            existingStudent.studentNumber === studentNumber
              ? 'studentNumber'
              : 'email',
        })
      }

      // --------------------------------------------------------
      // GENERATE TEMP PASSWORD
      // --------------------------------------------------------

      const tempPassword =
        generateTempPassword()

      const passwordHash =
        await bcrypt.hash(
          tempPassword,
          12,
        )

      const userId =
        uuidv4()

      const studentId =
        uuidv4()

      // --------------------------------------------------------
      // CREATE DATABASE RECORDS
      // --------------------------------------------------------

      const student =
        await prisma.$transaction(
          async tx => {
            await tx.user.create({
              data: {
                id: userId,

                email,

                passwordHash,

                role: 'STUDENT',

                status: 'active',

                isFirstLogin: true,
              },
            })

            await tx.student.create({
              data: {
                id: studentId,

                userId,

                studentNumber,

                studentCode:
                  generateStudentCode(),

                fullName:
                  data.fullName.trim(),

                email,

                gender:
                  data.gender?.trim() ||
                  null,

                birthDate:
                  optionalDate(
                    data.birthDate,
                  ),

                contactNumber:
                  data.contactNumber?.trim() ||
                  null,

                status: 'active',
              },
            })

            await tx.studentProfile.create(
              {
                data: {
                  id: uuidv4(),

                  studentId,

                  guardianName:
                    data.guardianName?.trim() ||
                    null,

                  guardianContact:
                    data.guardianContact?.trim() ||
                    null,
                },
              },
            )

            if (
              data.sectionId &&
              data.academicYearId &&
              data.gradeLevelId
            ) {
              await tx.studentSectionAssignment.create(
                {
                  data: {
                    id: uuidv4(),

                    studentId,

                    sectionId:
                      data.sectionId,

                    academicYearId:
                      data.academicYearId,

                    gradeLevelId:
                      data.gradeLevelId,
                  },
                },
              )
            }

            return tx.student.findUnique(
              {
                where: {
                  id: studentId,
                },

                include: {
                  user: true,

                  profile: true,

                  sectionAssignments: {
                    include: {
                      academicYear: true,
                      gradeLevel: true,
                      section: true,
                    },
                  },
                },
              },
            )
          },
        )

      // Synchronize the compatibility snapshot before the global
      // response auto-save runs. This keeps newly-created account data
      // available to legacy routes without allowing stale memory to
      // overwrite the Prisma records.
      if (student?.user) syncUserCompatibility(student.user)
      if (student) {
        syncStudentCompatibility(student)
        if (student.profile) syncStudentProfileCompatibility(student.profile)
      }

      // --------------------------------------------------------
      // IMPORTANT:
      // SEND EMAIL AFTER DATABASE CREATION
      // --------------------------------------------------------

      let emailSent = false

      let emailError:
        | string
        | null = null

      try {
        await sendStudentCredentialsEmail(
          {
            email,

            fullName:
              data.fullName.trim(),

            studentNumber,

            tempPassword,
          },
        )

        emailSent = true
      } catch (
        mailError: any
      ) {
        console.error(
          '[STUDENTS] Student credential email failed:',
          mailError,
        )

        emailError =
          mailError?.message ||
          'Failed to send email'
      }

      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res.status(201).json({
        success: true,

        student:
          formatStudent(
            student,
            true,
          ),

        emailSent,

        emailError,

        // Keep this temporarily available
        // so the admin can recover the password
        // when Gmail fails.
        tempPassword,
      })
    } catch (
      err: any
    ) {
      if (err?.code === 'P2002') {
        return res.status(409).json({
          error: 'An account with this email already exists.',
          field: 'email',
        })
      }

      if (
        err?.name ===
        'ZodError'
      ) {
        return res.status(400).json({
          error:
            err.issues?.[0]
              ?.message ??
            err.message ??
            'Invalid request',
        })
      }

      console.error(
        '[STUDENTS] Create student error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// GET SINGLE STUDENT
// ============================================================

router.get(
  '/:id',
  requireAuth,
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const s =
        await getStudent(
          req.params.id,
        )

      if (!s) {
        return res.status(404).json({
          error:
            'Student not found',
        })
      }

      if (
        req.user!.role ===
          'STUDENT' &&
        s.userId !==
          req.user!.userId
      ) {
        return res.status(403).json({
          error: 'Forbidden',
        })
      }

      res.json(
        formatStudent(
          s,
          true,
        ),
      )
    } catch (err) {
      console.error(err)

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// UPDATE STUDENT
// ============================================================

router.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const data =
        z
          .object({
            fullName:
              z.string().optional(),

            contactNumber:
              z.string().optional(),

            gender:
              z.string().optional(),

            birthDate:
              z.string().optional(),
          })
          .parse(req.body)

      const student =
        await prisma.student.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!student) {
        return res.status(404).json({
          error: 'Not found',
        })
      }

      const updated =
        await prisma.student.update(
          {
            where: {
              id: req.params.id,
            },

            data: {
              ...(data.fullName !==
              undefined
                ? {
                    fullName:
                      data.fullName,
                  }
                : {}),

              ...(data.contactNumber !==
              undefined
                ? {
                    contactNumber:
                      data.contactNumber ||
                      null,
                  }
                : {}),

              ...(data.gender !==
              undefined
                ? {
                    gender:
                      data.gender ||
                      null,
                  }
                : {}),

              ...(data.birthDate !==
              undefined
                ? {
                    birthDate:
                      optionalDate(
                        data.birthDate,
                      ),
                  }
                : {}),
            },

            include: {
              user: true,
              profile: true,
            },
          },
        )

      res.json(
        formatStudent(
          updated,
          true,
        ),
      )
    } catch (
      err: any
    ) {
      if (
        err?.name ===
        'ZodError'
      ) {
        return res.status(400).json({
          error:
            err.issues?.[0]
              ?.message ??
            err.message,
        })
      }

      console.error(err)

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// ARCHIVE STUDENT
// ============================================================

router.patch(
  '/:id/archive',
  requireAuth,
  requireRole('ADMIN'),
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const s =
        await prisma.student.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!s) {
        return res.status(404).json({
          error: 'Not found',
        })
      }

      await prisma.$transaction([
        prisma.student.update({
          where: {
            id: s.id,
          },

          data: {
            status: 'archived',
          },
        }),

        prisma.user.update({
          where: {
            id: s.userId,
          },

          data: {
            status: 'inactive',
          },
        }),
      ])

      res.json({
        success: true,
      })
    } catch (err) {
      console.error(err)

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// RESTORE STUDENT
// ============================================================

router.patch(
  '/:id/restore',
  requireAuth,
  requireRole('ADMIN'),
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const s =
        await prisma.student.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!s) {
        return res.status(404).json({
          error: 'Not found',
        })
      }

      await prisma.$transaction([
        prisma.student.update({
          where: {
            id: s.id,
          },

          data: {
            status: 'active',
          },
        }),

        prisma.user.update({
          where: {
            id: s.userId,
          },

          data: {
            status: 'active',
          },
        }),
      ])

      res.json({
        success: true,
      })
    } catch (err) {
      console.error(err)

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// RESET STUDENT PASSWORD
// ============================================================

router.post(
  '/:id/reset-password',
  requireAuth,
  requireRole('ADMIN'),
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const s =
        await prisma.student.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!s) {
        return res.status(404).json({
          error: 'Not found',
        })
      }

      // --------------------------------------------------------
      // GENERATE NEW TEMP PASSWORD
      // --------------------------------------------------------

      const tempPassword =
        generateTempPassword()

      const passwordHash =
        await bcrypt.hash(
          tempPassword,
          12,
        )

      // --------------------------------------------------------
      // UPDATE ACCOUNT
      // --------------------------------------------------------

      const updatedUser = await prisma.user.update({
        where: {
          id: s.userId,
        },
        data: {
          passwordHash,
          // Admin reset creates a temporary password.
          // Require the student to set a new personal password
          // on the next login.
          isFirstLogin: true,
        },
      })

      syncUserCompatibility(updatedUser)

      // --------------------------------------------------------
      // SEND EMAIL
      // --------------------------------------------------------

      let emailSent = false

      let emailError:
        | string
        | null = null

      try {
        await sendStudentCredentialsEmail(
          {
            email: s.email,

            fullName:
              s.fullName,

            studentNumber:
              s.studentNumber,

            tempPassword,
          },
        )

        emailSent = true
      } catch (
        mailError: any
      ) {
        console.error(
          '[STUDENTS] Password reset email failed:',
          mailError,
        )

        emailError =
          mailError?.message ||
          'Failed to send email'
      }

      return res.json({
        success: true,

        email:
          s.email,

        emailSent,

        emailError,

        tempPassword,
      })
    } catch (
      err: any
    ) {
      console.error(
        '[STUDENTS] Reset password error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// BULK IMPORT STUDENTS
// ============================================================

router.post(
  '/import',
  requireAuth,
  requireRole('ADMIN'),
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const {
        rows,
        dryRun,
        academicYearId,
        gradeLevelId,
        sectionId,
      } =
        z
          .object({
            rows: z.array(z.object({
                studentNumber: z.string().default(''),
                fullName: z.string().default(''),
                email: z.string().default(''),
                gender: z.string().optional().default(''),
                birthDate: z.string().optional().default(''),
                contactNumber: z.string().optional().default(''),
                guardianName: z.string().optional().default(''),
                guardianContact: z.string().optional().default(''),
              })).min(1, 'CSV must contain at least one student row.').max(5000, 'CSV cannot contain more than 5,000 student rows.'),

            dryRun:
              z.boolean()
                .default(true),

            academicYearId:
              z.string()
                .optional(),

            gradeLevelId:
              z.string()
                .optional(),

            sectionId:
              z.string()
                .optional(),
          })
          .parse(req.body)

      const seenNumbers =
        new Set<string>()

      const seenEmails =
        new Set<string>()

      const results:
        Array<{
          rowNumber: number
          data: any
          status:
            | 'valid'
            | 'error'
            | 'duplicate'
          errors: string[]
        }> = []

      // --------------------------------------------------------
      // VALIDATE ROWS
      // --------------------------------------------------------

      for (
        let i = 0;
        i < rows.length;
        i++
      ) {
        const row =
          rows[i]

        const errors:
          string[] = []

        const numberCheck = studentNumberSchema.safeParse(row.studentNumber.trim())
        if (!numberCheck.success) errors.push(numberCheck.error.issues[0]?.message || 'Invalid student number')

        const nameCheck = nameSchema('Full Name').safeParse(row.fullName.trim())
        if (!nameCheck.success) errors.push(nameCheck.error.issues[0]?.message || 'Invalid full name')

        const emailCheck = emailSchema.safeParse(row.email.trim())
        if (!emailCheck.success) errors.push(emailCheck.error.issues[0]?.message || 'Invalid email format')

        const phoneCheck = optionalPhoneSchema.safeParse(row.contactNumber.trim())
        if (!phoneCheck.success) errors.push(phoneCheck.error.issues[0]?.message || 'Invalid contact number')

        const guardianPhoneCheck = optionalPhoneSchema.safeParse(row.guardianContact.trim())
        if (!guardianPhoneCheck.success) errors.push(guardianPhoneCheck.error.issues[0]?.message || 'Invalid guardian contact')

        const birthCheck = optionalDateSchema('Birth date').safeParse(row.birthDate.trim())
        if (!birthCheck.success) errors.push(birthCheck.error.issues[0]?.message || 'Invalid birth date')

        const num =
          row.studentNumber
            .trim()

        const email =
          row.email
            .trim()
            .toLowerCase()

        if (
          seenNumbers.has(num)
        ) {
          errors.push(
            'Duplicate student number in file',
          )
        }

        if (
          seenEmails.has(email)
        ) {
          errors.push(
            'Duplicate email in file',
          )
        }

        if (
          num &&
          !seenNumbers.has(num)
        ) {
          const existing =
            await prisma.student.findUnique(
              {
                where: {
                  studentNumber:
                    num,
                },
              },
            )

          if (existing) {
            errors.push(
              'Student number already exists in system',
            )
          }
        }

        if (
          email &&
          !seenEmails.has(email)
        ) {
          const existingStudent =
            await prisma.student.findFirst(
              {
                where: {
                  email,
                },
              },
            )

          if (
            existingStudent
          ) {
            errors.push(
              'Email already exists in system',
            )
          }

          const existingUser =
            await prisma.user.findFirst(
              {
                where: {
                  email,
                },
              },
            )

          if (
            existingUser
          ) {
            errors.push(
              'Email already in use',
            )
          }
        }

        seenNumbers.add(
          num,
        )

        seenEmails.add(
          email,
        )

        const isDup =
          errors.some(
            error =>
              error.includes(
                'already',
              ) ||
              error.includes(
                'Duplicate',
              ),
          )

        results.push({
          rowNumber:
            i + 2,

          data: row,

          status:
            errors.length === 0
              ? 'valid'
              : isDup
              ? 'duplicate'
              : 'error',

          errors,
        })
      }

      // --------------------------------------------------------
      // SUMMARY
      // --------------------------------------------------------

      const summary = {
        total:
          rows.length,

        valid:
          results.filter(
            r =>
              r.status ===
              'valid',
          ).length,

        errors:
          results.filter(
            r =>
              r.status ===
              'error',
          ).length,

        duplicates:
          results.filter(
            r =>
              r.status ===
              'duplicate',
          ).length,
      }

      // --------------------------------------------------------
      // DRY RUN
      // --------------------------------------------------------

      if (dryRun) {
        return res.json({
          rows:
            results,

          summary,
        })
      }

      // --------------------------------------------------------
      // ACTUAL IMPORT
      // --------------------------------------------------------

      const credentials:
        Array<{
          rowNumber: number
          studentNumber: string
          fullName: string
          email: string
          tempPassword: string
          emailSent: boolean
          emailError?:
            string
        }> = []

      // --------------------------------------------------------
      // CREATE EACH STUDENT
      // --------------------------------------------------------

      for (
        const result of results
      ) {
        if (
          result.status !==
          'valid'
        ) {
          continue
        }

        const row =
          result.data

        const normalizedEmail =
          row.email
            .trim()
            .toLowerCase()

        const studentNumber =
          row.studentNumber
            .trim()

        const fullName =
          row.fullName.trim()

        const tempPassword =
          generateTempPassword()

        const passwordHash =
          await bcrypt.hash(
            tempPassword,
            12,
          )

        const userId =
          uuidv4()

        const studentId =
          uuidv4()

        // ------------------------------------------------------
        // DATABASE TRANSACTION
        // ------------------------------------------------------

        await prisma.$transaction(
          async tx => {
            await tx.user.create({
              data: {
                id: userId,

                email:
                  normalizedEmail,

                passwordHash,

                role: 'STUDENT',

                status: 'active',

                isFirstLogin:
                  true,
              },
            })

            await tx.student.create({
              data: {
                id: studentId,

                userId,

                studentNumber,

                studentCode:
                  generateStudentCode(),

                fullName,

                email:
                  normalizedEmail,

                gender:
                  row.gender?.trim() ||
                  null,

                birthDate:
                  optionalDate(
                    row.birthDate,
                  ),

                contactNumber:
                  row.contactNumber?.trim() ||
                  null,

                status:
                  'active',
              },
            })

            await tx.studentProfile.create(
              {
                data: {
                  id: uuidv4(),

                  studentId,

                  guardianName:
                    row.guardianName?.trim() ||
                    null,

                  guardianContact:
                    row.guardianContact?.trim() ||
                    null,
                },
              },
            )

            if (
              sectionId &&
              academicYearId &&
              gradeLevelId
            ) {
              await tx.studentSectionAssignment.create(
                {
                  data: {
                    id: uuidv4(),

                    studentId,

                    sectionId,

                    academicYearId,

                    gradeLevelId,
                  },
                },
              )
            }
          },
        )

        // Refresh the compatibility snapshot with the newly imported
        // account so later legacy routes see the same data as Prisma.
        const importedStudent = await getStudent(studentId)
        if (importedStudent?.user) syncUserCompatibility(importedStudent.user)
        if (importedStudent) {
          syncStudentCompatibility(importedStudent)
          if (importedStudent.profile) syncStudentProfileCompatibility(importedStudent.profile)
        }

        // ------------------------------------------------------
        // SEND EMAIL
        // ------------------------------------------------------

        let emailSent =
          false

        let emailError:
          | string
          | undefined

        try {
          await sendStudentCredentialsEmail(
            {
              email:
                normalizedEmail,

              fullName,

              studentNumber,

              tempPassword,
            },
          )

          emailSent =
            true
        } catch (
          mailError: any
        ) {
          console.error(
            `[STUDENTS] Failed to send email to ${normalizedEmail}:`,
            mailError,
          )

          emailError =
            mailError?.message ||
            'Failed to send email'
        }

        credentials.push({
          rowNumber:
            result.rowNumber,

          studentNumber,

          fullName,

          email:
            normalizedEmail,

          tempPassword,

          emailSent,

          emailError,
        })
      }

      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res.json({
        imported:
          credentials.length,

        skipped:
          results.filter(
            r =>
              r.status !==
              'valid',
          ).length,

        credentials,
      })
    } catch (
      err: any
    ) {
      if (
        err?.name ===
        'ZodError'
      ) {
        return res.status(400).json({
          error:
            err.issues?.[0]
              ?.message ??
            err.message,
        })
      }

      console.error(
        '[STUDENTS] Import error:',
        err,
      )

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// REASSIGN STUDENT TO SECTION
// ============================================================

router.patch(
  '/:id/section',
  requireAuth,
  requireRole('ADMIN'),
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const data =
        z
          .object({
            sectionId:
              z.string(),

            academicYearId:
              z.string(),

            gradeLevelId:
              z.string(),
          })
          .parse(req.body)

      const s =
        await prisma.student.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!s) {
        return res.status(404).json({
          error:
            'Student not found',
        })
      }

      await prisma.studentSectionAssignment.deleteMany(
        {
          where: {
            studentId:
              s.id,
          },
        },
      )

      await prisma.studentSectionAssignment.create(
        {
          data: {
            id: uuidv4(),

            studentId:
              s.id,

            ...data,
          },
        },
      )

      const updated =
        await getStudent(
          s.id,
        )

      res.json(
        formatStudent(
          updated,
          true,
        ),
      )
    } catch (
      err: any
    ) {
      if (
        err?.name ===
        'ZodError'
      ) {
        return res.status(400).json({
          error:
            err.issues?.[0]
              ?.message ??
            err.message,
        })
      }

      console.error(err)

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// REMOVE STUDENT FROM SECTION
// ============================================================

router.delete(
  '/:id/section',
  requireAuth,
  requireRole('ADMIN'),
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const s =
        await prisma.student.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!s) {
        return res.status(404).json({
          error:
            'Student not found',
        })
      }

      await prisma.studentSectionAssignment.deleteMany(
        {
          where: {
            studentId:
              s.id,
          },
        },
      )

      res.json({
        success: true,
      })
    } catch (err) {
      console.error(err)

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// UPDATE STUDENT PROFILE
// ============================================================

router.patch(
  '/:id/profile',
  requireAuth,
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const s =
        await prisma.student.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!s) {
        return res.status(404).json({
          error:
            'Student not found',
        })
      }

      const isOwner =
        (req.user!.role === 'STUDENT' && (s.userId === req.user!.userId || s.id === req.user!.userId)) ||
        req.user!.role === 'ADMIN'

      if (!isOwner) {
        return res.status(403).json({
          error: 'Forbidden',
        })
      }

      const data =
        z
          .object({
            contactNumber:
              z.string()
                .optional(),

            gender:
              z.string()
                .optional(),

            birthDate:
              z.string()
                .optional(),

            address:
              z.string()
                .optional(),

            guardianName:
              z.string()
                .optional(),

            guardianContact:
              z.string()
                .optional(),

            emergencyContact:
              z.string()
                .optional(),

            biography:
              z.string()
                .optional(),

            bloodType:
              z.string()
                .trim()
                .max(20)
                .optional(),

            weight:
              z.preprocess(
                value =>
                  value === '' ||
                  value == null
                    ? null
                    : Number(
                        value,
                      ),

                z
                  .number()
                  .min(0)
                  .max(1000)
                  .nullable()
                  .optional(),
              ),

            height:
              z.preprocess(
                value =>
                  value === '' ||
                  value == null
                    ? null
                    : Number(
                        value,
                      ),

                z
                  .number()
                  .min(0)
                  .max(1000)
                  .nullable()
                  .optional(),
              ),
          })
          .parse(req.body)

      await prisma.$transaction(
        async tx => {
          await tx.student.update(
            {
              where: {
                id: s.id,
              },

              data: {
                ...(data.contactNumber !==
                undefined
                  ? {
                      contactNumber:
                        data.contactNumber ||
                        null,
                    }
                  : {}),

                ...(data.gender !==
                undefined
                  ? {
                      gender:
                        data.gender ||
                        null,
                    }
                  : {}),

                ...(data.birthDate !==
                undefined
                  ? {
                      birthDate:
                        optionalDate(
                          data.birthDate,
                        ),
                    }
                  : {}),
              },
            },
          )

          await tx.studentProfile.upsert(
            {
              where: {
                studentId:
                  s.id,
              },

              create: {
                id: uuidv4(),

                studentId:
                  s.id,

                address:
                  data.address ||
                  null,

                guardianName:
                  data.guardianName ||
                  null,

                guardianContact:
                  data.guardianContact ||
                  null,

                emergencyContact:
                  data.emergencyContact ||
                  null,

                biography:
                  data.biography ||
                  null,

                bloodType:
                  data.bloodType ||
                  null,

                weight:
                  data.weight ??
                  null,

                height:
                  data.height ??
                  null,
              },

              update: {
                ...(data.address !==
                undefined
                  ? {
                      address:
                        data.address ||
                        null,
                    }
                  : {}),

                ...(data.guardianName !==
                undefined
                  ? {
                      guardianName:
                        data.guardianName ||
                        null,
                    }
                  : {}),

                ...(data.guardianContact !==
                undefined
                  ? {
                      guardianContact:
                        data.guardianContact ||
                        null,
                    }
                  : {}),

                ...(data.emergencyContact !==
                undefined
                  ? {
                      emergencyContact:
                        data.emergencyContact ||
                        null,
                    }
                  : {}),

                ...(data.biography !==
                undefined
                  ? {
                      biography:
                        data.biography ||
                        null,
                    }
                  : {}),

                ...(data.bloodType !==
                undefined
                  ? {
                      bloodType:
                        data.bloodType ||
                        null,
                    }
                  : {}),

                ...(data.weight !==
                undefined
                  ? {
                      weight:
                        data.weight ??
                        null,
                    }
                  : {}),

                ...(data.height !==
                undefined
                  ? {
                      height:
                        data.height ??
                        null,
                    }
                  : {}),
              },
            },
          )
        },
      )

      const updated =
        await getStudent(
          s.id,
        )

      if (updated) {
        syncStudentCompatibility(updated)
        if (updated.profile) syncStudentProfileCompatibility(updated.profile)
      }

      res.json(
        formatStudent(
          updated,
          false,
        ),
      )
    } catch (
      err: any
    ) {
      if (
        err?.name ===
        'ZodError'
      ) {
        return res.status(400).json({
          error:
            err.issues?.[0]
              ?.message ??
            err.message,
        })
      }

      console.error(err)

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// UPLOAD PROFILE PICTURE
// ============================================================

router.post(
  '/:id/avatar',
  requireAuth,
  avatarUpload.single(
    'avatar',
  ),
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const s = await prisma.student.findFirst({
        where: {
          OR: [
            { id: req.params.id },
            { userId: req.params.id },
          ],
        },
        include: {
          profile: true,
        },
      })

      if (!s) {
        return res.status(404).json({
          error:
            'Student not found',
        })
      }

      const isOwner =
        (req.user!.role === 'STUDENT' && (s.userId === req.user!.userId || s.id === req.user!.userId)) ||
        req.user!.role === 'ADMIN'

      if (!isOwner) {
        return res.status(403).json({
          error: 'Forbidden',
        })
      }

      if (!req.file) {
        return res.status(400).json({
          error:
            'No file uploaded',
        })
      }

      const stored = await uploadImage({
        buffer: req.file.buffer,
        folder: 'students',
        claimedMimeType: req.file.mimetype,
        maxBytes: 5 * 1024 * 1024,
      })

      const oldImage = s.profile?.profilePicture

      try {
        await prisma.studentProfile.upsert(
        {
          where: {
            studentId:
              s.id,
          },

          create: {
            id: uuidv4(),

            studentId:
              s.id,

            profilePicture:
              stored.url,
          },

          update: {
            profilePicture:
              stored.url,
          },
        },
      )

        if (oldImage && oldImage !== stored.url) {
          await deleteImageReference(oldImage).catch(err => console.warn('[IMAGE] Failed to delete old student avatar:', err))
        }
      } catch (dbError) {
        await deleteImageByUrl(stored.url).catch(() => undefined)
        throw dbError
      }

      // Keep the in-memory compatibility snapshot in sync so the global
      // response auto-save cannot restore the previous image URL.
      const updatedProfile = await prisma.studentProfile.findUnique({
        where: { studentId: s.id },
      })
      if (updatedProfile) syncStudentProfileCompatibility(updatedProfile)

      res.json(
        formatStudent(
          await getStudent(
            s.id,
          ),
          false,
        ),
      )
    } catch (err) {
      console.error(err)

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// UPLOAD BANNER
// ============================================================

router.post(
  '/:id/banner',
  requireAuth,
  bannerUpload.single(
    'banner',
  ),
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const s = await prisma.student.findFirst({
        where: {
          OR: [
            { id: req.params.id },
            { userId: req.params.id },
          ],
        },
        include: {
          profile: true,
        },
      })

      if (!s) {
        return res.status(404).json({
          error:
            'Student not found',
        })
      }

      const isOwner =
        (req.user!.role === 'STUDENT' && (s.userId === req.user!.userId || s.id === req.user!.userId)) ||
        req.user!.role === 'ADMIN'

      if (!isOwner) {
        return res.status(403).json({
          error: 'Forbidden',
        })
      }

      if (!req.file) {
        return res.status(400).json({
          error:
            'No file uploaded',
        })
      }

      const stored = await uploadImage({
        buffer: req.file.buffer,
        folder: 'students',
        claimedMimeType: req.file.mimetype,
        maxBytes: 8 * 1024 * 1024,
      })

      const oldImage = s.profile?.bannerImage

      try {
        await prisma.studentProfile.upsert(
        {
          where: {
            studentId:
              s.id,
          },

          create: {
            id: uuidv4(),

            studentId:
              s.id,

            bannerImage:
              stored.url,
          },

          update: {
            bannerImage:
              stored.url,
          },
        },
      )

        if (oldImage && oldImage !== stored.url) {
          await deleteImageReference(oldImage).catch(err => console.warn('[IMAGE] Failed to delete old student banner:', err))
        }
      } catch (dbError) {
        await deleteImageByUrl(stored.url).catch(() => undefined)
        throw dbError
      }

      // Keep the in-memory compatibility snapshot in sync so the global
      // response auto-save cannot restore the previous image URL.
      const updatedProfile = await prisma.studentProfile.findUnique({
        where: { studentId: s.id },
      })
      if (updatedProfile) syncStudentProfileCompatibility(updatedProfile)

      res.json(
        formatStudent(
          await getStudent(
            s.id,
          ),
          false,
        ),
      )
    } catch (err) {
      console.error(err)

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// STUDENT GRADES
// ============================================================

router.get(
  '/:id/grades',
  requireAuth,
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const s =
        await prisma.student.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!s) {
        return res.status(404).json({
          error:
            'Student not found',
        })
      }

      if (
        req.user!.role ===
          'STUDENT' &&
        s.userId !==
          req.user!.userId
      ) {
        return res.status(403).json({
          error: 'Forbidden',
        })
      }

      const grades =
        await prisma.finalGrade.findMany(
          {
            where: {
              studentId:
                s.id,

              ...(req.query
                .academicYearId
                ? {
                    academicYearId:
                      String(
                        req.query
                          .academicYearId,
                      ),
                  }
                : {}),

              ...(req.query
                .gradingPeriod
                ? {
                    gradingPeriod:
                      String(
                        req.query
                          .gradingPeriod,
                      ),
                  }
                : {}),
            },

            include: {
              subject: true,
              section: true,
              academicYear: true,
              teacher: true,
            },

            orderBy: {
              releasedAt:
                'desc',
            },
          },
        )

      res.json(
        grades,
      )
    } catch (err) {
      console.error(
        '[STUDENTS] Grades error:',
        err,
      )

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// STUDENT ATTENDANCE
// ============================================================

router.get(
  '/:id/attendance',
  requireAuth,
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const s =
        await prisma.student.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!s) {
        return res.status(404).json({
          error:
            'Student not found',
        })
      }

      if (
        req.user!.role ===
          'STUDENT' &&
        s.userId !==
          req.user!.userId
      ) {
        return res.status(403).json({
          error: 'Forbidden',
        })
      }

      const records =
        await prisma.attendanceRecord.findMany(
          {
            where: {
              studentId:
                s.id,
            },

            include: {
              session: {
                include: {
                  subject: true,
                  section: true,
                },
              },
            },

            orderBy: {
              timeRecorded:
                'desc',
            },
          },
        )

      res.json(
        records,
      )
    } catch (err) {
      console.error(
        '[STUDENTS] Attendance error:',
        err,
      )

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// STUDENT SCORES
// ============================================================

router.get(
  '/:id/scores',
  requireAuth,
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const s =
        await prisma.student.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!s) {
        return res.status(404).json({
          error:
            'Student not found',
        })
      }

      if (
        req.user!.role ===
          'STUDENT' &&
        s.userId !==
          req.user!.userId
      ) {
        return res.status(403).json({
          error: 'Forbidden',
        })
      }

      const scores =
        await prisma.studentScore.findMany(
          {
            where: {
              studentId:
                s.id,
            },

            include: {
              activity: {
                include: {
                  subject: true,
                  section: true,
                },
              },
            },

            orderBy: {
              dateRecorded:
                'desc',
            },
          },
        )

      res.json(
        scores,
      )
    } catch (err) {
      console.error(
        '[STUDENTS] Scores error:',
        err,
      )

      res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// EXPORT
// ============================================================

export default router