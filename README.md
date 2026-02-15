# 音声チャットアプリ (voice-chat-app)

## 📋 プロジェクト概要

Cloudflare Workers AIとRealtime Agentsを活用したリアルタイム音声チャットアプリケーション。2つのモードで動作します：

### 🎯 2つのモード

#### 1. **Realtimeモード**（低遅延・WebRTC）
- Cloudflare Realtime Agents SDKを使用
- WebRTC + RealtimeKit で超低遅延（<800ms）
- STT: Deepgram
- LLM: Cloudflare Workers AI / OpenAI（選択可能）
- TTS: ElevenLabs
- 用途: 本番環境・高品質な音声チャット

#### 2. **HTTPモード**（シンプル・完全無料）
- シンプルなHTTP API実装
- WebRTC不要・セットアップ簡単
- STT: Cloudflare Workers AI
- LLM: Cloudflare Workers AI / OpenAI（選択可能）
- TTS: Cloudflare Workers AI
- 用途: 動作確認・開発環境・Cloudflareのみで完結

## ✨ 主な機能

### 共通機能
- **RAG（Retrieval-Augmented Generation）**: Vectorizeを使った文書検索
- **会話履歴管理**: D1データベースで永続化
- **管理画面**: ドキュメントアップロード、音声プロファイル管理
- **マルチプロバイダー対応**: Cloudflare / OpenAI / Deepgram / ElevenLabsから選択可能

### Realtimeモード限定
- 双方向リアルタイム通信
- 割り込み対応
- 複数参加者対応

### HTTPモード限定
- APIキー不要で動作確認可能
- 実装がシンプル
- セットアップが簡単
- **D-IDリップシンク動画生成対応**（オプション）

## 🛠️ 技術スタック

### バックエンド
- **Hono Framework**: 軽量高速なWebフレームワーク
- **Cloudflare Workers**: エッジランタイム
- **Cloudflare D1**: SQLiteベースのグローバル分散DB
- **Cloudflare Vectorize**: ベクトルデータベース
- **Cloudflare R2**: オブジェクトストレージ
- **Cloudflare Workers AI**: STT/LLM/TTS

### フロントエンド
- **Vanilla JavaScript**: シンプルなフロントエンド
- **TailwindCSS**: ユーティリティファーストCSS
- **Font Awesome**: アイコン

### AI モデル

#### STT（音声認識）
**Cloudflare Workers AI:**
- `@cf/openai/whisper-large-v3-turbo` （推奨・日本語対応）
- `@cf/openai/whisper` （多言語）
- `@cf/deepgram/nova-3` （高性能）

**Deepgram:**
- Nova 2/3 （Realtimeモード）

#### LLM（応答生成）
**Cloudflare Workers AI:**
- `@cf/openai/gpt-oss-120b` （推奨・OpenAI最新）
- `@cf/meta/llama-4-scout-17b-16e-instruct` （2025年最新・マルチモーダル）
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast` （高品質・高速）
- `@cf/zai-org/glm-4.7-flash` （100+言語・131K context）
- `@cf/qwen/qwen2.5-72b-instruct-fp8` （日本語特化・32K context）

**OpenAI:**
- GPT-4o-mini

#### TTS（音声合成）
**Cloudflare Workers AI:**
- `@cf/deepgram/aura-2-en` （推奨・英語）
- `@cf/deepgram/aura-1` （英語）
- `@cf/myshell-ai/melotts` （多言語）

**ElevenLabs:**
- ボイスクローン対応（Realtimeモード）

#### Video（リップシンク動画）
**D-ID:**
- 音声からリアルなアバター動画生成
- HTTPモードでオプション有効化可能
- カスタムアバター画像対応

## 📦 プロジェクト構成

```
voice-chat-app/
├── src/
│   ├── index.tsx              # メインアプリケーション
│   ├── agents/
│   │   └── voice-chat-agent.ts # Realtime Agent（Durable Object）
│   ├── components/
│   │   ├── rag-text-processor.ts # RAG + LLM処理
│   │   ├── cloudflare-stt.ts    # Cloudflare STT（開発中）
│   │   └── cloudflare-tts.ts    # Cloudflare TTS（開発中）
│   ├── routes/
│   │   ├── admin.ts             # 管理API
│   │   └── chat-http.ts         # HTTP Chat API
│   ├── services/
│   │   ├── openai.ts            # OpenAI API
│   │   ├── cloudflare-llm.ts    # Cloudflare LLM
│   │   ├── elevenlabs.ts        # ElevenLabs API
│   │   ├── rag.ts               # RAGサービス
│   │   └── did.ts               # D-ID API（リップシンク）
│   └── types/
│       └── index.ts             # 型定義
├── public/static/
│   ├── realtime-chat.js         # Realtimeモード UI
│   ├── http-chat.js             # HTTPモード UI
│   └── admin.js                 # 管理画面 UI
├── migrations/
│   └── 0001_initial_schema.sql  # D1スキーマ
├── wrangler.jsonc               # Cloudflare設定
├── package.json
└── README.md
```

## 🚀 セットアップ

### 1. Cloudflare APIキー設定

**Account IDとAPI Tokenを取得:**
1. https://dash.cloudflare.com/ にログイン
2. Account ID をコピー
3. https://dash.cloudflare.com/profile/api-tokens で API Token作成
4. 必要な権限:
   - Workers AI: Edit
   - Workers Scripts: Edit
   - D1: Edit
   - Vectorize: Edit
   - R2: Edit
   - Durable Objects: Edit
   - Cloudflare Pages: Edit

### 2. 環境変数設定

`.dev.vars` ファイルを作成:

```env
# 必須: Cloudflare
ACCOUNT_ID=your-account-id
API_TOKEN=your-api-token

