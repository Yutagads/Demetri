/**
 * SMARTCLASS compatibility database backed by Supabase PostgreSQL through Prisma.
 *
 * IMPORTANT:
 * This file keeps the existing db.* compatibility arrays so the existing
 * route files continue to work.
 *
 * FIX:
 * saveDb() is NON-DESTRUCTIVE.
 *
 * The old implementation deleted the entire database before recreating it.
 * That caused teachers/students and their related records to disappear when
 * the in-memory compatibility store was incomplete or stale.
 */

import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import prisma from './prisma.js'
import { isCloudinaryImageUrl } from './services/imageStorage.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_FILE = path.join(__dirname, '../data/db.json')

export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email?: string
  username?: string
  passwordHash: string
  role: Role
  status: string
  isFirstLogin: boolean
  lastLogin?: string
  failedLoginAttempts?: number
  lockedUntil?: string
  createdAt: string
}

export interface Admin {
  id: string
  userId: string
  fullName: string
  createdAt: string
}

export interface StudentProfile {
  id: string
  studentId: string
  profilePicture?: string
  bannerImage?: string
  address?: string
  guardianName?: string
  guardianContact?: string
  emergencyContact?: string
  biography?: string
  bloodType?: string
  weight?: number
  height?: number
  updatedAt: string
}

export interface Student {
  id: string
  userId: string
  studentNumber: string
  studentCode: string
  fullName: string
  gender?: string
  birthDate?: string
  email: string
  contactNumber?: string
  status: string
  createdAt: string
}

export interface TeacherProfile {
  id: string
  teacherId: string
  profilePicture?: string
  bannerImage?: string
  gender?: string
  birthDate?: string
  updatedAt: string
}

export interface Teacher {
  id: string
  userId: string
  employeeId?: string
  fullName: string
  email: string
  department?: string
  contactNumber?: string
  status: string
  createdAt: string
}

export interface AcademicYear {
  id: string
  name: string
  startDate?: string
  endDate?: string
  isCurrent: boolean
  status: string
  createdAt: string
}

export interface GradeLevel {
  id: string
  name: string
  order: number
}

export interface Strand {
  id: string
  gradeLevelId: string
  name: string
}

export interface Section {
  id: string
  gradeLevelId: string
  strandId?: string
  name: string
  status: string
  createdAt: string
}

export interface Subject {
  id: string
  name: string
  code: string
  description?: string
  status: string
  createdAt: string
}

export interface StudentSectionAssignment {
  id: string
  studentId: string
  academicYearId: string
  gradeLevelId: string
  sectionId: string
  createdAt: string
}

export interface TeacherSubjectAssignment {
  id: string
  teacherId: string
  subjectId: string
  sectionId: string
  academicYearId: string
  createdAt: string
}

export interface ClassSchedule {
  id: string
  subjectId: string
  teacherId: string
  sectionId: string
  academicYearId: string
  assignmentId?: string
  scheduleImage?: string
  description?: string
  dayOfWeek?: string
  startTime?: string
  endTime?: string
  color?: string
  status?: 'draft' | 'published'
  uploadedAt: string
}

export interface AttendanceSession {
  id: string
  subjectId: string
  sectionId: string
  teacherId: string
  attendanceDate: string
  sessionCode?: string
  sessionStatus: string
  sessionExpiry?: string
  createdAt: string
  updatedAt: string
}

export interface AttendanceRecord {
  id: string
  studentId: string
  sessionId: string
  status: string
  timeRecorded: string
  verificationStatus: string
}

export interface AcademicActivity {
  id: string
  title: string
  subjectId: string
  sectionId: string
  teacherId: string
  academicYearId: string
  category: string
  totalScore: number
  activityDate: string
  createdAt: string
}

export interface StudentScore {
  id: string
  studentId: string
  activityId: string
  scoreObtained: number
  totalScore: number
  evidenceFile?: string
  dateRecorded: string
}

export interface AnnouncementCategory {
  id: string
  name: string
  icon?: string
  coverImage?: string
  order: number
  status: string
  createdAt: string
}

