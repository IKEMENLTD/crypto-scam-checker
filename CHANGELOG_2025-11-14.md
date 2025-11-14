# 修正ログ - 2025年11月14日

## 作業概要
PDFとテキスト入力で分析結果が大きく異なる問題を解決し、URL入力機能を削除。AI判定のブレについての説明を追加。

---

## 発生していた問題

**問題1: PDFとテキストで分析結果が大きく異なる**

**症状:**
- Bitcoin PDFアップロード: リスクスコア **50/100**
- Bitcoin テキスト入力: リスクスコア **1/100**
- 同じ内容なのに49点もの差が発生

**原因:**
- PDF.jsのテキスト抽出で `textContent.items.map(item => item.str).join(' ')` を使用していた
- これにより全ての改行がスペースに変換され、段落構造が完全に失われた
- AIは文章の構造（改行、段落）を重要視するため、改行の有無で分析結果が大きく変化

**問題2: URL入力機能が不要になった**
- PDFアップロード機能が完成したため、URL入力機能が重複
- ユーザーが混乱する可能性があるため削除を決定

---

## 修正内容

### 修正1: PDF.jsのテキスト抽出ロジック改善
**ファイルパス:** `/script.js`

**変更内容:**
```diff
  // 全ページのテキストを抽出
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
-     const pageText = textContent.items.map(item => item.str).join(' ');
-     fullText += pageText + '\n';
+
+     let lastY = null;
+     let pageText = '';
+
+     // Y座標を使って改行を検出
+     textContent.items.forEach((item, index) => {
+         const currentY = item.transform[5];
+
+         // 前のアイテムとY座標が5以上離れている場合は改行
+         if (lastY !== null && Math.abs(currentY - lastY) > 5) {
+             pageText += '\n';
+         }
+
+         // テキストを追加（末尾にスペースがない場合のみスペースを追加）
+         pageText += item.str;
+         if (item.str && !item.str.endsWith(' ') && index < textContent.items.length - 1) {
+             pageText += ' ';
+         }
+
+         lastY = currentY;
+     });
+
+     fullText += pageText.trim() + '\n\n';
  }
```

**理由:**
- `item.transform[5]` でテキストの縦位置（Y座標）を取得
- Y座標が5以上変化した場合に改行を挿入
- ページ間に空行（`\n\n`）を挿入して段落を明確に区切る
- これにより元のドキュメントの段落構造を保持

**状態:** ✅ 実装完了 ✅ GitHub更新済み

---

### 修正2: URL入力機能の完全削除
**ファイルパス:** `/index.html`, `/script.js`, `/api/fetch-pdf.js`

**変更内容:**

**index.html:**
```diff
- <button class="tab-btn" data-tab="url">URL入力</button>
  <button class="tab-btn" data-tab="text">テキスト入力</button>

- <div id="url-tab" class="tab-panel">
-     <input type="url" id="url-input" placeholder="ホワイトペーパーのURLを入力">
-     <button class="btn-secondary" id="url-fetch-btn">URLから取得</button>
- </div>
```

**script.js:**
```diff
- const urlInput = document.getElementById('url-input');
- const urlFetchBtn = document.getElementById('url-fetch-btn');

- // URL取得ボタン（41行削除）
- urlFetchBtn.addEventListener('click', async () => { ... });
```

**api/fetch-pdf.js:**
- ファイル全体を削除

**理由:**
- PDFアップロード機能で十分
- 機能の重複を削減してUIをシンプルに
- メンテナンス負荷を軽減

**状態:** ✅ 実装完了 ✅ GitHub更新済み

---

### 修正3: AI判定のブレについての説明追加
**ファイルパス:** `/script.js`

**変更内容:**
```diff
  <div style="margin-top: 30px; padding: 20px; background: var(--bg-color); border-radius: 8px; text-align: center;">
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0 0 10px 0;">
          ⚠️ この分析結果は参考情報です。投資判断は必ず専門家に相談の上、ご自身の責任で行ってください。
      </p>
+     <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">
+         ℹ️ 本ツールはAIによる分析を使用しているため、同じドキュメントでも実行ごとに数点程度のスコアのブレが生じる場合があります。
+     </p>
  </div>
```

**理由:**
- ユーザーがPDFとテキストで数点の差を見ても混乱しないように
- AIの性質を正しく理解してもらう
- 透明性の向上

**状態:** ✅ 実装完了 ✅ GitHub更新済み

---

### 修正4: デバッグログの削除
**ファイルパス:** `/script.js`

