import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { URL } from 'url'

export type ImageFolder =
  | 'students'
  | 'employees'
  | 'profiles'
  | 'school'
  | 'announcements'
  | 'other'

export interface StoredImage {
  url: string
  publicId: string
  imageType:
    | 'jpeg'
    | 'png'
    | 'gif'
    | 'webp'
    | 'svg'
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const projectRoot = path.resolve(
  path.dirname(
    fileURLToPath(import.meta.url)
  ),
  '../..'
)

/*
|--------------------------------------------------------------------------
| ENVIRONMENT VARIABLES
|--------------------------------------------------------------------------
*/

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    )
  }

  return value
}

function getConfig() {
  return {
    cloudName: requiredEnv(
      'CLOUDINARY_CLOUD_NAME'
    ),

    apiKey: requiredEnv(
      'CLOUDINARY_API_KEY'
    ),

    apiSecret: requiredEnv(
      'CLOUDINARY_API_SECRET'
    ),

    folder: (
      process.env.CLOUDINARY_FOLDER?.trim() ||
      'smartclass/images'
    ).replace(/^\/+|\/+$/g, ''),
  }
}

/*
|--------------------------------------------------------------------------
| CLOUDINARY SIGNATURE
|--------------------------------------------------------------------------
*/

function sha1(value: string): string {
  return crypto
    .createHash('sha1')
    .update(value)
    .digest('hex')
}

function cloudinarySignature(
  params: Record<string, string>,
  apiSecret: string
): string {
  const serialized = Object.keys(params)
    .filter(
      key =>
        params[key] !== undefined &&
        params[key] !== ''
    )
    .sort()
    .map(
      key =>
        `${key}=${params[key]}`
    )
    .join('&')

  return sha1(
    `${serialized}${apiSecret}`
  )
}

/*
|--------------------------------------------------------------------------
| FOLDER / PUBLIC ID
|--------------------------------------------------------------------------
*/

function normalizeFolder(
  folder: ImageFolder
) {
  return (
    folder
      .replace(
        /[^a-z0-9_-]/gi,
        ''
      )
      .toLowerCase() || 'other'
  )
}

function buildPublicId(
  folder: ImageFolder
) {
  const config = getConfig()

  return (
    `${config.folder}/` +
    `${normalizeFolder(folder)}/` +
    `${crypto.randomUUID()}`
  )
}

/*
|--------------------------------------------------------------------------
| IMAGE TYPE DETECTION
|--------------------------------------------------------------------------
*/

function detectImageType(
  buffer: Buffer
): StoredImage['imageType'] {
  /*
   * JPEG
   */
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpeg'
  }

  /*
   * PNG
   */
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(
        Buffer.from([
          0x89,
          0x50,
          0x4e,
          0x47,
          0x0d,
          0x0a,
          0x1a,
          0x0a,
        ])
      )
  ) {
    return 'png'
  }

  /*
   * GIF
   */
  if (buffer.length >= 6) {
    const signature =
      buffer
        .subarray(0, 6)
        .toString('ascii')

    if (
      signature === 'GIF87a' ||
      signature === 'GIF89a'
    ) {
      return 'gif'
    }
  }

  /*
   * WEBP
   */
  if (
    buffer.length >= 12 &&
    buffer
      .subarray(0, 4)
      .toString('ascii') ===
      'RIFF' &&
    buffer
      .subarray(8, 12)
      .toString('ascii') ===
      'WEBP'
  ) {
    return 'webp'
  }

  /*
   * SVG
   */
  const text = buffer
    .subarray(
      0,
      Math.min(
        buffer.length,
        8192
      )
    )
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trimStart()

  if (
    /^(?:<\?xml[^>]*>\s*)?<svg\b/i.test(
      text
    ) &&
    /<\/svg\s*>/i.test(text)
  ) {
    return 'svg'
  }

  throw new Error(
    'Unsupported or invalid image file. ' +
      'Allowed image types: JPEG, PNG, GIF, WebP, and SVG.'
  )
}

function expectedMime(
  imageType: StoredImage['imageType']
): string {
  const mimeMap: Record<
    StoredImage['imageType'],
    string
  > = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  }

  return mimeMap[imageType]
}

/*
|--------------------------------------------------------------------------
| VALIDATION
|--------------------------------------------------------------------------
*/

