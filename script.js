// グローバル変数
let currentTab = 'pdf';
let uploadedText = '';

// DOM要素
const disclaimerScreen = document.getElementById('disclaimer-screen');
const checkerScreen = document.getElementById('checker-screen');
const consentCheckbox = document.getElementById('consent-checkbox');
const startButton = document.getElementById('start-button');
const fileInput = document.getElementById('file-input');
const fileSelectBtn = document.getElementById('file-select-btn');
const uploadArea = document.getElementById('upload-area');
const fileInfo = document.getElementById('file-info');
const textInput = document.getElementById('text-input');
const analyzeBtn = document.getElementById('analyze-btn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');

// 免責事項の同意チェック
consentCheckbox.addEventListener('change', (e) => {
    startButton.disabled = !e.target.checked;
});

// ツール使用開始
startButton.addEventListener('click', () => {
    disclaimerScreen.classList.remove('active');
    checkerScreen.classList.add('active');
});

// タブ切り替え
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        // タブボタンの切り替え
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // タブパネルの切り替え
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`${tab}-tab`).classList.add('active');

        currentTab = tab;
        updateAnalyzeButton();
    });
});

// ファイル選択ボタン
fileSelectBtn.addEventListener('click', () => {
    fileInput.click();
});

// ファイル選択
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        await handleFileUpload(file);
    }
});

// ドラッグ&ドロップ
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        await handleFileUpload(file);
    } else {
        alert('PDFファイルのみアップロード可能です');
    }
});

// テキスト入力の監視
textInput.addEventListener('input', (e) => {
    uploadedText = e.target.value.trim();
    updateAnalyzeButton();
});

// 分析ボタン
analyzeBtn.addEventListener('click', async () => {
    let textToAnalyze = '';

    if (currentTab === 'text') {
        textToAnalyze = textInput.value.trim();
    } else {
        textToAnalyze = uploadedText;
    }

    if (!textToAnalyze) {
        alert('ホワイトペーパーのテキストを入力してください');
        return;
    }

    await analyzeWhitepaper(textToAnalyze);
});

// PDFからテキストを抽出する関数
async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.onload = async function() {
            try {
                const typedArray = new Uint8Array(this.result);

                // PDF.jsの設定
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

                // PDFドキュメントを読み込み
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                let fullText = '';

                // 全ページのテキストを抽出
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();

                    let lastY = null;
                    let pageText = '';

                    // Y座標を使って改行を検出
                    textContent.items.forEach((item, index) => {
                        const currentY = item.transform[5];

                        // 前のアイテムとY座標が5以上離れている場合は改行
                        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
                            pageText += '\n';
                        }

                        // テキストを追加（末尾にスペースがない場合のみスペースを追加）
                        pageText += item.str;
                        if (item.str && !item.str.endsWith(' ') && index < textContent.items.length - 1) {
                            pageText += ' ';
                        }

                        lastY = currentY;
                    });

                    fullText += pageText.trim() + '\n\n';
                }

                resolve(fullText.trim());
            } catch (error) {
                reject(error);
            }
        };

        fileReader.onerror = function() {
            reject(new Error('ファイルの読み込みに失敗しました'));
        };

        fileReader.readAsArrayBuffer(file);
    });
}

// ファイルアップロード処理
async function handleFileUpload(file) {
    try {
        // ファイル情報を表示
        fileInfo.style.display = 'block';
        fileInfo.innerHTML = `
            <div>
                <strong>${file.name}</strong>
                <span style="color: var(--text-secondary);">(${(file.size / 1024).toFixed(2)} KB)</span>
                <span style="color: var(--primary-color); margin-left: 10px;">📄 解析中...</span>
            </div>
        `;

        // PDFからテキストを抽出
        const text = await extractTextFromPDF(file);
        uploadedText = text;

        // デバッグ用：抽出されたテキストの最初の500文字をコンソールに出力
        console.log('=== PDF抽出テキスト（最初の500文字） ===');
        console.log(text.substring(0, 500));
        console.log('=== テキスト全体の長さ ===', text.length);

        // 成功メッセージを表示
        fileInfo.innerHTML = `
            <div>
                <strong>${file.name}</strong>
                <span style="color: var(--text-secondary);">(${(file.size / 1024).toFixed(2)} KB)</span>
                <span style="color: var(--success-color); margin-left: 10px;">✅ 解析完了 (${text.length}文字)</span>
            </div>
            <button class="btn-secondary" onclick="clearFile()">削除</button>
        `;

        updateAnalyzeButton();
    } catch (error) {
        console.error('PDF extraction error:', error);
        fileInfo.innerHTML = `
            <div style="color: var(--danger-color);">
                <strong>❌ エラー:</strong> ${error.message || 'PDFの読み込みに失敗しました'}
            </div>
            <button class="btn-secondary" onclick="clearFile()">やり直す</button>
        `;
        alert('PDFの読み込みに失敗しました。別のファイルを試すか、テキスト入力を使用してください。');
    }
}

