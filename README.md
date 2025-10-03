# Yahoo Shopping 利益商品検索ツール

メルカリの売れ筋商品データから、Yahoo Shoppingで安く仕入れられる利益商品を自動検索するツール

## 特徴

- **完全フロントエンド**: サーバー不要、ブラウザだけで動作
- **プライバシー保護**: APIキーはブラウザのLocalStorageに保存（サーバー送信なし）
- **リアルタイム検索**: Yahoo Shopping API V3を使用
- **CSVエクスポート**: 検索結果をCSV形式でダウンロード可能

## 必要なもの

1. **Yahoo Shopping API アプリケーションID**
   - [Yahoo! デベロッパーネットワーク](https://e.developer.yahoo.co.jp/register)で無料取得
   - 1日50,000リクエストまで無料

2. **CSVファイル** (商品データ)
   - A列: ブランド名
   - B列: 商品名
   - D列: 最頻値価格 (数値のみ、またはカンマ区切り)

## 使い方

### 1. 開く

ブラウザで `index.html` を開く

または

Vercelにデプロイして公開URL経由でアクセス

### 2. APIキー設定

初回起動時にYahoo Shopping APIのアプリケーションIDを入力

### 3. CSVアップロード

商品データのCSVファイルを選択

### 4. 検索設定

- **最低利益率**: デフォルト40%
- **最大検索件数**: デフォルト20行
- **1商品あたりの結果数**: デフォルト5件

### 5. 検索開始

「検索開始」ボタンをクリック

### 6. 結果確認

利益商品が見つかったら、カード形式で表示されます

### 7. CSVエクスポート

「CSVエクスポート」ボタンで結果をダウンロード

## Vercelデプロイ方法

```bash
# Vercel CLIインストール
npm install -g vercel

# プロジェクトディレクトリで
cd /mnt/c/Users/komed/Desktop/yahoo-shopping-frontend

# デプロイ
vercel

# 本番環境にデプロイ
vercel --prod
```

## CSVフォーマット例

```csv
ブランド,グループ名,,最頻値価格,,,
IENA,ラムウール ノーカラー ロングコート,,12000,,,
Deuxieme Classe,ウールアンゴラリバーコート,,49000,,,
```

## 注意事項

- Yahoo Shopping APIの利用規約を遵守してください
- APIリクエストは1秒間隔で実行されます（API制限対策）
- 大量検索時はブラウザがフリーズする可能性があります

## ライセンス

MIT License

## 開発者

Claude Code + Human
