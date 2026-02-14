# 音声チャットアプリ

## プロジェクト概要

**名称**: 音声チャットアプリ（Voice Chat App）

**目標**: RAG技術を活用した音声対話型AIアシスタント

**主要機能**:
- 🎤 音声入力（Speech-to-Text: OpenAI Whisper）
- 📚 RAG（Retrieval-Augmented Generation: Cloudflare Vectorize）
- 🤖 AI応答生成（GPT-4o-mini）
- 🔊 音声出力（Text-to-Speech: ElevenLabs ボイスクローン対応）
- 🎬 リップシンク動画（D-ID）
- 📁 学習データ管理（PowerPoint、テキスト、PDF対応）

## 技術スタック

### バックエンド
- **Hono**: 軽量高速なWebフレームワーク
- **Cloudflare Workers**: エッジランタイム
- **Cloudflare Pages**: デプロイメントプラットフォーム

### データストレージ
- **Cloudflare D1**: SQLiteベースのデータベース（メタデータ管理）
- **Cloudflare R2**: S3互換オブジェクトストレージ（ファイル保存）
- **Cloudflare Vectorize**: ベクトルデータベース（RAG用）

### 外部APIサービス
- **OpenAI API**: Whisper（STT）、Embeddings、GPT-4o-mini
- **ElevenLabs API**: ボイスクローンTTS
- **D-ID API**: リップシンク動画生成

### フロントエンド
- **Vanilla JavaScript**: シンプルな実装
- **Tailwind CSS**: スタイリング
- **Font Awesome**: アイコン

## データアーキテクチャ

### データモデル

1. **documents**: アップロードされたファイルのメタデータ
   - id, filename, file_type, r2_key, processed, etc.

2. **document_chunks**: ドキュメントのチャンク（RAG用）
   - id, document_id, chunk_index, content, vector_id

3. **conversations**: 会話セッション
   - id, session_id, started_at, ended_at

4. **messages**: チャットメッセージ
   - id, conversation_id, role, content, audio_url, video_url

5. **voice_profiles**: 音声プロファイル（ElevenLabs）
   - id, name, voice_id, description, is_active

### データフロー

```
1. ユーザー音声入力
   ↓
2. OpenAI Whisper (STT)
   ↓
3. テキスト化 → Cloudflare Vectorize でRAG検索
   ↓
4. 関連ドキュメント取得 → GPT-4で応答生成
   ↓
5. ElevenLabs (TTS) → 音声ファイル生成 → R2保存
   ↓
6. D-ID → リップシンク動画生成
   ↓
7. フロントエンドに返却（音声+動画）
```

## セットアップ手順

### 1. Cloudflare APIキーの設定

Deploy タブで Cloudflare API キーを設定してください。

必要な権限:
- Cloudflare Pages: Edit
- D1: Edit
- R2: Edit
- Vectorize: Edit

### 2. 外部APIキーの準備

以下のAPIキーを取得してください：

- **OpenAI API Key**: https://platform.openai.com/api-keys
- **ElevenLabs API Key**: https://elevenlabs.io/
- **D-ID API Key**: https://studio.d-id.com/

### 3. ローカル開発用環境変数

`.dev.vars` ファイルを作成し、APIキーを設定：

```bash
cp .dev.vars.example .dev.vars
# .dev.vars を編集してAPIキーを入力
```

### 4. Cloudflareリソースの作成

```bash
# D1 データベース作成
npx wrangler d1 create webapp-production
# 出力されたdatabase_idをwrangler.jsonc に記入

# Vectorize インデックス作成
npx wrangler vectorize create voice-chat-rag --dimensions=1536 --metric=cosine

# R2 バケット作成
npx wrangler r2 bucket create voice-chat-storage
```

### 5. データベースマイグレーション

```bash
# ローカル環境でマイグレーション実行
npm run db:migrate:local
```

### 6. ビルドと起動

```bash
# ビルド
npm run build

# PM2で起動
pm2 start ecosystem.config.cjs

# 動作確認
npm test  # curl http://localhost:3000
```

## 使い方

### 管理画面（/admin）

1. **学習データのアップロード**
   - テキストファイル（.txt）を選択してアップロード
   - PowerPoint/PDFの場合は、テキスト抽出後に手動入力が必要

2. **音声プロファイルの登録**
   - ElevenLabsで作成したVoice IDを登録
   - 複数のボイスプロファイルを管理可能

### チャット画面（/）

1. **音声プロファイルを選択**
2. **入力方法を選択**
   - テキスト入力: 直接テキストで質問
   - 音声録音: マイクボタンを押して録音
3. **AIからの応答**
   - テキスト表示
   - 音声再生
   - リップシンク動画（生成に時間がかかる場合があります）

## デプロイ

### 本番環境へのデプロイ

```bash
# 本番D1マイグレーション
npm run db:migrate:prod

# 環境変数を設定（Cloudflare Pages）
npx wrangler pages secret put OPENAI_API_KEY --project-name webapp
npx wrangler pages secret put ELEVENLABS_API_KEY --project-name webapp
npx wrangler pages secret put DID_API_KEY --project-name webapp

# デプロイ
npm run deploy:prod
```

## 現在の状態

### ✅ 完了した機能
- プロジェクト初期化とGit設定
- データベーススキーマ設計
- バックエンドAPI実装（Hono routes）
- 外部APIサービスラッパー（OpenAI, ElevenLabs, D-ID）
- RAGサービス実装
- 管理画面UI（ファイルアップロード、音声プロファイル管理）
- チャットUI（音声録音、再生、リップシンク表示）

### ⚠️ 未実装・要対応
- Cloudflare APIキー設定（Deploy タブで設定が必要）
- Cloudflare リソース作成（D1, Vectorize, R2）
- ローカル環境での動作テスト
- PowerPoint/PDF テキスト抽出機能（現在は.txtのみ対応）
- R2の公開URL設定（D-ID用）
- エラーハンドリングの強化
- リアルタイム応答の最適化

### 🚀 推奨される次のステップ

1. **Deploy タブでCloudflare APIキーを設定**
2. **Cloudflare リソースを作成**（D1, Vectorize, R2）
3. **外部APIキーを.dev.varsに設定**
4. **ローカルでビルド＆テスト**
5. **PowerPoint/PDF処理機能の追加**（ライブラリ検討）
6. **本番環境へのデプロイとテスト**

## プロジェクト構成

```
webapp/
├── src/
│   ├── index.tsx           # メインアプリケーション
│   ├── types/
│   │   └── index.ts        # TypeScript型定義
│   ├── routes/
│   │   ├── admin.ts        # 管理画面API
│   │   └── chat.ts         # チャットAPI
│   └── services/
│       ├── openai.ts       # OpenAI API
│       ├── elevenlabs.ts   # ElevenLabs API
│       ├── did.ts          # D-ID API
│       └── rag.ts          # RAGサービス
├── public/
│   └── static/
│       ├── admin.js        # 管理画面UI
│       └── chat.js         # チャットUI
├── migrations/
│   └── 0001_initial_schema.sql
├── ecosystem.config.cjs    # PM2設定
├── wrangler.jsonc          # Cloudflare設定
├── package.json
└── README.md
```

## トラブルシューティング

### ポート3000が使用中
```bash
npm run clean-port
```

### ビルドエラー
```bash
rm -rf dist .wrangler node_modules
npm install
npm run build
```

### データベースリセット
```bash
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
```

## ライセンス

MIT

## 最終更新日

2026-02-14
