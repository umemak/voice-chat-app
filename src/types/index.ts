// Cloudflare bindings type
export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  VECTORIZE: VectorizeIndex;
  VOICE_CHAT_AGENT: DurableObjectNamespace;
  AI: any; // Workers AI binding
  OPENAI_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  DEEPGRAM_API_KEY: string;
  DID_API_KEY: string;
  ACCOUNT_ID: string;
  API_TOKEN: string;
}

// TTS Provider types
export type TTSProvider = 'cloudflare' | 'elevenlabs';

// STT Provider types
export type STTProvider = 'cloudflare' | 'deepgram';

// Cloudflare Workers AI TTS Models
export type CloudflareTTSModel = 
  | '@cf/deepgram/aura-1'           // English (default)
  | '@cf/deepgram/aura-2-en'        // English (v2)
  | '@cf/deepgram/aura-2-es'        // Spanish
  | '@cf/myshell-ai/melotts';       // MeloTTS (multilingual)

// Cloudflare Workers AI STT Models
export type CloudflareSTTModel =
  | '@cf/openai/whisper'                    // Whisper (multilingual, Japanese supported)
  | '@cf/openai/whisper-large-v3-turbo'     // Whisper Large v3 Turbo (best quality, Japanese)
  | '@cf/deepgram/nova-3'                   // Deepgram Nova 3 (best performance)
  | '@cf/deepgram/flux'                     // Deepgram Flux (experimental)
  | '@cf/openai/whisper-tiny-en';           // Whisper Tiny (English only, fast)

export interface CloudflareTTSModelInfo {
  id: CloudflareTTSModel;
  name: string;
  language: string;
  description: string;
}

export interface CloudflareSTTModelInfo {
  id: CloudflareSTTModel;
  name: string;
  language: string;
  description: string;
  japaneseSupport: boolean;
}

export interface AgentInitOptions {
  agentId: string;
  meetingId: string;
  authToken: string;
  workerUrl: string;
  accountId: string;
  apiToken: string;
  voiceId?: string;
  ttsProvider?: TTSProvider;
  cloudflareTTSModel?: CloudflareTTSModel;
  sttProvider?: STTProvider;
  cloudflareSTTModel?: CloudflareSTTModel;
}

// Document types
export interface Document {
  id: number;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  r2_key: string;
  uploaded_at: string;
  processed: boolean;
  processed_at?: string;
  metadata?: string;
}

export interface DocumentChunk {
  id: number;
  document_id: number;
  chunk_index: number;
  content: string;
  vector_id?: string;
  created_at: string;
}

// Conversation types
export interface Conversation {
  id: number;
  session_id: string;
  started_at: string;
  ended_at?: string;
  metadata?: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  audio_url?: string;
  video_url?: string;
  created_at: string;
  metadata?: string;
}

// Voice profile types
export interface VoiceProfile {
  id: number;
  name: string;
  voice_id: string;
  description?: string;
  created_at: string;
  is_active: boolean;
}

// API Request/Response types
export interface UploadFileRequest {
  file: File;
  metadata?: Record<string, any>;
}

export interface UploadFileResponse {
  success: boolean;
  document?: Document;
  error?: string;
}

export interface ChatRequest {
  session_id: string;
  audio_data?: string; // base64 encoded audio
  text?: string; // direct text input
  voice_profile_id?: number;
}

export interface ChatResponse {
  success: boolean;
  message?: Message;
  audio_url?: string;
  video_url?: string;
  error?: string;
}

export interface RAGSearchResult {
  chunks: Array<{
    content: string;
    document_id: number;
    filename: string;
    score: number;
  }>;
}

// External API types
export interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface ElevenLabsTTSResponse {
  audio_url: string;
  voice_id: string;
}

export interface DIDVideoResponse {
  id: string;
  status: string;
  result_url?: string;
}
