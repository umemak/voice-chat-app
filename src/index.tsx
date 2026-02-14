import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings } from './types'
import adminRoutes from './routes/admin'
import chatRoutes from './routes/chat'

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Mount API routes
app.route('/api/admin', adminRoutes)
app.route('/api/chat', chatRoutes)

// Home page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>音声チャットアプリ</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex flex-col">
            <header class="bg-blue-600 text-white p-4 shadow-md">
                <div class="container mx-auto flex justify-between items-center">
                    <h1 class="text-2xl font-bold">
                        <i class="fas fa-microphone mr-2"></i>
                        音声チャットアプリ
                    </h1>
                    <nav class="space-x-4">
                        <a href="/" class="hover:underline">チャット</a>
                        <a href="/admin" class="hover:underline">管理画面</a>
                    </nav>
                </div>
            </header>
            
            <main class="flex-1 container mx-auto p-6">
                <div class="bg-white rounded-lg shadow-lg p-6">
                    <h2 class="text-xl font-bold mb-4">音声チャット</h2>
                    <div id="chat-container">
                        <!-- Chat UI will be loaded here -->
                        <p class="text-gray-500">チャットUIを読み込み中...</p>
                    </div>
                </div>
            </main>
        </div>
        
        <script src="/static/chat.js"></script>
    </body>
    </html>
  `)
})

// Admin page
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>管理画面 - 音声チャットアプリ</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex flex-col">
            <header class="bg-blue-600 text-white p-4 shadow-md">
                <div class="container mx-auto flex justify-between items-center">
                    <h1 class="text-2xl font-bold">
                        <i class="fas fa-cog mr-2"></i>
                        管理画面
                    </h1>
                    <nav class="space-x-4">
                        <a href="/" class="hover:underline">チャット</a>
                        <a href="/admin" class="hover:underline font-bold">管理画面</a>
                    </nav>
                </div>
            </header>
            
            <main class="flex-1 container mx-auto p-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Document Management -->
                    <div class="bg-white rounded-lg shadow-lg p-6">
                        <h2 class="text-xl font-bold mb-4">
                            <i class="fas fa-file-alt mr-2"></i>
                            学習データ管理
                        </h2>
                        <div id="document-manager">
                            <p class="text-gray-500">読み込み中...</p>
                        </div>
                    </div>
                    
                    <!-- Voice Profile Management -->
                    <div class="bg-white rounded-lg shadow-lg p-6">
                        <h2 class="text-xl font-bold mb-4">
                            <i class="fas fa-user-circle mr-2"></i>
                            音声プロファイル管理
                        </h2>
                        <div id="voice-manager">
                            <p class="text-gray-500">読み込み中...</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <script src="/static/admin.js"></script>
    </body>
    </html>
  `)
})

export default app
