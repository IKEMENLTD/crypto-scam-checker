# 修正ログ - 2025年11月13日

## 作業概要
Vercel本番環境でのAPI呼び出しエラー（JSONパースエラー）の根本原因を特定し、修正を実施。

---

## 発生していた問題

**エラー内容:**
```
Unexpected token 'T', 'The page c'... is not valid JSON
```

**症状:**
- URL入力で `https://bitcoin.org/bitcoin.pdf` を指定して「URLから取得」ボタンをクリックするとエラー発生
- APIエンドポイント（`/api/fetch-pdf`）がJSON形式ではなくHTMLエラーページを返していた

---

## 根本原因

2つの問題が重なっていた：

### 問題1: モジュール形式の不一致
- **package.json** に `"type": "module"` が設定されていた
- これによりVercelは全ての`.js`ファイルをES Modules形式として扱おうとした
- しかし実際のAPIファイルはCommonJS形式（`require`/`module.exports`）で書かれていた
- 形式の不一致により実行時エラーが発生

### 問題2: サーバーレス環境で動作しないコード
- **api/_middleware.js** の9-16行目に `setInterval` による永続的なタイマー処理があった
- Vercelのサーバーレス関数は実行後に終了するため、永続的なタイマーは動作しない
- これが実行時エラーの原因となっていた

---

## 修正内容

### 修正1: package.json
**ファイルパス:** `/package.json`

**変更内容:**
```diff
 {
   "name": "crypto-scam-checker",
   "version": "1.0.0",
   "description": "暗号資産詐欺チェッカー - ホワイトペーパー分析ツール",
   "main": "index.html",
-  "type": "module",
-  "engines": {
-    "node": ">=18.0.0"
-  },
   "scripts": {
     "dev": "vercel dev",
     "deploy": "vercel --prod"
   },
```

**理由:**
- `"type": "module"` を削除することで、デフォルトのCommonJS形式に戻す
- `"engines"` も不要なため削除

**状態:** ✅ ローカル修正済み ✅ GitHub更新済み

---

### 修正2: api/_middleware.js
**ファイルパス:** `/api/_middleware.js`

**変更内容:**
```diff
 // レート制限用のメモリストレージ（シンプル版）
 // 注意: サーバーレス環境では複数インスタンス間で共有されない
 // 本番環境ではUpstash RedisやVercel KVの使用を推奨
 const rateLimitStore = new Map();

-// 古いエントリをクリーンアップ
-setInterval(() => {
-    const now = Date.now();
-    for (const [key, data] of rateLimitStore.entries()) {
-        if (now - data.resetTime > 0) {
-            rateLimitStore.delete(key);
-        }
-    }
-}, 60000); // 1分ごとにクリーンアップ
-
 /**
  * レート制限チェック
```

**削除した行:** 9-16行目の8行（setIntervalのコード全体）

**理由:**
- サーバーレス環境では関数実行後にプロセスが終了するため、`setInterval`は動作しない
- 永続的なクリーンアップは不要（各リクエストごとに新しいインスタンスが起動する）

**状態:** ✅ ローカル修正済み ❌ GitHub未更新（次回作業で更新予定）

---

### 修正3: api/analyze.js
**ファイルパス:** `/api/analyze.js`

**変更内容:**
```diff
-import {
-    checkRateLimit,
-    getClientIP,
-    validateInput,
-    setSecurityHeaders,
-    sendErrorResponse,
-    logRequest
-} from './_middleware.js';
+const {
+    checkRateLimit,
+    getClientIP,
+    validateInput,
+    setSecurityHeaders,
+    sendErrorResponse,
+    logRequest
+} = require('./_middleware.js');

-export default async function handler(req, res) {
+module.exports = async function handler(req, res) {
```

**理由:**
- ES Modules形式（`import`/`export`）からCommonJS形式（`require`/`module.exports`）に変換
- Vercelのデフォルト設定に合わせる

**状態:** ✅ ローカル修正済み ✅ GitHub更新済み

