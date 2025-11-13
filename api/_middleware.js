// セキュリティミドルウェア

// レート制限用のメモリストレージ（シンプル版）
// 注意: サーバーレス環境では複数インスタンス間で共有されない
// 本番環境ではUpstash RedisやVercel KVの使用を推奨
const rateLimitStore = new Map();

// 古いエントリをクリーンアップ
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now - data.resetTime > 0) {
            rateLimitStore.delete(key);
        }
    }
}, 60000); // 1分ごとにクリーンアップ

/**
 * レート制限チェック
 * @param {string} identifier - IP アドレスまたは識別子
 * @param {number} maxRequests - 期間内の最大リクエスト数
 * @param {number} windowMs - 時間窓（ミリ秒）
 * @returns {Object} - { allowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const key = `rate_${identifier}`;

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
        // 新しいウィンドウ
        record = {
            count: 0,
            resetTime: now + windowMs
        };
        rateLimitStore.set(key, record);
    }

    record.count++;

    const allowed = record.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - record.count);

    return {
        allowed,
        remaining,
        resetTime: record.resetTime
    };
}

/**
 * IPアドレスを取得
 */
export function getClientIP(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        'unknown'
    );
}

/**
 * 入力検証
 */
export function validateInput(text) {
    const errors = [];

    // 必須チェック
    if (!text || typeof text !== 'string') {
        errors.push('テキストが必要です');
        return { valid: false, errors };
    }

    // 長さチェック
    if (text.trim().length < 10) {
        errors.push('テキストは最低10文字必要です');
    }

    if (text.length > 100000) {
        errors.push('テキストが長すぎます（最大100,000文字）');
    }

    // 不正な文字チェック（制御文字など）
    const controlCharsRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
    if (controlCharsRegex.test(text)) {
        errors.push('不正な文字が含まれています');
    }

    // SQLインジェクション的なパターンチェック（念のため）
    const sqlPatterns = /(\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b).*\b(TABLE|FROM|INTO)\b/i;
    if (sqlPatterns.test(text.substring(0, 1000))) {
        errors.push('不正なパターンが検出されました');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * セキュリティヘッダーを設定
 */
export function setSecurityHeaders(res) {
    // XSS対策
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Content Security Policy
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    );

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

/**
 * エラーレスポンスを安全に返す
 */
export function sendErrorResponse(res, statusCode, message, details = null) {
    const response = {
        error: message,
        timestamp: new Date().toISOString()
    };

    // 開発環境でのみ詳細を含める
    if (process.env.NODE_ENV === 'development' && details) {
        response.details = details;
    }

    return res.status(statusCode).json(response);
}

/**
 * リクエストログ（簡易版）
 */
export function logRequest(req, status, message = '') {
    const ip = getClientIP(req);
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;

    console.log(`[${timestamp}] ${ip} ${method} ${url} - ${status} ${message}`);
}
