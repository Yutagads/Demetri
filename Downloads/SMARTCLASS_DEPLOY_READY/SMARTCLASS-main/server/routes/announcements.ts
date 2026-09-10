import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { prisma } from '../prisma.js'
import { deleteAssetByUrl, isCloudinaryAssetUrl, uploadAsset } from '../services/assetStorage.js'
import { isCloudinaryImageUrl } from '../services/imageStorage.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { nameSchema, optionalText } from '../validation.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf',
    ]
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only images (JPEG, PNG, GIF, WebP, SVG) and PDF files are allowed'))
  },
})

const categoryInclude = { category: true } as const

function deleteLegacyFile(filePath?: string) {
  if (!filePath) return
  if (isCloudinaryAssetUrl(filePath) || isCloudinaryImageUrl(filePath) || /^https?:\/\//i.test(filePath)) return
  try {
    const abs = path.join(process.cwd(), filePath.replace(/^\//, ''))
    if (fs.existsSync(abs)) fs.unlinkSync(abs)
  } catch {
    // Best effort for legacy files only.
  }
}

// Public: get all published announcements with categories
router.get('/public', async (_req, res: Response) => {
  try {
    const categories = await prisma.announcementCategory.findMany({
      where: { status: 'active' },
      orderBy: { order: 'asc' },
      include: {
        announcements: {
          where: { publishStatus: 'published' },
          orderBy: { displayPriority: 'desc' },
        },
      },
    })

    res.json(categories)
  } catch (err) {
    console.error('[announcements] public error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get all categories (admin)
router.get('/categories', requireAuth, requireRole('ADMIN'), async (_req, res: Response) => {
  try {
    res.json(await prisma.announcementCategory.findMany({ orderBy: { order: 'asc' } }))
  } catch (err) {
    console.error('[announcements] list categories error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/categories', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      name: nameSchema('Category name').max(100),
      icon: optionalText('Icon', 100),
      order: z.number().int().min(0).max(1000).optional(),
    }).parse(req.body)

    const cat = await prisma.announcementCategory.create({
      data: {
        id: uuidv4(),
        name: data.name,
        icon: data.icon,
        order: data.order ?? 0,
        status: 'active',
      },
    })

    res.json(cat)
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    if (err.code === 'P2002') return res.status(409).json({ error: 'Announcement category already exists' })
    console.error('[announcements] create category error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get all announcements (admin)
router.get('/', requireAuth, requireRole('ADMIN'), async (_req, res: Response) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      include: categoryInclude,
    })
    res.json(announcements)
  } catch (err) {
    console.error('[announcements] list error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      title: z.string().trim().min(1).max(200),
      categoryId: z.string().trim().min(1),
      description: optionalText('Description', 2000),
      content: optionalText('Content', 10000),
      publishStatus: z.enum(['published', 'unpublished']).default('published'),
      displayPriority: z.number().int().min(0).max(1000).optional(),
      expiresAt: z.string().trim().optional(),
    }).parse(req.body)

    const category = await prisma.announcementCategory.findUnique({ where: { id: data.categoryId } })
    if (!category) return res.status(400).json({ error: 'Announcement category not found' })

    const now = new Date()
    const announcement = await prisma.announcement.create({
      data: {
        id: uuidv4(),
        title: data.title,
        categoryId: data.categoryId,
        description: data.description,
        content: data.content,
        publishStatus: data.publishStatus,
        displayPriority: data.displayPriority ?? 0,
        publishedAt: data.publishStatus === 'published' ? now : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
      include: categoryInclude,
    })

    res.json(announcement)
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    console.error('[announcements] create error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const data = z.object({
      title: z.string().trim().min(1).max(200).optional(),
      description: optionalText('Description', 2000),
      content: optionalText('Content', 10000),
      publishStatus: z.enum(['published', 'unpublished', 'archived']).optional(),
      displayPriority: z.number().int().min(0).max(1000).optional(),
      expiresAt: z.string().trim().nullable().optional(),
    }).parse(req.body)

    const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Not found' })

    const publishedAt = data.publishStatus === 'published'
      ? (existing.publishStatus === 'published' ? existing.publishedAt : new Date())
      : existing.publishedAt

    const announcement = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.publishStatus !== undefined ? { publishStatus: data.publishStatus } : {}),
        ...(data.displayPriority !== undefined ? { displayPriority: data.displayPriority } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null } : {}),
        ...(data.publishStatus !== undefined ? { publishedAt } : {}),
      },
      include: categoryInclude,
    })

    res.json(announcement)
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues?.[0]?.message ?? err.message })
    console.error('[announcements] update error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Upload image or PDF for an announcement. New uploads always go to Cloudinary.
router.post('/:id/upload', requireAuth, requireRole('ADMIN'), upload.single('media'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Announcement not found' })

    const isPdf = req.file.mimetype === 'application/pdf'
    const stored = await uploadAsset({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: 'announcements',
      maxBytes: 20 * 1024 * 1024,
    })

    try {
      const updated = await prisma.announcement.update({
        where: { id: existing.id },
        data: isPdf
          ? { pdf: stored.url }
          : { image: stored.url },
        include: categoryInclude,
      })

      if (isPdf) {
        if (existing.pdf && existing.pdf !== stored.url) {
          if (isCloudinaryAssetUrl(existing.pdf)) await deleteAssetByUrl(existing.pdf).catch(() => undefined)
          else deleteLegacyFile(existing.pdf)
        }
      } else if (existing.image && existing.image !== stored.url) {
        if (isCloudinaryAssetUrl(existing.image) || isCloudinaryImageUrl(existing.image)) await deleteAssetByUrl(existing.image).catch(() => undefined)
        else deleteLegacyFile(existing.image)
      }

      return res.json({
        url: stored.url,
        type: isPdf ? 'pdf' : 'image',
        announcement: updated,
      })
    } catch (dbError) {
      if (isCloudinaryAssetUrl(stored.url)) await deleteAssetByUrl(stored.url).catch(() => undefined)
      throw dbError
    }
  } catch (err: any) {
    console.error('[ANNOUNCEMENTS] Media upload failed:', err)
    res.status(400).json({ error: err.message || 'Upload failed' })
  }
})

// Remove media from an announcement
router.delete('/:id/media', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Not found' })

    const updated = await prisma.announcement.update({
      where: { id: existing.id },
      data: { image: null, pdf: null },
      include: categoryInclude,
    })

    if (existing.image) {
      if (isCloudinaryAssetUrl(existing.image) || isCloudinaryImageUrl(existing.image)) await deleteAssetByUrl(existing.image).catch(() => undefined)
      else deleteLegacyFile(existing.image)
    }
    if (existing.pdf) {
      if (isCloudinaryAssetUrl(existing.pdf)) await deleteAssetByUrl(existing.pdf).catch(() => undefined)
      else deleteLegacyFile(existing.pdf)
    }

    res.json({ success: true, announcement: updated })
  } catch (err) {
    console.error('[ANNOUNCEMENTS] Media deletion failed:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } })
    if (!announcement) return res.status(404).json({ error: 'Not found' })

    await prisma.announcement.delete({ where: { id: announcement.id } })

    if (announcement.image) {
      if (isCloudinaryAssetUrl(announcement.image) || isCloudinaryImageUrl(announcement.image)) await deleteAssetByUrl(announcement.image).catch(() => undefined)
      else deleteLegacyFile(announcement.image)
    }
    if (announcement.pdf) {
      if (isCloudinaryAssetUrl(announcement.pdf)) await deleteAssetByUrl(announcement.pdf).catch(() => undefined)
      else deleteLegacyFile(announcement.pdf)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('[ANNOUNCEMENTS] Delete failed:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
