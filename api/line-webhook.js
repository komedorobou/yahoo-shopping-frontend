import crypto from 'crypto';

const CHANNEL_SECRET = '7d32000110d4dd72028f39e3c2dd3446';

export default async function handler(req, res) {
  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Line-Signature');

  // OPTIONSリクエスト対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POSTメソッドのみ許可
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // LINE署名検証
    const signature = req.headers['x-line-signature'];
    if (!signature) {
      return res.status(401).json({ error: 'No signature' });
    }

    const body = JSON.stringify(req.body);
    const hash = crypto
      .createHmac('SHA256', CHANNEL_SECRET)
      .update(body)
      .digest('base64');

    if (hash !== signature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Webhookイベント処理
    const events = req.body.events || [];

    for (const event of events) {
      // 友だち追加イベント
      if (event.type === 'follow') {
        const userId = event.source.userId;
        const timestamp = event.timestamp;

        // リンクパラメータから外注先IDを取得（今後実装）
        // event.follow?.params?.state に partner_123 のような値が入る

        console.log('友だち追加:', {
          userId,
          timestamp,
          event
        });

        // ここで外注先データベースに自動登録
        // 現状はLocalStorageベースなので、フロントエンドから別途APIで登録する必要がある
        // 将来的にはデータベース（Supabase等）に保存
      }

      // メッセージ受信イベント
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const text = event.message.text;

        console.log('メッセージ受信:', {
          userId,
          text
        });
      }
    }

    // LINE側には200を返す（必須）
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('LINE Webhook Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
