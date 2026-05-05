import { Router, Request, Response } from 'express'
import { db } from '../db'
import axios from 'axios'
import { config } from '../config'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  try {
    // Quick DB connectivity check
    db.prepare('SELECT 1 as ok').get()

    res.json({
      status: 'ok',
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
    })
  } catch (err) {
    console.error('[Health] Database check failed:', err)
    res.status(503).json({
      status: 'error',
      message: 'Database unavailable',
      timestamp: new Date().toISOString(),
    })
  }
})

router.get('/services', async (req, res) => {
  const services: Record<string, 'ok' | 'starting' | 'unavailable'> = {
    database: 'unavailable',
    clip: 'unavailable',
  }

  // Check DB
  try {
    db.prepare('SELECT 1').get()
    services.database = 'ok'
  } catch {}

  // Check CLIP service
  try {
    await axios.get(`${config.clipServiceUrl}/health`, { timeout: 3000 })
    services.clip = 'ok'
  } catch (err: any) {
    // If the service is reachable but returning errors, it's starting
    services.clip = err.code === 'ECONNREFUSED' ? 'unavailable' : 'starting'
  }

  const allOk = Object.values(services).every(s => s === 'ok')
  res.status(allOk ? 200 : 503).json({ services, timestamp: new Date().toISOString() })
})

export default router
