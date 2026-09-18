import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { sendGmailEmail } from '../services/gmail.js'

import { prisma } from '../prisma.js'
import {
  requireAuth,
  requireRole,
} from '../middleware/auth.js'

const router = Router()

const __dirname = path.dirname(
  fileURLToPath(import.meta.url),
)

// ============================================================
// UPLOAD DIRECTORIES
// ============================================================

const avatarDir = path.join(
  __dirname,
  '../../uploads/avatars',
)

if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, {
    recursive: true,
  })
}

// ============================================================
// IMAGE FILTER
// ============================================================

const imageFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ]

  if (
    allowedTypes.includes(
      file.mimetype,
    )
  ) {
    cb(null, true)
  } else {
    cb(
      new Error(
        'Only image files are allowed',
      ),
    )
  }
}

// ============================================================
// AVATAR UPLOAD
// ============================================================

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (
      _req,
      _file,
      cb,
    ) => {
      cb(null, avatarDir)
    },

    filename: (
      _req,
      file,
      cb,
    ) => {
      cb(
        null,
        `${uuidv4()}${path.extname(
          file.originalname,
        ).toLowerCase()}`,
      )
    },
  }),

  limits: {
    fileSize:
      5 * 1024 * 1024,
  },

  fileFilter:
    imageFilter,
})

// ============================================================
// TEACHER CODE
// ============================================================

function generateTeacherCode() {
  return (
    'TC-' +
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
  if (
    !value ||
    !value.trim()
  ) {
    return null
  }

  const date = new Date(
    value,
  )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      `Invalid date: ${value}`,
    )
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
    .replace(
      /&/g,
      '&amp;',
    )
    .replace(
      /</g,
      '&lt;',
    )
    .replace(
      />/g,
      '&gt;',
    )
    .replace(
      /"/g,
      '&quot;',
    )
    .replace(
      /'/g,
      '&#039;',
    )
}

// ============================================================
// GMAIL EMAIL CONFIGURATION
// ============================================================

const configuredFrontendUrl =
  process.env.FRONTEND_URL?.trim() ||
  'https://exehighsmartclass.netlify.app'

const frontendUrl =
  configuredFrontendUrl.replace(/\/$/, '').endsWith('/login')
    ? configuredFrontendUrl.replace(/\/$/, '')
    : `${configuredFrontendUrl.replace(/\/$/, '')}/login`

const schoolName =
  'Exequiel R. Lina High School SMARTCLASS'

async function sendTeacherCredentialsEmail(
  params: {
    email: string
    fullName: string
    employeeId?: string | null
    tempPassword: string
  },
) {
  const {
    email,
    fullName,
    employeeId,
    tempPassword,
  } = params


  // ----------------------------------------------------------
  // LOGIN URL
  // ----------------------------------------------------------

  const loginUrl = frontendUrl

  // ----------------------------------------------------------
  // SEND EMAIL
  // ----------------------------------------------------------

  const info =
    await sendGmailEmail({
      to: email,
      subject: 'SMARTCLASS Teacher Account Credentials',
      text: `
Hello ${fullName},

Your ${schoolName} teacher account has been successfully created.

EMP ID:
${employeeId || '-'}

Username:
${email}

Temporary Password:
${tempPassword}

Login:
${loginUrl}

IMPORTANT:
This is a temporary password.

You will be required to change your password when you log in for the first time.

If you did not expect this account, please contact the school administrator.

Regards,
${schoolName} Administration
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
    Exequiel R. Lina High School SMARTCLASS Teacher Account
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
        box-shadow:0 4px 20px rgba(0,0,0,0.08);
      "
    >

      <h1
        style="
          margin-top:0;
          color:#1d4ed8;
          text-align:center;
        "
      >
        Exequiel R. Lina High School SMARTCLASS
      </h1>

      <h2
        style="
          color:#111827;
          text-align:center;
        "
      >
        Teacher Account Created
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
        Your SMARTCLASS teacher account
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
          EMP ID
        </p>

        <p
          style="
            margin:0 0 20px 0;
            color:#111827;
            font-size:20px;
            font-weight:bold;
          "
        >
          ${escapeHtml(
            employeeId || '-',
          )}
        </p>

        <p
          style="
            margin:0 0 12px 0;
            color:#6b7280;
            font-size:13px;
          "
        >
          USERNAME
        </p>

        <p
          style="
            margin:0 0 20px 0;
            color:#111827;
            font-size:20px;
            font-weight:bold;
          "
        >
          ${escapeHtml(email)}
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
          ${escapeHtml(
            tempPassword,
          )}
        </p>
      </div>

      <div
        style="
          text-align:center;
          margin:30px 0;
        "
      >
        <a
          href="${escapeHtml(
            loginUrl,
          )}"
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
          your password after your first
          login.
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
        please contact the school
        administrator.
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
          Exequiel R. Lina High School SMARTCLASS Administration
        </strong>
      </p>

    </div>
  </div>
</body>
</html>
        `.trim(),
    })

  console.log(
    `✅ Teacher credentials email sent to ${email}`,
  )

  console.log(
    `📨 Message ID: ${info.messageId}`,
  )

  return info
}