**変更内容:**
```diff
  // PDFからテキストを抽出
  const text = await extractTextFromPDF(file);
  uploadedText = text;

- // デバッグ用：抽出されたテキストの最初の500文字をコンソールに出力
- console.log('=== PDF抽出テキスト（最初の500文字） ===');
- console.log(text.substring(0, 500));
- console.log('=== テキスト全体の長さ ===', text.length);
```

```diff
- console.error('API Error Response:', errorData);
- console.error('API Error Response (JSON):', JSON.stringify(errorData, null, 2));
```

```diff
- // 詳細なエラー情報をコンソールに出力
- console.error('=== Analysis Error Details ===');
- console.error('Error message:', error.message);
- console.error('Error object:', error);
- console.error('Error stack:', error.stack);
```

**理由:**
- 本番環境ではデバッグログは不要
- コンソールをクリーンに保つ
- パフォーマンスの向上

**状態:** ✅ 実装完了 ⏳ GitHub更新中

---

## テスト結果

### 修正前
| ドキュメント | 入力方法 | リスクスコア | 評価 |
|------------|---------|------------|------|
| Bitcoin | PDF（改行なし） | 50/100 | ❌ 不正確 |
| Bitcoin | テキスト | 1/100 | ✅ |
| MoonRocket | PDF | 100/100 | ✅ |
| MoonRocket | テキスト | 100/100 | ✅ |

### 修正後
| ドキュメント | 入力方法 | リスクスコア | 評価 |
|------------|---------|------------|------|
| Bitcoin | PDF（改行あり） | **5/100** | ✅ 改善 |
| Bitcoin | テキスト | 1/100 | ✅ |
| MoonRocket | PDF（改行あり） | **99/100** | ✅ |
| MoonRocket | テキスト | 100/100 | ✅ |

**結果:**
- Bitcoin: 50点 → **5点** (45点改善！)
- MoonRocket: 100点 → **99点** (ほぼ一致)
- PDFとテキストで一貫した分析結果が得られるようになった ✅

---

## 現在の機能

### ✅ 実装済み機能
1. **PDFアップロード** - ドラッグ&ドロップまたはファイル選択
2. **テキスト入力** - 直接テキストを貼り付け
3. **詐欺リスク分析** - Google Gemini 2.5 Flash APIを使用
4. **結果表示** - リスクスコア、危険信号、注意点、ポジティブな点、推奨アクション
5. **レート制限** - 1分間に10リクエストまで
6. **セキュリティヘッダー** - CSP、HSTS等
7. **免責事項** - 利用規約と同意チェック
8. **AI判定ブレの説明** - ユーザーへの透明性

### ❌ 削除した機能
1. **URL入力** - 不要となったため削除

---

## 学んだこと

### 技術的な知見

1. **PDF.jsのテキスト抽出**
   - 単純な`join(' ')`では段落構造が失われる
   - `item.transform[5]`でY座標を取得して改行を検出できる
   - Y座標の閾値（5）は実験的に決定

2. **AIの挙動**
   - AIは文章の構造（改行、段落）を重要視する
   - 改行の有無で分析結果が大きく変わる（50点 vs 5点）
   - 同じ内容でも毎回数点のブレが生じる（AI判定の性質）

3. **ユーザー体験**
   - 機能が多すぎるとユーザーが混乱する
   - 不要な機能は削除してシンプルに
   - 透明性（AI判定のブレの説明）が重要

### 作業プロセス

1. **問題の可視化**
   - コンソールログを追加してPDF抽出結果を確認
   - テストファイルを用意して比較検証
   - スクリーンショットで結果を記録

2. **段階的な改善**
   - デバッグログ追加 → 問題特定 → 修正 → テスト → デバッグログ削除
   - 一度に複数の変更をせず、一つずつ確実に

3. **ドキュメント化の重要性**
   - 変更内容を記録することで後から振り返れる
   - テスト結果を表形式で記録

---

## 参考リンク

- 本番サイト: https://crypto-scam-checker.vercel.app
- GitHubリポジトリ: https://github.com/IKEMENLTD/crypto-scam-checker
- Vercelダッシュボード: https://vercel.com/dashboard

---

## 完成度

- **現在の完成度:** 95%
- **主要機能:** 全て実装完了
- **残タスク:** なし
- **本番運用:** 可能

---

## 一言メモ

PDFのテキスト抽出は単純なjoin処理だと思っていたが、Y座標を使った改行検出が必要だと分かり、PDF処理の奥深さを実感した。AIが文章構造を重視することも新しい学びだった。問題を可視化してから解決策を実装する流れがスムーズだった。