export function validateImageBuffer(
  buffer: Buffer,
  claimedMimeType?: string,
  maxBytes = MAX_IMAGE_BYTES
) {
  if (!buffer?.length) {
    throw new Error(
      'Uploaded image is empty.'
    )
  }

  if (buffer.length > maxBytes) {
    throw new Error(
      `Image exceeds the ${Math.round(
        maxBytes / 1024 / 1024
      )} MB limit.`
    )
  }

  const imageType =
    detectImageType(buffer)

  const actualMime =
    expectedMime(imageType)

  /*
   * Only compare when browser supplied
   * an image MIME type.
   */
  if (
    claimedMimeType &&
    claimedMimeType.startsWith('image/') &&
    claimedMimeType !== actualMime
  ) {
    throw new Error(
      'Image content does not match ' +
        `the supplied MIME type (${claimedMimeType}).`
    )
  }

  return {
    imageType,
    actualMime,
  }
}

/*
|--------------------------------------------------------------------------
| CLOUDINARY UPLOAD
|--------------------------------------------------------------------------
*/

async function uploadToCloudinary(
  buffer: Buffer,
  publicId: string,
  contentType: string,
  imageType: StoredImage['imageType']
) {
  const config = getConfig()

  const timestamp =
    Math.floor(
      Date.now() / 1000
    ).toString()

  const params: Record<
    string,
    string
  > = {
    folder: config.folder,

    /*
     * public_id must not duplicate folder.
     */
    public_id:
      publicId.slice(
        config.folder.length + 1
      ),

    timestamp,
  }

  if (imageType === 'svg') {
    params.format = 'svg'
  }

  const form = new FormData()

  /*
   * IMPORTANT:
   *
   * Do NOT pass Buffer directly to Blob.
   *
   * Create a Uint8Array copy instead.
   * This fixes TypeScript BlobPart errors.
   */
  const fileBytes = new Uint8Array(
    buffer.length
  )

  fileBytes.set(buffer)

  const fileBlob = new Blob(
    [fileBytes],
    {
      type: contentType,
    }
  )

  const extension =
    imageType === 'jpeg'
      ? 'jpg'
      : imageType

  form.append(
    'file',
    fileBlob,
    `image.${extension}`
  )

  /*
   * Add signed parameters.
   */
  for (
    const [key, value]
    of Object.entries(params)
  ) {
    form.append(
      key,
      value
    )
  }

  form.append(
    'api_key',
    config.apiKey
  )

  form.append(
    'signature',
    cloudinarySignature(
      params,
      config.apiSecret
    )
  )

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      config.cloudName
    )}/image/upload`,
    {
      method: 'POST',
      body: form,
    }
  )

  if (!response.ok) {
    const text =
      await response
        .text()
        .catch(() => '')

    throw new Error(
      `Cloudinary upload failed ` +
        `(${response.status}): ` +
        text.slice(0, 500)
    )
  }

  const result =
    (await response.json()) as {
      secure_url?: string
      public_id?: string
    }

  if (
    !result.secure_url ||
    !result.public_id
  ) {
    throw new Error(
      'Cloudinary returned an incomplete upload response.'
    )
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
  }
}

/*
|--------------------------------------------------------------------------
| PUBLIC IMAGE UPLOAD FUNCTION
|--------------------------------------------------------------------------
*/

export async function uploadImage(
  params: {
    buffer: Buffer
    folder: ImageFolder
    claimedMimeType?: string
    maxBytes?: number
  }
): Promise<StoredImage> {
  const {
    imageType,
    actualMime,
  } = validateImageBuffer(
    params.buffer,
    params.claimedMimeType,
    params.maxBytes
  )

  const hasCloudinary = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  )

  if (!hasCloudinary) {
    const uploadsDir = path.resolve(projectRoot, 'uploads', params.folder)
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    const filename = `${crypto.randomUUID()}.${imageType}`
    const filePath = path.join(uploadsDir, filename)
    fs.writeFileSync(filePath, params.buffer)
    return {
      url: `/uploads/${params.folder}/${filename}`,
      publicId: `${params.folder}/${filename}`,
      imageType,
    }
  }

  const publicId =
    buildPublicId(params.folder)

  const stored =
    await uploadToCloudinary(
      params.buffer,
      publicId,
      actualMime,
      imageType
    )

  return {
    url: stored.url,
    publicId: stored.publicId,
    imageType,
  }
}

/*
|--------------------------------------------------------------------------
| CLOUDINARY URL CHECK
|--------------------------------------------------------------------------
*/

export function isCloudinaryImageUrl(
  value?: string | null
) {
  if (!value) {
    return false
  }

  try {
    const url = new URL(value)

    return (
      url.hostname ===
        'res.cloudinary.com' &&
      url.pathname.includes(
        '/image/upload/'
      )
    )
  } catch {
    return false
  }
}

/*
|--------------------------------------------------------------------------
| GET PUBLIC ID FROM CLOUDINARY URL
|--------------------------------------------------------------------------
*/

function publicIdFromCloudinaryUrl(
  value: string
): string | undefined {
  try {
    const url = new URL(value)

    if (
      !isCloudinaryImageUrl(value)
    ) {
      return undefined
    }

    const parts =
      url.pathname
        .split('/')
        .filter(Boolean)

    const uploadIndex =
      parts.indexOf('upload')

    if (uploadIndex < 0) {
      return undefined
    }

    let publicParts =
      parts.slice(
        uploadIndex + 1
      )

    /*
     * Remove Cloudinary version:
     * v123456789
     */
    if (
      publicParts[0]?.startsWith('v') &&
      /^v\d+$/.test(
        publicParts[0]
      )
    ) {
      publicParts =
        publicParts.slice(1)
    }

    if (!publicParts.length) {
      return undefined
    }

    const lastIndex =
      publicParts.length - 1

    publicParts[lastIndex] =
      publicParts[lastIndex].replace(
        /\.[^.]+$/,
        ''
      )

    return publicParts
      .map(decodeURIComponent)
      .join('/')
  } catch {
    return undefined
  }
}

/*
|--------------------------------------------------------------------------
| DELETE BY PUBLIC ID
|--------------------------------------------------------------------------
*/

export async function deleteImageByPublicId(
  publicId: string
) {
  if (!publicId) {
    return false
  }

  const config = getConfig()

  const timestamp =
    Math.floor(
      Date.now() / 1000
    ).toString()

  const params: Record<
    string,
    string
  > = {
    public_id: publicId,
    timestamp,
    invalidate: 'true',
  }

  const form =
    new URLSearchParams({
      ...params,
      api_key: config.apiKey,
      signature:
        cloudinarySignature(
          params,
          config.apiSecret
        ),
    })

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      config.cloudName
    )}/image/destroy`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },

      body: form.toString(),
    }
  )

  if (!response.ok) {
    const text =
      await response
        .text()
        .catch(() => '')

    throw new Error(
      `Cloudinary delete failed ` +
        `(${response.status}): ` +
        text.slice(0, 500)
    )
  }

  const result =
    (await response.json()) as {
      result?: string
    }

  if (
    result.result !== 'ok' &&
    result.result !== 'not found'
  ) {
    throw new Error(
      'Cloudinary delete failed: ' +
        (
          result.result ||
          'unknown result'
        )
    )
  }

  return true
}

