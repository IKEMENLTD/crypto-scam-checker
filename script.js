// グローバル変数
let currentTab = 'pdf';
let uploadedText = '';
let currentAnalysis = null; // 現在の分析結果を保持
let currentInputName = ''; // 入力されたファイル名またはテキストの識別子
let analysisHistory = []; // 分析履歴
const MAX_HISTORY_SIZE = 20; // 最大履歴保存数

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

// ページ読み込み時に履歴を読み込み
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
    console.log('disclaimerScreen:', disclaimerScreen);
    console.log('checkerScreen:', checkerScreen);
    console.log('startButton:', startButton);
    console.log('consentCheckbox:', consentCheckbox);
    loadHistory();
});

// 免責事項の同意チェック
if (consentCheckbox) {
    consentCheckbox.addEventListener('change', (e) => {
        console.log('Checkbox changed:', e.target.checked);
        startButton.disabled = !e.target.checked;
    });
} else {
    console.error('consentCheckbox not found!');
}

// ツール使用開始
if (startButton) {
    startButton.addEventListener('click', () => {
        console.log('Start button clicked!');
        console.log('Before - disclaimerScreen classes:', disclaimerScreen.className);
        console.log('Before - checkerScreen classes:', checkerScreen.className);

        disclaimerScreen.classList.remove('active');
        checkerScreen.classList.add('active');

        console.log('After - disclaimerScreen classes:', disclaimerScreen.className);
        console.log('After - checkerScreen classes:', checkerScreen.className);
    });
} else {
    console.error('startButton not found!');
}

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
        // テキスト入力の場合はファイル名を設定
        if (!currentInputName || currentInputName.endsWith('.pdf')) {
            currentInputName = 'テキスト入力_' + new Date().toLocaleDateString('ja-JP').replace(/\//g, '-');
        }
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
        // ファイル名を保存
        currentInputName = file.name;

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
        // ボタンを無効化
        analyzeBtn.disabled = true;
        loading.style.display = 'block';
        results.style.display = 'none';

        // テキストをサニタイズ（制御文字を削除）
        const sanitizedText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

        // バックエンドAPIを呼び出し
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: sanitizedText })
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
        // エラーメッセージを改行を保持して表示
        const errorMessage = error.message.replace(/\\n/g, '\n');
        alert(errorMessage);
        console.error('Analysis error:', error);
    } finally {
        // ボタンをリセット
        analyzeBtn.disabled = false;
        loading.style.display = 'none';
    }
}

