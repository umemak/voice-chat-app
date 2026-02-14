# Cloudflare Realtime Agents 実装ガイド

## 🎯 アーキテクチャ概要

このプロジェクトは**Cloudflare Realtime Agents SDK**を使用して、超低遅延（<800ms）のリアルタイム音声AIアシスタントを実装しています。

### パイプライン構成

```
ユーザー（ブラウザ）
    ↓ WebRTC（RealtimeKit）
VoiceChatAgent（Durable Object）
    ├─ RealtimeKit Transport（音声入出力）
    ├─ Deepgram STT（音声→テキスト）
    ├─ RAG Text Processor
    │   ├─ Vectorize検索（関連文書）
    │   ├─ OpenAI GPT-4（応答生成）
    │   └─ D1（会話履歴保存）
    ├─ ElevenLabs TTS（テキスト→音声）
    └─ RealtimeKit Transport（音声出力）
        ↓ WebRTC
ユーザー（スピーカー）
```

## 🏗️ プロジェクト構造

```
webapp/
├── src/
│   ├── agents/
│   │   └── voice-chat-agent.ts      # メインエージェント（Durable Object）
│   ├── components/
│   │   └── rag-text-processor.ts    # RAG処理（TextComponent）
│   ├── services/
│   │   ├── rag.ts                   # RAGサービス（Vectorize）
│   │   ├── openai.ts                # OpenAI API
│   │   ├── elevenlabs.ts            # ElevenLabs API
│   │   └── did.ts                   # D-ID API（オプション）
│   ├── routes/
│   │   └── admin.ts                 # 管理画面API
│   ├── types/
│   │   └── index.ts                 # 型定義
│   └── index.tsx                    # メインWorker
├── public/static/
│   ├── realtime-chat.js             # フロントエンド（RealtimeKit）
│   └── admin.js                     # 管理画面UI
├── migrations/
│   └── 0001_initial_schema.sql      # D1スキーマ
└── wrangler.jsonc                   # Cloudflare設定
```

## 🔑 必要なAPIキー

### 1. Cloudflare（必須）
- **Account ID**: Cloudflareアカウント設定から取得
- **API Token**: 以下の権限が必要
  - `Realtime: Admin`
  - `D1: Edit`
  - `Vectorize: Edit`
  - `R2: Edit`
  - `Workers: Edit`

### 2. Deepgram（必須）
- **API Key**: https://deepgram.com/
- Workers AI経由でSTT/TTSに使用
- グローバル330拠点で低遅延

### 3. OpenAI（必須）
- **API Key**: https://platform.openai.com/
- Embeddings（RAG用）
- GPT-4o-mini（応答生成）

### 4. ElevenLabs（必須）
- **API Key**: https://elevenlabs.io/
- ボイスクローンTTS

## 🚀 セットアップ手順

### ステップ1: Cloudflareリソース作成

```bash
# 1. D1データベース作成
npx wrangler d1 create webapp-production
# 出力されたdatabase_idをwrangler.jsonc に記入

# 2. Vectorizeインデックス作成
npx wrangler vectorize create voice-chat-rag --dimensions=1536 --metric=cosine

# 3. R2バケット作成
npx wrangler r2 bucket create voice-chat-storage

# 4. D1マイグレーション実行
npm run db:migrate:local
```

### ステップ2: 環境変数設定

`.dev.vars`ファイルを作成：

```bash
# Cloudflare
ACCOUNT_ID=your-account-id
API_TOKEN=your-api-token-with-realtime-admin

# AI Services
DEEPGRAM_API_KEY=your-deepgram-key
OPENAI_API_KEY=sk-your-openai-key
ELEVENLABS_API_KEY=your-elevenlabs-key
```

### ステップ3: ビルドとテスト

```bash
# ビルド
npm run build

# ローカル起動（PM2）
pm2 start ecosystem.config.cjs

# 動作確認
curl http://localhost:3000
```

## 💻 使用方法

### 1. 管理画面（/admin）

#### 学習データのアップロード
1. テキストファイル（.txt）を選択
2. アップロード後、自動的にベクトル化
3. RAG検索で使用可能になる

#### 音声プロファイル登録
1. ElevenLabsでボイスクローンを作成
2. Voice IDをコピー
3. 管理画面で登録

### 2. リアルタイム音声チャット（/）

