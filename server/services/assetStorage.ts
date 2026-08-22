import crypto from 'crypto'
import path from 'path'
import { URL } from 'url'
import { deleteImageByUrl, isCloudinaryImageUrl, uploadImage } from './imageStorage.js'

export type AssetResourceType = 'image' | 'raw' | 'video'
export interface StoredAsset { url: string; publicId: string; resourceType: AssetResourceType; fileType: string }

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}
function getConfig() {
  return {
    cloudName: requiredEnv('CLOUDINARY_CLOUD_NAME'),
    apiKey: requiredEnv('CLOUDINARY_API_KEY'),
    apiSecret: requiredEnv('CLOUDINARY_API_SECRET'),
    folder: (process.env.CLOUDINARY_FOLDER?.trim() || 'smartclass/images').replace(/^\/+|\/+$/g, ''),
  }
}
function sha1(value: string) { return crypto.createHash('sha1').update(value).digest('hex') }
function signature(params: Record<string,string>, apiSecret: string) {
  const serialized = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '').sort().map(k => `${k}=${params[k]}`).join('&')
  return sha1(`${serialized}${apiSecret}`)
}

function validateFileSignature(buffer: Buffer, mime: string, originalName: string) {
  const lower = originalName.toLowerCase()
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
    if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Invalid PDF file.')
    return
  }
  if (mime === 'application/msword') {
    if (!(buffer.subarray(0, 8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])))) throw new Error('Invalid legacy Office document.')
    return
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    if (buffer.subarray(0, 2).toString('hex') !== '504b') throw new Error('Invalid Office document.')
    return
  }
}

function classifyResourceType(mime: string): AssetResourceType {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'video'
  return 'raw'
}
function extension(originalName: string, mime: string) {
  const ext = path.extname(originalName || '').toLowerCase()
  if (ext) return ext
  const map: Record<string,string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  }
  return map[mime] || ''
}

async function uploadNonImage(buffer: Buffer, originalName: string, mime: string, maxBytes: number): Promise<StoredAsset> {
  if (!buffer?.length) throw new Error('Uploaded file is empty.')
  if (buffer.length > maxBytes) throw new Error(`File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`)
  validateFileSignature(buffer, mime, originalName)
  const config = getConfig()
  const resourceType = classifyResourceType(mime)
  const targetFolder = `${config.folder}/files`
  const publicId = `${crypto.randomUUID()}${resourceType === 'raw' ? extension(originalName, mime) : ''}`
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const params: Record<string,string> = { folder: targetFolder, public_id: publicId, timestamp }
  const form = new FormData()
  const bytes = new Uint8Array(buffer.length); bytes.set(buffer)
  form.append('file', new Blob([bytes], { type: mime || 'application/octet-stream' }), originalName || `file${extension(originalName, mime)}`)
  for (const [k,v] of Object.entries(params)) form.append(k,v)
  form.append('api_key', config.apiKey)
  form.append('signature', signature(params, config.apiSecret))
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/upload`, { method:'POST', body:form })
  if (!response.ok) { const text=await response.text().catch(()=>'' ); throw new Error(`Cloudinary upload failed (${response.status}): ${text.slice(0,500)}`) }
  const result=await response.json() as { secure_url?:string; public_id?:string }
  if (!result.secure_url || !result.public_id) throw new Error('Cloudinary returned an incomplete upload response.')
  return { url:result.secure_url, publicId:result.public_id, resourceType, fileType:mime || 'application/octet-stream' }
}

export async function uploadAsset(params:{ buffer:Buffer; originalName:string; mimeType:string; folder:'announcements'|'presentation'; maxBytes?:number }):Promise<StoredAsset> {
  const maxBytes=params.maxBytes ?? 50*1024*1024
  if (params.mimeType.startsWith('image/')) {
    const stored=await uploadImage({ buffer:params.buffer, folder: params.folder === 'announcements' ? 'announcements' : 'other', claimedMimeType:params.mimeType, maxBytes })
    return { url:stored.url, publicId:stored.publicId, resourceType:'image', fileType:params.mimeType }
  }
  return uploadNonImage(params.buffer, params.originalName, params.mimeType, maxBytes)
}

function parseCloudinaryUrl(value:string) {
  const url=new URL(value)
  if (url.hostname !== 'res.cloudinary.com') return null
  const parts=url.pathname.split('/').filter(Boolean)
  const uploadIndex=parts.indexOf('upload')
  if (uploadIndex < 1) return null
  const resourceType=parts[uploadIndex-1] as AssetResourceType
  if (!['image','raw','video'].includes(resourceType)) return null
  let publicParts=parts.slice(uploadIndex+1)
  if (publicParts[0] && /^v\d+$/.test(publicParts[0])) publicParts=publicParts.slice(1)
  if (!publicParts.length) return null
  const publicIdWithExt=publicParts.join('/')
  const publicId=(resourceType==='image' ? publicIdWithExt.replace(/\.[^./]+$/,'') : publicIdWithExt)
  return { resourceType, publicId }
}
export async function deleteAssetByUrl(value?:string|null) {
  if (!value) return false
  if (isCloudinaryImageUrl(value)) { await deleteImageByUrl(value); return true }
  const parsed=parseCloudinaryUrl(value); if (!parsed) return false
  const config=getConfig(); const timestamp=Math.floor(Date.now()/1000).toString(); const params={public_id:parsed.publicId,timestamp}
  const form=new URLSearchParams(); form.set('public_id',parsed.publicId); form.set('timestamp',timestamp); form.set('api_key',config.apiKey); form.set('signature',signature(params,config.apiSecret))
  const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${parsed.resourceType}/destroy`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()})
  if (!response.ok) { const text=await response.text().catch(()=>'' ); throw new Error(`Cloudinary delete failed (${response.status}): ${text.slice(0,500)}`) }
  return true
}
export function isCloudinaryAssetUrl(value?:string|null){ if(!value)return false; try{return !!parseCloudinaryUrl(value)}catch{return false} }