---

### 修正4: api/fetch-pdf.js
**ファイルパス:** `/api/fetch-pdf.js`

**変更内容:**
```diff
-import { checkRateLimit, getClientIP, setSecurityHeaders, sendErrorResponse, logRequest } from './_middleware.js';
+const { checkRateLimit, getClientIP, setSecurityHeaders, sendErrorResponse, logRequest } = require('./_middleware.js');

-export default async function handler(req, res) {
+module.exports = async function handler(req, res) {
```

**理由:**
- ES Modules形式からCommonJS形式に変換

**状態:** ✅ ローカル修正済み ✅ GitHub更新済み

---

## 現在の状態

### ✅ 完了済み
- ローカルファイル：全て修正完了
- GitHubファイル：
  - ✅ package.json - 更新済み
  - ✅ api/analyze.js - 更新済み
  - ✅ api/fetch-pdf.js - 更新済み

### ⚠️ 未完了
- GitHubファイル：
  - ❌ **api/_middleware.js - まだsetIntervalが残っている**

---

## 次回やること（優先順位順）

### 【最優先】ステップ1: GitHubへのアップロード
1. https://github.com/IKEMENLTD/crypto-scam-checker/blob/main/api/_middleware.js を開く
2. 鉛筆アイコン(✏️)をクリック
3. 9-16行目の以下8行を削除:
   ```javascript
   // 古いエントリをクリーンアップ
   setInterval(() => {
       const now = Date.now();
       for (const [key, data] of rateLimitStore.entries()) {
           if (now - data.resetTime > 0) {
               rateLimitStore.delete(key);
           }
       }
   }, 60000); // 1分ごとにクリーンアップ
   ```
4. 「Commit changes...」→「Commit changes」をクリック

### ステップ2: Vercel再デプロイの確認
- GitHubにコミット後、約30秒～1分で自動デプロイ完了
- https://vercel.com/dashboard でステータス確認

### ステップ3: 本番環境でテスト
1. https://crypto-scam-checker.vercel.app を開く
2. 3つのチェックボックスをチェック
3. URL入力タブで `https://bitcoin.org/bitcoin.pdf` を入力
4. 「URLから取得」をクリック → エラーが出ないか確認
5. 「詐欺リスクを分析」をクリック → 分析結果が表示されるか確認

---

## 学んだこと

### 技術的な知見
1. **package.jsonの"type"フィールドの影響範囲**
   - "type": "module" はプロジェクト全体のモジュール形式を決定する
   - 設定すると全ての.jsファイルがES Modulesとして扱われる
   - CommonJSコードと混在させるとエラーになる

2. **サーバーレス環境の制約**
   - 関数実行後にプロセスが終了する
   - setInterval/setTimeoutなどの永続的な処理は動作しない
   - 状態はリクエスト間で共有されない（メモリは揮発性）

3. **Vercelのモジュール形式**
   - デフォルトではCommonJS形式を期待
   - ES Modulesを使う場合は明示的に設定が必要

### 作業プロセスの改善点
1. **徹底的な事前確認の重要性**
   - 修正前に全ファイルを体系的にチェックすることで、見落としを防げる
   - 「妥協0」の姿勢が結果的に最も効率的

2. **問題の段階的な切り分け**
   - まずローカルとGitHubの差分を確認
   - 次にファイルごとの問題を特定
   - 最後に根本原因を特定

3. **ドキュメント化の重要性**
   - 修正内容を記録しておくことで、次回同じ問題に遭遇したときに参照できる

---

## 参考リンク
- 本番サイト: https://crypto-scam-checker.vercel.app
- GitHubリポジトリ: https://github.com/IKEMENLTD/crypto-scam-checker
- Vercelダッシュボード: https://vercel.com/dashboard

---

## メモ
- WSL環境でgit認証ができないため、GitHub Web UIを使った手動編集を採用
- 今後の改善: git認証方法の学習、ローカルでのVercel開発サーバー利用
