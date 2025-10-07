#!/bin/bash
echo "🚀 強制デプロイを実行します..."
git add -A
git commit -m "DEPLOY NOW - 外注先管理機能" --allow-empty
git push origin main
echo "✅ GitHubにプッシュ完了"
echo "⏳ Vercelのデプロイを待機中..."
