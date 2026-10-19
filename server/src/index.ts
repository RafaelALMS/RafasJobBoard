import fs from 'node:fs'
import path from 'node:path'
import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { config } from './config.ts'
import { registerJobRoutes } from './routes/jobs.ts'
import { registerResumeRoutes } from './routes/resume.ts'

export async function buildApp() {
  const app = Fastify({ logger: false })

  await app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  })

  app.setErrorHandler((err: unknown, _req, reply) => {
    const e = err as { message?: string; statusCode?: number }
    const code = typeof e.statusCode === 'number' && e.statusCode >= 400 ? e.statusCode : 500
    if (code >= 500) console.error('[server]', err)
    reply.code(code).send({ error: e.message || 'Internal server error' })
  })

  await registerJobRoutes(app)
  await registerResumeRoutes(app)

  // Serve the built SPA when it exists (in dev Vite serves the UI instead)
  const indexHtml = path.join(config.clientDist, 'index.html')
  if (fs.existsSync(indexHtml)) {
    await app.register(fastifyStatic, { root: config.clientDist, prefix: '/' })
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) {
        reply.code(404).send({ error: 'Not found' })
        return
      }
      reply.sendFile('index.html')
    })
  } else {
    app.setNotFoundHandler((_req, reply) => {
      reply.code(404).send({ error: 'Not found' })
    })
  }

  return app
}

buildApp()
  .then(async (app) => {
    await app.listen({ host: config.host, port: config.port })
    const keys = [
      config.llm.key ? 'LLM' : null,
      config.embedding.key ? 'embeddings' : null,
    ].filter(Boolean)
    console.log(
      `JobMatch API → http://${config.host}:${config.port}` +
        (keys.length ? `  (${keys.join(' + ')} enabled)` : '  (local keyword scoring only)'),
    )
  })
  .catch((err) => {
    console.error('[server] failed to start:', err)
    process.exit(1)
  })