// ============================================================
// GET TEACHER
// ============================================================

async function getTeacher(
  id: string,
) {
  return prisma.teacher.findUnique({
    where: {
      id,
    },

    include: {
      user: true,

      profile: true,

      subjectAssignments: {
        orderBy: {
          createdAt:
            'desc',
        },

        include: {
          academicYear: true,
          subject: true,
          section: true,
        },
      },
    },
  })
}

// ============================================================
// FORMAT TEACHER
// ============================================================

function formatTeacher(
  teacher: any,
  includeUser = true,
) {
  if (!teacher) {
    return null
  }

  const {
    user,
    profile,
    subjectAssignments,
    ...base
  } = teacher

  return {
    ...base,

    ...(includeUser
      ? {
          user,
        }
      : {}),

    profile:
      profile ?? null,

    subjectAssignments:
      subjectAssignments ??
      [],
  }
}

// ============================================================
// ADMIN: LIST TEACHERS
// ============================================================

router.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const search =
        req.query.search
          ? String(
              req.query.search,
            ).trim()
          : ''

      const status =
        req.query.status
          ? String(
              req.query.status,
            )
          : undefined

      const teachers =
        await prisma.teacher.findMany({
          where: {
            ...(status
              ? {
                  status,
                }
              : {}),

            ...(search
              ? {
                  OR: [
                    {
                      fullName: {
                        contains:
                          search,
                        mode:
                          'insensitive',
                      },
                    },

                    {
                      email: {
                        contains:
                          search,
                        mode:
                          'insensitive',
                      },
                    },

                    {
                      employeeId: {
                        contains:
                          search,
                        mode:
                          'insensitive',
                      },
                    },
                  ],
                }
              : {}),
          },

          orderBy: {
            fullName: 'asc',
          },

          include: {
            user: true,

            profile: true,

            subjectAssignments: {
              orderBy: {
                createdAt:
                  'desc',
              },

              include: {
                academicYear: true,
                subject: true,
                section: true,
              },
            },
          },
        })

      return res.json(
        teachers.map(
          teacher =>
            formatTeacher(
              teacher,
              true,
            ),
        ),
      )
    } catch (err) {
      console.error(
        '[TEACHERS] List teachers error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// ADMIN: CREATE TEACHER
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
      // --------------------------------------------------------
      // VALIDATE REQUEST
      // --------------------------------------------------------

      const data =
        z
          .object({
            fullName:
              z.string().min(1),

            email:
              z.string().email(),

            employeeId:
              z.string().optional(),

            department:
              z.string().optional(),

            contactNumber:
              z.string().optional(),

            gender:
              z.string().optional(),

            birthDate:
              z.string().optional(),
          })
          .parse(req.body)

      // --------------------------------------------------------
      // NORMALIZE DATA
      // --------------------------------------------------------

      const email =
        data.email
          .trim()
          .toLowerCase()

      const fullName =
        data.fullName.trim()

      const employeeId =
        data.employeeId
          ?.trim() || null

      // --------------------------------------------------------
      // DUPLICATE CHECK
      // --------------------------------------------------------

      const [
        existingTeacher,
        existingUser,
      ] = await Promise.all([
        prisma.teacher.findFirst({
          where: {
            OR: [
              {
                email,
              },

              ...(employeeId
                ? [
                    {
                      employeeId,
                    },
                  ]
                : []),
            ],
          },
        }),

        prisma.user.findFirst({
          where: {
            email,
          },
        }),
      ])

      if (
        existingTeacher ||
        existingUser
      ) {
        return res.status(400).json({
          error:
            'Teacher email or employee ID already exists',
        })
      }

      // --------------------------------------------------------
      // GENERATE TEMPORARY PASSWORD
      // --------------------------------------------------------

      const tempPassword =
        generateTempPassword()

      const passwordHash =
        await bcrypt.hash(
          tempPassword,
          12,
        )

      // --------------------------------------------------------
      // GENERATE IDS
      // --------------------------------------------------------

      const userId =
        uuidv4()

      const teacherId =
        uuidv4()

      // --------------------------------------------------------
      // CREATE DATABASE RECORDS
      // --------------------------------------------------------

      const teacher =
        await prisma.$transaction(
          async tx => {
            // --------------------------------------------------
            // CREATE USER
            // --------------------------------------------------

            await tx.user.create({
              data: {
                id: userId,

                email,

                passwordHash,

                role: 'TEACHER',

                status: 'active',

                isFirstLogin:
                  true,
              },
            })

            // --------------------------------------------------
            // CREATE TEACHER
            // --------------------------------------------------

          await tx.teacher.create({
  data: {
    id: teacherId,
    userId,
    fullName: data.fullName.trim(),
    email,
    employeeId: data.employeeId?.trim() || null,
    department: data.department?.trim() || null,
    contactNumber: data.contactNumber?.trim() || null,
    status: 'active',
  },
})

            // --------------------------------------------------
            // RETURN COMPLETE TEACHER
            // --------------------------------------------------

            return tx.teacher.findUnique(
              {
                where: {
                  id: teacherId,
                },

                include: {
                  user: true,

                  profile: true,

                  subjectAssignments: {
                    orderBy: {
                      createdAt:
                        'desc',
                    },

                    include: {
                      academicYear:
                        true,

                      subject:
                        true,

                      section:
                        true,
                    },
                  },
                },
              },
            )
          },
        )

      // --------------------------------------------------------
      // CHECK CREATED TEACHER
      // --------------------------------------------------------

      if (!teacher) {
        return res.status(500).json({
          error:
            'Teacher was not created',
        })
      }

      // --------------------------------------------------------
      // SEND EMAIL AFTER DATABASE CREATION
      // --------------------------------------------------------

      let emailSent =
        false

      let emailError:
        | string
        | null = null

      try {
        await sendTeacherCredentialsEmail(
          {
            email,

            fullName,

            employeeId,

            tempPassword,
          },
        )

        emailSent =
          true
      } catch (
        mailError: any
      ) {
        console.error(
          '[TEACHERS] Teacher credential email failed:',
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

        teacher:
          formatTeacher(
            teacher,
            true,
          ),

        emailSent,

        emailError,

        // TEMPORARILY RETURN PASSWORD
        // This allows admin to recover the
        // password if Gmail fails.
        tempPassword,
      })
    } catch (
      err: any
    ) {
      // --------------------------------------------------------
      // ZOD VALIDATION ERROR
      // --------------------------------------------------------

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

      // --------------------------------------------------------
      // DATABASE / SERVER ERROR
      // --------------------------------------------------------

      console.error(
        '[TEACHERS] Create teacher error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// GET SINGLE TEACHER
// ============================================================

router.get(
  '/:id',
  requireAuth,
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const teacher =
        await getTeacher(
          req.params.id,
        )

      if (!teacher) {
        return res.status(404).json({
          error:
            'Teacher not found',
        })
      }

      // --------------------------------------------------------
      // TEACHER CAN ONLY VIEW OWN ACCOUNT
      // --------------------------------------------------------

      if (
        req.user!.role ===
          'TEACHER' &&
        teacher.userId !==
          req.user!.userId
      ) {
        return res.status(403).json({
          error: 'Forbidden',
        })
      }

      return res.json(
        formatTeacher(
          teacher,
          true,
        ),
      )
    } catch (err) {
      console.error(
        '[TEACHERS] Get teacher error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// UPDATE TEACHER
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

            department:
              z.string().optional(),

            contactNumber:
              z.string().optional(),

            employeeId:
              z.string().optional(),
          })
          .parse(req.body)

      // --------------------------------------------------------
      // FIND TEACHER
      // --------------------------------------------------------

      const teacher =
        await prisma.teacher.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!teacher) {
        return res.status(404).json({
          error: 'Not found',
        })
      }

      // --------------------------------------------------------
      // CHECK EMPLOYEE ID DUPLICATE
      // --------------------------------------------------------

      if (
        data.employeeId !==
        undefined
      ) {
        const employeeId =
          data.employeeId.trim()

        if (employeeId) {
          const existing =
            await prisma.teacher.findFirst(
              {
                where: {
                  employeeId,

                  NOT: {
                    id: teacher.id,
                  },
                },
              },
            )

          if (existing) {
            return res.status(400).json({
              error:
                'Employee ID already exists',
            })
          }
        }
      }

      // --------------------------------------------------------
      // UPDATE TEACHER
      // --------------------------------------------------------

      const updated =
        await prisma.teacher.update(
          {
            where: {
              id: req.params.id,
            },

            data: {
              ...(data.fullName !==
              undefined
                ? {
                    fullName:
                      data.fullName.trim(),
                  }
                : {}),

              ...(data.department !==
              undefined
                ? {
                    department:
                      data.department.trim() ||
                      null,
                  }
                : {}),

              ...(data.contactNumber !==
              undefined
                ? {
                    contactNumber:
                      data.contactNumber.trim() ||
                      null,
                  }
                : {}),

              ...(data.employeeId !==
              undefined
                ? {
                    employeeId:
                      data.employeeId.trim() ||
                      null,
                  }
                : {}),
            },

            include: {
              user: true,

              profile: true,

              subjectAssignments: {
                orderBy: {
                  createdAt:
                    'desc',
                },

                include: {
                  academicYear:
                    true,

                  subject:
                    true,

                  section:
                    true,
                },
              },
            },
          },
        )

      return res.json(
        formatTeacher(
          updated,
          true,
        ),
      )
    } catch (
      err: any
    ) {
      // --------------------------------------------------------
      // ZOD ERROR
      // --------------------------------------------------------

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
        '[TEACHERS] Update teacher error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// ARCHIVE TEACHER
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
      const teacher =
        await prisma.teacher.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!teacher) {
        return res.status(404).json({
          error: 'Not found',
        })
      }

      await prisma.$transaction([
        prisma.teacher.update({
          where: {
            id: teacher.id,
          },

          data: {
            status:
              'archived',
          },
        }),

        prisma.user.update({
          where: {
            id: teacher.userId,
          },

          data: {
            status:
              'inactive',
          },
        }),
      ])

      return res.json({
        success: true,
      })
    } catch (err) {
      console.error(
        '[TEACHERS] Archive teacher error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// RESTORE TEACHER
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
      const teacher =
        await prisma.teacher.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!teacher) {
        return res.status(404).json({
          error: 'Not found',
        })
      }

      await prisma.$transaction([
        prisma.teacher.update({
          where: {
            id: teacher.id,
          },

          data: {
            status:
              'active',
          },
        }),

        prisma.user.update({
          where: {
            id: teacher.userId,
          },

          data: {
            status:
              'active',
          },
        }),
      ])

      return res.json({
        success: true,
      })
    } catch (err) {
      console.error(
        '[TEACHERS] Restore teacher error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// ASSIGN SUBJECT / SECTION
// ============================================================

router.post(
  '/:id/assignments',
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
            subjectId:
              z.string(),

            sectionId:
              z.string(),

            academicYearId:
              z.string(),
          })
          .parse(req.body)

      // --------------------------------------------------------
      // FIND TEACHER
      // --------------------------------------------------------

      const teacher =
        await prisma.teacher.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!teacher) {
        return res.status(404).json({
          error:
            'Teacher not found',
        })
      }

      // --------------------------------------------------------
      // CREATE ASSIGNMENT
      // --------------------------------------------------------

      const assignment =
        await prisma.teacherSubjectAssignment.create(
          {
            data: {
              id: uuidv4(),

              teacherId:
                teacher.id,

              subjectId:
                data.subjectId,

              sectionId:
                data.sectionId,

              academicYearId:
                data.academicYearId,
            },

            include: {
              subject: true,

              section: true,

              academicYear:
                true,
            },
          },
        )

      return res.json(
        assignment,
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
            err.message ??
            'Invalid request',
        })
      }

      console.error(
        '[TEACHERS] Assignment error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// RESET TEACHER PASSWORD
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
      // --------------------------------------------------------
      // FIND TEACHER
      // --------------------------------------------------------

      const teacher =
        await prisma.teacher.findUnique(
          {
            where: {
              id: req.params.id,
            },
          },
        )

      if (!teacher) {
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
      // UPDATE USER ACCOUNT
      // --------------------------------------------------------

      await prisma.user.update({
        where: {
          id: teacher.userId,
        },

        data: {
          passwordHash,
          // A reset password is temporary, so the teacher
          // must be required to set a new personal password
          // on the next login.
          isFirstLogin: true,
        },
      })

      // --------------------------------------------------------
      // SEND EMAIL
      // --------------------------------------------------------

      let emailSent =
        false

      let emailError:
        | string
        | null = null

      try {
        await sendTeacherCredentialsEmail(
          {
            email:
              teacher.email,

            fullName:
              teacher.fullName,

            employeeId:
              teacher.employeeId,

            tempPassword,
          },
        )

        emailSent =
          true
      } catch (
        mailError: any
      ) {
        console.error(
          '[TEACHERS] Password reset email failed:',
          mailError,
        )

        emailError =
          mailError?.message ||
          'Failed to send email'
      }

      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res.json({
        success: true,

        email:
          teacher.email,

        emailSent,

        emailError,

        tempPassword,
      })
    } catch (
      err: any
    ) {
      console.error(
        '[TEACHERS] Reset password error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// UPDATE TEACHER PROFILE
// ============================================================

router.patch(
  '/:id/profile',
  requireAuth,
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const teacher =
        await prisma.teacher.findUnique({
          where: {
            id: req.params.id,
          },
        })

      if (!teacher) {
        return res.status(404).json({
          error:
            'Teacher not found',
        })
      }

      const isOwner =
        req.user!.role ===
          'TEACHER' &&
        teacher.userId ===
          req.user!.userId

      if (
        !isOwner &&
        req.user!.role !==
          'ADMIN'
      ) {
        return res.status(403).json({
          error: 'Forbidden',
        })
      }

      const data =
        z
          .object({
            gender:
              z.string().optional(),

            birthDate:
              z.string().optional(),

            contactNumber:
              z.string().optional(),
          })
          .parse(req.body)

      await prisma.$transaction(
        async tx => {
          // ----------------------------------------------------
          // UPDATE TEACHER
          // ----------------------------------------------------

          await tx.teacher.update({
            where: {
              id: teacher.id,
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
            },
          })

          // ----------------------------------------------------
          // UPDATE / CREATE PROFILE
          // ----------------------------------------------------

          await tx.teacherProfile.upsert({
            where: {
              teacherId:
                teacher.id,
            },

            create: {
              id: uuidv4(),

              teacherId:
                teacher.id,

              gender:
                data.gender ||
                null,

              birthDate:
                optionalDate(
                  data.birthDate,
                ),
            },

            update: {
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
          })
        },
      )

      const updated =
        await getTeacher(
          teacher.id,
        )

      return res.json(
        formatTeacher(
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
            err.message ??
            'Invalid request',
        })
      }

      console.error(
        '[TEACHERS] Update profile error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// UPLOAD TEACHER PROFILE PICTURE
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
      const teacher =
        await prisma.teacher.findUnique({
          where: {
            id: req.params.id,
          },

          include: {
            profile: true,
          },
        })

      if (!teacher) {
        return res.status(404).json({
          error:
            'Teacher not found',
        })
      }

      // --------------------------------------------------------
      // CHECK OWNER
      // --------------------------------------------------------

      const isOwner =
        req.user!.role ===
          'TEACHER' &&
        teacher.userId ===
          req.user!.userId

      if (
        !isOwner &&
        req.user!.role !==
          'ADMIN'
      ) {
        return res.status(403).json({
          error: 'Forbidden',
        })
      }

      // --------------------------------------------------------
      // CHECK FILE
      // --------------------------------------------------------

      if (!req.file) {
        return res.status(400).json({
          error:
            'No file uploaded',
        })
      }

      // --------------------------------------------------------
      // NEW FILE PATH
      // --------------------------------------------------------

      const filePath =
        `/uploads/avatars/${req.file.filename}`

      // --------------------------------------------------------
      // DELETE OLD PROFILE PICTURE
      // --------------------------------------------------------

      if (
        teacher.profile
          ?.profilePicture
      ) {
        const oldPath =
          path.join(
            __dirname,
            '../../',
            teacher.profile
              .profilePicture,
          )

        if (
          fs.existsSync(
            oldPath,
          )
        ) {
          fs.unlinkSync(
            oldPath,
          )
        }
      }

      // --------------------------------------------------------
      // SAVE NEW PROFILE PICTURE
      // --------------------------------------------------------

      await prisma.teacherProfile.upsert({
        where: {
          teacherId:
            teacher.id,
        },

        create: {
          id: uuidv4(),

          teacherId:
            teacher.id,

          profilePicture:
            filePath,
        },

        update: {
          profilePicture:
            filePath,
        },
      })

      // --------------------------------------------------------
      // RETURN UPDATED TEACHER
      // --------------------------------------------------------

      const updated =
        await getTeacher(
          teacher.id,
        )

      return res.json(
        formatTeacher(
          updated,
          false,
        ),
      )
    } catch (err) {
      console.error(
        '[TEACHERS] Avatar upload error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

// ============================================================
// EXPORT ROUTER
// ============================================================

export default router