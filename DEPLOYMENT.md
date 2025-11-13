# デプロイ手順

このドキュメントでは、暗号資産詐欺チェッカーをVercelにデプロイする手順を説明します。

## 前提条件

- GitHubアカウント
- Vercelアカウント（無料）
- Google Gemini APIキー（無料）

## ステップ1: Google Gemini APIキーの取得

1. [Google AI Studio](https://aistudio.google.com/app/apikey)にアクセス
2. Googleアカウントでログイン
3. 「Create API Key」をクリック
4. APIキーをコピー（後で使用します）

## ステップ2: GitHubリポジトリの作成

### オプションA: GitHub Desktop使用（初心者向け）

1. [GitHub Desktop](https://desktop.github.com/)をダウンロード＆インストール
2. GitHub Desktopを開き、GitHubアカウントでログイン
3. 「File」→「Add Local Repository」を選択
4. プロジェクトフォルダを選択：
   ```
   C:\Users\music003\OneDrive\ドキュメント\プロジェクト\暗号資産詐欺の見抜き方チェッカー
   ```
5. 「Create Repository」をクリック
6. コミットメッセージを入力（例：「Initial commit」）
7. 「Commit to main」をクリック
8. 「Publish repository」をクリック
9. リポジトリ名を入力（例：`crypto-scam-checker`）
10. 「Publish Repository」をクリック

### オプションB: Git CLI使用（上級者向け）

```bash
# プロジェクトディレクトリに移動
cd "C:\Users\music003\OneDrive\ドキュメント\プロジェクト\暗号資産詐欺の見抜き方チェッカー"

# Gitリポジトリを初期化
git init

# ファイルをステージング
git add .

# コミット
git commit -m "Initial commit"

# GitHubにリポジトリを作成（ブラウザで https://github.com/new にアクセス）
# リポジトリ名：crypto-scam-checker

# リモートリポジトリを追加
git remote add origin https://github.com/あなたのユーザー名/crypto-scam-checker.git

# プッシュ
git branch -M main
git push -u origin main
```

## ステップ3: Vercelへのデプロイ

1. [Vercel](https://vercel.com/)にアクセス
2. 「Sign Up」をクリック（GitHubアカウントで登録）
3. ダッシュボードで「Add New」→「Project」をクリック
4. GitHubリポジトリを選択：`crypto-scam-checker`
5. 「Import」をクリック

### プロジェクト設定

- **Framework Preset**: Other（そのまま）
- **Root Directory**: ./（そのまま）
- **Build Command**: 空欄
- **Output Directory**: 空欄

### 環境変数の設定

1. 「Environment Variables」セクションを展開
2. 以下を追加：
   - **Name**: `GEMINI_API_KEY`
   - **Value**: [ステップ1で取得したAPIキー]
   - **Environment**: Production, Preview, Development すべてチェック
3. 「Add」をクリック

### デプロイ実行

1. 「Deploy」ボタンをクリック
2. デプロイが完了するまで待つ（約1-2分）
3. 「Visit」ボタンをクリックしてサイトを確認

## ステップ4: 動作確認

1. デプロイされたサイトにアクセス
2. 免責事項に同意
3. テストテキストを入力：
   ```
   【テスト用ホワイトペーパー】

   プロジェクト名：SuperCoin

   投資リターン：月利50%を保証します。
   最低投資額：1万円から
   確実に儲かります。絶対に損をしません。

   技術：独自のブロックチェーン技術により、
   従来の暗号資産を超える性能を実現。

   チーム：匿名の天才開発者集団
   ```
4. 「詐欺リスクを分析」をクリック
5. 分析結果が表示されることを確認

## ステップ5: カスタムドメインの設定（オプション）

1. Vercelダッシュボードでプロジェクトを選択
2. 「Settings」→「Domains」をクリック
3. ドメインを追加（例：`crypto-checker.your-domain.com`）
4. DNS設定を行う

## トラブルシューティング

### エラー: "APIキーが設定されていません"

1. Vercelダッシュボード→プロジェクト→Settings→Environment Variables
2. `GEMINI_API_KEY`が正しく設定されているか確認
3. 再デプロイ：Deployments→最新デプロイの「...」→「Redeploy」

### エラー: "分析に失敗しました"

1. Google AI Studioでクォータを確認
2. APIキーが有効か確認
3. ブラウザの開発者ツール（F12）でエラーを確認

### デプロイが失敗する

1. `vercel.json`の構文が正しいか確認
2. `api/analyze.js`にエラーがないか確認
3. Vercelのビルドログを確認

## ローカル開発環境のセットアップ

デプロイ前にローカルでテストしたい場合：

```bash
# Node.jsをインストール（https://nodejs.org/）

# プロジェクトディレクトリに移動
cd "C:\Users\music003\OneDrive\ドキュメント\プロジェクト\暗号資産詐欺の見抜き方チェッカー"

# Vercel CLIをインストール
npm install -g vercel

# .envファイルを作成
# .env.exampleをコピーして.envにリネーム
# APIキーを入力

# ローカルサーバーを起動
vercel dev

# ブラウザでhttp://localhost:3000にアクセス
```

## 更新のデプロイ

コードを更新した後：

### GitHub Desktop使用

1. GitHub Desktopを開く
2. 変更されたファイルを確認
3. コミットメッセージを入力
4. 「Commit to main」をクリック
5. 「Push origin」をクリック
6. Vercelが自動的に再デプロイ

### Git CLI使用

```bash
git add .
git commit -m "Update: 変更内容"
git push origin main
```

Vercelが自動的に変更を検出し、再デプロイします。

## コスト

- **Vercel**: 無料プラン（Hobby）で十分
  - 月間100GBまでの帯域幅
  - 100時間のサーバーレス関数実行時間

- **Google Gemini API**: 無料枠
  - 1分あたり60リクエスト
  - 1日あたり1,500リクエスト

個人利用や小規模サイトであれば、完全無料で運用できます。

## セキュリティ注意事項

1. `.env`ファイルは絶対にGitにコミットしない
2. `.gitignore`に`.env`が含まれていることを確認
3. APIキーは絶対に公開しない
4. Vercelの環境変数のみでAPIキーを管理

## サポート

問題が発生した場合：

1. [Vercelドキュメント](https://vercel.com/docs)を参照
2. [Google AI Studioヘルプ](https://ai.google.dev/docs)を参照
3. プロジェクトのREADME.mdを確認
