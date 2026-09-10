import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { syncUserCompatibility } from '../db.js'
import { signToken, requireAuth } from '../middleware/auth.js'
import { passwordSchema } from '../validation.js'
import { getEffectiveTeacherAssignments } from '../services/teacherAssignments.js'

const router = Router()

/**
 * ============================================================
 * SYSTEM SETTINGS
 * ============================================================
 */

async function setting(key: string, fallback: string) {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key },
    })

    return record?.value ?? fallback
  } catch (error) {
    console.error(`Failed to read system setting "${key}":`, error)
    return fallback
  }
}

async function firstLoginRequired(user: {
  isFirstLogin: boolean
  role: 'ADMIN' | 'TEACHER' | 'STUDENT'
}) {
  /**
   * ADMIN
   * ----------------------------------------------------------
   * Admin accounts are never required to change password.
   */
  if (user.role === 'ADMIN') {
    return false
  }

  /**
   * STUDENT / TEACHER
   * ----------------------------------------------------------
   * The first-login requirement is controlled ONLY by the
   * database value isFirstLogin.
   *
   * If isFirstLogin is false, changing/resetting the password
   * must NOT make the account a first-login account again.
   */
  if (user.isFirstLogin !== true) {
    return false
  }

  /**
   * System setting can disable the first-login requirement
   * globally.
   */
  const forceFirstLogin =
    await setting(
      'forceFirstLoginPasswordChange',
      'true',
    )

  return forceFirstLogin === 'true'
}

async function loginLimits() {
  const max = Math.max(
    1,
    Number(await setting('maxLoginAttempts', '5')) || 5,
  )

  const minutes = Math.max(
    1,
    Number(await setting('lockoutDuration', '15')) || 15,
  )

  return {
    max,
    minutes,
  }
}

function generateTempPassword() {
  return crypto.randomBytes(9).toString('base64url')
}

/**
 * ============================================================
 * LOGIN VALIDATION
 * ============================================================
 */

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
  role: z.enum([
    'STUDENT',
    'TEACHER',
    'ADMIN',
  ]),
})

/**
 * ============================================================
 * LOGIN
 * POST /api/auth/login
 * ============================================================
 */

