import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'
import { db, saveDb } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Date fields by model to convert to Date instances in mock responses
const DATE_FIELDS: Record<string, string[]> = {
  user: ['createdAt', 'lastLogin', 'lockedUntil'],
  admin: ['createdAt'],
  student: ['birthDate', 'createdAt'],
  studentProfile: ['updatedAt'],
  teacher: ['createdAt'],
  teacherProfile: ['birthDate', 'updatedAt'],
  academicYear: ['startDate', 'endDate', 'createdAt'],
  section: ['createdAt'],
  subject: ['createdAt'],
  studentSectionAssignment: ['createdAt'],
  teacherSubjectAssignment: ['createdAt'],
  classSchedule: ['uploadedAt'],
  attendanceSession: ['attendanceDate', 'sessionExpiry', 'createdAt', 'updatedAt'],
  attendanceRecord: ['timeRecorded'],
  academicActivity: ['activityDate', 'createdAt'],
  studentScore: ['dateRecorded'],
  announcementCategory: ['createdAt'],
  announcement: ['publishedAt', 'expiresAt', 'createdAt', 'updatedAt'],
  systemSetting: ['updatedAt'],
  presentationMaterial: ['uploadedAt'],
  importedSheet: ['createdAt'],
  finalGrade: ['releasedAt'],
}

const MODEL_MAP: Record<string, keyof typeof db> = {
  user: 'users',
  admin: 'admins',
  student: 'students',
  studentProfile: 'studentProfiles',
  teacher: 'teachers',
  teacherProfile: 'teacherProfiles',
  academicYear: 'academicYears',
  gradeLevel: 'gradeLevels',
  strand: 'strands',
  section: 'sections',
  subject: 'subjects',
  studentSectionAssignment: 'studentSectionAssignments',
  teacherSubjectAssignment: 'teacherSubjectAssignments',
  classSchedule: 'classSchedules',
  attendanceSession: 'attendanceSessions',
  attendanceRecord: 'attendanceRecords',
  academicActivity: 'academicActivities',
  studentScore: 'studentScores',
  announcementCategory: 'announcementCategories',
  announcement: 'announcements',
  systemSetting: 'systemSettings',
  presentationMaterial: 'presentationMaterials',
  importedSheet: 'importedSheets',
  finalGrade: 'finalGrades',
}

function normalizeItem(modelName: string, item: any): any {
  if (!item) return null
  const clone = { ...item }
  const dateFields = DATE_FIELDS[modelName] || []
  for (const f of dateFields) {
    if (clone[f] && typeof clone[f] === 'string') {
      const d = new Date(clone[f])
      if (!Number.isNaN(d.getTime())) {
        clone[f] = d
      }
    }
  }
  return clone
}

function matchesWhere(item: any, where?: any): boolean {
  if (!where) return true
  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue
    if (key === 'AND' && Array.isArray(val)) {
      if (!val.every(cond => matchesWhere(item, cond))) return false
      continue
    }
    if (key === 'OR' && Array.isArray(val)) {
      if (!val.some(cond => matchesWhere(item, cond))) return false
      continue
    }
    if (key === 'NOT') {
      if (matchesWhere(item, val)) return false
      continue
    }

    const itemVal = item[key]
    if (val === null) {
      if (itemVal !== null && itemVal !== undefined) return false
      continue
    }

    if (typeof val === 'object' && !(val instanceof Date)) {
      const obj = val as any
      if (obj.in && Array.isArray(obj.in)) {
        if (!obj.in.includes(itemVal)) return false
      }
      if (obj.notIn && Array.isArray(obj.notIn)) {
        if (obj.notIn.includes(itemVal)) return false
      }
      if (obj.not !== undefined) {
        if (itemVal === obj.not) return false
      }
      if (obj.equals !== undefined) {
        if (itemVal !== obj.equals) return false
      }
      if (obj.contains !== undefined) {
        const needle = String(obj.contains).toLowerCase()
        const haystack = String(itemVal ?? '').toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      if (obj.startsWith !== undefined) {
        const needle = String(obj.startsWith).toLowerCase()
        const haystack = String(itemVal ?? '').toLowerCase()
        if (!haystack.startsWith(needle)) return false
      }
      if (obj.endsWith !== undefined) {
        const needle = String(obj.endsWith).toLowerCase()
        const haystack = String(itemVal ?? '').toLowerCase()
        if (!haystack.endsWith(needle)) return false
      }
      if (obj.gt !== undefined && itemVal <= obj.gt) return false
      if (obj.gte !== undefined && itemVal < obj.gte) return false
      if (obj.lt !== undefined && itemVal >= obj.lt) return false
      if (obj.lte !== undefined && itemVal > obj.lte) return false
      continue
    }

    if (val instanceof Date) {
      const itemDate = itemVal instanceof Date ? itemVal : new Date(itemVal)
      if (itemDate.getTime() !== val.getTime()) return false
      continue
    }

    if (itemVal !== val) {
      return false
    }
  }
  return true
}

