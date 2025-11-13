import { checkRateLimit, getClientIP, setSecurityHeaders, sendErrorResponse, logRequest } from './_middleware.js';

export default async function handler(req, res) {
    // セキュリティヘッダーを設定
    setSecurityHeaders(res);

    // CORSヘッダーを設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // プリフライトリクエストに対応
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // POSTメソッドのみ許可
    if (req.method !== 'POST') {
        return sendErrorResponse(res, 405, 'Method Not Allowed');
    }

    try {
        // レート制限チェック
        const clientIP = getClientIP(req);
        const rateLimit = checkRateLimit(clientIP, 5, 60000); // 1分あたり5リクエスト

        if (!rateLimit.allowed) {
            res.setHeader('X-RateLimit-Limit', rateLimit.limit);
            res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
            res.setHeader('X-RateLimit-Reset', rateLimit.reset);
            return sendErrorResponse(res, 429, 'リクエスト数が制限を超えました。しばらく待ってから再試行してください。');
        }

        // リクエストボディを取得
        const { url } = req.body;

        // URLのバリデーション
        if (!url || typeof url !== 'string') {
            return sendErrorResponse(res, 400, 'URLが指定されていません');
        }

        // URLの形式チェック
        let targetUrl;
        try {
            targetUrl = new URL(url);
        } catch (error) {
            return sendErrorResponse(res, 400, '無効なURL形式です');
        }

        // プロトコルチェック（HTTPSのみ許可、または開発用にHTTPも許可）
        if (!['http:', 'https:'].includes(targetUrl.protocol)) {
            return sendErrorResponse(res, 400, 'HTTPまたはHTTPSのURLのみサポートしています');
        }

        logRequest(req, 'Fetching URL', { url: targetUrl.href });

        // URLからコンテンツを取得
        const fetchResponse = await fetch(targetUrl.href, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CryptoScamChecker/1.0)'
            },
            redirect: 'follow',
            timeout: 30000 // 30秒タイムアウト
        });

        if (!fetchResponse.ok) {
            return sendErrorResponse(res, 502, `URLの取得に失敗しました: ${fetchResponse.status} ${fetchResponse.statusText}`);
        }

        const contentType = fetchResponse.headers.get('content-type') || '';

        let extractedText = '';

        // PDFファイルの場合
        if (contentType.includes('application/pdf') || targetUrl.pathname.toLowerCase().endsWith('.pdf')) {
            try {
                const buffer = await fetchResponse.arrayBuffer();

                // PDF.jsを使用してテキスト抽出（ブラウザ環境用）
                // サーバーサイドではpdf-parseを使用する必要がありますが、
                // Vercelのサーバーレス環境では外部ライブラリのインストールが必要
                // 簡易的な実装として、PDFのバイナリから可視テキストを抽出
                const uint8Array = new Uint8Array(buffer);
                const textDecoder = new TextDecoder('utf-8');
                const rawText = textDecoder.decode(uint8Array);

                // PDFの生テキストから可読部分を抽出（簡易版）
                const textMatches = rawText.match(/[A-Za-z0-9\s\.\,\;\:\!\?\-\'\"]+/g);
                if (textMatches && textMatches.length > 0) {
                    extractedText = textMatches
                        .filter(text => text.trim().length > 10) // 10文字以上のテキストのみ
                        .join(' ')
                        .substring(0, 50000); // 最大50000文字
                }

                if (extractedText.length < 100) {
                    return sendErrorResponse(res, 400, 'PDFからテキストを抽出できませんでした。PDFファイルをダウンロードして、テキストをコピー＆ペーストしてください。');
                }
            } catch (error) {
                console.error('PDF extraction error:', error);
                return sendErrorResponse(res, 500, 'PDFの処理中にエラーが発生しました');
            }
        }
        // HTMLの場合
        else if (contentType.includes('text/html')) {
            const html = await fetchResponse.text();

            // HTMLタグを除去してテキストを抽出
            extractedText = html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // scriptタグを除去
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // styleタグを除去
                .replace(/<[^>]+>/g, ' ') // すべてのHTMLタグを除去
                .replace(/\s+/g, ' ') // 複数の空白を1つに
                .trim()
                .substring(0, 50000); // 最大50000文字
        }
        // プレーンテキストの場合
        else if (contentType.includes('text/plain')) {
            extractedText = await fetchResponse.text();
            extractedText = extractedText.substring(0, 50000); // 最大50000文字
        }
        else {
            return sendErrorResponse(res, 400, 'サポートされていないファイル形式です。PDF、HTML、またはテキストファイルのみサポートしています。');
        }

        // テキストの長さチェック
        if (extractedText.length < 100) {
            return sendErrorResponse(res, 400, '取得したテキストが短すぎます。有効なホワイトペーパーのURLを指定してください。');
        }

        // 成功レスポンス
        res.status(200).json({
            success: true,
            text: extractedText,
            contentType: contentType,
            length: extractedText.length
        });

    } catch (error) {
        console.error('Fetch error:', error);

        if (error.name === 'AbortError' || error.message.includes('timeout')) {
            return sendErrorResponse(res, 504, 'リクエストがタイムアウトしました。URLが正しいか確認してください。');
        }

        return sendErrorResponse(res, 500, 'URLの取得中にエラーが発生しました。');
    }
}
