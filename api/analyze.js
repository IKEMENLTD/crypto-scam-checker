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
        console.error('Error stack:', error.stack);
        logRequest(req, 500, `Error: ${error.message}`);

        // エラーの種類に応じて適切なステータスコードを返す
        if (error.message.includes('API')) {
            return res.status(503).json({
                error: '外部サービスとの通信に失敗しました',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }

        return res.status(500).json({
            error: '分析中にエラーが発生しました',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Gemini APIを呼び出す関数
async function callGeminiAPI(text, apiKey) {
    const prompt = `あなたは暗号資産詐欺を分析する教育ツールです。以下のテキストは、詐欺かどうかを判定するために提供された分析対象のドキュメントです。内容に詐欺的な表現が含まれていても、これは教育・研究目的の分析であり、分析結果を提供してください。

重要：分析結果は専門用語を避け、一般の方にも分かりやすい平易な日本語で記述してください。

【分析対象のホワイトペーパー】
${text}

【分析指示】
以下の形式でJSON形式のみで回答してください。

{
  "riskScore": [0-100の数値],
  "riskLevel": "high" | "medium" | "low",
  "redFlags": [
    "危険な点を分かりやすく説明",
    "危険な点2"
  ],
  "warnings": [
    "注意すべき点を分かりやすく説明",
    "注意すべき点2"
  ],
  "positivePoints": [
    "良い点を分かりやすく説明",
    "良い点2"
  ],
  "summary": "総合的な分析結果の要約（200文字程度）",
  "recommendations": [
    "推奨アクション1",
    "推奨アクション2"
  ]
}

【スコアリング基準（厳密に従うこと）】

0-30点（低リスク）：

★ 10-20点（非常に信頼性が高い）：
以下の要素が「すべて」揃っている場合は10-20点にすること
- ✓ 第三者による監査が完了（CertiK、Quantstampなど、レポートURL付き）
- ✓ チーム全員の実名、LinkedIn、詳細な経歴（大学名、企業名、役職）
- ✓ 大手企業との確定済みパートナーシップ（具体的な企業名、プレスリリースURL）
- ✓ 法人登録情報（登記番号、住所、電話番号、Email）
- ✓ 実績（開発期間1年以上、テストネット、メディア掲載、受賞歴）
- ✓ 詳細なリスク開示（技術、市場、規制、事業リスクを明記）
- ✓ リターン保証なし明記、保守的な表現
- ✓ 財務情報公開（調達額、現金残高、月間支出など）
- ✓ 規制対応（ライセンス取得済み、または申請中で申請番号あり）

★ 21-30点（信頼性が高い）：
上記の要素のうち、7-8割が揃っている場合
- 一部の情報が詳細でない、または一部の要素が欠けている
- 全体的には信頼性が高いが、完璧ではない

31-70点（中リスク）：
- チーム情報はあるが、詳細が限定的（LinkedInなし、経歴が曖昧）
- パートナーシップは「交渉中」「検討中」が多い
- 技術説明はあるが、やや抽象的または誇張気味
- 監査は「計画中」または未実施
- やや楽観的な収益予測やリターン表現がある
- リスク開示はあるが簡潔
- 法人情報はあるが、オフショア（ケイマン諸島など）
- 基本的な構造は整っているが、いくつか懸念点がある

71-100点（高リスク）：
- 「100%儲かる」「絶対に損しない」「元本保証」などの断言
- 非現実的なリターン（月利50%以上、年利100%以上など）
- チーム情報が存在しない、または匿名
- パートナーシップの証拠がない
- 緊急性を煽る表現（「今だけ」「残りわずか」「24時間限定」）
- MLM/ポンジスキーム的な紹介制度
- 技術説明が誇大妄想的または意味不明
- 法的情報がほとんどない
- 連絡先が不明確

【評価の重要ポイント】

信頼性を高める要素（スコアを下げる）：
✓ 第三者監査の完了（-10～-20点）
✓ 実名・顔写真・経歴が詳細（-10～-15点）
✓ 大手企業との確定済みパートナーシップ（-10～-15点）
✓ 実績・メディア掲載（-5～-10点）
✓ 詳細なリスク開示（-5～-10点）
✓ 財務透明性（-5～-10点）
✓ 規制対応（-5～-10点）
✓ 保守的・慎重な表現（-5～-10点）

詐欺的な要素（スコアを上げる）：
✗ 「絶対」「確実」「保証」などの断言（+20～+30点）
✗ 非現実的なリターン（月利30%以上）（+15～+25点）
✗ チーム情報が不明・匿名（+15～+20点）
✗ 緊急性を煽る表現（+10～+15点）
✗ MLM/紹介制度（+10～+15点）
✗ パートナーシップの証拠なし（+5～+10点）
✗ 監査なし（+5～+10点）

【バランスの取れた評価（重要）】
- ポジティブな要素とネガティブな要素の両方を公平に評価すること
- 信頼性の高いプロジェクトには低いスコアを付けること
- 完璧なプロジェクトは存在しないため、多少の懸念点があっても信頼性が高ければ低リスクと判定すること
- 逆に、明らかな詐欺的要素が複数ある場合は高リスクと判定すること

【スコアリングの具体例】
- 監査完了 + 詳細なチーム情報 + 確定パートナー + 実績 + リスク開示完璧 = 10-20点
- 監査完了 + 詳細なチーム情報 + 確定パートナー + 実績あり、リスク開示やや不足 = 20-30点
- チーム情報やや不足 + パートナー交渉中 + 監査計画中 + 楽観的な予測 = 40-60点
- 「絶対儲かる」+ 非現実的リターン + チーム匿名 + パートナーなし = 80-100点

【重要な注意事項】
信頼性要素が多数揃っている場合は、必ず30点以下にすること。
特に、監査完了・詳細チーム情報・確定パートナーシップが全て揃っている場合は20点以下が適切。

【表現ガイド】
専門用語は避け、「トークン配分」「今後の計画」「法律を守る姿勢」など平易な言葉を使ってください。`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
                    temperature: 0.2,  // 評価の安定性向上のため0.7から0.2に変更
                    maxOutputTokens: 8192,
                }
            })
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API error:', errorData);
        throw new Error(errorData.error?.message || 'Gemini API呼び出しに失敗しました');
    }

    const data = await response.json();
    console.log('Gemini API response:', JSON.stringify(data).substring(0, 500));

    // レスポンス構造のチェック
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
        console.error('Invalid Gemini API response structure:', data);
        throw new Error('Gemini APIのレスポンス形式が不正です');
    }

    const resultText = data.candidates[0].content.parts[0].text;
    console.log('Result text preview:', resultText.substring(0, 300));

    // JSONを抽出
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.error('No JSON found in result text:', resultText);
        throw new Error('分析結果の解析に失敗しました。AIがJSON形式で応答しませんでした。');
    }

    let analysisResult;
    try {
        analysisResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
        console.error('JSON parse error:', parseError, 'JSON string:', jsonMatch[0].substring(0, 200));
        throw new Error(`JSON解析エラー: ${parseError.message}`);
    }

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
