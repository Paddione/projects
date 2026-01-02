import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'path'

// Type for mock API data
interface MockApiData {
  questionSets: Array<{
    id: number
    name: string
    description: string
    category: string
    difficulty: string
    is_active: boolean
    is_public: boolean
    created_at: string
    updated_at: string
  }>
  questions: Array<{
    id: number
    question_set_id: number
    question_text: string
    answers: string[]
    explanation: string
    difficulty: number
    created_at: string
    updated_at: string
  }>
  users: unknown[]
  nextId: number
}

// Mock API middleware for test mode
function mockApiMiddleware() {
  return {
    name: 'mock-api',
    configureServer(server: any) {
      // Frontend log sink: write dev logs to logs/frontend/dev.log
      server.middlewares.use('/__frontend-log', (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next()
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const fs = require('fs') as typeof import('fs')
            const path = require('path') as typeof import('path')
            const base = path.resolve(process.cwd(), 'logs', 'frontend')
            fs.mkdirSync(base, { recursive: true })
            const payload = body || '{}'
            fs.appendFile(path.join(base, 'dev.log'), payload + '\n', () => { })
          } catch { }
          res.statusCode = 204
          res.end()
        })
      })
      server.middlewares.use('/api', (req: any, res: any, next: any) => {
        // Only handle in test mode
        if (process.env.VITE_TEST_MODE !== 'true') {
          return next()
        }

        res.setHeader('Content-Type', 'application/json')

        const url = new URL(req.url, 'http://localhost')
        const method = req.method.toUpperCase()

        // Mock data storage (simple in-memory store)
        if (!(global as any).mockApiData) {
          (global as any).mockApiData = {
            questionSets: [],
            questions: [],
            users: [],
            nextId: 1
          }
        }

        const mockData = (global as any).mockApiData as MockApiData

        try {
          // Handle question sets
          if (url.pathname === '/questions/sets' && method === 'POST') {
            let body = ''
            req.on('data', (chunk: Buffer) => { body += chunk.toString() })
            req.on('end', () => {
              const data = JSON.parse(body)
              const questionSet = {
                id: mockData.nextId++,
                name: data.name,
                description: data.description,
                category: data.category || 'General',
                difficulty: data.difficulty || 'medium',
                is_active: data.is_active !== undefined ? data.is_active : true,
                is_public: data.is_public !== undefined ? data.is_public : true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
              mockData.questionSets.push(questionSet)
              res.statusCode = 200
              res.end(JSON.stringify({ success: true, data: questionSet }))
            })
            return
          }

          if (url.pathname === '/questions' && method === 'POST') {
            let body = ''
            req.on('data', (chunk: Buffer) => { body += chunk.toString() })
            req.on('end', () => {
              const data = JSON.parse(body)
              const question = {
                id: mockData.nextId++,
                question_set_id: data.question_set_id,
                question_text: data.question_text,
                answers: data.answers,
                explanation: data.explanation,
                difficulty: data.difficulty || 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
              mockData.questions.push(question)
              res.statusCode = 200
              res.end(JSON.stringify({ success: true, data: question }))
            })
            return
          }

          if (url.pathname === '/questions/sets' && url.searchParams.has('limit') && method === 'GET') {
            const limit = parseInt(url.searchParams.get('limit') || '10', 10)
            const offset = parseInt(url.searchParams.get('offset') || '0', 10)
            const sort = url.searchParams.get('sort') || 'created_at'
            const dir = url.searchParams.get('dir') || 'DESC'

            const items = mockData.questionSets.slice(offset, offset + limit)
            const total = mockData.questionSets.length

            res.statusCode = 200
            res.end(JSON.stringify({
              success: true,
              data: {
                items,
                limit,
                offset,
                sort: { by: sort, dir },
                total
              }
            }))
            return
          }

          if (url.pathname.match(/^\/questions\/sets\/\d+\/questions/) && method === 'GET') {
            const setId = parseInt(url.pathname.split('/')[3], 10)
            const limit = parseInt(url.searchParams.get('limit') || '10', 10)
            const offset = parseInt(url.searchParams.get('offset') || '0', 10)
            const sort = url.searchParams.get('sort') || 'created_at'
            const dir = url.searchParams.get('dir') || 'DESC'

            const setQuestions = mockData.questions.filter((q: { question_set_id: number }) => q.question_set_id === setId)
            const items = setQuestions.slice(offset, offset + limit)
            const total = setQuestions.length

            res.statusCode = 200
            res.end(JSON.stringify({
              success: true,
              data: {
                items,
                limit,
                offset,
                sort: { by: sort, dir },
                total
              }
            }))
            return
          }

          if (url.pathname === '/questions/search' && method === 'GET') {
            const q = url.searchParams.get('q') || ''
            const limit = parseInt(url.searchParams.get('limit') || '10', 10)
            const offset = parseInt(url.searchParams.get('offset') || '0', 10)
            const sort = url.searchParams.get('sort') || 'created_at'
            const dir = url.searchParams.get('dir') || 'DESC'

            // Simple search - match question text
            const filteredQuestions = mockData.questions.filter((question: { question_text: string }) => {
              const questionText = typeof question.question_text === 'object'
                ? (question.question_text as any).en || (question.question_text as any).de || ''
                : question.question_text || ''
              return questionText.toLowerCase().includes(q.toLowerCase())
            })

            const total = filteredQuestions.length
            const items = filteredQuestions.slice(offset, offset + limit)

            res.statusCode = 200
            res.end(JSON.stringify({
              success: true,
              data: {
                items,
                limit,
                offset,
                sort: { by: sort, dir },
                total
              }
            }))
            return
          }

          // Health check endpoint
          if (url.pathname === '/health' && method === 'GET') {
            res.statusCode = 200
            res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }))
            return
          }

          // Database health check endpoint  
          if (url.pathname === '/health/database' && method === 'GET') {
            res.statusCode = 200
            res.end(JSON.stringify({ status: 'healthy', database: 'mock' }))
            return
          }

          // Default fallback for other endpoints
          res.statusCode = 200
          res.end(JSON.stringify({ success: true, data: null, message: 'Mock API response' }))

        } catch (error) {
          console.error('Mock API error:', error)
          res.statusCode = 500
          res.end(JSON.stringify({ success: false, error: 'Mock API error' }))
        }
      })
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mockApiMiddleware()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    },
  },
  cacheDir: process.env.VITE_CACHE_DIR || '/tmp/.vite',
  server: {
    port: 3000,
    host: true,
    proxy: process.env.VITE_TEST_MODE === 'true' ? undefined : {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      // Note: Do not proxy '/admin' so React router can handle the admin panel route
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: [
      'l2p.korczewski.de',
      'localhost',
      '127.0.0.1',
    ],
  },
})
