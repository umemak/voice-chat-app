-- Documents table (uploaded files metadata)
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'pptx', 'txt', 'pdf', etc.
  file_size INTEGER NOT NULL,
  r2_key TEXT NOT NULL UNIQUE, -- R2 storage key
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed BOOLEAN DEFAULT 0, -- vectorization status
  processed_at DATETIME,
  metadata TEXT -- JSON string for additional metadata
);

-- Document chunks table (text chunks for RAG)
CREATE TABLE IF NOT EXISTS document_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  vector_id TEXT, -- Vectorize index ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Conversations table (chat history)
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  metadata TEXT -- JSON string for session metadata
);

-- Messages table (chat messages)
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL, -- 'user', 'assistant'
  content TEXT NOT NULL, -- text content
  audio_url TEXT, -- R2 URL for audio file
  video_url TEXT, -- D-ID video URL
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT, -- JSON string (STT confidence, etc.)
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Voice profiles table (ElevenLabs voice clones)
CREATE TABLE IF NOT EXISTS voice_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  voice_id TEXT NOT NULL UNIQUE, -- ElevenLabs voice ID
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents(processed);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_active ON voice_profiles(is_active);
