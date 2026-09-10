import axios from 'axios'

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

const api = axios.create({
  baseURL: configuredApiBase,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// When posting FormData (file uploads), axios's default Content-Type: application/json
// must be removed so the browser can set multipart/form-data with the correct boundary.
// Without this, multer on the server cannot parse the body and returns 400.
api.interceptors.request.use(config => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('smartclass_token') : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    return Promise.reject(err)
  }
)

export default api

// Auth
export const authApi = {
  login: (data: { identifier: string; password: string; role: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
}

// Announcements
export const announcementsApi = {
  getPublic: () => api.get('/announcements/public'),
  getAll: () => api.get('/announcements'),
  getCategories: () => api.get('/announcements/categories'),
  create: (data: any) => api.post('/announcements', data),
  update: (id: string, data: any) => api.put(`/announcements/${id}`, data),
  delete: (id: string) => api.delete(`/announcements/${id}`),
  createCategory: (data: any) => api.post('/announcements/categories', data),
  uploadMedia: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('media', file)
    // Do NOT set Content-Type manually — axios must auto-set multipart/form-data
    // with the boundary param, otherwise multer cannot parse the body.
    return api.post(`/announcements/${id}/upload`, fd)
  },
  removeMedia: (id: string) => api.delete(`/announcements/${id}/media`),
}

// Students
export const studentsApi = {
  getAll: (params?: any) => api.get('/students', { params }),
  getOne: (id: string) => api.get(`/students/${id}`),
  create: (data: any) => api.post('/students', data),
  update: (id: string, data: any) => api.put(`/students/${id}`, data),
  archive: (id: string) => api.patch(`/students/${id}/archive`),
  restore: (id: string) => api.patch(`/students/${id}/restore`),
  resetPassword: (id: string) => api.post(`/students/${id}/reset-password`),
  reassignSection: (id: string, data: { sectionId: string; academicYearId: string; gradeLevelId: string }) =>
    api.patch(`/students/${id}/section`, data),
  removeFromSection: (id: string) => api.delete(`/students/${id}/section`),
  importStudents: (data: { rows: any[]; dryRun: boolean; academicYearId?: string; gradeLevelId?: string; sectionId?: string }) =>
    api.post('/students/import', data),
  getAttendance: (id: string) => api.get(`/students/${id}/attendance`),
  getScores: (id: string) => api.get(`/students/${id}/scores`),
  updateProfile: (id: string, data: any) => api.patch(`/students/${id}/profile`, data),
  uploadAvatar: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('avatar', file)
    return api.post(`/students/${id}/avatar`, fd)
  },
  uploadBanner: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('banner', file)
    return api.post(`/students/${id}/banner`, fd)
  },
  getGrades: (id: string, params?: any) => api.get(`/students/${id}/grades`, { params }),
}

// Teachers
export const teachersApi = {
  getAll: (params?: any) => api.get('/teachers', { params }),
  getOne: (id: string) => api.get(`/teachers/${id}`),
  create: (data: any) => api.post('/teachers', data),
  update: (id: string, data: any) => api.put(`/teachers/${id}`, data),
  archive: (id: string) => api.patch(`/teachers/${id}/archive`),
  resetPassword: (id: string) => api.post(`/teachers/${id}/reset-password`),
  addAssignment: (id: string, data: any) => api.post(`/teachers/${id}/assignments`, data),
  updateProfile: (id: string, data: any) => api.patch(`/teachers/${id}/profile`, data),
  uploadAvatar: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('avatar', file)
    return api.post(`/teachers/${id}/avatar`, fd)
  },
  uploadBanner: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('banner', file)
    return api.post(`/teachers/${id}/banner`, fd)
  },
}

// Attendance
export const attendanceApi = {
  createSession: (data: any) => api.post('/attendance/sessions', data),
  getSessions: () => api.get('/attendance/sessions'),
  getSession: (id: string) => api.get(`/attendance/sessions/${id}`),
  updateRecord: (id: string, data: any) => api.patch(`/attendance/records/${id}`, data),
  generateCode: (sessionId: string, data: any) =>
    api.post(`/attendance/sessions/${sessionId}/generate-code`, data),
  closeSession: (id: string) => api.patch(`/attendance/sessions/${id}/close`),
  getPublicSession: (code: string) => api.get(`/attendance/public/${code}`),
  submitAttendance: (data: any) => api.post('/attendance/public/submit', data),
  getAdminSessions: () => api.get('/attendance/admin/sessions'),
}

