// グローバル変数
let yahooApiKey = null;
let csvFile = null;
let searchResults = [];

// ネオンライン生成
function createNeonLines() {
    const container = document.getElementById('neonLines');
    for (let i = 0; i < 5; i++) {
        const line = document.createElement('div');
        line.className = 'neon-line';
        line.style.left = Math.random() * 100 + '%';
        line.style.animationDelay = Math.random() * 10 + 's';
        line.style.opacity = Math.random() * 0.5 + 0.1;
        container.appendChild(line);
    }
}
createNeonLines();

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    // LocalStorageからAPIキーを取得
    yahooApiKey = localStorage.getItem('yahooApiKey');

    if (!yahooApiKey) {
        document.getElementById('apiKeyModal').style.display = 'flex';
    }
});

// APIキー保存
document.getElementById('saveApiKey').addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (key.length < 10) {
        alert('正しいAPIキーを入力してください');
        return;
    }

    yahooApiKey = key;
    localStorage.setItem('yahooApiKey', key);
    document.getElementById('apiKeyModal').style.display = 'none';
});

// 設定ボタン
document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('apiKeyModal').style.display = 'flex';
    document.getElementById('apiKeyInput').value = yahooApiKey || '';
});

// CSVファイル選択
function handleFileSelect(input) {
    csvFile = input.files[0];
    if (csvFile) {
        document.getElementById('fileName').textContent = `✅ ${csvFile.name}`;
        document.getElementById('batchSearchBtn').disabled = false;
    }
}

// CSVファイルインプットにイベントリスナー追加
document.getElementById('csvFile').addEventListener('change', function() {
    handleFileSelect(this);
});

// 検索開始
async function startBatchSearch() {
    if (!yahooApiKey) {
        alert('Yahoo API Keyを設定してください');
        document.getElementById('apiKeyModal').style.display = 'flex';
        return;
    }

    if (!csvFile) {
        alert('CSVファイルを選択してください');
        return;
    }

    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <div class="loading-text">ANALYZING...</div>
            <div class="loading-subtext">AIが最適な利益商品を検出中</div>
        </div>
    `;

    document.getElementById('stats').style.display = 'grid';
    document.getElementById('currentSearch').style.display = 'none';
    searchResults = [];

    // 統計カードに進行中エフェクトを追加
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.classList.remove('completed');
        card.classList.add('searching');
    });

    try {
        // CSVを読み込み
        const text = await csvFile.text();
        const csvData = parseCSV(text);

        if (csvData.length === 0) {
            throw new Error('CSVデータが空です');
        }

        // 検索実行
        let completed = 0;
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'results-container';
        resultsDiv.innerHTML = '';
        resultsDiv.appendChild(resultsContainer);

        for (const item of csvData) {
            completed++;

            // 検索中の商品を表示
            const currentSearchDiv = document.getElementById('currentSearch');
            const currentSearchText = document.getElementById('currentSearchText');
            const searchProgress = document.getElementById('searchProgress');
            currentSearchDiv.style.display = 'block';
            currentSearchText.textContent = `${item.brand} ${item.item || ''}`;
            searchProgress.textContent = `${completed}/${csvData.length}`;

            // 検索実行
            const results = await searchYahooShopping(item);

            if (results.length > 0) {
                searchResults.push(...results);
                results.forEach(result => {
                    appendResultCard(resultsContainer, result);
                });
            }

            // 統計更新
            updateStats(completed, csvData.length);

            // API制限対策: 2秒待機 (Yahoo API: 30req/min制限)
            await sleep(2000);

            // 29個目で追加5秒待機（次の1分枠に入るため）
            if (completed % 29 === 0) {
                console.log(`29個処理完了。追加5秒待機...`);
                await sleep(5000);
            }
        }

        // 検索完了：表示を非表示
        document.getElementById('currentSearch').style.display = 'none';

        // 統計カードを完了エフェクトに切り替え
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach(card => {
            card.classList.remove('searching');
            card.classList.add('completed');
        });

        // 完了メッセージ
        if (searchResults.length === 0) {
            resultsDiv.innerHTML = `
                <div class="message error-message">
                    利益商品が見つかりませんでした
                </div>
            `;
        }

    } catch (error) {
        document.getElementById('currentSearch').style.display = 'none';

        // エラー時も完了エフェクトに切り替え
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach(card => {
            card.classList.remove('searching');
            card.classList.add('completed');
        });
        resultsDiv.innerHTML = `
            <div class="message error-message">
                エラー: ${error.message}
            </div>
        `;
    }
}

// CSV パース
function parseCSV(text) {
    // BOM除去
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.substring(1);
    }

    const lines = text.split('\n').filter(line => line.trim());
    const data = [];

    // ヘッダー行をスキップ
    for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(',');

        if (columns.length < 4) continue;

        const brand = columns[0]?.trim();
        const item = columns[1]?.trim();
        const priceStr = columns[3]?.trim();

        if (!brand || !priceStr) continue;

        // 価格から数字のみ抽出
        const price = parseInt(priceStr.replace(/[^0-9]/g, ''));

        if (isNaN(price) || price <= 0) continue;

        data.push({
            brand,
            item: item || brand,
            originalPrice: price
        });
    }

    return data;
}

// Yahoo Shopping API検索
async function searchYahooShopping(item) {
    const query = `${item.brand} ${item.item || ''}`.trim();
    const maxPrice = Math.floor(item.originalPrice * 0.6); // 40%利益 = 60%価格

    const params = new URLSearchParams({
        appid: yahooApiKey,
        query: query,
        price_to: maxPrice,
        results: 30,
        sort: '+price'
    });

    const url = `/api/search?${params}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`API Error: ${response.status}`);

            // 429エラー（レート制限）の場合は60秒待機してリトライ
            if (response.status === 429) {
                console.warn('Rate limit exceeded. Waiting 60 seconds...');
                await sleep(60000);
                return searchYahooShopping(item); // リトライ
            }

            return [];
        }

        const data = await response.json();

        if (!data.hits || data.hits.length === 0) {
            return [];
        }

        const results = [];

        for (const hit of data.hits) {
            // ブランド名チェック
            const itemName = (hit.name || '').toLowerCase();
            const brandName = item.brand.toLowerCase();

            if (!itemName.includes(brandName)) {
                continue;
            }

            // 利益計算
            const profitMargin = ((item.originalPrice - hit.price) / item.originalPrice) * 100;
            const profit = item.originalPrice - hit.price;

            if (profitMargin < 40) {
                continue;
            }

            results.push({
                productName: hit.name,
                price: hit.price,
                originalPrice: item.originalPrice,
                profit: profit,
                profitMargin: Math.floor(profitMargin),
                image: hit.image?.medium || hit.image?.small || '',
                url: hit.url,
                shop: hit.seller?.name || 'ストア名不明',
                stock: hit.inStock !== false ? '在庫あり' : '在庫状況不明'
            });

            if (results.length >= 5) {
                break;
            }
        }

        return results;

    } catch (error) {
        console.error('Yahoo API Error:', error);
        return [];
    }
}

