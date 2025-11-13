# セキュリティ対策

本ツールは一般公開を前提として、以下のセキュリティ対策を実装しています。

## 🛡️ 実装済みセキュリティ機能

### 1. レート制限（Rate Limiting）

**目的**: API乱用の防止、DDoS攻撃の軽減

**実装内容**:
- IPアドレスベースのレート制限
- **制限**: 1分間に10リクエストまで
- レート制限ヘッダーをレスポンスに含める:
  - `X-RateLimit-Limit`: 制限数
  - `X-RateLimit-Remaining`: 残りリクエスト数
  - `X-RateLimit-Reset`: リセット時刻

**ユーザーへの影響**:
- 通常の使用では制限に引っかかりません
- 制限を超えた場合、待ち時間が表示されます

**制限事項**:
- サーバーレス環境ではメモリベースのため、複数インスタンス間で共有されない
- 本番環境では[Upstash Redis](https://upstash.com/)や[Vercel KV](https://vercel.com/storage/kv)の使用を推奨

### 2. 入力検証（Input Validation）

**目的**: 不正なデータの防止、インジェクション攻撃の軽減

**実装内容**:
- テキストの存在確認
- 最小文字数: 10文字
- 最大文字数: 100,000文字（分析時は30,000文字に切り詰め）
- 制御文字の検出
- SQLインジェクション的なパターンの検出

**検証内容**:
```javascript
- 必須チェック
- 型チェック（string）
- 長さチェック
- 不正文字チェック
- 危険なパターンチェック
```

### 3. セキュリティヘッダー

**目的**: XSS、クリックジャッキング、MIMEスニッフィングなどの攻撃を防ぐ

**実装内容**:
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### 4. CORS（Cross-Origin Resource Sharing）

**目的**: 許可されたオリジンからのみAPIアクセスを許可

**実装内容**:
- 環境変数`ALLOWED_ORIGINS`で許可するオリジンを管理
- 本番環境では実際のドメインのみ許可
- プリフライトリクエスト（OPTIONS）のサポート
- 24時間のキャッシュ

**設定方法**:
```bash
# Vercel環境変数で設定
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### 5. APIキーの保護

**目的**: クライアントにAPIキーを公開しない

**実装内容**:
- APIキーは環境変数でサーバーサイド管理
- `.env`ファイルは`.gitignore`で除外
- クライアントには絶対に送信しない

### 6. エラーハンドリング

**目的**: 攻撃者に有用な情報を与えない

**実装内容**:
- 本番環境では詳細なエラーメッセージを隠す
- 開発環境でのみ詳細を表示
- 適切なHTTPステータスコードを返す

### 7. リクエストログ

**目的**: 異常な動作の検知、デバッグ

**実装内容**:
```javascript
[timestamp] IP method URL - status message
```

**ログ例**:
```
[2024-01-15T10:30:00.000Z] 192.168.1.1 POST /api/analyze - 200 Analysis completed
[2024-01-15T10:31:00.000Z] 192.168.1.1 POST /api/analyze - 429 Rate limit exceeded
```

## ⚠️ 既知の制限事項

### 1. レート制限の制約

**問題**: サーバーレス環境ではメモリベースのレート制限が不完全

**影響**:
- 異なるサーバーインスタンスでは制限がリセットされる可能性
- 高負荷時に制限が効かない場合がある

**対策**:
- Upstash RedisまたはVercel KVへの移行を推奨
- Vercel Pro/Enterpriseプランの使用

### 2. CORS制限

**問題**: `NODE_ENV=production`では全オリジンを許可

**影響**:
- 任意のドメインからAPIを呼び出し可能

**対策**:
- デプロイ後、環境変数`ALLOWED_ORIGINS`を設定
- 自ドメインのみ許可するよう設定

## 🔧 追加推奨事項

### 1. Vercel組み込みの保護機能を有効化

Vercel Pro/Enterpriseプランでは以下が利用可能:
- **Vercel Firewall**: DDoS保護、Bot検出
- **Rate Limiting**: より強力なレート制限
- **Web Application Firewall (WAF)**: OWASP Top 10対策

### 2. モニタリングの設定

**推奨サービス**:
- [Vercel Analytics](https://vercel.com/analytics)
- [Sentry](https://sentry.io/)（エラートラッキング）
- [LogTail](https://logtail.com/)（ログ管理）

**モニタリング項目**:
- API呼び出し回数
- エラー率
- レスポンス時間
- レート制限超過回数

### 3. Gemini APIの保護

**推奨設定**:
- Google Cloud Consoleでクォータを設定
- APIキーに制限を追加:
  - IPアドレス制限
  - HTTPリファラー制限
  - API制限（Gemini APIのみ）

**設定方法**:
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 「認証情報」→APIキーを選択
3. 「APIの制限」→「キーを制限」
4. Generative Language APIのみ選択

### 4. Content Security Policy (CSP) の強化

現在の設定:
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
```

**推奨**: `unsafe-inline`を削除し、nonceを使用

### 5. バックアップとリカバリ

**推奨事項**:
- GitHubで完全なバージョン管理
- 環境変数のバックアップ（安全な場所に保管）
- 定期的なセキュリティ監査

## 🚨 セキュリティインシデント対応

### もし不正使用を検出したら

1. **即座の対応**:
   - Vercelダッシュボードでプロジェクトを一時停止
   - Gemini APIキーを無効化・再生成

2. **調査**:
   - Vercelのログを確認
   - 不正なIPアドレスを特定
   - 被害範囲の確認

3. **対策**:
   - レート制限をより厳格に
   - 必要に応じてIPブロック
   - セキュリティパッチの適用

4. **報告**:
   - 重大な脆弱性を発見した場合は開発者に報告

## 🔒 セキュアな運用のためのチェックリスト

デプロイ前:
- [ ] `.env`ファイルが`.gitignore`に含まれている
- [ ] APIキーがコードに直接書かれていない
- [ ] 環境変数がVercelで正しく設定されている
- [ ] `ALLOWED_ORIGINS`が本番ドメインに設定されている

デプロイ後:
- [ ] レート制限が機能している
- [ ] CORSが正しく動作している
- [ ] エラーメッセージが適切
- [ ] ログが正しく出力されている

定期的な確認:
- [ ] Gemini APIの使用量を確認
- [ ] 異常なトラフィックがないか確認
- [ ] セキュリティパッチの適用
- [ ] 依存パッケージの更新

## 📚 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Vercel Security Best Practices](https://vercel.com/docs/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)

## 📧 セキュリティ報告

セキュリティ上の問題を発見した場合は、GitHubのIssueではなく、直接開発者に連絡してください。

---

**最終更新**: 2024年1月
**バージョン**: 2.0（セキュリティ強化版）