function sortItems(items: any[], orderBy?: any): any[] {
  if (!orderBy) return items
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
  return [...items].sort((a, b) => {
    for (const ord of orders) {
      for (const [key, dir] of Object.entries(ord)) {
        let va = a[key]
        let vb = b[key]
        if (va instanceof Date) va = va.getTime()
        if (vb instanceof Date) vb = vb.getTime()
        if (typeof va === 'string' && typeof vb === 'string') {
          const cmp = va.localeCompare(vb)
          if (cmp !== 0) return dir === 'desc' ? -cmp : cmp
        } else if (va !== vb) {
          if (va == null) return dir === 'desc' ? 1 : -1
          if (vb == null) return dir === 'desc' ? -1 : 1
          return dir === 'desc' ? (va < vb ? 1 : -1) : (va > vb ? 1 : -1)
        }
      }
    }
    return 0
  })
}

function expandRelations(modelName: string, item: any, include?: any): any {
  if (!item || !include) return item
  const res = { ...item }

  if (modelName === 'user') {
    if (include.admin) res.admin = normalizeItem('admin', db.admins.find(a => a.userId === item.id))
    if (include.student) res.student = expandRelations('student', normalizeItem('student', db.students.find(s => s.userId === item.id)), include.student === true ? undefined : include.student?.include)
    if (include.teacher) res.teacher = expandRelations('teacher', normalizeItem('teacher', db.teachers.find(t => t.userId === item.id)), include.teacher === true ? undefined : include.teacher?.include)
  }

  if (modelName === 'admin') {
    if (include.user) res.user = normalizeItem('user', db.users.find(u => u.id === item.userId))
  }

  if (modelName === 'student') {
    if (include.user) res.user = normalizeItem('user', db.users.find(u => u.id === item.userId))
    if (include.profile) res.profile = normalizeItem('studentProfile', db.studentProfiles.find(p => p.studentId === item.id))
    if (include.sectionAssignments) {
      const list = db.studentSectionAssignments.filter(a => a.studentId === item.id)
      res.sectionAssignments = list.map(a => expandRelations('studentSectionAssignment', normalizeItem('studentSectionAssignment', a), include.sectionAssignments?.include))
    }
    if (include.attendanceRecords) {
      res.attendanceRecords = db.attendanceRecords.filter(r => r.studentId === item.id).map(r => normalizeItem('attendanceRecord', r))
    }
    if (include.studentScores) {
      res.studentScores = db.studentScores.filter(s => s.studentId === item.id).map(s => normalizeItem('studentScore', s))
    }
    if (include.finalGrades) {
      res.finalGrades = db.finalGrades.filter(g => g.studentId === item.id).map(g => normalizeItem('finalGrade', g))
    }
  }

  if (modelName === 'teacher') {
    if (include.user) res.user = normalizeItem('user', db.users.find(u => u.id === item.userId))
    if (include.profile) res.profile = normalizeItem('teacherProfile', db.teacherProfiles.find(p => p.teacherId === item.id))
    if (include.subjectAssignments) {
      const list = db.teacherSubjectAssignments.filter(a => a.teacherId === item.id)
      res.subjectAssignments = list.map(a => expandRelations('teacherSubjectAssignment', normalizeItem('teacherSubjectAssignment', a), include.subjectAssignments?.include))
    }
    if (include.classSchedules) {
      res.classSchedules = db.classSchedules.filter(s => s.teacherId === item.id).map(s => normalizeItem('classSchedule', s))
    }
  }

  if (modelName === 'section') {
    if (include.gradeLevel) res.gradeLevel = normalizeItem('gradeLevel', db.gradeLevels.find(g => g.id === item.gradeLevelId))
    if (include.strand) res.strand = normalizeItem('strand', db.strands.find(s => s.id === item.strandId))
    if (include.studentSectionAssignments) res.studentSectionAssignments = db.studentSectionAssignments.filter(a => a.sectionId === item.id).map(a => normalizeItem('studentSectionAssignment', a))
  }

  if (modelName === 'studentSectionAssignment') {
    if (include.section) res.section = expandRelations('section', normalizeItem('section', db.sections.find(s => s.id === item.sectionId)), include.section === true ? { gradeLevel: true, strand: true } : include.section?.include)
    if (include.student) res.student = normalizeItem('student', db.students.find(s => s.id === item.studentId))
    if (include.academicYear) res.academicYear = normalizeItem('academicYear', db.academicYears.find(y => y.id === item.academicYearId))
    if (include.gradeLevel) res.gradeLevel = normalizeItem('gradeLevel', db.gradeLevels.find(g => g.id === item.gradeLevelId))
  }

  if (modelName === 'teacherSubjectAssignment') {
    if (include.teacher) res.teacher = normalizeItem('teacher', db.teachers.find(t => t.id === item.teacherId))
    if (include.subject) res.subject = normalizeItem('subject', db.subjects.find(s => s.id === item.subjectId))
    if (include.section) res.section = expandRelations('section', normalizeItem('section', db.sections.find(s => s.id === item.sectionId)), include.section === true ? { gradeLevel: true, strand: true } : include.section?.include)
    if (include.academicYear) res.academicYear = normalizeItem('academicYear', db.academicYears.find(y => y.id === item.academicYearId))
  }

  if (modelName === 'classSchedule') {
    if (include.subject) res.subject = normalizeItem('subject', db.subjects.find(s => s.id === item.subjectId))
    if (include.section) res.section = expandRelations('section', normalizeItem('section', db.sections.find(s => s.id === item.sectionId)), include.section === true ? { gradeLevel: true, strand: true } : include.section?.include)
    if (include.teacher) res.teacher = normalizeItem('teacher', db.teachers.find(t => t.id === item.teacherId))
    if (include.academicYear) res.academicYear = normalizeItem('academicYear', db.academicYears.find(y => y.id === item.academicYearId))
  }

  if (modelName === 'attendanceSession') {
    if (include.subject) res.subject = normalizeItem('subject', db.subjects.find(s => s.id === item.subjectId))
    if (include.section) res.section = expandRelations('section', normalizeItem('section', db.sections.find(s => s.id === item.sectionId)), include.section === true ? { gradeLevel: true, strand: true } : include.section?.include)
    if (include.teacher) res.teacher = normalizeItem('teacher', db.teachers.find(t => t.id === item.teacherId))
    if (include.attendanceRecords) {
      res.attendanceRecords = db.attendanceRecords.filter(r => r.sessionId === item.id).map(r => {
        const norm = normalizeItem('attendanceRecord', r)
        if (include.attendanceRecords?.include?.student) {
          const st = db.students.find(s => s.id === r.studentId)
          norm.student = expandRelations('student', normalizeItem('student', st), { profile: true })
        }
        return norm
      })
    }
  }

  if (modelName === 'attendanceRecord') {
    if (include.student) res.student = expandRelations('student', normalizeItem('student', db.students.find(s => s.id === item.studentId)), { profile: true })
    if (include.session) res.session = normalizeItem('attendanceSession', db.attendanceSessions.find(s => s.id === item.sessionId))
  }

  if (modelName === 'announcementCategory') {
    if (include.announcements) {
      let anns = db.announcements.filter(a => a.categoryId === item.id)
      if (include.announcements?.where) {
        anns = anns.filter(a => matchesWhere(a, include.announcements.where))
      }
      if (include.announcements?.orderBy) {
        anns = sortItems(anns, include.announcements.orderBy)
      }
      res.announcements = anns.map(a => normalizeItem('announcement', a))
    }
  }

  if (modelName === 'announcement') {
    if (include.category) res.category = normalizeItem('announcementCategory', db.announcementCategories.find(c => c.id === item.categoryId))
  }

  if (modelName === 'presentationMaterial') {
    if (include.teacher) res.teacher = normalizeItem('teacher', db.teachers.find(t => t.id === item.teacherId))
    if (include.subject) res.subject = normalizeItem('subject', db.subjects.find(s => s.id === item.subjectId))
    if (include.section) res.section = expandRelations('section', normalizeItem('section', db.sections.find(s => s.id === item.sectionId)), include.section === true ? { gradeLevel: true, strand: true } : include.section?.include)
  }

  if (modelName === 'academicActivity') {
    if (include.subject) res.subject = normalizeItem('subject', db.subjects.find(s => s.id === item.subjectId))
    if (include.section) res.section = expandRelations('section', normalizeItem('section', db.sections.find(s => s.id === item.sectionId)), include.section === true ? { gradeLevel: true, strand: true } : include.section?.include)
    if (include.teacher) res.teacher = normalizeItem('teacher', db.teachers.find(t => t.id === item.teacherId))
    if (include.academicYear) res.academicYear = normalizeItem('academicYear', db.academicYears.find(y => y.id === item.academicYearId))
    if (include.studentScores) res.studentScores = db.studentScores.filter(s => s.activityId === item.id).map(s => normalizeItem('studentScore', s))
  }

  return res
}