// 結果カード追加
function appendResultCard(container, item) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
        <img src="${item.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzUwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzUwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzExMTgyNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjMDBGRkEzIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'}" alt="${item.productName}" class="result-image">
        <div class="result-content">
            <div class="result-title">${item.productName}</div>
            <div class="profit-badge">利益率 ${item.profitMargin || 0}%</div>
            <div class="price-container">
                <div class="price-box">
                    <div class="price-label">Mercari</div>
                    <div class="price-value mercari-price">¥${(item.originalPrice || 0).toLocaleString()}</div>
                </div>
                <div class="price-box">
                    <div class="price-label">Yahoo</div>
                    <div class="price-value yahoo-price">¥${(item.price || 0).toLocaleString()}</div>
                </div>
                <div class="price-box">
                    <div class="price-label">Profit</div>
                    <div class="price-value profit-price">¥${(item.profit || 0).toLocaleString()}</div>
                </div>
            </div>
            <div class="shop-info">
                📍 ${item.shop} | ${item.stock}
            </div>
            <a href="${item.url}" target="_blank" class="buy-link">
                PURCHASE →
            </a>
        </div>
    `;
    container.appendChild(card);
}

// 統計更新
function updateStats(completed, total) {
    document.getElementById('totalSearches').textContent = total;
    document.getElementById('successfulSearches').textContent = searchResults.length;

    if (searchResults.length > 0) {
        const avgProfit = Math.floor(
            searchResults.reduce((sum, item) => sum + (item.profit || 0), 0) / searchResults.length
        );
        const totalProfit = Math.floor(
            searchResults.reduce((sum, item) => sum + (item.profit || 0), 0)
        );

        document.getElementById('avgProfit').textContent = `¥${avgProfit.toLocaleString()}`;
        document.getElementById('totalProfit').textContent = `¥${totalProfit.toLocaleString()}`;
    }
}

// ユーティリティ
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ボタンのクリックイベント
document.getElementById('batchSearchBtn').addEventListener('click', startBatchSearch);