// 結果を表示
function displayResults(analysis, saveHistory = true, scrollToScore = true) {
    // 現在の分析結果を保存
    currentAnalysis = analysis;

    // 履歴に保存（新規分析の場合のみ）
    if (saveHistory) {
        saveToHistory(analysis);
    }

    // スコアから自動的にリスクレベルを判定（AIの値に依存しない）
    const score = analysis.riskScore;
    let actualRiskLevel;
    if (score >= 71) {
        actualRiskLevel = 'high';
    } else if (score >= 31) {
        actualRiskLevel = 'medium';
    } else {
        actualRiskLevel = 'low';
    }

    const riskScoreClass = actualRiskLevel === 'high' ? 'score-high' :
                          actualRiskLevel === 'medium' ? 'score-medium' : 'score-low';

    const riskLabelText = actualRiskLevel === 'high' ? '⚠️ 高リスク - 投資非推奨' :
                         actualRiskLevel === 'medium' ? '⚡ 中リスク - 要注意' : '✅ 低リスク';

    const riskLabelClass = actualRiskLevel === 'high' ? 'score-high' :
                          actualRiskLevel === 'medium' ? 'score-medium' : 'score-low';

    let html = `
        <div class="risk-score">
            <h3>詐欺リスクスコア</h3>
            <div class="score-value ${riskScoreClass}">${analysis.riskScore}/100</div>
            <div class="risk-label ${riskLabelClass}">${riskLabelText}</div>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 15px 0 0 0; line-height: 1.6;">
                ℹ️ 本ツールはAIによる分析を使用しているため、同じドキュメントでも実行ごとに数点程度のスコアのブレが生じる場合があります。
            </p>
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
        <div class="export-section">
            <h3>📥 分析結果をエクスポート</h3>
            <div class="export-buttons">
                <button class="btn-export btn-csv" onclick="exportToCSV()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    CSV形式でダウンロード
                </button>
                <button class="btn-export btn-pdf" onclick="exportToPDF()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    PDF形式でダウンロード
                </button>
            </div>
        </div>

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

    // スコアボックスにスクロール（少し遅延させて確実に表示後にスクロール）
    if (scrollToScore) {
        setTimeout(() => {
            const riskScoreBox = document.querySelector('.risk-score');
            if (riskScoreBox) {
                riskScoreBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }
}

// CSV形式でエクスポート
function exportToCSV() {
    if (!currentAnalysis) {
        alert('エクスポートする分析結果がありません');
        return;
    }

    const analysis = currentAnalysis;
    const timestamp = new Date().toLocaleString('ja-JP');
    const fileName = currentInputName || 'ホワイトペーパー';

    // CSVヘッダー
    let csv = '\uFEFF'; // BOM for Excel UTF-8 support
    csv += '暗号資産詐欺チェッカー - 分析結果\n';
    csv += `分析日時,${timestamp}\n`;
    csv += `ファイル名,${fileName}\n`;
    csv += '\n';

    // 基本情報
    csv += '項目,値\n';
    csv += `リスクスコア,${analysis.riskScore}/100\n`;
    csv += `リスクレベル,${analysis.riskLevel}\n`;
    csv += '\n';

    // 総合分析
    csv += '総合分析\n';
    csv += `"${analysis.summary.replace(/"/g, '""')}"\n`;
    csv += '\n';

    // 重大な危険信号
    if (analysis.redFlags && analysis.redFlags.length > 0) {
        csv += '重大な危険信号\n';
        analysis.redFlags.forEach((flag, index) => {
            csv += `${index + 1},"${flag.replace(/"/g, '""')}"\n`;
        });
        csv += '\n';
    }

    // 注意すべき点
    if (analysis.warnings && analysis.warnings.length > 0) {
        csv += '注意すべき点\n';
        analysis.warnings.forEach((warning, index) => {
            csv += `${index + 1},"${warning.replace(/"/g, '""')}"\n`;
        });
        csv += '\n';
    }

    // ポジティブな点
    if (analysis.positivePoints && analysis.positivePoints.length > 0) {
        csv += 'ポジティブな点\n';
        analysis.positivePoints.forEach((point, index) => {
            csv += `${index + 1},"${point.replace(/"/g, '""')}"\n`;
        });
        csv += '\n';
    }

    // 推奨アクション
    if (analysis.recommendations && analysis.recommendations.length > 0) {
        csv += '推奨アクション\n';
        analysis.recommendations.forEach((rec, index) => {
            csv += `${index + 1},"${rec.replace(/"/g, '""')}"\n`;
        });
        csv += '\n';
    }

    // 免責事項
    csv += '\n免責事項\n';
    csv += '"この分析結果は参考情報です。投資判断は必ず専門家に相談の上、ご自身の責任で行ってください。"\n';

    // ダウンロード
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const safeFileName = fileName.replace(/[^a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `暗号資産詐欺分析_${safeFileName}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// PDF形式でエクスポート
async function exportToPDF() {
    if (!currentAnalysis) {
        alert('エクスポートする分析結果がありません');
        return;
    }

    try {
        const fileName = currentInputName || 'ホワイトペーパー';
        const results = document.getElementById('results');

        if (!results) {
            alert('分析結果が見つかりません');
            return;
        }

        // ローディング表示
        loading.style.display = 'block';

        // html2canvasで結果エリアをキャプチャ
        const canvas = await html2canvas(results, {
            scale: 2, // 高解像度化
            useCORS: true,
            logging: false,
            backgroundColor: '#0a0a0a',
            windowWidth: results.scrollWidth,
            windowHeight: results.scrollHeight
        });

        // jsPDFインスタンスを作成
        const { jsPDF } = window.jspdf;
        const imgData = canvas.toDataURL('image/png');

        // A4サイズ (210mm x 297mm)
        const pdfWidth = 210;
        const pdfHeight = 297;

        // キャンバスの比率を計算
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = imgWidth / imgHeight;

        // PDF内の画像サイズを計算（マージンを考慮）
        const margin = 10;
        const contentWidth = pdfWidth - (margin * 2);
        const contentHeight = contentWidth / ratio;

        // 必要なページ数を計算
        const pageHeight = pdfHeight - (margin * 2);
        const totalPages = Math.ceil(contentHeight / pageHeight);

        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // 各ページに画像を配置
        for (let page = 0; page < totalPages; page++) {
            if (page > 0) {
                doc.addPage();
            }

            const yOffset = -(page * pageHeight);

            // 画像の一部を切り取ってPDFに配置
            doc.addImage(
                imgData,
                'PNG',
                margin,
                margin + yOffset,
                contentWidth,
                contentHeight,
                undefined,
                'FAST'
            );
        }

        // ダウンロード
        const safeFileName = fileName.replace(/[^a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_');
        const timestamp = new Date().toISOString().slice(0, 10);
        doc.save(`分析結果_${safeFileName}_${timestamp}.pdf`);

        loading.style.display = 'none';

    } catch (error) {
        console.error('PDF export error:', error);
        alert('PDFの生成に失敗しました。もう一度お試しください。');
        loading.style.display = 'none';
    }
}

// ========================================
// 履歴管理機能
// ========================================

// 履歴を読み込み
function loadHistory() {
    try {
        const stored = localStorage.getItem('analysisHistory');
        if (stored) {
            analysisHistory = JSON.parse(stored);
        }
    } catch (error) {
        console.error('履歴の読み込みに失敗:', error);
        analysisHistory = [];
    }
}

// 履歴に保存
function saveToHistory(analysis) {
    const historyItem = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        fileName: currentInputName || 'ホワイトペーパー',
        analysis: analysis
    };

    // 履歴の先頭に追加
    analysisHistory.unshift(historyItem);

    // 最大数を超えたら古いものを削除
    if (analysisHistory.length > MAX_HISTORY_SIZE) {
        analysisHistory = analysisHistory.slice(0, MAX_HISTORY_SIZE);
    }

    // localStorageに保存
    try {
        localStorage.setItem('analysisHistory', JSON.stringify(analysisHistory));
    } catch (error) {
        console.error('履歴の保存に失敗:', error);
        // ストレージが満杯の場合は古い履歴を削除
        if (error.name === 'QuotaExceededError') {
            analysisHistory = analysisHistory.slice(0, 10);
            try {
                localStorage.setItem('analysisHistory', JSON.stringify(analysisHistory));
            } catch (e) {
                console.error('履歴の保存に再度失敗:', e);
            }
        }
    }

    // 履歴UIを更新
    updateHistoryUI();
}

// 履歴UIを更新
function updateHistoryUI() {
    const historyContainer = document.getElementById('history-list');
    if (!historyContainer) return;

    if (analysisHistory.length === 0) {
        historyContainer.innerHTML = `
            <p class="history-empty">まだ分析履歴がありません</p>
        `;
        return;
    }

    let html = '';

    analysisHistory.forEach((item, index) => {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const riskLevel = item.analysis.riskScore >= 71 ? 'high' :
                         item.analysis.riskScore >= 31 ? 'medium' : 'low';
        const riskLabel = riskLevel === 'high' ? '⚠️ 高リスク' :
                         riskLevel === 'medium' ? '⚡ 中リスク' : '✅ 低リスク';
        const riskClass = `score-${riskLevel}`;

        html += `
            <div class="history-item" data-index="${index}">
                <div class="history-info">
                    <div class="history-title">${item.fileName}</div>
                    <div class="history-date">${dateStr}</div>
                </div>
                <div class="history-score">
                    <span class="history-score-value ${riskClass}">${item.analysis.riskScore}</span>
                    <span class="history-risk-label">${riskLabel}</span>
                </div>
                <div class="history-actions">
                    <button class="btn-history-view" onclick="viewHistory(${index})" title="表示">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <button class="btn-history-delete" onclick="deleteHistory(${index})" title="削除">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    });

    historyContainer.innerHTML = html;
}

