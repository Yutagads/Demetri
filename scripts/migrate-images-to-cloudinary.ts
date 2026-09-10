import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { prisma } from '../server/prisma.js'
import { isCloudinaryImageUrl, uploadImage } from '../server/services/imageStorage.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')
const deleteLocal = process.argv.includes('--delete-local')

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'])

function isDataImageReference(value: string) {
  return /^data:image\/(jpeg|png|gif|webp|svg\+xml);base64,/i.test(value)
}

function isLocalReference(value: string) {
  return value.startsWith('/uploads/') || value.startsWith('uploads/') || value.startsWith('./uploads/')
}

function looksLikeImageReference(value: string) {
  const pathname = value.split('?')[0].split('#')[0]
  return imageExtensions.has(path.extname(pathname).toLowerCase())
}

async function loadReference(value: string) {
  if (isDataImageReference(value)) {
    const base64 = value.slice(value.indexOf(',') + 1)
    return { buffer: Buffer.from(base64, 'base64'), source: value, claimedMimeType: value.slice(5, value.indexOf(';')) }
  }

  if (isLocalReference(value)) {
    const relative = value.replace(/^\.\//, '').replace(/^\//, '')
    const filePath = path.join(projectRoot, relative)
    if (!fs.existsSync(filePath)) throw new Error(`Local file not found: ${filePath}`)
    return { buffer: fs.readFileSync(filePath), source: filePath, claimedMimeType: undefined }
  }

  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value)
    if (!response.ok) throw new Error(`HTTP ${response.status} while downloading ${value}`)
    const contentType = response.headers.get('content-type')?.split(';')[0].trim()
    if (!contentType?.startsWith('image/')) throw new Error(`Remote reference is not an image (${contentType || 'unknown content type'})`)
    return { buffer: Buffer.from(await response.arrayBuffer()), source: value, claimedMimeType: contentType }
  }

  throw new Error(`Unsupported legacy image reference: ${value}`)
}

async function migrateOne(label: string, value: string | null | undefined, folder: Parameters<typeof uploadImage>[0]['folder']) {
  if (!value || isCloudinaryImageUrl(value)) return value
  if (!isDataImageReference(value) && !isLocalReference(value) && !looksLikeImageReference(value) && !/^https?:\/\//i.test(value)) return value

  try {
    const loaded = await loadReference(value)
    const stored = await uploadImage({
      buffer: loaded.buffer,
      folder,
      claimedMimeType: loaded.claimedMimeType,
      maxBytes: 50 * 1024 * 1024,
    })

    console.log(`✓ ${label}: ${value} -> ${stored.url}`)
    if (deleteLocal && isLocalReference(value)) {
      try { fs.unlinkSync(loaded.source) } catch (err) { console.warn(`  ! Could not remove old local file: ${loaded.source}`, err) }
    }
    return stored.url
  } catch (err) {
    console.warn(`! ${label}: migration skipped.`, err instanceof Error ? err.message : err)
    return value
  }
}

async function main() {
  console.log('SMARTCLASS image migration: legacy/local/remote image refs -> Cloudinary')
  console.log(deleteLocal ? 'Local source files will be removed only after a successful Cloudinary upload.' : 'Source files will be kept. Use --delete-local only after verifying the migration.')

  const students = await prisma.studentProfile.findMany()
  for (const profile of students) {
    const profilePicture = await migrateOne(`student ${profile.studentId} profilePicture`, profile.profilePicture, 'students')
    const bannerImage = await migrateOne(`student ${profile.studentId} bannerImage`, profile.bannerImage, 'students')
    if (profilePicture !== profile.profilePicture || bannerImage !== profile.bannerImage) {
      await prisma.studentProfile.update({ where: { id: profile.id }, data: { profilePicture: profilePicture ?? null, bannerImage: bannerImage ?? null } })
    }
  }

  const teachers = await prisma.teacherProfile.findMany()
  for (const profile of teachers) {
    const profilePicture = await migrateOne(`teacher ${profile.teacherId} profilePicture`, profile.profilePicture, 'employees')
    if (profilePicture !== profile.profilePicture) {
      await prisma.teacherProfile.update({ where: { id: profile.id }, data: { profilePicture: profilePicture ?? null } })
    }
  }

  const settings = await prisma.systemSetting.findUnique({ where: { key: 'schoolLogo' } })
  if (settings?.value) {
    const schoolLogo = await migrateOne('schoolLogo', settings.value, 'school')
    if (schoolLogo !== settings.value) await prisma.systemSetting.update({ where: { id: settings.id }, data: { value: schoolLogo ?? '' } })
  }

  const announcements = await prisma.announcement.findMany()
  for (const announcement of announcements) {
    const image = await migrateOne(`announcement ${announcement.id} image`, announcement.image, 'announcements')
    if (image !== announcement.image) await prisma.announcement.update({ where: { id: announcement.id }, data: { image: image ?? null } })
  }

  const categories = await prisma.announcementCategory.findMany()
  for (const category of categories) {
    const coverImage = await migrateOne(`announcement category ${category.id} coverImage`, category.coverImage, 'announcements')
    if (coverImage !== category.coverImage) await prisma.announcementCategory.update({ where: { id: category.id }, data: { coverImage: coverImage ?? null } })
  }

  const schedules = await prisma.classSchedule.findMany()
  for (const schedule of schedules) {
    const scheduleImage = await migrateOne(`schedule ${schedule.id} scheduleImage`, schedule.scheduleImage, 'other')
    if (scheduleImage !== schedule.scheduleImage) await prisma.classSchedule.update({ where: { id: schedule.id }, data: { scheduleImage: scheduleImage ?? null } })
  }

  const scores = await prisma.studentScore.findMany()
  for (const score of scores) {
    if (!score.evidenceFile) continue
    const evidenceFile = await migrateOne(`student score ${score.id} evidenceFile`, score.evidenceFile, 'other')
    if (evidenceFile !== score.evidenceFile) await prisma.studentScore.update({ where: { id: score.id }, data: { evidenceFile: evidenceFile ?? null } })
  }

  const materials = await prisma.presentationMaterial.findMany()
  for (const material of materials) {
    if (material.fileType !== 'image' && !looksLikeImageReference(material.filePath)) continue
    const filePath = await migrateOne(`presentation ${material.id} image`, material.filePath, 'other')
    if (filePath !== material.filePath) await prisma.presentationMaterial.update({ where: { id: material.id }, data: { filePath: filePath ?? material.filePath } })
  }

  console.log('Migration complete. Existing source files were preserved unless --delete-local was used.')
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
