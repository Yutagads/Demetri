import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { optionalText } from '../validation.js'

const router = Router()

/*
 * SMARTCLASS Academic Routes
 *
 * Prisma/PostgreSQL version.
 *
 * IMPORTANT FIX:
 * StudentScore writes use an atomic upsert first, with a P2002
 * fallback. This prevents duplicate studentId + activityId errors
 * when the teacher UI sends the same score request more than once
 * at nearly the same time.
 */

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function toDate(value: string | Date | undefined | null): Date | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`)
  }

  return date
}

async function getTeacherFromUser(userId: string) {
  return prisma.teacher.findFirst({
    where: {
      userId,
    },
  })
}

async function getActivityExpanded(id: string) {
  const activity = await prisma.academicActivity.findUnique({
    where: { id },
  })

  if (!activity) {
    return null
  }

  const [subject, section, studentScores] = await Promise.all([
    prisma.subject.findUnique({
      where: { id: activity.subjectId },
    }),

    prisma.section.findUnique({
      where: { id: activity.sectionId },
    }),

    prisma.studentScore.findMany({
      where: {
        activityId: activity.id,
      },
      orderBy: {
        dateRecorded: 'asc',
      },
    }),
  ])

  const scoresWithStudents = await Promise.all(
    studentScores.map(async score => {
      const student = await prisma.student.findUnique({
        where: {
          id: score.studentId,
        },
      })

      return {
        ...score,
        student,
      }
    }),
  )

  return {
    ...activity,
    subject,
    section,
    studentScores: scoresWithStudents,
  }
}

/*
 * Save one teacher-entered score safely.
 *
 * The normal path is an atomic upsert using the Prisma composite
 * unique key studentId_activityId.
 *
 * If PostgreSQL reports P2002 because two browser requests arrived
 * simultaneously, we immediately fetch the existing row and update it.
 */
async function saveStudentScore(
  studentId: string,
  activityId: string,
  scoreObtained: number,
  totalScore: number,
  now: Date,
) {
  try {
    return await prisma.studentScore.upsert({
      where: {
        studentId_activityId: {
          studentId,
          activityId,
        },
      },
      update: {
        scoreObtained,
        totalScore,
        dateRecorded: now,
      },
      create: {
        id: uuidv4(),
        studentId,
        activityId,
        scoreObtained,
        totalScore,
        dateRecorded: now,
      },
    })
  } catch (err: any) {
    /*
     * P2002 means the unique key was created by another request
     * between the competing writes. Retry as an update.
     */
    if (err?.code === 'P2002') {
      const existing = await prisma.studentScore.findFirst({
        where: {
          studentId,
          activityId,
        },
      })

      if (existing) {
        return prisma.studentScore.update({
          where: {
            id: existing.id,
          },
          data: {
            scoreObtained,
            totalScore,
            dateRecorded: now,
          },
        })
      }
    }

    throw err
  }
}

/* -------------------------------------------------------------------------- */
/* Activities                                                                 */
/* -------------------------------------------------------------------------- */

/*
 * Teacher/Admin: create activity
 */
router.post(
  '/activities',
  requireAuth,
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const data = z
        .object({
          title: z.string().trim().min(1).max(200),
          subjectId: z.string().trim().min(1),
          sectionId: z.string().trim().min(1),
          academicYearId: z.string().trim().min(1),
          category: z.enum(['Quiz', 'Assignment', 'Project', 'Examination', 'Laboratory', 'Participation', 'Other']),
          totalScore: z.number().finite().positive().max(100000),
          activityDate: z.string().optional(),
        })
        .parse(req.body)

      const teacher = await getTeacherFromUser(req.user!.userId)

      if (!teacher && req.user!.role !== 'ADMIN') {
        return res.status(404).json({
          error: 'Teacher not found',
        })
      }

      const teacherId = teacher?.id || ''
      const now = new Date()

      const activity = await prisma.academicActivity.create({
        data: {
          id: uuidv4(),
          title: data.title,
          subjectId: data.subjectId,
          sectionId: data.sectionId,
          teacherId,
          academicYearId: data.academicYearId,
          category: data.category,
          totalScore: data.totalScore,
          activityDate: toDate(data.activityDate) ?? now,
          createdAt: now,
        },
      })

      return res.json(await getActivityExpanded(activity.id))
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error: err.issues?.[0]?.message ?? err.message,
        })
      }

      console.error('[academic] create activity error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/*
 * Teacher/Admin: list activities
 */
router.get(
  '/activities',
  requireAuth,
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const teacher = await getTeacherFromUser(req.user!.userId)

      const activities = await prisma.academicActivity.findMany({
        where:
          teacher && req.user!.role !== 'ADMIN'
            ? {
                teacherId: teacher.id,
              }
            : undefined,
        orderBy: {
          activityDate: 'desc',
        },
      })

      const expanded = await Promise.all(
        activities.map(activity => getActivityExpanded(activity.id)),
      )

      return res.json(expanded)
    } catch (err) {
      console.error('[academic] list activities error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/*
 * Teacher/Admin: record/update student scores.
 *
 * FIXED:
 * - No findFirst -> create race.
 * - Uses atomic upsert.
 * - Handles P2002 race as a fallback.
 */
router.post(
  '/activities/:id/scores',
  requireAuth,
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const scores = z
        .array(
          z.object({
            studentId: z.string().trim().min(1),
            scoreObtained: z.number().finite().min(0),
          }),
        )
        .parse(req.body)

      const activity = await prisma.academicActivity.findUnique({
        where: {
          id: req.params.id,
        },
      })

      if (!activity) {
        return res.status(404).json({
          error: 'Activity not found',
        })
      }

      const now = new Date()
      const results: any[] = []

      for (const scoreData of scores) {
        if (
          !Number.isFinite(scoreData.scoreObtained) ||
          scoreData.scoreObtained < 0
        ) {
          return res.status(400).json({
            error: 'Invalid score value',
          })
        }

        if (scoreData.scoreObtained > activity.totalScore) {
          return res.status(400).json({
            error: `Score cannot be greater than ${activity.totalScore}.`,
          })
        }

        const score = await saveStudentScore(
          scoreData.studentId,
          req.params.id,
          scoreData.scoreObtained,
          activity.totalScore,
          now,
        )

        results.push(score)
      }

      return res.json(results)
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error: err.issues?.[0]?.message ?? err.message,
        })
      }

      console.error('[academic] save activity scores error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/*
 * Student: submit own score
 */
router.post(
  '/scores',
  requireAuth,
  requireRole('STUDENT'),
  async (req: Request, res: Response) => {
    try {
      const data = z
        .object({
          activityId: z.string().trim().min(1),
          scoreObtained: z.number().finite().min(0),
        })
        .parse(req.body)

      const student = await prisma.student.findFirst({
        where: {
          userId: req.user!.userId,
        },
      })

      if (!student) {
        return res.status(404).json({
          error: 'Not found',
        })
      }

      const activity = await prisma.academicActivity.findUnique({
        where: {
          id: data.activityId,
        },
      })

      if (!activity) {
        return res.status(404).json({
          error: 'Activity not found',
        })
      }

      if (
        !Number.isFinite(data.scoreObtained) ||
        data.scoreObtained < 0 ||
        data.scoreObtained > activity.totalScore
      ) {
        return res.status(400).json({
          error: `Score must be between 0 and ${activity.totalScore}.`,
        })
      }

      const score = await saveStudentScore(
        student.id,
        data.activityId,
        data.scoreObtained,
        activity.totalScore,
        new Date(),
      )

      return res.json(score)
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error: err.issues?.[0]?.message ?? err.message,
        })
      }

      console.error('[academic] student score error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/*
 * Update activity
 */
router.patch(
  '/activities/:id',
  requireAuth,
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const data = z
        .object({
          title: z.string().min(1).optional(),
          category: z.string().optional(),
          totalScore: z.number().positive().optional(),
          activityDate: z.string().optional(),
        })
        .parse(req.body)

      const activity = await prisma.academicActivity.findUnique({
        where: {
          id: req.params.id,
        },
      })

      if (!activity) {
        return res.status(404).json({
          error: 'Activity not found',
        })
      }

      const updateData: any = {}

      if (data.title !== undefined) updateData.title = data.title
      if (data.category !== undefined) updateData.category = data.category
      if (data.totalScore !== undefined) updateData.totalScore = data.totalScore
      if (data.activityDate !== undefined) {
        updateData.activityDate = toDate(data.activityDate)
      }

      const updatedActivity =
        Object.keys(updateData).length > 0
          ? await prisma.academicActivity.update({
              where: {
                id: req.params.id,
              },
              data: updateData,
            })
          : activity

      /*
       * Keep existing StudentScore.totalScore synchronized.
       */
      if (
        data.totalScore !== undefined &&
        data.totalScore !== activity.totalScore
      ) {
        await prisma.studentScore.updateMany({
          where: {
            activityId: activity.id,
          },
          data: {
            totalScore: data.totalScore,
          },
        })
      }

      return res.json(await getActivityExpanded(updatedActivity.id))
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error: err.issues?.[0]?.message ?? err.message,
        })
      }

      console.error('[academic] update activity error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/*
 * Delete activity and all its scores
 */
router.delete(
  '/activities/:id',
  requireAuth,
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const activity = await prisma.academicActivity.findUnique({
        where: {
          id: req.params.id,
        },
      })

      if (!activity) {
        return res.status(404).json({
          error: 'Activity not found',
        })
      }

      await prisma.studentScore.deleteMany({
        where: {
          activityId: req.params.id,
        },
      })

      await prisma.academicActivity.delete({
        where: {
          id: req.params.id,
        },
      })

      return res.json({
        deleted: true,
      })
    } catch (err) {
      console.error('[academic] delete activity error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/*
 * Admin: all activities
 */
router.get(
  '/admin/activities',
  requireAuth,
  requireRole('ADMIN'),
  async (_req: Request, res: Response) => {
    try {
      const activities = await prisma.academicActivity.findMany({
        orderBy: {
          activityDate: 'desc',
        },
      })

      const expanded = await Promise.all(
        activities.map(async activity => {
          const activityExpanded = await getActivityExpanded(activity.id)

          const teacher = await prisma.teacher.findUnique({
            where: {
              id: activity.teacherId,
            },
          })

          return {
            ...activityExpanded,
            teacher,
          }
        }),
      )

      return res.json(expanded)
    } catch (err) {
      console.error('[academic] admin activities error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/* -------------------------------------------------------------------------- */
/* Imported Sheets                                                            */
/* -------------------------------------------------------------------------- */

router.get(
  '/sheets',
  requireAuth,
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const sectionId =
        typeof req.query.sectionId === 'string'
          ? req.query.sectionId
          : undefined

      const teacher = await getTeacherFromUser(req.user!.userId)

      const where: any = {}

      if (sectionId) {
        where.sectionId = sectionId
      }

      if (req.user!.role === 'TEACHER') {
        if (!teacher) {
          return res.status(404).json({
            error: 'Teacher not found',
          })
        }

        where.teacherId = teacher.id
      }

      const sheets = await prisma.importedSheet.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
      })

      return res.json(sheets)
    } catch (err) {
      console.error('[academic] list sheets error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

router.post(
  '/sheets',
  requireAuth,
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const data = z
        .object({
          sectionId: z.string(),
          subjectId: z.string().optional(),
          name: z.string().trim().min(1).max(100),
          headers: z.array(z.string().trim().max(200)).min(1).max(200),
          rows: z.array(z.array(z.string().max(2000)).max(200)).max(5000),
        })
        .parse(req.body)

      const teacher = await getTeacherFromUser(req.user!.userId)

      if (!teacher) {
        return res.status(404).json({
          error: 'Teacher not found',
        })
      }

      const teacherId = teacher.id

      if (data.subjectId) {
        await prisma.importedSheet.deleteMany({
          where: {
            sectionId: data.sectionId,
            subjectId: data.subjectId,
            teacherId,
          },
        })
      }

      const sheet = await prisma.importedSheet.create({
        data: {
          id: uuidv4(),
          teacherId,
          sectionId: data.sectionId,
          subjectId: data.subjectId,
          name: data.name,
          headers: data.headers,
          rows: data.rows,
          createdAt: new Date(),
        },
      })

      return res.json(sheet)
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error: err.issues?.[0]?.message ?? err.message,
        })
      }

      console.error('[academic] create sheet error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

router.delete(
  '/sheets/:id',
  requireAuth,
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const sheet = await prisma.importedSheet.findUnique({
        where: {
          id: req.params.id,
        },
      })

      if (!sheet) {
        return res.status(404).json({
          error: 'Sheet not found',
        })
      }

      if (req.user!.role === 'TEACHER') {
        const teacher = await getTeacherFromUser(req.user!.userId)

        if (!teacher || sheet.teacherId !== teacher.id) {
          return res.status(403).json({
            error: 'Forbidden',
          })
        }
      }

      await prisma.importedSheet.delete({
        where: {
          id: req.params.id,
        },
      })

      return res.json({
        deleted: true,
      })
    } catch (err) {
      console.error('[academic] delete sheet error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/* -------------------------------------------------------------------------- */
/* Final Grades                                                               */
/* -------------------------------------------------------------------------- */

router.post(
  '/grades',
  requireAuth,
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const data = z
        .object({
          studentId: z.string(),
          subjectId: z.string(),
          sectionId: z.string(),
          academicYearId: z.string(),
          gradingPeriod: z.enum(['1st', '2nd', '3rd', '4th']),
          grade: z.number().min(0).max(100),
        })
        .parse(req.body)

      const teacher = await getTeacherFromUser(req.user!.userId)

      if (!teacher && req.user!.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Teacher not found',
        })
      }

      const teacherId = teacher?.id || ''

      const existing = await prisma.finalGrade.findFirst({
        where: {
          studentId: data.studentId,
          subjectId: data.subjectId,
          sectionId: data.sectionId,
          academicYearId: data.academicYearId,
          gradingPeriod: data.gradingPeriod,
        },
      })

      const now = new Date()

      let gradeRecord

      if (existing) {
        gradeRecord = await prisma.finalGrade.update({
          where: {
            id: existing.id,
          },
          data: {
            teacherId,
            grade: data.grade,
            releasedAt: now,
          },
        })
      } else {
        gradeRecord = await prisma.finalGrade.create({
          data: {
            id: uuidv4(),
            studentId: data.studentId,
            subjectId: data.subjectId,
            teacherId,
            sectionId: data.sectionId,
            academicYearId: data.academicYearId,
            gradingPeriod: data.gradingPeriod,
            grade: data.grade,
            releasedAt: now,
          },
        })
      }

      const [subject, section, academicYear] = await Promise.all([
        prisma.subject.findUnique({
          where: { id: gradeRecord.subjectId },
        }),
        prisma.section.findUnique({
          where: { id: gradeRecord.sectionId },
        }),
        prisma.academicYear.findUnique({
          where: { id: gradeRecord.academicYearId },
        }),
      ])

      return res.json({
        ...gradeRecord,
        subject,
        section,
        academicYear,
      })
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error: err.issues?.[0]?.message ?? err.message,
        })
      }

      console.error('[academic] release grade error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

router.get(
  '/grades',
  requireAuth,
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const sectionId =
        typeof req.query.sectionId === 'string'
          ? req.query.sectionId
          : undefined

      const academicYearId =
        typeof req.query.academicYearId === 'string'
          ? req.query.academicYearId
          : undefined

      const gradingPeriod =
        typeof req.query.gradingPeriod === 'string'
          ? req.query.gradingPeriod
          : undefined

      const subjectId =
        typeof req.query.subjectId === 'string'
          ? req.query.subjectId
          : undefined

      const where: any = {}

      if (sectionId) where.sectionId = sectionId
      if (academicYearId) where.academicYearId = academicYearId
      if (gradingPeriod) where.gradingPeriod = gradingPeriod
      if (subjectId) where.subjectId = subjectId

      const grades = await prisma.finalGrade.findMany({
        where,
        orderBy: {
          releasedAt: 'desc',
        },
      })

      const expanded = await Promise.all(
        grades.map(async grade => {
          const [subject, student, section, academicYear] =
            await Promise.all([
              prisma.subject.findUnique({
                where: { id: grade.subjectId },
              }),
              prisma.student.findUnique({
                where: { id: grade.studentId },
              }),
              prisma.section.findUnique({
                where: { id: grade.sectionId },
              }),
              prisma.academicYear.findUnique({
                where: { id: grade.academicYearId },
              }),
            ])

          return {
            ...grade,
            subject,
            student,
            section,
            academicYear,
          }
        }),
      )

      return res.json(expanded)
    } catch (err) {
      console.error('[academic] list grades error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/*
 * Admin: reset one exact released final grade.
 */
router.post(
  '/admin/grades/reset',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const data = z
        .object({
          studentId: z.string().min(1),
          subjectId: z.string().min(1),
          sectionId: z.string().min(1),
          academicYearId: z.string().min(1),
          gradingPeriod: z.enum(['1st', '2nd', '3rd', '4th']),
        })
        .parse(req.body)

      const existing = await prisma.finalGrade.findFirst({
        where: {
          studentId: data.studentId,
          subjectId: data.subjectId,
          sectionId: data.sectionId,
          academicYearId: data.academicYearId,
          gradingPeriod: data.gradingPeriod,
        },
      })

      if (!existing) {
        return res.status(404).json({
          error: 'No released grade matches that exact selection.',
        })
      }

      await prisma.finalGrade.delete({
        where: {
          id: existing.id,
        },
      })

      return res.json({
        success: true,
        reset: 1,
      })
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error: err.issues?.[0]?.message ?? err.message,
        })
      }

      console.error('[academic] reset grade error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/*
 * Admin: reset every released final grade for one section/subject/period.
 */
router.post(
  '/admin/grades/reset-section',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const data = z
        .object({
          subjectId: z.string().min(1),
          sectionId: z.string().min(1),
          academicYearId: z.string().min(1),
          gradingPeriod: z.enum(['1st', '2nd', '3rd', '4th']),
        })
        .parse(req.body)

      const matching = await prisma.finalGrade.findMany({
        where: {
          subjectId: data.subjectId,
          sectionId: data.sectionId,
          academicYearId: data.academicYearId,
          gradingPeriod: data.gradingPeriod,
        },
      })

      if (matching.length === 0) {
        return res.status(404).json({
          error: 'No released grades match this section and selection.',
        })
      }

      const result = await prisma.finalGrade.deleteMany({
        where: {
          subjectId: data.subjectId,
          sectionId: data.sectionId,
          academicYearId: data.academicYearId,
          gradingPeriod: data.gradingPeriod,
        },
      })

      return res.json({
        success: true,
        reset: result.count,
      })
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({
          error: err.issues?.[0]?.message ?? err.message,
        })
      }

      console.error('[academic] reset section grades error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

/*
 * Teacher: retract a final grade.
 */
router.delete(
  '/grades/:id',
  requireAuth,
  requireRole('TEACHER', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const grade = await prisma.finalGrade.findUnique({
        where: {
          id: req.params.id,
        },
      })

      if (!grade) {
        return res.status(404).json({
          error: 'Grade not found',
        })
      }

      if (req.user!.role === 'TEACHER') {
        const teacher = await getTeacherFromUser(req.user!.userId)

        if (!teacher || grade.teacherId !== teacher.id) {
          return res.status(403).json({
            error: 'Forbidden',
          })
        }
      }

      await prisma.finalGrade.delete({
        where: {
          id: req.params.id,
        },
      })

      return res.json({
        deleted: true,
      })
    } catch (err) {
      console.error('[academic] delete grade error:', err)

      return res.status(500).json({
        error: 'Server error',
      })
    }
  },
)

export default router