// Academic
export const academicApi = {
  createActivity: (data: any) => api.post('/academic/activities', data),
  getActivities: () => api.get('/academic/activities'),
  updateActivity: (id: string, data: any) => api.patch(`/academic/activities/${id}`, data),
  deleteActivity: (id: string) => api.delete(`/academic/activities/${id}`),
  recordScores: (activityId: string, scores: any) =>
    api.post(`/academic/activities/${activityId}/scores`, scores),
  submitScore: (data: any) => api.post('/academic/scores', data),
  getAdminActivities: () => api.get('/academic/admin/activities'),
  // Imported sheets
  getSheets: (sectionId: string) => api.get('/academic/sheets', { params: { sectionId } }),
  createSheet: (data: { sectionId: string; subjectId?: string; name: string; headers: string[]; rows: string[][] }) =>
    api.post('/academic/sheets', data),
  deleteSheet: (id: string) => api.delete(`/academic/sheets/${id}`),
  // Final grades
  releaseGrade: (data: any) => api.post('/academic/grades', data),
  getGrades: (params?: any) => api.get('/academic/grades', { params }),
  resetGrade: (data: any) => api.post('/academic/admin/grades/reset', data),
  resetSectionGrades: (data: any) => api.post('/academic/admin/grades/reset-section', data),
  retractGrade: (id: string) => api.delete(`/academic/grades/${id}`),
}

// Structure
export const structureApi = {
  getAcademicYears: () => api.get('/structure/academic-years'),
  createAcademicYear: (data: any) => api.post('/structure/academic-years', data),
  getGradeLevels: () => api.get('/structure/grade-levels'),
  createGradeLevel: (data: any) => api.post('/structure/grade-levels', data),
  createStrand: (data: any) => api.post('/structure/strands', data),
  getSections: () => api.get('/structure/sections'),
  createSection: (data: any) => api.post('/structure/sections', data),
  getSubjects: () => api.get('/structure/subjects'),
  createSubject: (data: any) => api.post('/structure/subjects', data),
  getSchedules: (params?: any) => api.get('/structure/schedules', { params }),
  createSchedule: (data: any) => api.post('/structure/schedules', data),
  updateSchedule: (id: string, data: any) => api.put(`/structure/schedules/${id}`, data),
  deleteSchedule: (id: string) => api.delete(`/structure/schedules/${id}`),
  publishSchedules: (data: { sectionId: string; academicYearId: string }) =>
    api.post('/structure/schedules/publish', data),
  getSectionStudents: (sectionId: string) => api.get(`/structure/section-students/${sectionId}`),
}

// Presentation Materials
export const presentationsApi = {
  getAll: (params?: any) => api.get('/presentations', { params }),
  // Do NOT set Content-Type manually — axios must auto-set multipart/form-data
  // with the boundary param, otherwise multer cannot parse the body.
  upload: (formData: FormData, onUploadProgress?: (e: { loaded: number; total?: number }) => void) =>
    api.post('/presentations/upload', formData, { onUploadProgress }),
  // Link an existing file to a new subject/section without re-uploading
  link: (data: { materialId: string; subjectId?: string; sectionId?: string; title?: string }) =>
    api.post('/presentations/link', data),
  delete: (id: string) => api.delete(`/presentations/${id}`),
}

// Settings
export const settingsApi = {
  getPublic: () => api.get('/settings/public'),
  getAll: () => api.get('/settings'),
  update: (data: any) => api.put('/settings', data),
  uploadLogo: (file: File) => {
    const fd = new FormData()
    fd.append('logo', file)
    return api.post('/settings/logo', fd)
  },
  removeLogo: () => api.delete('/settings/logo'),
  exportBackup: () => api.get('/settings/backup/export', { responseType: 'blob' }),
  importBackup: (file: File) => {
    const fd = new FormData()
    fd.append('backup', file)
    return api.post('/settings/backup/import', fd)
  },
  resetDemo: () => api.post('/settings/reset-demo'),
  updateAdminAccount: (data: { username?: string; currentPassword: string; newPassword?: string }) =>
    api.put('/settings/admin-account', data),
  getDashboardStats: () => api.get('/settings/dashboard-stats'),
}