export interface Announcement {
  id: string
  title: string
  categoryId: string
  description?: string
  image?: string
  pdf?: string
  content?: string
  publishStatus: string
  displayPriority: number
  publishedAt?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface SystemSetting {
  id: string
  key: string
  value: string
  updatedAt: string
}

export interface PresentationMaterial {
  id: string
  teacherId: string
  subjectId: string
  sectionId: string
  title: string
  filePath: string
  fileType: string
  originalName: string
  uploadedAt: string
}

export interface ImportedSheet {
  id: string
  teacherId: string
  sectionId: string
  subjectId?: string
  name: string
  headers: string[]
  rows: string[][]
  createdAt: string
}

export interface FinalGrade {
  id: string
  studentId: string
  subjectId: string
  teacherId: string
  sectionId: string
  academicYearId: string
  gradingPeriod: string
  grade: number
  releasedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const db = {
  users: [] as User[],
  admins: [] as Admin[],
  students: [] as Student[],
  studentProfiles: [] as StudentProfile[],
  teachers: [] as Teacher[],
  teacherProfiles: [] as TeacherProfile[],
  academicYears: [] as AcademicYear[],
  gradeLevels: [] as GradeLevel[],
  strands: [] as Strand[],
  sections: [] as Section[],
  subjects: [] as Subject[],
  studentSectionAssignments: [] as StudentSectionAssignment[],
  teacherSubjectAssignments: [] as TeacherSubjectAssignment[],
  classSchedules: [] as ClassSchedule[],
  attendanceSessions: [] as AttendanceSession[],
  attendanceRecords: [] as AttendanceRecord[],
  academicActivities: [] as AcademicActivity[],
  studentScores: [] as StudentScore[],
  announcementCategories: [] as AnnouncementCategory[],
  announcements: [] as Announcement[],
  systemSettings: [] as SystemSetting[],
  presentationMaterials: [] as PresentationMaterial[],
  importedSheets: [] as ImportedSheet[],
  finalGrades: [] as FinalGrade[],
}

// ─────────────────────────────────────────────────────────────────────────────
// PRISMA -> COMPATIBILITY STORE SYNC HELPERS
// ─────────────────────────────────────────────────────────────────────────────
//
// Some newer routes write directly to Prisma while older routes still use the
// compatibility `db` arrays. Keep the in-memory snapshot synchronized whenever
// a direct Prisma mutation is made so the global response auto-save cannot
// overwrite a freshly persisted value with stale data.

export function syncUserCompatibility(user: any) {
  const index = db.users.findIndex(u => u.id === user.id)
  const normalized: User = {
    id: user.id,
    email: user.email ?? undefined,
    username: user.username ?? undefined,
    passwordHash: user.passwordHash,
    role: user.role as Role,
    status: user.status,
    isFirstLogin: user.isFirstLogin,
    lastLogin: user.lastLogin?.toISOString?.() ?? user.lastLogin ?? undefined,
    failedLoginAttempts: user.failedLoginAttempts ?? 0,
    lockedUntil: user.lockedUntil?.toISOString?.() ?? user.lockedUntil ?? undefined,
    createdAt: user.createdAt?.toISOString?.() ?? user.createdAt,
  }

  if (index === -1) db.users.push(normalized)
  else db.users[index] = normalized
}

export function syncTeacherCompatibility(teacher: any) {
  const index = db.teachers.findIndex(t => t.id === teacher.id)
  const normalized: Teacher = {
    id: teacher.id,
    userId: teacher.userId,
    employeeId: teacher.employeeId ?? undefined,
    fullName: teacher.fullName,
    email: teacher.email,
    department: teacher.department ?? undefined,
    contactNumber: teacher.contactNumber ?? undefined,
    status: teacher.status,
    createdAt: teacher.createdAt?.toISOString?.() ?? teacher.createdAt,
  }

  if (index === -1) db.teachers.push(normalized)
  else db.teachers[index] = normalized
}

export function syncStudentCompatibility(student: any) {
  const index = db.students.findIndex(s => s.id === student.id)
  const normalized: Student = {
    id: student.id,
    userId: student.userId,
    studentNumber: student.studentNumber,
    studentCode: student.studentCode,
    fullName: student.fullName,
    gender: student.gender ?? undefined,
    birthDate: student.birthDate?.toISOString?.() ?? student.birthDate ?? undefined,
    email: student.email,
    contactNumber: student.contactNumber ?? undefined,
    status: student.status,
    createdAt: student.createdAt?.toISOString?.() ?? student.createdAt,
  }

  if (index === -1) db.students.push(normalized)
  else db.students[index] = normalized
}

export function syncStudentProfileCompatibility(profile: any) {
  const index = db.studentProfiles.findIndex(p => p.id === profile.id)
  const normalized: StudentProfile = {
    id: profile.id,
    studentId: profile.studentId,
    profilePicture: profile.profilePicture ?? undefined,
    bannerImage: profile.bannerImage ?? undefined,
    address: profile.address ?? undefined,
    guardianName: profile.guardianName ?? undefined,
    guardianContact: profile.guardianContact ?? undefined,
    emergencyContact: profile.emergencyContact ?? undefined,
    biography: profile.biography ?? undefined,
    bloodType: profile.bloodType ?? undefined,
    weight: profile.weight ?? undefined,
    height: profile.height ?? undefined,
    updatedAt: profile.updatedAt?.toISOString?.() ?? profile.updatedAt,
  }

  if (index === -1) db.studentProfiles.push(normalized)
  else db.studentProfiles[index] = normalized
}

export function syncTeacherProfileCompatibility(profile: any) {
  const index = db.teacherProfiles.findIndex(p => p.id === profile.id)
  const normalized: TeacherProfile = {
    id: profile.id,
    teacherId: profile.teacherId,
    profilePicture: profile.profilePicture ?? undefined,
    gender: profile.gender ?? undefined,
    birthDate: profile.birthDate?.toISOString?.() ?? profile.birthDate ?? undefined,
    updatedAt: profile.updatedAt?.toISOString?.() ?? profile.updatedAt,
  }

  if (index === -1) db.teacherProfiles.push(normalized)
  else db.teacherProfiles[index] = normalized
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE DATABASE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NON-DESTRUCTIVE database synchronization.
 *
 * IMPORTANT:
 * DO NOT delete the complete database here.
 *
 * Every record from the compatibility store is upserted into PostgreSQL.
 * Existing records remain untouched if they are not present in the current
 * in-memory array.
 */
let saveDbQueue: Promise<void> = Promise.resolve()

/**
 * Serialize full compatibility-store synchronizations.
 * Multiple requests can finish at nearly the same time; running several
 * full PostgreSQL transactions concurrently can exhaust/close pooled
 * connections and cause P1017 errors.
 */
export function saveDb(): Promise<void> {
  const operation = saveDbQueue.then(
    () => performSaveDb(),
    () => performSaveDb(),
  )

  // Keep the queue alive after a failed operation. The caller still receives
  // the rejection so it can handle/log the actual error.
  saveDbQueue = operation.catch(() => undefined)

  return operation
}

async function performSaveDb() {
  try {
    const dataDir = path.resolve(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    const dbPath = path.join(dataDir, 'db.json')
    await fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf-8')
  } catch (diskErr) {
    console.error('[db] Error writing to data/db.json:', diskErr)
  }

  try {
    if (process.env.DATABASE_URL) {
      await prisma.$transaction(async (tx) => {
        const p = tx as any

        // ───────────────────────────────────────────────────────────────────────
        // USERS
        // ───────────────────────────────────────────────────────────────────────

      for (const u of db.users) {
        const username =
          typeof u.username === 'string' && u.username.trim() !== ''
            ? u.username.trim()
            : null

        const email =
          typeof u.email === 'string' && u.email.trim() !== ''
            ? u.email.trim()
            : null

        // NON-DESTRUCTIVE MATCH ORDER:
        // 1) primary key (id)
        // 2) unique username
        // 3) unique email
        // 4) create only when no existing identity can be matched
        //
        // The previous fix only checked id + username. That still allowed
        // a stale db.json user with an existing email to reach create() and
        // fail with User_email_key.
        let existingUser = await p.user.findUnique({
          where: { id: u.id },
        })

        if (!existingUser && username) {
          existingUser = await p.user.findUnique({
            where: { username },
          })
        }

        if (!existingUser && email) {
          existingUser = await p.user.findUnique({
            where: { email },
          })
        }

        const updateData: any = {
          passwordHash: u.passwordHash,
          role: u.role,
          status: u.status,
          isFirstLogin: u.isFirstLogin,
          lastLogin: u.lastLogin ? new Date(u.lastLogin) : null,
          failedLoginAttempts: u.failedLoginAttempts ?? 0,
          lockedUntil: u.lockedUntil ? new Date(u.lockedUntil) : null,
        }

        if (existingUser) {
          // Only update a unique field when it is either already owned by
          // this same record or not owned by another account.
          if (username && existingUser.username !== username) {
            const usernameOwner = await p.user.findUnique({
              where: { username },
            })

            if (!usernameOwner || usernameOwner.id === existingUser.id) {
              updateData.username = username
            }
          }

          if (email && existingUser.email !== email) {
            const emailOwner = await p.user.findUnique({
              where: { email },
            })

            if (!emailOwner || emailOwner.id === existingUser.id) {
              updateData.email = email
            }
          }

          // Preserve the existing PostgreSQL primary key.
          // Never delete, replace, or merge accounts.
          await p.user.update({
            where: { id: existingUser.id },
            data: updateData,
          })
        } else {
          // No matching ID, username, or email exists. This is a genuinely
          // new account, so it is safe to create it.
          await p.user.create({
            data: {
              id: u.id,
              email,
              username,
              passwordHash: u.passwordHash,
              role: u.role,
              status: u.status,
              isFirstLogin: u.isFirstLogin,
              lastLogin: u.lastLogin ? new Date(u.lastLogin) : null,
              failedLoginAttempts: u.failedLoginAttempts ?? 0,
              lockedUntil: u.lockedUntil ? new Date(u.lockedUntil) : null,
              createdAt: new Date(u.createdAt),
            },
          })
        }
      }

      // ───────────────────────────────────────────────────────────────────────
      // ADMINS
      // ───────────────────────────────────────────────────────────────────────

      for (const a of db.admins) {
        await p.admin.upsert({
          where: { id: a.id },
          update: {
            userId: a.userId,
            fullName: a.fullName,
          },
          create: {
            id: a.id,
            userId: a.userId,
            fullName: a.fullName,
            createdAt: new Date(a.createdAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // STUDENTS
      // ───────────────────────────────────────────────────────────────────────

      for (const s of db.students) {
        await p.student.upsert({
          where: { id: s.id },
          update: {
            userId: s.userId,
            studentNumber: s.studentNumber,
            studentCode: s.studentCode,
            fullName: s.fullName,
            gender: s.gender ?? null,
            birthDate: s.birthDate
              ? new Date(s.birthDate)
              : null,
            email: s.email,
            contactNumber: s.contactNumber ?? null,
            status: s.status,
          },
          create: {
            id: s.id,
            userId: s.userId,
            studentNumber: s.studentNumber,
            studentCode: s.studentCode,
            fullName: s.fullName,
            gender: s.gender ?? null,
            birthDate: s.birthDate
              ? new Date(s.birthDate)
              : null,
            email: s.email,
            contactNumber: s.contactNumber ?? null,
            status: s.status,
            createdAt: new Date(s.createdAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // STUDENT PROFILES
      // ───────────────────────────────────────────────────────────────────────

      for (const s of db.studentProfiles) {
        await p.studentProfile.upsert({
          where: { id: s.id },
          update: {
            studentId: s.studentId,
            profilePicture: s.profilePicture ?? null,
            bannerImage: s.bannerImage ?? null,
            address: s.address ?? null,
            guardianName: s.guardianName ?? null,
            guardianContact: s.guardianContact ?? null,
            emergencyContact: s.emergencyContact ?? null,
            biography: s.biography ?? null,
            bloodType: s.bloodType ?? null,
            weight: s.weight ?? null,
            height: s.height ?? null,
            updatedAt: new Date(s.updatedAt),
          },
          create: {
            id: s.id,
            studentId: s.studentId,
            profilePicture: s.profilePicture ?? null,
            bannerImage: s.bannerImage ?? null,
            address: s.address ?? null,
            guardianName: s.guardianName ?? null,
            guardianContact: s.guardianContact ?? null,
            emergencyContact: s.emergencyContact ?? null,
            biography: s.biography ?? null,
            bloodType: s.bloodType ?? null,
            weight: s.weight ?? null,
            height: s.height ?? null,
            updatedAt: new Date(s.updatedAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // TEACHERS
      // ───────────────────────────────────────────────────────────────────────

      for (const t of db.teachers) {
        await p.teacher.upsert({
          where: { id: t.id },
          update: {
            userId: t.userId,
            employeeId: t.employeeId ?? null,
            fullName: t.fullName,
            email: t.email,
            department: t.department ?? null,
            contactNumber: t.contactNumber ?? null,
            status: t.status,
          },
          create: {
            id: t.id,
            userId: t.userId,
            employeeId: t.employeeId ?? null,
            fullName: t.fullName,
            email: t.email,
            department: t.department ?? null,
            contactNumber: t.contactNumber ?? null,
            status: t.status,
            createdAt: new Date(t.createdAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // TEACHER PROFILES
      // ───────────────────────────────────────────────────────────────────────

      for (const t of db.teacherProfiles) {
        await p.teacherProfile.upsert({
          where: { id: t.id },
          update: {
            teacherId: t.teacherId,
            profilePicture: t.profilePicture ?? null,
            gender: t.gender ?? null,
            birthDate: t.birthDate
              ? new Date(t.birthDate)
              : null,
            updatedAt: new Date(t.updatedAt),
          },
          create: {
            id: t.id,
            teacherId: t.teacherId,
            profilePicture: t.profilePicture ?? null,
            gender: t.gender ?? null,
            birthDate: t.birthDate
              ? new Date(t.birthDate)
              : null,
            updatedAt: new Date(t.updatedAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // ACADEMIC YEARS
      // ───────────────────────────────────────────────────────────────────────

      for (const y of db.academicYears) {
        await p.academicYear.upsert({
          where: { id: y.id },
          update: {
            name: y.name,
            startDate: y.startDate
              ? new Date(y.startDate)
              : null,
            endDate: y.endDate
              ? new Date(y.endDate)
              : null,
            isCurrent: y.isCurrent,
            status: y.status,
          },
          create: {
            id: y.id,
            name: y.name,
            startDate: y.startDate
              ? new Date(y.startDate)
              : null,
            endDate: y.endDate
              ? new Date(y.endDate)
              : null,
            isCurrent: y.isCurrent,
            status: y.status,
            createdAt: new Date(y.createdAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // GRADE LEVELS
      // ───────────────────────────────────────────────────────────────────────

      for (const g of db.gradeLevels) {
        await p.gradeLevel.upsert({
          where: { id: g.id },
          update: {
            name: g.name,
            order: g.order,
          },
          create: {
            id: g.id,
            name: g.name,
            order: g.order,
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // STRANDS
      // ───────────────────────────────────────────────────────────────────────

      for (const s of db.strands) {
        await p.strand.upsert({
          where: { id: s.id },
          update: {
            gradeLevelId: s.gradeLevelId,
            name: s.name,
          },
          create: {
            id: s.id,
            gradeLevelId: s.gradeLevelId,
            name: s.name,
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // SECTIONS
      // ───────────────────────────────────────────────────────────────────────

      for (const s of db.sections) {
        await p.section.upsert({
          where: { id: s.id },
          update: {
            gradeLevelId: s.gradeLevelId,
            strandId: s.strandId ?? null,
            name: s.name,
            status: s.status,
          },
          create: {
            id: s.id,
            gradeLevelId: s.gradeLevelId,
            strandId: s.strandId ?? null,
            name: s.name,
            status: s.status,
            createdAt: new Date(s.createdAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // SUBJECTS
      // ───────────────────────────────────────────────────────────────────────

      for (const s of db.subjects) {
        await p.subject.upsert({
          where: { id: s.id },
          update: {
            name: s.name,
            code: s.code,
            description: s.description ?? null,
            status: s.status,
          },
          create: {
            id: s.id,
            name: s.name,
            code: s.code,
            description: s.description ?? null,
            status: s.status,
            createdAt: new Date(s.createdAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // STUDENT SECTION ASSIGNMENTS
      // ───────────────────────────────────────────────────────────────────────

      for (const a of db.studentSectionAssignments) {
        await p.studentSectionAssignment.upsert({
          where: { id: a.id },
          update: {
            studentId: a.studentId,
            academicYearId: a.academicYearId,
            gradeLevelId: a.gradeLevelId,
            sectionId: a.sectionId,
          },
          create: {
            id: a.id,
            studentId: a.studentId,
            academicYearId: a.academicYearId,
            gradeLevelId: a.gradeLevelId,
            sectionId: a.sectionId,
            createdAt: new Date(a.createdAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // TEACHER SUBJECT ASSIGNMENTS
      // ───────────────────────────────────────────────────────────────────────

      for (const a of db.teacherSubjectAssignments) {
        await p.teacherSubjectAssignment.upsert({
          where: { id: a.id },
          update: {
            teacherId: a.teacherId,
            subjectId: a.subjectId,
            sectionId: a.sectionId,
            academicYearId: a.academicYearId,
          },
          create: {
            id: a.id,
            teacherId: a.teacherId,
            subjectId: a.subjectId,
            sectionId: a.sectionId,
            academicYearId: a.academicYearId,
            createdAt: new Date(a.createdAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // CLASS SCHEDULES
      // ───────────────────────────────────────────────────────────────────────

      for (const s of db.classSchedules) {
        await p.classSchedule.upsert({
          where: { id: s.id },
          update: {
            subjectId: s.subjectId,
            teacherId: s.teacherId,
            sectionId: s.sectionId,
            academicYearId: s.academicYearId,
            assignmentId: s.assignmentId ?? null,
            scheduleImage: s.scheduleImage ?? null,
            description: s.description ?? null,
            dayOfWeek: s.dayOfWeek ?? null,
            startTime: s.startTime ?? null,
            endTime: s.endTime ?? null,
            color: s.color ?? null,
            status: s.status ?? null,
          },
          create: {
            id: s.id,
            subjectId: s.subjectId,
            teacherId: s.teacherId,
            sectionId: s.sectionId,
            academicYearId: s.academicYearId,
            assignmentId: s.assignmentId ?? null,
            scheduleImage: s.scheduleImage ?? null,
            description: s.description ?? null,
            dayOfWeek: s.dayOfWeek ?? null,
            startTime: s.startTime ?? null,
            endTime: s.endTime ?? null,
            color: s.color ?? null,
            status: s.status ?? null,
            uploadedAt: new Date(s.uploadedAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // ATTENDANCE SESSIONS
      // ───────────────────────────────────────────────────────────────────────

      for (const s of db.attendanceSessions) {
        await p.attendanceSession.upsert({
          where: { id: s.id },
          update: {
            subjectId: s.subjectId,
            sectionId: s.sectionId,
            teacherId: s.teacherId,
            attendanceDate: new Date(s.attendanceDate),
            sessionCode: s.sessionCode ?? null,
            sessionStatus: s.sessionStatus,
            sessionExpiry: s.sessionExpiry
              ? new Date(s.sessionExpiry)
              : null,
            updatedAt: new Date(s.updatedAt),
          },
          create: {
            id: s.id,
            subjectId: s.subjectId,
            sectionId: s.sectionId,
            teacherId: s.teacherId,
            attendanceDate: new Date(s.attendanceDate),
            sessionCode: s.sessionCode ?? null,
            sessionStatus: s.sessionStatus,
            sessionExpiry: s.sessionExpiry
              ? new Date(s.sessionExpiry)
              : null,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // ATTENDANCE RECORDS
      // ───────────────────────────────────────────────────────────────────────

      for (const r of db.attendanceRecords) {
        await p.attendanceRecord.upsert({
          where: { id: r.id },
          update: {
            studentId: r.studentId,
            sessionId: r.sessionId,
            status: r.status,
            timeRecorded: new Date(r.timeRecorded),
            verificationStatus: r.verificationStatus,
          },
          create: {
            id: r.id,
            studentId: r.studentId,
            sessionId: r.sessionId,
            status: r.status,
            timeRecorded: new Date(r.timeRecorded),
            verificationStatus: r.verificationStatus,
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // ACADEMIC ACTIVITIES
      // ───────────────────────────────────────────────────────────────────────

      for (const a of db.academicActivities) {
        await p.academicActivity.upsert({
          where: { id: a.id },
          update: {
            title: a.title,
            subjectId: a.subjectId,
            sectionId: a.sectionId,
            teacherId: a.teacherId,
            academicYearId: a.academicYearId,
            category: a.category,
            totalScore: a.totalScore,
            activityDate: new Date(a.activityDate),
          },
          create: {
            id: a.id,
            title: a.title,
            subjectId: a.subjectId,
            sectionId: a.sectionId,
            teacherId: a.teacherId,
            academicYearId: a.academicYearId,
            category: a.category,
            totalScore: a.totalScore,
            activityDate: new Date(a.activityDate),
            createdAt: new Date(a.createdAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // STUDENT SCORES
      // ───────────────────────────────────────────────────────────────────────

      for (const s of db.studentScores) {
        await p.studentScore.upsert({
          where: { id: s.id },
          update: {
            studentId: s.studentId,
            activityId: s.activityId,
            scoreObtained: s.scoreObtained,
            totalScore: s.totalScore,
            evidenceFile: s.evidenceFile ?? null,
            dateRecorded: new Date(s.dateRecorded),
          },
          create: {
            id: s.id,
            studentId: s.studentId,
            activityId: s.activityId,
            scoreObtained: s.scoreObtained,
            totalScore: s.totalScore,
            evidenceFile: s.evidenceFile ?? null,
            dateRecorded: new Date(s.dateRecorded),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // ANNOUNCEMENT CATEGORIES
      // ───────────────────────────────────────────────────────────────────────

      for (const c of db.announcementCategories) {
        await p.announcementCategory.upsert({
          where: { id: c.id },
          update: {
            name: c.name,
            icon: c.icon ?? null,
            coverImage: c.coverImage ?? null,
            order: c.order,
            status: c.status,
          },
          create: {
            id: c.id,
            name: c.name,
            icon: c.icon ?? null,
            coverImage: c.coverImage ?? null,
            order: c.order,
            status: c.status,
            createdAt: new Date(c.createdAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // ANNOUNCEMENTS
      // ───────────────────────────────────────────────────────────────────────

      for (const a of db.announcements) {
        await p.announcement.upsert({
          where: { id: a.id },
          update: {
            title: a.title,
            categoryId: a.categoryId,
            description: a.description ?? null,
            image: a.image ?? null,
            pdf: a.pdf ?? null,
            content: a.content ?? null,
            publishStatus: a.publishStatus,
            displayPriority: a.displayPriority,
            publishedAt: a.publishedAt
              ? new Date(a.publishedAt)
              : null,
            expiresAt: a.expiresAt
              ? new Date(a.expiresAt)
              : null,
            updatedAt: new Date(a.updatedAt),
          },
          create: {
            id: a.id,
            title: a.title,
            categoryId: a.categoryId,
            description: a.description ?? null,
            image: a.image ?? null,
            pdf: a.pdf ?? null,
            content: a.content ?? null,
            publishStatus: a.publishStatus,
            displayPriority: a.displayPriority,
            publishedAt: a.publishedAt
              ? new Date(a.publishedAt)
              : null,
            expiresAt: a.expiresAt
              ? new Date(a.expiresAt)
              : null,
            createdAt: new Date(a.createdAt),
            updatedAt: new Date(a.updatedAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // SYSTEM SETTINGS
      // ───────────────────────────────────────────────────────────────────────

      for (const s of db.systemSettings) {
        await p.systemSetting.upsert({
          where: { id: s.id },
          update: {
            key: s.key,
            value: s.value,
            updatedAt: new Date(s.updatedAt),
          },
          create: {
            id: s.id,
            key: s.key,
            value: s.value,
            updatedAt: new Date(s.updatedAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // PRESENTATION MATERIALS
      // ───────────────────────────────────────────────────────────────────────

      for (const m of db.presentationMaterials) {
        await p.presentationMaterial.upsert({
          where: { id: m.id },
          update: {
            teacherId: m.teacherId,
            subjectId: m.subjectId,
            sectionId: m.sectionId,
            title: m.title,
            filePath: m.filePath,
            fileType: m.fileType,
            originalName: m.originalName,
            uploadedAt: new Date(m.uploadedAt),
          },
          create: {
            id: m.id,
            teacherId: m.teacherId,
            subjectId: m.subjectId,
            sectionId: m.sectionId,
            title: m.title,
            filePath: m.filePath,
            fileType: m.fileType,
            originalName: m.originalName,
            uploadedAt: new Date(m.uploadedAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // IMPORTED SHEETS
      // ───────────────────────────────────────────────────────────────────────

      for (const s of db.importedSheets) {
        await p.importedSheet.upsert({
          where: { id: s.id },
          update: {
            teacherId: s.teacherId,
            sectionId: s.sectionId,
            subjectId: s.subjectId ?? null,
            name: s.name,
            headers: s.headers as any,
            rows: s.rows as any,
          },
          create: {
            id: s.id,
            teacherId: s.teacherId,
            sectionId: s.sectionId,
            subjectId: s.subjectId ?? null,
            name: s.name,
            headers: s.headers as any,
            rows: s.rows as any,
            createdAt: new Date(s.createdAt),
          },
        })
      }

      // ───────────────────────────────────────────────────────────────────────
      // FINAL GRADES
      // ───────────────────────────────────────────────────────────────────────

      for (const g of db.finalGrades) {
        await p.finalGrade.upsert({
          where: { id: g.id },
          update: {
            studentId: g.studentId,
            subjectId: g.subjectId,
            teacherId: g.teacherId,
            sectionId: g.sectionId,
            academicYearId: g.academicYearId,
            gradingPeriod: g.gradingPeriod,
            grade: g.grade,
            releasedAt: new Date(g.releasedAt),
          },
          create: {
            id: g.id,
            studentId: g.studentId,
            subjectId: g.subjectId,
            teacherId: g.teacherId,
            sectionId: g.sectionId,
            academicYearId: g.academicYearId,
            gradingPeriod: g.gradingPeriod,
            grade: g.grade,
            releasedAt: new Date(g.releasedAt),
          },
        })
      }
    }, {
      maxWait: 15000,
      timeout: 60000,
    })

      console.log('[db] Non-destructive sync completed')
    }
  } catch (err) {
    console.error('[db] Failed to sync with database:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD DATABASE
// ─────────────────────────────────────────────────────────────────────────────

export async function loadDb(): Promise<boolean> {
  // First attempt loading from local data/db.json if it exists
  try {
    const candidates = [
      path.resolve(process.cwd(), 'data/db.json'),
      path.resolve(__dirname, '../data/db.json'),
      path.resolve(__dirname, 'data/db.json'),
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8')
        const parsed = JSON.parse(raw)
        for (const [k, v] of Object.entries(parsed)) {
          if (Array.isArray(v) && k in db) {
            ;(db as any)[k] = v
          }
        }
        console.log(`[db] Successfully loaded from ${p}: ${db.users.length} users`)
        break
      }
    }
  } catch (diskErr) {
    console.warn('[db] Note: local disk load:', diskErr)
  }

  if (!process.env.DATABASE_URL) {
    return db.users.length > 0
  }

  try {
    // IMPORTANT: do not issue all table reads in Promise.all().
    // Supabase session mode has a finite connection limit, and the old
    // Promise.all() opened many Prisma queries at the same time, producing
    // P2039 / EMAXCONNSESSION (pool_size: 15).
    //
    // Read one table at a time so startup uses a single active query at a time.
    const users = await prisma.user.findMany()
    const admins = await prisma.admin.findMany()
    const students = await prisma.student.findMany()
    const studentProfiles = await prisma.studentProfile.findMany()
    const teachers = await prisma.teacher.findMany()
    const teacherProfiles = await prisma.teacherProfile.findMany()
    const academicYears = await prisma.academicYear.findMany()
    const gradeLevels = await prisma.gradeLevel.findMany()
    const strands = await prisma.strand.findMany()
    const sections = await prisma.section.findMany()
    const subjects = await prisma.subject.findMany()
    const studentSectionAssignments = await prisma.studentSectionAssignment.findMany()
    const teacherSubjectAssignments = await prisma.teacherSubjectAssignment.findMany()
    const classSchedules = await prisma.classSchedule.findMany()
    const attendanceSessions = await prisma.attendanceSession.findMany()
    const attendanceRecords = await prisma.attendanceRecord.findMany()
    const academicActivities = await prisma.academicActivity.findMany()
    const studentScores = await prisma.studentScore.findMany()
    const announcementCategories = await prisma.announcementCategory.findMany()
    const announcements = await prisma.announcement.findMany()
    const systemSettings = await prisma.systemSetting.findMany()
    const presentationMaterials = await prisma.presentationMaterial.findMany()
    const importedSheets = await prisma.importedSheet.findMany()
    const finalGrades = await prisma.finalGrade.findMany()

    db.users = users.map(u => ({
      ...u,
      email: u.email ?? undefined,
      username: u.username ?? undefined,
      role: u.role as Role,
      lastLogin: u.lastLogin?.toISOString(),
      lockedUntil: u.lockedUntil?.toISOString(),
      createdAt: u.createdAt.toISOString(),
    }))

    db.admins = admins.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    }))

    db.students = students.map(s => ({
      ...s,
      gender: s.gender ?? undefined,
      contactNumber: s.contactNumber ?? undefined,
      birthDate: s.birthDate?.toISOString(),
      createdAt: s.createdAt.toISOString(),
    }))

    db.studentProfiles = studentProfiles.map(s => ({
      ...s,
      profilePicture: s.profilePicture ?? undefined,
      bannerImage: s.bannerImage ?? undefined,
      address: s.address ?? undefined,
      guardianName: s.guardianName ?? undefined,
      guardianContact: s.guardianContact ?? undefined,
      emergencyContact: s.emergencyContact ?? undefined,
      biography: s.biography ?? undefined,
      bloodType: s.bloodType ?? undefined,
      weight: s.weight ?? undefined,
      height: s.height ?? undefined,
      updatedAt: s.updatedAt.toISOString(),
    }))

    db.teachers = teachers.map(t => ({
      ...t,
      employeeId: t.employeeId ?? undefined,
      department: t.department ?? undefined,
      contactNumber: t.contactNumber ?? undefined,
      createdAt: t.createdAt.toISOString(),
    }))

    db.teacherProfiles = teacherProfiles.map(t => ({
      ...t,
      profilePicture: t.profilePicture ?? undefined,
      gender: t.gender ?? undefined,
      birthDate: t.birthDate?.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }))

    db.academicYears = academicYears.map(y => ({
      ...y,
      startDate: y.startDate?.toISOString(),
      endDate: y.endDate?.toISOString(),
      createdAt: y.createdAt.toISOString(),
    }))

    db.gradeLevels = gradeLevels

    db.strands = strands

    db.sections = sections.map(s => ({
      ...s,
      strandId: s.strandId ?? undefined,
      createdAt: s.createdAt.toISOString(),
    }))

    db.subjects = subjects.map(s => ({
      ...s,
      description: s.description ?? undefined,
      createdAt: s.createdAt.toISOString(),
    }))

    db.studentSectionAssignments =
      studentSectionAssignments.map(a => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      }))

    db.teacherSubjectAssignments =
      teacherSubjectAssignments.map(a => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      }))

    db.classSchedules = classSchedules.map(s => ({
      ...s,
      assignmentId: s.assignmentId ?? undefined,
      scheduleImage: s.scheduleImage ?? undefined,
      description: s.description ?? undefined,
      dayOfWeek: s.dayOfWeek ?? undefined,
      startTime: s.startTime ?? undefined,
      endTime: s.endTime ?? undefined,
      color: s.color ?? undefined,
      status:
        s.status === 'published' || s.status === 'draft'
          ? s.status
          : undefined,
      uploadedAt: s.uploadedAt.toISOString(),
    }))

    db.attendanceSessions = attendanceSessions.map(s => ({
      ...s,
      sessionCode: s.sessionCode ?? undefined,
      attendanceDate: s.attendanceDate.toISOString(),
      sessionExpiry: s.sessionExpiry?.toISOString(),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))

    db.attendanceRecords = attendanceRecords.map(r => ({
      ...r,
      timeRecorded: r.timeRecorded.toISOString(),
    }))

    db.academicActivities = academicActivities.map(a => ({
      ...a,
      activityDate: a.activityDate.toISOString(),
      createdAt: a.createdAt.toISOString(),
    }))

    db.studentScores = studentScores.map(s => ({
      ...s,
      evidenceFile: s.evidenceFile ?? undefined,
      dateRecorded: s.dateRecorded.toISOString(),
    }))

    db.announcementCategories =
      announcementCategories.map(c => ({
        ...c,
        icon: c.icon ?? undefined,
        coverImage: c.coverImage ?? undefined,
        createdAt: c.createdAt.toISOString(),
      }))

    db.announcements = announcements.map(a => ({
      ...a,
      description: a.description ?? undefined,
      image: a.image ?? undefined,
      pdf: a.pdf ?? undefined,
      content: a.content ?? undefined,
      publishedAt: a.publishedAt?.toISOString(),
      expiresAt: a.expiresAt?.toISOString(),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }))

    db.systemSettings = systemSettings.map(s => ({
      ...s,
      updatedAt: s.updatedAt.toISOString(),
    }))

    db.presentationMaterials =
      presentationMaterials.map(m => ({
        ...m,
        uploadedAt: m.uploadedAt.toISOString(),
      }))

    db.importedSheets = importedSheets.map(s => ({
      ...s,
      subjectId: s.subjectId ?? undefined,
      headers: Array.isArray(s.headers)
        ? s.headers.map(String)
        : [],
      rows: Array.isArray(s.rows)
        ? (s.rows as any[]).map(r =>
            Array.isArray(r) ? r.map(String) : []
          )
        : [],
      createdAt: s.createdAt.toISOString(),
    }))

    db.finalGrades = finalGrades.map(g => ({
      ...g,
      releasedAt: g.releasedAt.toISOString(),
    }))

    console.log(
      `[db] Loaded from Supabase: ${db.users.length} users, ` +
      `${db.teachers.length} teachers, ` +
      `${db.students.length} students`
    )

    return true
  } catch (err) {
    console.error('[db] Failed to load from Supabase:', err)
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA SANITIZER
// ─────────────────────────────────────────────────────────────────────────────

export function _sanitiseMediaRefs(): boolean {
  const uploadsBase = path.join(__dirname, '../uploads')

  // Prevent unused variable warning while keeping the original structure.
  void uploadsBase

  let dirty = false

  db.announcements.forEach((a: any, idx: number) => {
    for (const field of ['image', 'pdf'] as const) {
      const val: string | undefined = a[field]

      if (!val) continue

      if (isCloudinaryImageUrl(val) || /^https?:\/\//i.test(val)) continue

      const rel = val.replace(/^\//, '')
      const abs = path.join(__dirname, '../', rel)

      if (!fs.existsSync(abs)) {
        ;(db.announcements[idx] as any)[field] = undefined
        dirty = true

        console.log(
          `[db] Cleared missing ${field} ref on announcement "${a.title}":`,
          val
        )
      }
    }
  })

  if (dirty) {
    void saveDb().catch((err) => {
      console.error('[db] Background sync failed:', err)
    })
  }

  return dirty
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDatabase() {
  const loaded = await loadDb()

  if (loaded && db.users.length > 0) {
    ensureDefaultSettings()

    /*
     * IMPORTANT:
     * Do not rebuild/delete the database here.
     *
     * Only synchronize settings that may have been introduced later.
     */
    await saveDb()

    return
  }

  const now = new Date().toISOString()

  // ───────────────────────────────────────────────────────────────────────────
  // USERS
  // ───────────────────────────────────────────────────────────────────────────

  const adminId = uuidv4()
  const teacherUserId = uuidv4()
  const studentUserId = uuidv4()

  db.users.push(
    {
      id: adminId,
      username: 'admin',
      passwordHash: await bcrypt.hash('admin123', 12),
      role: 'ADMIN',
      status: 'active',
      isFirstLogin: false,
      createdAt: now,
    },
    {
      id: teacherUserId,
      email: 'teacher@erlhs.edu.ph',
      passwordHash: await bcrypt.hash('teacher123', 12),
      role: 'TEACHER',
      status: 'active',

      // Force password change applies to teacher.
      isFirstLogin: true,

      createdAt: now,
    },
    {
      id: studentUserId,
      email: 'student@erlhs.edu.ph',
      passwordHash: await bcrypt.hash('student123', 12),
      role: 'STUDENT',
      status: 'active',

      // Force password change applies to student.
      isFirstLogin: true,

      createdAt: now,
    },
  )

  // ───────────────────────────────────────────────────────────────────────────
  // ADMIN
  // ───────────────────────────────────────────────────────────────────────────

  db.admins.push({
    id: uuidv4(),
    userId: adminId,
    fullName: 'System Administrator',
    createdAt: now,
  })

  // ───────────────────────────────────────────────────────────────────────────
  // ACADEMIC YEAR
  // ───────────────────────────────────────────────────────────────────────────

  const yearId = uuidv4()

  db.academicYears.push({
    id: yearId,
    name: '2024-2025',
    isCurrent: true,
    status: 'active',
    createdAt: now,
  })

  // ───────────────────────────────────────────────────────────────────────────
  // GRADE LEVELS
  // ───────────────────────────────────────────────────────────────────────────

  const grade11Id = uuidv4()
  const grade12Id = uuidv4()

  db.gradeLevels.push(
    {
      id: grade11Id,
      name: 'Grade 11',
      order: 11,
    },
    {
      id: grade12Id,
      name: 'Grade 12',
      order: 12,
    },
  )

  // ───────────────────────────────────────────────────────────────────────────
  // STRANDS
  // ───────────────────────────────────────────────────────────────────────────

  const stemId = uuidv4()
  const abmId = uuidv4()

  db.strands.push(
    {
      id: stemId,
      gradeLevelId: grade11Id,
      name: 'STEM',
    },
    {
      id: abmId,
      gradeLevelId: grade11Id,
      name: 'ABM',
    },
  )

  // ───────────────────────────────────────────────────────────────────────────
  // SECTIONS
  // ───────────────────────────────────────────────────────────────────────────

  const sectionAId = uuidv4()
  const sectionBId = uuidv4()

  db.sections.push(
    {
      id: sectionAId,
      gradeLevelId: grade11Id,
      strandId: stemId,
      name: 'Section A',
      status: 'active',
      createdAt: now,
    },
    {
      id: sectionBId,
      gradeLevelId: grade11Id,
      strandId: abmId,
      name: 'Section B',
      status: 'active',
      createdAt: now,
    },
  )

  // ───────────────────────────────────────────────────────────────────────────
  // SUBJECTS
  // ───────────────────────────────────────────────────────────────────────────

  const mathId = uuidv4()
  const engId = uuidv4()
  const sciId = uuidv4()
  const peId = uuidv4()

  db.subjects.push(
    {
      id: mathId,
      name: 'General Mathematics',
      code: 'MATH-GEN-11',
      status: 'active',
      createdAt: now,
    },
    {
      id: engId,
      name: 'Oral Communication',
      code: 'ENG-ORAL-11',
      status: 'active',
      createdAt: now,
    },
    {
      id: sciId,
      name: 'General Chemistry',
      code: 'SCI-CHEM-11',
      status: 'active',
      createdAt: now,
    },
    {
      id: peId,
      name: 'Physical Education',
      code: 'PE-11',
      status: 'active',
      createdAt: now,
    },
  )

  // ───────────────────────────────────────────────────────────────────────────
  // TEACHER
  // ───────────────────────────────────────────────────────────────────────────

  const teacherId = uuidv4()

  db.teachers.push({
    id: teacherId,
    userId: teacherUserId,
    employeeId: 'EMP-001',
    fullName: 'Maria Santos',
    email: 'teacher@erlhs.edu.ph',
    department: 'Science Department',
    status: 'active',
    createdAt: now,
  })

  db.teacherProfiles.push({
    id: uuidv4(),
    teacherId,
    updatedAt: now,
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEACHER ASSIGNMENTS
  // ───────────────────────────────────────────────────────────────────────────

  db.teacherSubjectAssignments.push(
    {
      id: uuidv4(),
      teacherId,
      subjectId: mathId,
      sectionId: sectionAId,
      academicYearId: yearId,
      createdAt: now,
    },
    {
      id: uuidv4(),
      teacherId,
      subjectId: engId,
      sectionId: sectionAId,
      academicYearId: yearId,
      createdAt: now,
    },
  )

  // ───────────────────────────────────────────────────────────────────────────
  // CLASS SCHEDULES
  // ───────────────────────────────────────────────────────────────────────────

  db.classSchedules.push(
    {
      id: uuidv4(),
      teacherId,
      subjectId: mathId,
      sectionId: sectionAId,
      academicYearId: yearId,
      dayOfWeek: 'Monday',
      startTime: '08:00',
      endTime: '09:30',
      color: '#6366f1',
      status: 'published',
      uploadedAt: now,
    },
    {
      id: uuidv4(),
      teacherId,
      subjectId: mathId,
      sectionId: sectionAId,
      academicYearId: yearId,
      dayOfWeek: 'Wednesday',
      startTime: '08:00',
      endTime: '09:30',
      color: '#6366f1',
      status: 'published',
      uploadedAt: now,
    },
    {
      id: uuidv4(),
      teacherId,
      subjectId: engId,
      sectionId: sectionAId,
      academicYearId: yearId,
      dayOfWeek: 'Tuesday',
      startTime: '10:00',
      endTime: '11:30',
      color: '#22c55e',
      status: 'published',
      uploadedAt: now,
    },
    {
      id: uuidv4(),
      teacherId,
      subjectId: engId,
      sectionId: sectionAId,
      academicYearId: yearId,
      dayOfWeek: 'Thursday',
      startTime: '10:00',
      endTime: '11:30',
      color: '#22c55e',
      status: 'published',
      uploadedAt: now,
    },
  )

  // ───────────────────────────────────────────────────────────────────────────
  // STUDENT
  // ───────────────────────────────────────────────────────────────────────────

  const studentId = uuidv4()

  db.students.push({
    id: studentId,
    userId: studentUserId,
    studentNumber: '2024-00001',
    studentCode: 'SC-DEMO01',
    fullName: 'Juan Dela Cruz',
    gender: 'Male',
    email: 'student@erlhs.edu.ph',
    status: 'active',
    createdAt: now,
  })

  db.studentProfiles.push({
    id: uuidv4(),
    studentId,
    updatedAt: now,
  })

  db.studentSectionAssignments.push({
    id: uuidv4(),
    studentId,
    sectionId: sectionAId,
    academicYearId: yearId,
    gradeLevelId: grade11Id,
    createdAt: now,
  })

  // ───────────────────────────────────────────────────────────────────────────
  // ANNOUNCEMENT CATEGORIES
  // ───────────────────────────────────────────────────────────────────────────

  const cat1Id = uuidv4()
  const cat2Id = uuidv4()
  const cat3Id = uuidv4()
  const cat4Id = uuidv4()

  db.announcementCategories.push(
    {
      id: cat1Id,
      name: 'School Announcements',
      icon: '📢',
      order: 1,
      status: 'active',
      createdAt: now,
    },
    {
      id: cat2Id,
      name: 'Upcoming Events',
      icon: '📅',
      order: 2,
      status: 'active',
      createdAt: now,
    },
    {
      id: cat3Id,
      name: 'Class Schedule',
      icon: '📚',
      order: 3,
      status: 'active',
      createdAt: now,
    },
    {
      id: cat4Id,
      name: 'Emergency Hotlines',
      icon: '📞',
      order: 4,
      status: 'active',
      createdAt: now,
    },
  )

  // ───────────────────────────────────────────────────────────────────────────
  // ANNOUNCEMENTS
  // ───────────────────────────────────────────────────────────────────────────

  db.announcements.push(
    {
      id: uuidv4(),
      title: 'Welcome to SMARTCLASS!',
      categoryId: cat1Id,
      description:
        'SMARTCLASS is now live! Students and teachers can log in using their assigned credentials.',
      publishStatus: 'published',
      displayPriority: 10,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      title: '1st Quarter Examinations',
      categoryId: cat2Id,
      description:
        'First quarter exams scheduled for next week. Please review your study materials.',
      publishStatus: 'published',
      displayPriority: 8,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  )

  // ───────────────────────────────────────────────────────────────────────────
  // ATTENDANCE
  // ───────────────────────────────────────────────────────────────────────────

  const sessionId = uuidv4()

  db.attendanceSessions.push({
    id: sessionId,
    subjectId: mathId,
    sectionId: sectionAId,
    teacherId,
    attendanceDate: now,
    sessionStatus: 'closed',
    createdAt: now,
    updatedAt: now,
  })

  db.attendanceRecords.push({
    id: uuidv4(),
    studentId,
    sessionId,
    status: 'present',
    timeRecorded: now,
    verificationStatus: 'verified',
  })

  // ───────────────────────────────────────────────────────────────────────────
  // ACADEMIC ACTIVITY
  // ───────────────────────────────────────────────────────────────────────────

  const activityId = uuidv4()

  db.academicActivities.push({
    id: activityId,
    title: 'Unit 1 Quiz',
    subjectId: mathId,
    sectionId: sectionAId,
    teacherId,
    academicYearId: yearId,
    category: 'Quiz',
    totalScore: 50,
    activityDate: now,
    createdAt: now,
  })

  db.studentScores.push({
    id: uuidv4(),
    studentId,
    activityId,
    scoreObtained: 45,
    totalScore: 50,
    dateRecorded: now,
  })

  // ───────────────────────────────────────────────────────────────────────────
  // SETTINGS
  // ───────────────────────────────────────────────────────────────────────────

  const settingKeys = [
    ['schoolName', 'Exequiel R. Lina High School'],
    ['schoolLogo', ''],
    ['schoolAddress', 'ERLHS Campus, Philippines'],
    ['schoolTagline', 'Learning today, leading tomorrow.'],
    ['schoolContactNumber', ''],
    ['schoolContactEmail', ''],
    ['currentAcademicYear', '2024-2025'],
    ['currentSemester', '1st Semester'],
    ['systemVersion', 'v1.0.0'],
    ['inactivityTimeout', '10'],
    ['sessionCodeExpiry', '30'],
    ['passingGrade', '75'],
    ['gradingPeriods', '4'],
    ['currentGradingPeriod', '1st'],
    ['slideRotationInterval', '6'],
    ['tabRotationInterval', '30'],
    ['weatherLatitude', '14.5995'],
    ['weatherLongitude', '120.9842'],
    ['weatherLocation', 'Manila'],
    ['kioskIdleTimeout', '10'],

    // Only TEACHER/STUDENT should be forced to change password.
    ['forceFirstLoginPasswordChange', 'true'],

    ['maxLoginAttempts', '5'],
    ['lockoutDuration', '15'],
  ]

  for (const [key, value] of settingKeys) {
    db.systemSettings.push({
      id: uuidv4(),
      key,
      value,
      updatedAt: now,
    })
  }

  await saveDb()
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export function ensureDefaultSettings() {
  const defaults: Record<string, string> = {
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

  const now = new Date().toISOString()

  for (const [key, value] of Object.entries(defaults)) {
    if (!db.systemSettings.some(s => s.key === key)) {
      db.systemSettings.push({
        id: uuidv4(),
        key,
        value,
        updatedAt: now,
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESET DATABASE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WARNING:
 * This function intentionally performs a full reset.
 *
 * DO NOT call resetDatabase() during normal server startup.
 */
export async function resetDatabase() {
  ;(Object.keys(db) as Array<keyof typeof db>).forEach(key => {
    ;(db[key] as unknown as unknown[]).length = 0
  })

  try {
    if (fs.existsSync(DB_FILE)) {
      fs.unlinkSync(DB_FILE)
    }
  } catch (err) {
    console.error(
      '[db] Failed to remove backup during reset:',
      err
    )
  }

  await seedDatabase()
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPAND SECTION
// ─────────────────────────────────────────────────────────────────────────────

export function expandSection(s: Section) {
  return {
    ...s,

    gradeLevel:
      db.gradeLevels.find(
        g => g.id === s.gradeLevelId
      ) || null,

    strand:
      s.strandId
        ? db.strands.find(
            st => st.id === s.strandId
          ) || null
        : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPAND STUDENT
// ─────────────────────────────────────────────────────────────────────────────

export function expandStudent(
  s: Student,
  opts: { includeUser?: boolean } = {}
) {
  const profile =
    db.studentProfiles.find(
      p => p.studentId === s.id
    ) || null

  const sectionAssignments =
    db.studentSectionAssignments
      .filter(a => a.studentId === s.id)
      .map(a => {
        const section =
          db.sections.find(
            sec => sec.id === a.sectionId
          )

        return {
          ...a,

          section: section
            ? expandSection(section)
            : null,

          academicYear:
            db.academicYears.find(
              y => y.id === a.academicYearId
            ) || null,
        }
      })

  const userRecord = opts.includeUser
    ? (() => {
        const u =
          db.users.find(
            u => u.id === s.userId
          )

        return u
          ? {
              status: u.status,
              isFirstLogin: u.isFirstLogin,
              lastLogin: u.lastLogin,
              email: u.email,
            }
          : null
      })()
    : undefined

  return {
    ...s,
    profile,
    sectionAssignments,

    ...(userRecord !== undefined
      ? { user: userRecord }
      : {}),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPAND TEACHER
// ─────────────────────────────────────────────────────────────────────────────

export function expandTeacher(
  t: Teacher,
  opts: { includeUser?: boolean } = {}
) {
  const profile =
    db.teacherProfiles.find(
      p => p.teacherId === t.id
    ) || null

  const subjectAssignments =
    db.teacherSubjectAssignments
      .filter(a => a.teacherId === t.id)
      .map(a => {
        const section =
          db.sections.find(
            s => s.id === a.sectionId
          )

        return {
          ...a,

          subject:
            db.subjects.find(
              s => s.id === a.subjectId
            ) || null,

          section:
            section
              ? expandSection(section)
              : null,

          academicYear:
            db.academicYears.find(
              y => y.id === a.academicYearId
            ) || null,
        }
      })

  const classSchedules =
    db.classSchedules
      .filter(sc => sc.teacherId === t.id)
      .map(sc => {
        const section =
          db.sections.find(
            s => s.id === sc.sectionId
          )

        return {
          ...sc,

          subject:
            db.subjects.find(
              s => s.id === sc.subjectId
            ) || null,

          section:
            section
              ? expandSection(section)
              : null,

          academicYear:
            db.academicYears.find(
              y => y.id === sc.academicYearId
            ) || null,
        }
      })

  const userRecord = opts.includeUser
    ? (() => {
        const u =
          db.users.find(
            u => u.id === t.userId
          )

        return u
          ? {
              status: u.status,
              isFirstLogin: u.isFirstLogin,
              lastLogin: u.lastLogin,
            }
          : null
      })()
    : undefined

  return {
    ...t,
    profile,
    subjectAssignments,
    classSchedules,

    ...(userRecord !== undefined
      ? { user: userRecord }
      : {}),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPAND ATTENDANCE SESSION
// ─────────────────────────────────────────────────────────────────────────────

export function expandAttendanceSession(
  sess: AttendanceSession,
  opts: { includeRecords?: boolean } = {}
) {
  const records = opts.includeRecords
    ? db.attendanceRecords
        .filter(
          r => r.sessionId === sess.id
        )
        .map(r => {
          const st =
            db.students.find(
              s => s.id === r.studentId
            )

          if (!st) {
            return {
              ...r,
              student: null,
            }
          }

          const profile =
            db.studentProfiles.find(
              p => p.studentId === st.id
            ) || null

          return {
            ...r,
            student: {
              ...st,
              profile,
            },
          }
        })
    : undefined

  const section =
    db.sections.find(
      s => s.id === sess.sectionId
    )

  return {
    ...sess,

    subject:
      db.subjects.find(
        s => s.id === sess.subjectId
      ) || null,

    section:
      section
        ? expandSection(section)
        : null,

    teacher:
      db.teachers.find(
        t => t.id === sess.teacherId
      ) || null,

    ...(records !== undefined
      ? {
          attendanceRecords: records,
        }
      : {}),
  }
}