#### RealtimeKit Meetingの作成
1. [RealtimeKit Dashboard](https://dash.realtime.cloudflare.com/dashboard)にアクセス
2. 「Create Meeting」をクリック
3. 「Join」から以下を取得：
   - Meeting ID（例: `bbbb2fac-953c-4239-9ba8-75ba912d76fc`）
   - Auth Token（例: `eyJ...`）

#### AIエージェントの起動
1. アプリの「接続開始」ボタンをクリック
2. Meeting IDとAuth Tokenを入力
3. 音声プロファイルを選択（オプション）
4. 「AIエージェントを起動」をクリック

#### 会話開始
1. 別のブラウザタブでRealtimeKit Meetingに参加
2. マイクに向かって話す
3. AIが超低遅延（<800ms）で応答

## 🔧 主要コンポーネント解説

### VoiceChatAgent（Durable Object）

```typescript
export class VoiceChatAgent extends RealtimeAgent<Bindings> {
  async init(agentId, meetingId, authToken, ...) {
    // パイプライン構築
    await this.initPipeline([
      rtkTransport,           // WebRTC I/O
      new DeepgramSTT(...),   // STT
      this.textProcessor,     // RAG処理
      new ElevenLabsTTS(...), // TTS
      rtkTransport,           // WebRTC出力
    ], ...);
  }
}
```

**特徴**:
- Durable Objectsでステートフル管理
- 各ミーティングごとに1つのインスタンス
- パイプラインの自動調整

### RAGTextProcessor（TextComponent）

```typescript
export class RAGTextProcessor extends TextComponent {
  async onTranscript(text, reply) {
    // 1. RAG検索
    const context = await this.ragService.getContext(text);
    
    // 2. LLM推論
    const response = await this.openai.chatCompletion([...], context);
    
    // 3. 応答
    reply(response);
  }
}
```

**特徴**:
- Vectorize検索で関連文書取得
- 会話履歴管理（D1）
- カスタムロジック実装可能

## 📊 パフォーマンス目標

| 処理 | 目標時間 | 実装 |
|------|----------|------|
| **マイク入力** | 40ms | WebRTC |
| **STT** | 300ms | Deepgram on Workers AI |
| **RAG検索** | 50ms | Vectorize |
| **LLM推論** | 400ms | OpenAI GPT-4o-mini |
| **TTS** | 150ms | ElevenLabs |
| **合計** | **<800ms** | ✅ |

## 🌍 本番デプロイ

### ステップ1: Cloudflare Pages Projectの作成

```bash
npx wrangler pages project create webapp \
  --production-branch main \
  --compatibility-date 2026-02-14
```

### ステップ2: 本番環境変数設定

```bash
npx wrangler pages secret put ACCOUNT_ID --project-name webapp
npx wrangler pages secret put API_TOKEN --project-name webapp
npx wrangler pages secret put DEEPGRAM_API_KEY --project-name webapp
npx wrangler pages secret put OPENAI_API_KEY --project-name webapp
npx wrangler pages secret put ELEVENLABS_API_KEY --project-name webapp
```

### ステップ3: 本番マイグレーション

```bash
npm run db:migrate:prod
```

### ステップ4: デプロイ

```bash
npm run deploy:prod
```

## 🐛 トラブルシューティング

### エラー: "CLOUDFLARE_API_TOKEN not set"
- Deploy タブでCloudflare APIキーを設定
- または `.dev.vars` に `API_TOKEN` を追加

### エラー: "Durable Object not found"
- `wrangler.jsonc` の `migrations` セクションを確認
- ビルドを再実行: `npm run build`

### エラー: "Vectorize index not found"
- Vectorizeインデックスを作成: `npx wrangler vectorize create voice-chat-rag`

### エージェントが応答しない
- RealtimeKit Meetingに正しく参加しているか確認
- Auth Tokenが有効か確認
- ブラウザのマイク権限を確認

## 📚 参考リンク

- [Cloudflare Realtime Agents公式ドキュメント](https://developers.cloudflare.com/realtime/agents/)
- [RealtimeKit Dashboard](https://dash.realtime.cloudflare.com/)
- [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/)
- [Deepgram on Workers AI](https://developers.cloudflare.com/workers-ai/models/)
- [ElevenLabs API](https://elevenlabs.io/docs)

## 🎉 完成！

これで、グローバルエッジネットワーク上で動作する超低遅延のリアルタイム音声AIアシスタントが完成しました。

学習データをアップロードして、AIと会話してみてください！