// 履歴を表示
function viewHistory(index) {
    const item = analysisHistory[index];
    if (!item) return;

    // 現在の分析結果として設定
    currentAnalysis = item.analysis;
    currentInputName = item.fileName;

    // 結果を表示（履歴には保存しない、スクロールは後で実行）
    displayResults(item.analysis, false, false);

    // スコアボックスまでスクロール
    setTimeout(() => {
        const riskScoreBox = document.querySelector('.risk-score');
        if (riskScoreBox) {
            riskScoreBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

// 履歴を削除
function deleteHistory(index) {
    if (!confirm('この履歴を削除しますか？')) return;

    analysisHistory.splice(index, 1);

    try {
        localStorage.setItem('analysisHistory', JSON.stringify(analysisHistory));
    } catch (error) {
        console.error('履歴の削除に失敗:', error);
    }

    updateHistoryUI();
}

// 全履歴を削除
function clearAllHistory() {
    if (!confirm('すべての履歴を削除しますか？この操作は取り消せません。')) return;

    analysisHistory = [];

    try {
        localStorage.removeItem('analysisHistory');
    } catch (error) {
        console.error('履歴のクリアに失敗:', error);
    }

    updateHistoryUI();
}

// 履歴パネルの表示/非表示を切り替え
function toggleHistoryPanel() {
    const panel = document.getElementById('history-panel');
    if (!panel) return;

    panel.classList.toggle('active');
    updateHistoryUI();
}