function createModelDelegate(modelName: string) {
  const dbKey = MODEL_MAP[modelName]
  if (!dbKey) throw new Error(`Unknown model: ${modelName}`)

  return {
    findMany: async (args: any = {}) => {
      const arr = (db[dbKey] || []) as any[]
      let filtered = arr.filter(item => matchesWhere(item, args.where))
      filtered = sortItems(filtered, args.orderBy)
      if (args.skip) filtered = filtered.slice(args.skip)
      if (args.take) filtered = filtered.slice(0, args.take)
      return filtered.map(item => expandRelations(modelName, normalizeItem(modelName, item), args.include))
    },

    findFirst: async (args: any = {}) => {
      const arr = (db[dbKey] || []) as any[]
      let filtered = arr.filter(item => matchesWhere(item, args.where))
      filtered = sortItems(filtered, args.orderBy)
      const found = filtered[0]
      if (!found) return null
      return expandRelations(modelName, normalizeItem(modelName, found), args.include)
    },

    findUnique: async (args: any = {}) => {
      const arr = (db[dbKey] || []) as any[]
      const found = arr.find(item => matchesWhere(item, args.where))
      if (!found) return null
      return expandRelations(modelName, normalizeItem(modelName, found), args.include)
    },

    count: async (args: any = {}) => {
      const arr = (db[dbKey] || []) as any[]
      const filtered = arr.filter(item => matchesWhere(item, args.where))
      return filtered.length
    },

    create: async (args: any) => {
      const arr = db[dbKey] as any[]
      const now = new Date().toISOString()
      const data = { ...args.data }
      if (!data.id) data.id = uuidv4()
      if (data.createdAt === undefined && DATE_FIELDS[modelName]?.includes('createdAt')) {
        data.createdAt = now
      }
      if (data.updatedAt === undefined && DATE_FIELDS[modelName]?.includes('updatedAt')) {
        data.updatedAt = now
      }

      // Convert Date objects in data to ISO string for db storage
      for (const [k, v] of Object.entries(data)) {
        if (v instanceof Date) {
          data[k] = v.toISOString()
        }
      }

      arr.push(data)
      void saveDb().catch(() => {})
      return expandRelations(modelName, normalizeItem(modelName, data), args.include)
    },

    createMany: async (args: any) => {
      const arr = db[dbKey] as any[]
      const dataList = Array.isArray(args.data) ? args.data : [args.data]
      const now = new Date().toISOString()
      let count = 0
      for (const item of dataList) {
        const clone = { ...item }
        if (!clone.id) clone.id = uuidv4()
        if (clone.createdAt === undefined && DATE_FIELDS[modelName]?.includes('createdAt')) {
          clone.createdAt = now
        }
        for (const [k, v] of Object.entries(clone)) {
          if (v instanceof Date) clone[k] = v.toISOString()
        }
        arr.push(clone)
        count++
      }
      void saveDb().catch(() => {})
      return { count }
    },

    update: async (args: any) => {
      const arr = db[dbKey] as any[]
      const index = arr.findIndex(item => matchesWhere(item, args.where))
      if (index === -1) throw new Error(`Record to update not found on model ${modelName}`)
      const current = arr[index]
      const data = { ...args.data }
      if (DATE_FIELDS[modelName]?.includes('updatedAt')) {
        data.updatedAt = new Date().toISOString()
      }
      for (const [k, v] of Object.entries(data)) {
        if (v instanceof Date) {
          data[k] = v.toISOString()
        }
      }
      arr[index] = { ...current, ...data }
      void saveDb().catch(() => {})
      return expandRelations(modelName, normalizeItem(modelName, arr[index]), args.include)
    },

    updateMany: async (args: any) => {
      const arr = db[dbKey] as any[]
      let count = 0
      const data = { ...args.data }
      for (const [k, v] of Object.entries(data)) {
        if (v instanceof Date) data[k] = v.toISOString()
      }
      for (let i = 0; i < arr.length; i++) {
        if (matchesWhere(arr[i], args.where)) {
          arr[i] = { ...arr[i], ...data }
          count++
        }
      }
      if (count > 0) void saveDb().catch(() => {})
      return { count }
    },

    upsert: async (args: any) => {
      const arr = db[dbKey] as any[]
      const index = arr.findIndex(item => matchesWhere(item, args.where))
      if (index !== -1) {
        const data = { ...args.update }
        for (const [k, v] of Object.entries(data)) {
          if (v instanceof Date) data[k] = v.toISOString()
        }
        arr[index] = { ...arr[index], ...data }
        void saveDb().catch(() => {})
        return expandRelations(modelName, normalizeItem(modelName, arr[index]), args.include)
      } else {
        const data = { ...args.create }
        if (!data.id) data.id = uuidv4()
        const now = new Date().toISOString()
        if (data.createdAt === undefined && DATE_FIELDS[modelName]?.includes('createdAt')) data.createdAt = now
        if (data.updatedAt === undefined && DATE_FIELDS[modelName]?.includes('updatedAt')) data.updatedAt = now
        for (const [k, v] of Object.entries(data)) {
          if (v instanceof Date) data[k] = v.toISOString()
        }
        arr.push(data)
        void saveDb().catch(() => {})
        return expandRelations(modelName, normalizeItem(modelName, data), args.include)
      }
    },

    delete: async (args: any) => {
      const arr = db[dbKey] as any[]
      const index = arr.findIndex(item => matchesWhere(item, args.where))
      if (index === -1) throw new Error(`Record to delete not found on model ${modelName}`)
      const deleted = arr.splice(index, 1)[0]
      void saveDb().catch(() => {})
      return normalizeItem(modelName, deleted)
    },

    deleteMany: async (args: any = {}) => {
      const arr = db[dbKey] as any[]
      let count = 0
      for (let i = arr.length - 1; i >= 0; i--) {
        if (matchesWhere(arr[i], args.where)) {
          arr.splice(i, 1)
          count++
        }
      }
      if (count > 0) void saveDb().catch(() => {})
      return { count }
    },
  }
}

