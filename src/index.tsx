import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings } from './types'
import adminRoutes from './routes/admin'
import chatHttpRoutes from './routes/chat-http'
import { VoiceChatAgent } from './agents/voice-chat-agent'

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Mount API routes
app.route('/api/admin', adminRoutes)
app.route('/api/chat-http', chatHttpRoutes)

// Realtime Agent routes
app.post('/api/agent/init', async (c) => {
  try {
    const { 
      meetingId, 
      authToken, 
      voiceId, 
      ttsProvider, 
      cloudflareTTSModel,
      sttProvider,
      cloudflareSTTModel,
      llmProvider,
      cloudflareLLMModel
    } = await c.req.json<{
      meetingId: string;
      authToken: string;
      voiceId?: string;
      ttsProvider?: 'cloudflare' | 'elevenlabs';
      cloudflareTTSModel?: string;
      sttProvider?: 'cloudflare' | 'deepgram';
      cloudflareSTTModel?: string;
      llmProvider?: 'cloudflare' | 'openai';
      cloudflareLLMModel?: string;
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
      cloudflareTTSModel || '@cf/deepgram/aura-2-en',
      sttProvider || 'cloudflare',
      cloudflareSTTModel || '@cf/openai/whisper-large-v3-turbo',
      llmProvider || 'cloudflare',
      cloudflareLLMModel || '@cf/openai/gpt-oss-120b'
    );

    return c.json({ 
      success: true, 
      agentId, 
      sttProvider: sttProvider || 'cloudflare',
      cloudflareSTTModel: cloudflareSTTModel || '@cf/openai/whisper-large-v3-turbo',
      llmProvider: llmProvider || 'cloudflare',
      cloudflareLLMModel: cloudflareLLMModel || '@cf/openai/gpt-oss-120b',
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
                        <a href="/" class="hover:underline font-bold">Realtimeモード</a>
                        <a href="/http-chat" class="hover:underline">HTTPモード</a>
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
                            <label class="block text-sm font-medium mb-2">STTプロバイダー（音声認識）</label>
                            <select id="stt-provider-select" class="w-full px-3 py-2 border rounded-lg mb-3">
                              <option value="cloudflare">Cloudflare Workers AI（無料・APIキー不要）</option>
                              <option value="deepgram">Deepgram（高品質・要APIキー）</option>
                            </select>
                        </div>

                        <div id="cloudflare-stt-model-section" class="mb-4">
                            <label class="block text-sm font-medium mb-2">Cloudflare STTモデル</label>
                            <select id="cloudflare-stt-model-select" class="w-full px-3 py-2 border rounded-lg">
                              <option value="@cf/openai/whisper-large-v3-turbo">Whisper Large v3 Turbo（推奨・日本語対応）</option>
                              <option value="@cf/openai/whisper">Whisper（多言語・日本語対応）</option>
                              <option value="@cf/deepgram/nova-3">Deepgram Nova 3（高性能・日本語対応）</option>
                              <option value="@cf/deepgram/flux">Deepgram Flux（実験的）</option>
                              <option value="@cf/openai/whisper-tiny-en">Whisper Tiny（英語のみ・高速）</option>
                            </select>
                            <p class="text-xs text-gray-500 mt-1">
                              🇯🇵 日本語対応: Whisper系、Nova 3
                            </p>
                        </div>

                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2">LLMプロバイダー（AI応答生成）</label>
                            <select id="llm-provider-select" class="w-full px-3 py-2 border rounded-lg mb-3">
                              <option value="cloudflare">Cloudflare Workers AI（無料・APIキー不要）</option>
                              <option value="openai">OpenAI GPT-4o-mini（高品質・要APIキー）</option>
                            </select>
                        </div>

                        <div id="cloudflare-llm-model-section" class="mb-4">
                            <label class="block text-sm font-medium mb-2">Cloudflare LLMモデル</label>
                            <select id="cloudflare-llm-model-select" class="w-full px-3 py-2 border rounded-lg">
                              <option value="@cf/openai/gpt-oss-120b">GPT OSS 120B（推奨・OpenAI最新）</option>
                              <option value="@cf/meta/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B（2025年最新・マルチモーダル）</option>
                              <option value="@cf/meta/llama-3.3-70b-instruct-fp8-fast">Llama 3.3 70B（高品質・高速）</option>
                              <option value="@cf/zai-org/glm-4.7-flash">GLM 4.7 Flash（100+言語対応）</option>
                              <option value="@cf/meta/llama-3.1-8b-instruct-fast">Llama 3.1 8B（軽量・高速）</option>
                              <option value="@cf/qwen/qwen2.5-72b-instruct-fp8">Qwen 2.5 72B（日本語特化・32K context）</option>
                            </select>
                            <p class="text-xs text-gray-500 mt-1">
                              🇯🇵 全モデル日本語対応済み
                            </p>
                        </div>
                            </select>
                            <p class="text-xs text-gray-500 mt-1">
                              🇯🇵 すべて日本語対応
                            </p>
                        </div>

                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2">TTSプロバイダー（音声合成）</label>
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

// HTTP Chat page (Simple mode - no WebRTC)
app.get('/http-chat', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>音声チャット（HTTPモード） - voice-chat-app</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex flex-col">
            <header class="bg-blue-600 text-white p-4 shadow-md">
                <div class="container mx-auto flex justify-between items-center">
                    <h1 class="text-2xl font-bold">
                        <i class="fas fa-comments mr-2"></i>
                        音声チャット（HTTPモード）
                    </h1>
                    <nav class="space-x-4">
                        <a href="/" class="hover:underline">Realtimeモード</a>
                        <a href="/http-chat" class="hover:underline font-bold">HTTPモード</a>
                        <a href="/admin" class="hover:underline">管理画面</a>
                    </nav>
                </div>
            </header>
            
            <main class="flex-1 container mx-auto p-6">
                <div class="max-w-4xl mx-auto space-y-6">
                    <!-- Status -->
                    <div class="bg-white rounded-lg shadow-lg p-4">
                        <div id="http-connection-status" class="flex items-center">
                            <i class="fas fa-circle text-green-500 mr-2"></i>
                            <span id="http-status-text" class="text-sm font-medium">準備完了</span>
                        </div>
                    </div>

                    <!-- Settings -->
                    <div class="bg-white rounded-lg shadow-lg p-6">
                        <h2 class="text-xl font-bold mb-4">
                            <i class="fas fa-cog mr-2"></i>
                            設定
                        </h2>

                        <!-- STT Settings -->
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2">STT（音声認識）</label>
                            <select id="http-stt-provider" class="w-full px-3 py-2 border rounded-lg mb-2">
                              <option value="cloudflare">Cloudflare Workers AI（無料）</option>
                              <option value="deepgram" disabled>Deepgram（準備中）</option>
                            </select>
                        </div>

                        <div id="http-stt-model-section" class="mb-4">
                            <select id="http-stt-model" class="w-full px-3 py-2 border rounded-lg">
                              <option value="@cf/openai/whisper-large-v3-turbo">Whisper Large v3 Turbo（推奨）</option>
                              <option value="@cf/openai/whisper">Whisper</option>
                              <option value="@cf/deepgram/nova-3">Deepgram Nova 3</option>
                            </select>
                        </div>

                        <!-- LLM Settings -->
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2">LLM（応答生成）</label>
                            <select id="http-llm-provider" class="w-full px-3 py-2 border rounded-lg mb-2">
                              <option value="cloudflare">Cloudflare Workers AI（無料）</option>
                              <option value="openai">OpenAI GPT-4o-mini</option>
                            </select>
                        </div>

                        <div id="http-llm-model-section" class="mb-4">
                            <select id="http-llm-model" class="w-full px-3 py-2 border rounded-lg">
                              <option value="@cf/openai/gpt-oss-120b">GPT OSS 120B（推奨）</option>
                              <option value="@cf/meta/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B</option>
                              <option value="@cf/meta/llama-3.3-70b-instruct-fp8-fast">Llama 3.3 70B</option>
                              <option value="@cf/zai-org/glm-4.7-flash">GLM 4.7 Flash</option>
                              <option value="@cf/qwen/qwen2.5-72b-instruct-fp8">Qwen 2.5 72B</option>
                            </select>
                        </div>

                        <!-- TTS Settings -->
                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-2">TTS（音声合成）</label>
                            <select id="http-tts-provider" class="w-full px-3 py-2 border rounded-lg mb-2">
                              <option value="cloudflare">Cloudflare Workers AI（無料）</option>
                              <option value="elevenlabs" disabled>ElevenLabs（準備中）</option>
                            </select>
                        </div>

                        <div id="http-tts-model-section" class="mb-4">
                            <select id="http-tts-model" class="w-full px-3 py-2 border rounded-lg">
                              <option value="@cf/deepgram/aura-2-en">Deepgram Aura 2 EN（推奨）</option>
                              <option value="@cf/deepgram/aura-1">Deepgram Aura 1 EN</option>
                              <option value="@cf/myshell-ai/melotts">MeloTTS</option>
                            </select>
                        </div>

                        <!-- D-ID Video Settings -->
                        <div class="mb-4 border-t pt-4">
                            <label class="flex items-center mb-2">
                                <input type="checkbox" id="enable-video" class="mr-2">
                                <span class="text-sm font-medium">
                                    <i class="fas fa-video mr-1"></i>
                                    D-ID リップシンク動画を生成
                                </span>
                            </label>
                            <div id="avatar-url-section" class="hidden">
                                <input type="text" 
                                       id="avatar-url" 
                                       placeholder="アバター画像URL（任意）" 
                                       class="w-full px-3 py-2 border rounded-lg text-sm">
                                <p class="text-xs text-gray-500 mt-1">
                                    未入力の場合はデフォルトアバターを使用
                                </p>
                            </div>
                        </div>

                        <div class="flex space-x-2">
                            <button id="record-btn" 
                                    class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                                <i class="fas fa-microphone mr-2"></i>
                                録音開始
                            </button>
                            <button id="clear-chat-btn" 
                                    class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold">
                                <i class="fas fa-trash mr-2"></i>
                                クリア
                            </button>
                        </div>
                    </div>

                    <!-- Chat Messages -->
                    <div class="bg-white rounded-lg shadow-lg p-6">
                        <h2 class="text-xl font-bold mb-4">
                            <i class="fas fa-comment-dots mr-2"></i>
                            会話履歴
                        </h2>
                        <div id="messages-container" class="h-96 overflow-y-auto border rounded-lg p-4">
                            <!-- Messages will be added here -->
                        </div>
                    </div>

                    <!-- Info -->
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 class="font-bold text-blue-800 mb-2">
                            <i class="fas fa-info-circle mr-2"></i>
                            HTTPモードについて
                        </h3>
                        <ul class="list-disc list-inside space-y-1 text-sm text-blue-700">
                            <li>シンプルなHTTP API実装</li>
                            <li>WebRTC不要・セットアップ簡単</li>
                            <li>Cloudflare Workers AIのみで動作可能</li>
                            <li>ターンベース（順番に話す）</li>
                            <li>リアルタイム性はRealtimeモードより劣る</li>
                            <li><strong>D-ID連携:</strong> APIキー設定時は動画生成、未設定時は静止画表示</li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
        
        <script src="/static/http-chat.js"></script>
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
                        <a href="/" class="hover:underline">Realtimeモード</a>
                        <a href="/http-chat" class="hover:underline">HTTPモード</a>
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
