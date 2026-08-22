import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import path from 'path'
import { prisma } from '../prisma.js'
import { deleteAssetByUrl, isCloudinaryAssetUrl, uploadAsset } from '../services/assetStorage.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
      'application/octet-stream',
    ]
    const allowedExts = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
      '.pdf', '.ppt', '.pptx', '.doc', '.docx', '.mp4', '.webm', '.mov', '.avi',
    ]
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) cb(null, true)
    else if (allowedExts.includes(ext)) cb(null, true)
    else cb(new Error('Allowed types: images, PDF, PowerPoint, Word documents, and videos'))
  },
})

async function getTeacher(userId: string) {
  return prisma.teacher.findUnique({ where: { userId } })
}

function fileTypeFromExtension(ext: string) {
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return 'image'
  if (ext === '.pdf') return 'pdf'
  if (['.ppt', '.pptx'].includes(ext)) return 'pptx'
  if (['.doc', '.docx'].includes(ext)) return 'doc'
  if (['.mp4', '.webm', '.mov', '.avi'].includes(ext)) return 'video'
  return 'other'
}

const includeRelations = {
  teacher: true,
} as const

async function enrichMaterials<T extends { subjectId: string; sectionId: string }>(materials: T[]) {
  return Promise.all(
    materials.map(async material => {
      const [subject, section] = await Promise.all([
        prisma.subject.findUnique({
          where: { id: material.subjectId },
        }),
        prisma.section.findUnique({
          where: { id: material.sectionId },
          include: { gradeLevel: true, strand: true },
        }),
      ])

      return {
        ...material,
        subject,
        section,
      }
    }),
  )
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { teacherId, subjectId, sectionId } = req.query
    const materials = await prisma.presentationMaterial.findMany({
      where: {
        ...(teacherId ? { teacherId: String(teacherId) } : {}),
        ...(subjectId ? { subjectId: String(subjectId) } : {}),
        ...(sectionId ? { sectionId: String(sectionId) } : {}),
      },
      orderBy: { uploadedAt: 'desc' },
      include: includeRelations,
    })

    res.json(await enrichMaterials(materials))
  } catch (err) {
    console.error('[presentations] list error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post(
  '/upload',
  requireAuth,
  requireRole('TEACHER'),
  (req: Request, res: Response, next) => {
    upload.single('file')(req, res, err => {
      if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message })
      if (err) return res.status(400).json({ error: err.message })
      next()
    })
  },
  async (req: Request, res: Response) => {
    try {
      const { title, subjectId, sectionId } = req.body
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
      if (!title?.trim()) return res.status(400).json({ error: 'Title is required' })
      if (!subjectId || !sectionId) return res.status(400).json({ error: 'Subject and section are required' })

      const teacher = await getTeacher(req.user!.userId)
      if (!teacher) return res.status(403).json({ error: 'Teacher profile not found' })

      const ext = path.extname(req.file.originalname).toLowerCase()
      const fileType = fileTypeFromExtension(ext)
      const stored = await uploadAsset({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        folder: 'presentation',
        maxBytes: 50 * 1024 * 1024,
      })

      try {
        const material = await prisma.presentationMaterial.create({
          data: {
            id: uuidv4(),
            teacherId: teacher.id,
            subjectId,
            sectionId,
            title: title.trim(),
            filePath: stored.url,
            fileType,
            originalName: req.file.originalname,
          },
          include: includeRelations,
        })

        const [enriched] = await enrichMaterials([material])
        return res.json(enriched)
      } catch (dbError) {
        if (isCloudinaryAssetUrl(stored.url)) await deleteAssetByUrl(stored.url).catch(() => undefined)
        throw dbError
      }
    } catch (err: any) {
      console.error('[presentations] upload error:', err)
      res.status(500).json({ error: err.message || 'Server error' })
    }
  },
)

router.post('/link', requireAuth, requireRole('TEACHER'), async (req: Request, res: Response) => {
  try {
    const { materialId, subjectId, sectionId, title } = req.body
    if (!materialId) return res.status(400).json({ error: 'materialId is required' })

    const teacher = await getTeacher(req.user!.userId)
    if (!teacher) return res.status(403).json({ error: 'Teacher profile not found' })

    const source = await prisma.presentationMaterial.findUnique({ where: { id: materialId } })
    if (!source) return res.status(404).json({ error: 'Source material not found' })
    if (source.teacherId !== teacher.id) return res.status(403).json({ error: 'Forbidden' })

    const linked = await prisma.presentationMaterial.create({
      data: {
        id: uuidv4(),
        teacherId: teacher.id,
        subjectId: subjectId || source.subjectId,
        sectionId: sectionId || source.sectionId,
        title: title?.trim() || source.title,
        filePath: source.filePath,
        fileType: source.fileType,
        originalName: source.originalName,
      },
      include: includeRelations,
    })

    const [enriched] = await enrichMaterials([linked])
    res.json(enriched)
  } catch (err: any) {
    console.error('[presentations] link error:', err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
})

router.delete('/:id', requireAuth, requireRole('TEACHER'), async (req: Request, res: Response) => {
  try {
    const material = await prisma.presentationMaterial.findUnique({ where: { id: req.params.id } })
    if (!material) return res.status(404).json({ error: 'Material not found' })

    const teacher = await getTeacher(req.user!.userId)
    if (!teacher || material.teacherId !== teacher.id) return res.status(403).json({ error: 'Forbidden' })

    const stillReferenced = await prisma.presentationMaterial.count({
      where: {
        filePath: material.filePath,
        id: { not: material.id },
      },
    })

    await prisma.presentationMaterial.delete({ where: { id: material.id } })

    if (stillReferenced === 0 && isCloudinaryAssetUrl(material.filePath)) {
      await deleteAssetByUrl(material.filePath).catch(err => console.warn('[MEDIA] Failed to delete presentation asset:', err))
    }

    res.json({ ok: true })
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Material not found' })
    console.error('[presentations] delete error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