// Build mock client
function createMockPrisma() {
  const client: any = {
    $transaction: async (arg: any) => {
      if (typeof arg === 'function') {
        return arg(client)
      }
      if (Array.isArray(arg)) {
        const results: any[] = []
        for (const p of arg) results.push(await p)
        return results
      }
      return arg
    },
    $queryRaw: async () => [],
    $executeRaw: async () => 0,
  }

  for (const model of Object.keys(MODEL_MAP)) {
    client[model] = createModelDelegate(model)
  }

  return client
}

export const mockPrisma = createMockPrisma()

// Real client initialization with PrismaPg adapter
let realPrismaClient: any = null

export function getRealPrisma(): any {
  if (realPrismaClient) return realPrismaClient
  if (!process.env.DATABASE_URL) return null

  try {
    const connectionString = process.env.DATABASE_URL
    const pool = new pg.Pool({
      connectionString,
      ssl: connectionString.includes('supabase.co') || connectionString.includes('sslmode=')
        ? { rejectUnauthorized: false }
        : undefined,
      // Supabase session/transaction poolers have a finite connection limit.
      // Keep the local/Render app pool small so multiple app instances do not
      // exhaust the database connection pool.
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 30000,
    })

    const adapter = new PrismaPg(pool)
    realPrismaClient = new PrismaClient({ adapter })
    console.log('[prisma] Connected to live Supabase PostgreSQL via PrismaPg adapter')
    return realPrismaClient
  } catch (err: any) {
    console.warn('[prisma] Could not initialize live Supabase client, using fallback:', err?.message || err)
    return null
  }
}

export const prisma: any = new Proxy({}, {
  get: (_target, prop: string) => {
    const real = getRealPrisma()
    if (real && real[prop]) {
      return real[prop]
    }
    return mockPrisma[prop]
  }
})

export default prisma
