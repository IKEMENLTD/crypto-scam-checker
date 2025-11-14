// Vercel サーバーレス関数 - ホワイトペーパー分析API（セキュリティ強化版）

const {
    checkRateLimit,
    getClientIP,
    validateInput,
    setSecurityHeaders,
    sendErrorResponse,
    logRequest
} = require('./_middleware.js');

module.exports = async function handler(req, res) {
    // セキュリティヘッダーを設定
    setSecurityHeaders(res);

    // 許可されたオリジンのみCORSを許可（本番環境では実際のドメインを設定）
    const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:8000'];

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'production') {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24時間

    // OPTIONSリクエスト（プリフライト）への対応
    if (req.method === 'OPTIONS') {
        logRequest(req, 200, 'CORS preflight');
        res.status(200).end();
        return;
    }

    // POSTメソッドのみ許可
    if (req.method !== 'POST') {
        logRequest(req, 405, 'Method not allowed');
        return sendErrorResponse(res, 405, 'POSTメソッドのみ許可されています');
    }

    // クライアントIPを取得
    const clientIP = getClientIP(req);

    // レート制限チェック（1分間に10リクエストまで）
    const rateLimit = checkRateLimit(clientIP, 10, 60000);
    res.setHeader('X-RateLimit-Limit', '10');
    res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
    res.setHeader('X-RateLimit-Reset', String(rateLimit.resetTime));

    if (!rateLimit.allowed) {
        logRequest(req, 429, `Rate limit exceeded - IP: ${clientIP}`);
        return sendErrorResponse(
            res,
            429,
            'リクエスト数が制限を超えました。しばらくしてから再試行してください。',
            { resetTime: new Date(rateLimit.resetTime).toISOString() }
        );
    }

    try {
        const { text } = req.body;

        // 入力検証
        const validation = validateInput(text);
        if (!validation.valid) {
            logRequest(req, 400, `Validation failed - ${validation.errors.join(', ')}`);
            return sendErrorResponse(res, 400, validation.errors[0], validation.errors);
        }

        // テキストの長さ制限
        const maxLength = 30000;
        let analyzedText = text.trim();
        if (analyzedText.length > maxLength) {
            analyzedText = analyzedText.substring(0, maxLength) + '\n\n[テキストが長すぎるため、一部省略されました]';
        }

        // 環境変数からAPIキーを取得
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            logRequest(req, 500, 'API key not configured');
            return sendErrorResponse(res, 500, 'サービスが正しく設定されていません');
        }

        // Gemini APIを呼び出し
        logRequest(req, 200, 'Starting analysis');
        const analysisResult = await callGeminiAPI(analyzedText, apiKey);

        logRequest(req, 200, 'Analysis completed successfully');

        // 結果を返す
        return res.status(200).json({
            ...analysisResult,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Analysis error:', error);
        logRequest(req, 500, `Error: ${error.message}`);

        // エラーの種類に応じて適切なステータスコードを返す
        if (error.message.includes('API')) {
            return sendErrorResponse(res, 503, '外部サービスとの通信に失敗しました', error.message);
        }

        return sendErrorResponse(res, 500, '分析中にエラーが発生しました', error.message);
    }
}

// Gemini APIを呼び出す関数
async function callGeminiAPI(text, apiKey) {
    const prompt = `あなたは暗号資産詐欺の専門家です。以下のホワイトペーパーを分析し、詐欺の可能性を評価してください。

【分析対象のホワイトペーパー】
${text}

【分析指示】
以下の形式でJSON形式のみで回答してください。他の説明は不要です。

{
  "riskScore": [0-100の数値],
  "riskLevel": "high" | "medium" | "low",
  "redFlags": [
    "具体的な危険信号1",
    "具体的な危険信号2"
  ],
  "warnings": [
    "注意すべき点1",
    "注意すべき点2"
  ],
  "positivePoints": [
    "良い点1",
    "良い点2"
  ],
  "summary": "総合的な分析結果の要約（200文字程度）",
  "recommendations": [
    "推奨アクション1",
    "推奨アクション2"
  ]
}

【評価基準】
- 非現実的なリターンの約束
- 実現性の低い技術的主張
- チーム情報の不透明性
- トークノミクスの不自然さ
- ロードマップの不明確さ
- 法的コンプライアンスへの言及の欠如
- コミュニティやパートナーシップの実績
- ホワイトペーパーの品質と専門性`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            })
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Gemini API呼び出しに失敗しました');
    }

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;

    // JSONを抽出
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('分析結果の解析に失敗しました');
    }

    const analysisResult = JSON.parse(jsonMatch[0]);

    // デフォルト値を設定（存在しない場合）
    return {
        riskScore: analysisResult.riskScore || 50,
        riskLevel: analysisResult.riskLevel || 'medium',
        redFlags: analysisResult.redFlags || [],
        warnings: analysisResult.warnings || [],
        positivePoints: analysisResult.positivePoints || [],
        summary: analysisResult.summary || '分析を完了しました',
        recommendations: analysisResult.recommendations || []
    };
}
