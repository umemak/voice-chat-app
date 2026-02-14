// Cloudflare bindings type
export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  VECTORIZE: VectorizeIndex;
  VOICE_CHAT_AGENT: DurableObjectNamespace;
  OPENAI_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  DEEPGRAM_API_KEY: string;
  DID_API_KEY: string;
  ACCOUNT_ID: string;
  API_TOKEN: string;
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