// ファイルクリア
function clearFile() {
    fileInput.value = '';
    fileInfo.style.display = 'none';
    uploadedText = '';
    updateAnalyzeButton();
}

// 分析ボタンの有効/無効を更新
function updateAnalyzeButton() {
    const hasContent = uploadedText.length > 0 || (currentTab === 'text' && textInput.value.trim().length > 0);
    analyzeBtn.disabled = !hasContent;
}

// ホワイトペーパーを分析
async function analyzeWhitepaper(text) {
    try {
        analyzeBtn.disabled = true;
        loading.style.display = 'block';
        results.style.display = 'none';

        // バックエンドAPIを呼び出し
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        });

        // レート制限ヘッダーを取得
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (parseError) {
                console.error('Failed to parse error response:', parseError);
                throw new Error(`APIエラー (${response.status}): レスポンスのパースに失敗しました`);
            }

            console.error('API Error Response:', errorData);
            console.error('API Error Response (JSON):', JSON.stringify(errorData, null, 2));

            // レート制限エラーの特別な処理
            if (response.status === 429) {
                const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset)) : null;
                const waitMinutes = resetTime ? Math.ceil((resetTime - Date.now()) / 60000) : 1;
                throw new Error(
                    `リクエスト制限に達しました。\n${waitMinutes}分後に再試行してください。\n\n` +
                    `このツールは悪用防止のため、1分間に10回までの分析に制限されています。`
                );
            }

            throw new Error(errorData.error || '分析に失敗しました');
        }

        const analysisResult = await response.json();

        // レート制限の残り回数を表示（デバッグ用）
        if (rateLimitRemaining !== null) {
            console.log(`残りリクエスト数: ${rateLimitRemaining}/10`);
        }

        displayResults(analysisResult);

    } catch (error) {
        // 詳細なエラー情報をコンソールに出力
        console.error('=== Analysis Error Details ===');
        console.error('Error message:', error.message);
        console.error('Error object:', error);
        console.error('Error stack:', error.stack);

        // エラーメッセージを改行を保持して表示
        const errorMessage = error.message.replace(/\\n/g, '\n');
        alert(errorMessage);
        console.error('Analysis error:', error);
    } finally {
        analyzeBtn.disabled = false;
        loading.style.display = 'none';
    }
}

// 結果を表示
function displayResults(analysis) {
    const riskScoreClass = analysis.riskLevel === 'high' ? 'score-high' :
                          analysis.riskLevel === 'medium' ? 'score-medium' : 'score-low';

    const riskLabelText = analysis.riskLevel === 'high' ? '⚠️ 高リスク - 投資非推奨' :
                         analysis.riskLevel === 'medium' ? '⚡ 中リスク - 要注意' : '✅ 低リスク';

    const riskLabelClass = analysis.riskLevel === 'high' ? 'score-high' :
                          analysis.riskLevel === 'medium' ? 'score-medium' : 'score-low';

    let html = `
        <div class="risk-score">
            <h3>詐欺リスクスコア</h3>
            <div class="score-value ${riskScoreClass}">${analysis.riskScore}/100</div>
            <div class="risk-label ${riskLabelClass}">${riskLabelText}</div>
        </div>

        <div class="analysis-section">
            <h3>📊 総合分析</h3>
            <p>${analysis.summary}</p>
        </div>
    `;

    if (analysis.redFlags && analysis.redFlags.length > 0) {
        html += `
            <div class="analysis-section">
                <h3>🚩 重大な危険信号</h3>
                ${analysis.redFlags.map(flag => `
                    <div class="red-flag-item">
                        <strong>⚠️</strong> ${flag}
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (analysis.warnings && analysis.warnings.length > 0) {
        html += `
            <div class="analysis-section">
                <h3>⚡ 注意すべき点</h3>
                ${analysis.warnings.map(warning => `
                    <div class="warning-item">
                        <strong>!</strong> ${warning}
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (analysis.positivePoints && analysis.positivePoints.length > 0) {
        html += `
            <div class="analysis-section">
                <h3>✅ ポジティブな点</h3>
                ${analysis.positivePoints.map(point => `
                    <div class="positive-item">
                        <strong>✓</strong> ${point}
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (analysis.recommendations && analysis.recommendations.length > 0) {
        html += `
            <div class="recommendation-box">
                <h3>💡 推奨アクション</h3>
                <ul>
                    ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    html += `
        <div style="margin-top: 30px; padding: 20px; background: var(--bg-color); border-radius: 8px; text-align: center;">
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0 0 10px 0;">
                ⚠️ この分析結果は参考情報です。投資判断は必ず専門家に相談の上、ご自身の責任で行ってください。
            </p>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">
                ℹ️ 本ツールはAIによる分析を使用しているため、同じドキュメントでも実行ごとに数点程度のスコアのブレが生じる場合があります。
            </p>
        </div>
    `;

    results.innerHTML = html;
    results.style.display = 'block';

    // 結果までスクロール
    results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