router.post(
  '/login',
  async (req: Request, res: Response) => {
    try {
      const {
        identifier,
        password,
        role,
      } = loginSchema.parse(req.body)

      let user: any = null
      let name = 'User'

      /**
       * --------------------------------------------------------
       * STUDENT LOGIN
       * --------------------------------------------------------
       */

      if (role === 'STUDENT') {
        const student =
          await prisma.student.findUnique({
            where: {
              studentNumber: identifier,
            },
            include: {
              user: true,
            },
          })

        /**
         * Student exists but user account is missing.
         */
        if (student && !student.user) {
          console.error(
            `[AUTH] Student ${identifier} exists but has no linked User account.`,
          )

          return res.status(401).json({
            error: 'Student account is not properly configured.',
          })
        }

        if (student?.user) {
          user = student.user
          name = student.fullName || 'Student'
        }
      }

      /**
       * --------------------------------------------------------
       * TEACHER LOGIN
       * --------------------------------------------------------
       */

      else if (role === 'TEACHER') {
        user = await prisma.user.findFirst({
          where: {
            email: identifier,
            role: 'TEACHER',
          },
        })

        if (user) {
          const teacher =
            await prisma.teacher.findUnique({
              where: {
                userId: user.id,
              },
            })

          name =
            teacher?.fullName ||
            user.name ||
            'Teacher'
        }
      }

      /**
       * --------------------------------------------------------
       * ADMIN LOGIN
       * --------------------------------------------------------
       */

      else if (role === 'ADMIN') {
        user = await prisma.user.findFirst({
          where: {
            username: identifier,
            role: 'ADMIN',
          },
        })

        if (user) {
          const admin =
            await prisma.admin.findUnique({
              where: {
                userId: user.id,
              },
            })

          name =
            admin?.fullName ||
            user.name ||
            'Administrator'
        }
      }

      /**
       * --------------------------------------------------------
       * INVALID USER
       * --------------------------------------------------------
       */

      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials',
        })
      }

      /**
       * --------------------------------------------------------
       * ACCOUNT STATUS
       * --------------------------------------------------------
       */

      if (user.status !== 'active') {
        return res.status(401).json({
          error: 'Account is inactive',
        })
      }

      /**
       * --------------------------------------------------------
       * ACCOUNT LOCK CHECK
       * --------------------------------------------------------
       */

      if (
        user.lockedUntil &&
        user.lockedUntil.getTime() > Date.now()
      ) {
        return res.status(423).json({
          error:
            'Account temporarily locked. Please try again later.',
        })
      }

      /**
       * --------------------------------------------------------
       * CLEAR EXPIRED LOCK
       * --------------------------------------------------------
       *
       * IMPORTANT:
       * Use updateMany instead of update.
       *
       * update() can throw Prisma P2025 if the user disappears
       * between findUnique() and update().
       *
       * updateMany() safely returns { count: 0 } instead.
       */

      if (user.lockedUntil) {
        const clearExpiredLock =
          await prisma.user.updateMany({
            where: {
              id: user.id,
            },
            data: {
              lockedUntil: null,
              failedLoginAttempts: 0,
            },
          })

        /**
         * User disappeared during the request.
         */
        if (clearExpiredLock.count === 0) {
          console.error(
            `[AUTH] User ${user.id} disappeared while clearing expired lock.`,
          )

          return res.status(401).json({
            error: 'Account no longer exists.',
          })
        }

        /**
         * Keep local object synchronized.
         */
        user.lockedUntil = null
        user.failedLoginAttempts = 0
      }

      /**
       * --------------------------------------------------------
       * PASSWORD CHECK
       * --------------------------------------------------------
       */

      const valid = await bcrypt.compare(
        password,
        user.passwordHash,
      )

      /**
       * --------------------------------------------------------
       * INVALID PASSWORD
       * --------------------------------------------------------
       */

      if (!valid) {
        const {
          max,
          minutes,
        } = await loginLimits()

        const failedAttempts =
          (user.failedLoginAttempts || 0) + 1

        /**
         * ------------------------------------------------------
         * MAXIMUM FAILED ATTEMPTS
         * ------------------------------------------------------
         */

        if (failedAttempts >= max) {
          const lockedUntil =
            new Date(
              Date.now() +
                minutes * 60_000,
            )

          const lockResult =
            await prisma.user.updateMany({
              where: {
                id: user.id,
              },
              data: {
                failedLoginAttempts: 0,
                lockedUntil,
              },
            })

          /**
           * User disappeared during update.
           */
          if (lockResult.count === 0) {
            console.error(
              `[AUTH] User ${user.id} disappeared while locking account.`,
            )

            return res.status(401).json({
              error: 'Account no longer exists.',
            })
          }

          return res.status(423).json({
            error:
              `Too many failed attempts. ` +
              `Try again in ${minutes} minutes.`,
          })
        }

        /**
         * ------------------------------------------------------
         * SAVE FAILED ATTEMPT
         * ------------------------------------------------------
         */

        const failedResult =
          await prisma.user.updateMany({
            where: {
              id: user.id,
            },
            data: {
              failedLoginAttempts:
                failedAttempts,
            },
          })

        /**
         * User disappeared during update.
         */
        if (failedResult.count === 0) {
          console.error(
            `[AUTH] User ${user.id} disappeared while saving failed login attempt.`,
          )

          return res.status(401).json({
            error: 'Account no longer exists.',
          })
        }

        return res.status(401).json({
          error: 'Invalid credentials',
        })
      }

      /**
       * ========================================================
       * SUCCESSFUL LOGIN
       * ========================================================
       *
       * IMPORTANT:
       * This is the exact location where your P2025 happened.
       *
       * Old:
       *
       * prisma.user.update()
       *
       * New:
       *
       * prisma.user.updateMany()
       *
       * This prevents P2025 if the user was removed between
       * the initial lookup and this update.
       */

      const loginAt = new Date()

      const loginUpdate =
        await prisma.user.updateMany({
          where: {
            id: user.id,
          },
          data: {
            lastLogin: loginAt,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        })

      // Keep the legacy compatibility snapshot synchronized. The global
      // response auto-save runs after mutating requests and must not restore
      // stale login metadata from memory.
      if (loginUpdate.count > 0) {
        user.lastLogin = loginAt
        user.failedLoginAttempts = 0
        user.lockedUntil = null
        syncUserCompatibility(user)
      }

      /**
       * --------------------------------------------------------
       * USER DISAPPEARED
       * --------------------------------------------------------
       */

      if (loginUpdate.count === 0) {
        console.error(
          `[AUTH] User ${user.id} no longer exists during successful login.`,
        )

        return res.status(401).json({
          error:
            'Account no longer exists. Please create the account again.',
        })
      }

      /**
       * --------------------------------------------------------
       * JWT TOKEN
       * --------------------------------------------------------
       */

      const token = signToken({
        userId: user.id,
        role: user.role,
        name,
      })

      /**
       * --------------------------------------------------------
       * COOKIE
       * --------------------------------------------------------
       */

      res.cookie('token', token, {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          'production',
        sameSite: 'lax',
        maxAge:
          24 *
          60 *
          60 *
          1000,
      })

      /**
       * --------------------------------------------------------
       * RESPONSE
       * --------------------------------------------------------
       */

      return res.json({
        token,
        user: {
          id: user.id,
          role: user.role,
          name,
          isFirstLogin:
            await firstLoginRequired(user),
        },
      })
    } catch (err: any) {
      /**
       * --------------------------------------------------------
       * ZOD VALIDATION ERROR
       * --------------------------------------------------------
       */

      if (err?.name === 'ZodError') {
        return res.status(400).json({
          error:
            err.issues?.[0]?.message ??
            err.message ??
            'Invalid request.',
        })
      }

      /**
       * --------------------------------------------------------
       * PRISMA ERROR
       * --------------------------------------------------------
       */

      if (err?.code === 'P2025') {
        console.error(
          '[AUTH] Prisma P2025:',
          err,
        )

        return res.status(401).json({
          error:
            'The account could not be found. Please log in again.',
        })
      }

      /**
       * --------------------------------------------------------
       * GENERAL ERROR
       * --------------------------------------------------------
       */

      console.error(
        '[AUTH] Login error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/**
 * ============================================================
 * LOGOUT
 * POST /api/auth/logout
 * ============================================================
 */

router.post(
  '/logout',
  (_req: Request, res: Response) => {
    res.clearCookie('token')

    return res.json({
      success: true,
    })
  },
)

/**
 * ============================================================
 * CURRENT USER
 * GET /api/auth/me
 * ============================================================
 */

router.get(
  '/me',
  requireAuth,
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const user =
        await prisma.user.findUnique({
          where: {
            id: req.user!.userId,
          },

          include: {
            /**
             * ADMIN
             */
            admin: true,

            /**
             * STUDENT
             */
            student: {
              include: {
                profile: true,

                sectionAssignments: {
                  take: 1,

                  include: {
                    section: {
                      include: {
                        gradeLevel: true,
                        strand: true,
                      },
                    },

                    academicYear: true,
                  },
                },
              },
            },

            /**
             * TEACHER
             */
            teacher: {
              include: {
                profile: true,

                subjectAssignments: {
                  include: {
                    subject: true,

                    section: {
                      include: {
                        gradeLevel: true,
                        strand: true,
                      },
                    },

                    academicYear: true,
                  },
                },
              },
            },
          },
        })

      /**
       * --------------------------------------------------------
       * USER NO LONGER EXISTS
       * --------------------------------------------------------
       */

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
        })
      }

      /**
       * ========================================================
       * STUDENT PROFILE
       * ========================================================
       */

      if (user.role === 'STUDENT') {
        const student =
          user.student

        if (!student) {
          return res.status(404).json({
            error:
              'Student profile not found',
          })
        }

        const sectionAssignments =
          student.sectionAssignments.map(
            (assignment) => ({
              ...assignment,

              section:
                assignment.section
                  ? {
                      ...assignment.section,

                      gradeLevel:
                        assignment.section
                          .gradeLevel ||
                        null,

                      strand:
                        assignment.section
                          .strand ||
                        null,
                    }
                  : null,

              academicYear:
                assignment.academicYear ||
                null,
            }),
          )

        const profile = {
          ...student,

          profile:
            student.profile ||
            null,

          sectionAssignments,
        }

        return res.json({
          id: user.id,
          role: user.role,

          isFirstLogin:
            await firstLoginRequired(
              user,
            ),

          profile,
        })
      }

      /**
       * ========================================================
       * TEACHER PROFILE
       * ========================================================
       */

      if (user.role === 'TEACHER') {
        const teacher =
          user.teacher

        if (!teacher) {
          return res.status(404).json({
            error:
              'Teacher profile not found',
          })
        }

        // Always read the current assignment set from the database.
        // The effective list also includes older schedule-only relationships,
        // so a teacher never loses assigned subjects after a fresh login.
        const subjectAssignments =
          await getEffectiveTeacherAssignments(teacher.id)

        const profile = {
          ...teacher,

          profile:
            teacher.profile ||
            null,

          subjectAssignments,
        }

        return res.json({
          id: user.id,
          role: user.role,

          isFirstLogin:
            await firstLoginRequired(
              user,
            ),

          profile,
        })
      }

      /**
       * ========================================================
       * ADMIN PROFILE
       * ========================================================
       */

      const profile =
        user.admin || null

      return res.json({
        id: user.id,
        role: user.role,

        isFirstLogin:
          await firstLoginRequired(
            user,
          ),

        profile,
      })
    } catch (err: any) {
      /**
       * Handle Prisma record-not-found errors safely.
       */
      if (err?.code === 'P2025') {
        console.error(
          '[AUTH] /me P2025:',
          err,
        )

        return res.status(404).json({
          error:
            'User account no longer exists.',
        })
      }

      console.error(
        '[AUTH] /me error:',
        err,
      )

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/**
 * ============================================================
 * CHANGE PASSWORD
 * POST /api/auth/change-password
 * ============================================================
 */

router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword: passwordSchema,
    }).parse(req.body)

    const user = await prisma.user.findUnique({
      where: {
        id: req.user!.userId,
      },
    })

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      })
    }

    const valid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    )

    if (!valid) {
      return res.status(401).json({
        error: 'Current password is incorrect',
      })
    }

    const passwordHash = await bcrypt.hash(
      newPassword,
      12,
    )

    // A successfully changed temporary password permanently
    // clears the first-login requirement. This is persisted
    // in PostgreSQL through Prisma.
    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
        isFirstLogin: false,
      },
    })

    // The compatibility `db.users` array is loaded once at startup. Without
    // synchronizing it here, the response auto-save would write the old
    // password hash/isFirstLogin=true back over PostgreSQL after this request.
    syncUserCompatibility(updatedUser)

    return res.json({
      success: true,
      isFirstLogin: false,
    })
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: err.issues?.[0]?.message ?? err.message,
      })
    }

    console.error(
      '[AUTH] Change password failed:',
      err,
    )

    res.status(500).json({
      error: 'Server error',
    })
  }
})

export default router