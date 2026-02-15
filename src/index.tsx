import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings } from './types'
import adminRoutes from './routes/admin'
import { VoiceChatAgent } from './agents/voice-chat-agent'

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Mount API routes
app.route('/api/admin', adminRoutes)

// Realtime Agent routes
app.post('/api/agent/init', async (c) => {
  try {
    const { meetingId, authToken, voiceId, ttsProvider, cloudflareTTSModel } = await c.req.json<{
      meetingId: string;
      authToken: string;
      voiceId?: string;
      ttsProvider?: 'cloudflare' | 'elevenlabs';
      cloudflareTTSModel?: string;
    }>();

    if (!meetingId || !authToken) {
      return c.json({ error: 'meetingId and authToken required' }, 400);
    }

    const agentId = meetingId;
    const agent = c.env.VOICE_CHAT_AGENT.idFromName(meetingId);
    const stub = c.env.VOICE_CHAT_AGENT.get(agent);

    const url = new URL(c.req.url);
    await stub.init(
      agentId,
      meetingId,
      authToken,
      url.host,
      c.env.ACCOUNT_ID,
      c.env.API_TOKEN,
      voiceId,
      ttsProvider || 'cloudflare',
      cloudflareTTSModel || '@cf/deepgram/aura-2-en'
    );

    return c.json({ 
      success: true, 
      agentId, 
      ttsProvider: ttsProvider || 'cloudflare',
      cloudflareTTSModel: cloudflareTTSModel || '@cf/deepgram/aura-2-en'
    });
  } catch (error) {
    console.error('Agent init error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Init failed' },
      500
    );
  }
});

app.post('/api/agent/deinit', async (c) => {
  try {
    const { meetingId } = await c.req.json<{ meetingId: string }>();

    if (!meetingId) {
      return c.json({ error: 'meetingId required' }, 400);
    }

    const agent = c.env.VOICE_CHAT_AGENT.idFromName(meetingId);
    const stub = c.env.VOICE_CHAT_AGENT.get(agent);
    await stub.deinit();

    return c.json({ success: true });
  } catch (error) {
    console.error('Agent deinit error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Deinit failed' },
      500
    );
  }
});

// Internal pipeline routing (required by Realtime Agents SDK)
app.all('/agentsInternal/*', async (c) => {
  const url = new URL(c.req.url);
  const meetingId = url.searchParams.get('meetingId');
  
  if (!meetingId) {
    return c.json({ error: 'meetingId required' }, 400);
  }

  const agent = c.env.VOICE_CHAT_AGENT.idFromName(meetingId);
  const stub = c.env.VOICE_CHAT_AGENT.get(agent);
  
  return stub.fetch(c.req.raw);
})

// Home page - RealtimeKit Voice Chat
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>音声チャットアプリ - Realtime Voice AI</title>
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
                        <a href="/" class="hover:underline font-bold">チャット</a>
                        <a href="/admin" class="hover:underline">管理画面</a>
                    </nav>
                </div>
            </header>
            
            <main class="flex-1 container mx-auto p-6">
                <div class="max-w-4xl mx-auto">
                    <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
                        <h2 class="text-xl font-bold mb-4">
                            <i class="fas fa-video mr-2"></i>
                            リアルタイム音声チャット
                        </h2>
                        
                        <div id="connection-status" class="mb-4 p-3 bg-gray-100 rounded-lg">
                            <p class="text-sm text-gray-600">
                                <i class="fas fa-circle text-gray-400 mr-2"></i>
                                <span id="status-text">未接続</span>
                            </p>
                        </div>

                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2">TTSプロバイダー</label>
                            <select id="tts-provider-select" class="w-full px-3 py-2 border rounded-lg mb-3">
                              <option value="cloudflare">Cloudflare Workers AI（無料・APIキー不要）</option>
                              <option value="elevenlabs">ElevenLabs（高品質・ボイスクローン対応）</option>
                            </select>
                        </div>

                        <div id="cloudflare-model-section" class="mb-4">
                            <label class="block text-sm font-medium mb-2">Cloudflare TTSモデル</label>
                            <select id="cloudflare-model-select" class="w-full px-3 py-2 border rounded-lg">
                              <option value="@cf/deepgram/aura-2-en">Deepgram Aura 2 - English（推奨）</option>
                              <option value="@cf/deepgram/aura-1">Deepgram Aura 1 - English</option>
                              <option value="@cf/deepgram/aura-2-es">Deepgram Aura 2 - Spanish</option>
                              <option value="@cf/myshell-ai/melotts">MeloTTS - Multilingual</option>
                            </select>
                            <p class="text-xs text-gray-500 mt-1">
                              ※ 日本語での質問でも、英語で応答されます
                            </p>
                        </div>

                        <div id="voice-profile-section" class="mb-4 hidden">
                            <label class="block text-sm font-medium mb-2">音声プロファイル（ElevenLabsのみ）</label>
                            <select id="voice-select" class="w-full px-3 py-2 border rounded-lg">
                              <option value="">デフォルト</option>
                            </select>
                        </div>

                        <div class="flex space-x-2">
                            <button id="connect-btn" 
                                    class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                                <i class="fas fa-phone mr-2"></i>
                                接続開始
                            </button>
                            <button id="disconnect-btn" 
                                    class="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold hidden">
                                <i class="fas fa-phone-slash mr-2"></i>
                                切断
                            </button>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow-lg p-6">
                        <h3 class="text-lg font-bold mb-4">使い方</h3>
                        <ol class="list-decimal list-inside space-y-2 text-gray-700">
                            <li><strong>TTSプロバイダーを選択</strong>
                              <ul class="list-disc list-inside ml-6 mt-1 text-sm">
                                <li><strong>Cloudflare Workers AI</strong>: 無料、APIキー不要（動作確認用）</li>
                                <li><strong>ElevenLabs</strong>: 高品質、ボイスクローン対応（要APIキー）</li>
                              </ul>
                            </li>
                            <li>音声プロファイルを選択（ElevenLabsの場合のみ）</li>
                            <li>「接続開始」ボタンをクリック</li>
                            <li>RealtimeKitのMeeting IDとAuth Tokenを入力</li>
                            <li>AIエージェントを起動</li>
                            <li>別のタブでミーティングに参加して話しかけてください</li>
                            <li>学習データは管理画面からアップロードできます</li>
                        </ol>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- RealtimeKit SDK will be loaded here -->
        <script src="/static/realtime-chat.js"></script>
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

// Export Durable Object class
export { VoiceChatAgent }
