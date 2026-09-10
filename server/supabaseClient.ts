import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

let prismaInstance: any = null
let poolInstance: pg.Pool | null = null

export function getPrismaClient(): PrismaClient | null {
  if (prismaInstance) return prismaInstance
  if (!process.env.DATABASE_URL) return null

  try {
    const connectionString = process.env.DATABASE_URL
    poolInstance = new pg.Pool({
      connectionString,
      ssl: connectionString.includes('supabase.co') || connectionString.includes('sslmode=') 
        ? { rejectUnauthorized: false } 
        : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    const adapter = new PrismaPg(poolInstance)
    prismaInstance = new PrismaClient({ adapter })
    console.log('🔌 Initialized Supabase PrismaPg adapter pool')
    return prismaInstance
  } catch (err) {
    console.error('❌ Failed to initialize Supabase Prisma adapter:', err)
    return null
  }
}

export const directPrisma: any = new Proxy({}, {
  get: (_target, prop: string) => {
    const client = getPrismaClient()
    if (!client) {
      throw new Error(`Prisma client not connected (DATABASE_URL missing or invalid). Attempted to access property '${prop}'`)
    }
    return (client as any)[prop]
  }
})
