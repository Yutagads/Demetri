import crypto from 'crypto'
import { prisma } from '../prisma.js'

export type TeacherAssignment = {
  id: string
  teacherId: string
  subjectId: string
  sectionId: string
  academicYearId: string
  createdAt: Date
  subject: any
  section: any
  academicYear: any
}

/**
 * Make sure a teacher has a persistent subject/section/year assignment.
 * This is intentionally idempotent so schedule creation/update can safely
 * call it without creating duplicates.
 */
export async function ensureTeacherSubjectAssignment(params: {
  teacherId: string
  subjectId: string
  sectionId: string
  academicYearId: string
}, client: any = prisma): Promise<TeacherAssignment> {
  return client.teacherSubjectAssignment.upsert({
    where: {
      teacherId_subjectId_sectionId_academicYearId: params,
    },
    update: {},
    create: {
      id: crypto.randomUUID(),
      ...params,
    },
    include: {
      subject: true,
      section: { include: { gradeLevel: true, strand: true } },
      academicYear: true,
    },
  })
}

/**
 * Return the assignments a teacher should see in every teacher portal.
 *
 * Older SMARTCLASS data may contain a class schedule without a matching
 * TeacherSubjectAssignment row. We treat those schedule entries as an
 * assignment as well, so existing data does not disappear from the teacher
 * portal. New schedules are also synchronized by the schedule routes.
 */
export async function getEffectiveTeacherAssignments(teacherId: string): Promise<TeacherAssignment[]> {
  const [assignments, schedules] = await Promise.all([
    prisma.teacherSubjectAssignment.findMany({
      where: { teacherId },
      include: {
        subject: true,
        section: { include: { gradeLevel: true, strand: true } },
        academicYear: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.classSchedule.findMany({
      where: { teacherId },
      include: {
        subject: true,
        section: { include: { gradeLevel: true, strand: true } },
        academicYear: true,
      },
      orderBy: { uploadedAt: 'asc' },
    }),
  ])

  const result = [...assignments] as TeacherAssignment[]
  const seen = new Set(
    assignments.map(a => `${a.subjectId}::${a.sectionId}::${a.academicYearId}`),
  )

  for (const schedule of schedules) {
    const key = `${schedule.subjectId}::${schedule.sectionId}::${schedule.academicYearId}`
    if (seen.has(key)) continue

    // This is a compatibility representation for old schedule-only data.
    // It is returned to the UI immediately; the database backfill below will
    // persist the same relationship when the server starts.
    result.push({
      id: schedule.assignmentId || `schedule:${schedule.id}`,
      teacherId: schedule.teacherId,
      subjectId: schedule.subjectId,
      sectionId: schedule.sectionId,
      academicYearId: schedule.academicYearId,
      createdAt: schedule.uploadedAt,
      subject: schedule.subject,
      section: schedule.section,
      academicYear: schedule.academicYear,
    })
    seen.add(key)
  }

  return result
}

/**
 * Backfill missing teacher subject assignments from existing schedules.
 * Safe to run on every server start because the operation is an upsert.
 */
export async function syncTeacherAssignmentsFromSchedules() {
  const schedules = await prisma.classSchedule.findMany({
    select: {
      id: true,
      teacherId: true,
      subjectId: true,
      sectionId: true,
      academicYearId: true,
      assignmentId: true,
    },
  })

  let created = 0
  for (const schedule of schedules) {
    const assignment = await ensureTeacherSubjectAssignment({
      teacherId: schedule.teacherId,
      subjectId: schedule.subjectId,
      sectionId: schedule.sectionId,
      academicYearId: schedule.academicYearId,
    })

    if (!schedule.assignmentId) {
      await prisma.classSchedule.update({
        where: { id: schedule.id },
        data: { assignmentId: assignment.id },
      })
      created++
    }
  }

  if (created > 0) {
    console.log(`[TEACHER ASSIGNMENTS] Synchronized ${created} schedule relationship(s).`)
  }
}