/*
|--------------------------------------------------------------------------
| DELETE BY CLOUDINARY URL
|--------------------------------------------------------------------------
*/

export async function deleteImageByUrl(
  value?: string | null
) {
  const publicId = value
    ? publicIdFromCloudinaryUrl(
        value
      )
    : undefined

  if (!publicId) {
    return false
  }

  return deleteImageByPublicId(
    publicId
  )
}

/*
|--------------------------------------------------------------------------
| DELETE IMAGE REFERENCE
|--------------------------------------------------------------------------
*/

export async function deleteImageReference(
  value?: string | null
) {
  if (!value) {
    return false
  }

  /*
   * Cloudinary image.
   */
  if (
    isCloudinaryImageUrl(value)
  ) {
    return deleteImageByUrl(value)
  }

  /*
   * Legacy local image references.
   *
   * Only used for cleanup/migration.
   */
  if (
    value.startsWith('/uploads/')
  ) {
    const relative =
      value.replace(/^\//, '')

    const absolute =
      path.resolve(
        projectRoot,
        relative
      )

    const uploadsRoot =
      path.resolve(
        projectRoot,
        'uploads'
      ) + path.sep

    /*
     * Prevent path traversal.
     */
    if (
      !absolute.startsWith(
        uploadsRoot
      )
    ) {
      return false
    }

    try {
      if (
        fs.existsSync(absolute)
      ) {
        fs.unlinkSync(
          absolute
        )
      }

      return true
    } catch (err) {
      console.warn(
        '[IMAGE] Failed to remove legacy local image:',
        value,
        err
      )

      return false
    }
  }

  return false
}