# オプション: 外部サービス
OPENAI_API_KEY=sk-...          # OpenAI LLM使用時
DEEPGRAM_API_KEY=...           # Deepgram STT使用時（Realtimeモード）
ELEVENLABS_API_KEY=...         # ElevenLabs TTS使用時（Realtimeモード）
```

### 3. Cloudflareリソース作成

```bash
# D1データベース
npx wrangler d1 create webapp-production

# Vectorizeインデックス
npx wrangler vectorize create voice-chat-rag --dimensions=1536 --metric=cosine

# R2バケット
npx wrangler r2 bucket create voice-chat-storage

# database_idをwrangler.jsoncに設定
# "database_id": "作成されたID"
```

### 4. ローカル開発

```bash
# 依存関係インストール
npm install

# D1マイグレーション
npm run db:migrate:local

# ビルド
npm run build

# 開発サーバー起動
npm run dev:sandbox
```

### 5. デプロイ

```bash
# 本番環境D1マイグレーション
npm run db:migrate:prod

# Cloudflare Pagesにデプロイ
npm run deploy
```

## 📖 使い方

### HTTPモード（推奨・初回）

1. http://localhost:3000/http-chat にアクセス
2. STT/LLM/TTS を Cloudflare Workers AI に設定
3. 「録音開始」ボタンをクリック
4. 話す → 「停止」→ AI応答を待つ
5. **APIキー不要で動作確認可能！**

### Realtimeモード（本番環境）

1. http://localhost:3000/ にアクセス
2. STT/LLM/TTS プロバイダーを選択
3. https://dash.realtime.cloudflare.com/ で Meeting作成
4. Meeting IDとAuth Tokenを入力
5. AIエージェント起動
6. 別タブでミーティングに参加

### 管理画面

1. http://localhost:3000/admin にアクセス
2. 学習データ（テキストファイル）をアップロード
3. 音声プロファイル（ElevenLabs Voice ID）を登録

## 🎯 推奨構成

### 完全無料構成（HTTPモード）
```
STT: Cloudflare Workers AI (Whisper Large v3 Turbo)
LLM: Cloudflare Workers AI (GPT OSS 120B)
TTS: Cloudflare Workers AI (Aura 2 EN)
必要なAPIキー: Cloudflare のみ
```

### 高品質構成（Realtimeモード）
```
STT: Deepgram (Nova 3)
LLM: Cloudflare Workers AI (GPT OSS 120B)
TTS: ElevenLabs (ボイスクローン)
必要なAPIキー: Cloudflare + Deepgram + ElevenLabs
```

## 🔗 リンク

- **GitHub**: https://github.com/umemak/voice-chat-app
- **Cloudflare Workers AI**: https://developers.cloudflare.com/workers-ai/
- **Cloudflare Realtime**: https://developers.cloudflare.com/realtime/
- **RealtimeKit**: https://realtime.cloudflare.com/

## 📝 ライセンス

MIT License

## 🤝 コントリビューション

Issues・Pull Requestsを歓迎します！
