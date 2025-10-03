// グローバル変数
let yahooApiKey = null;
let csvData = [];
let searchResults = [];

// DOM要素
const apiKeyModal = document.getElementById('apiKeyModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const mainContent = document.getElementById('mainContent');
const settingsBtn = document.getElementById('settingsBtn');
const csvFileInput = document.getElementById('csvFile');
const csvStatus = document.getElementById('csvStatus');
const startSearchBtn = document.getElementById('startSearch');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const resultsSection = document.getElementById('resultsSection');
const resultsStats = document.getElementById('resultsStats');
const resultsContainer = document.getElementById('resultsContainer');
const exportResultsBtn = document.getElementById('exportResults');
const minProfitMarginInput = document.getElementById('minProfitMargin');
const maxSearchItemsInput = document.getElementById('maxSearchItems');
const resultsPerItemInput = document.getElementById('resultsPerItem');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    // LocalStorageからAPIキーを取得
    yahooApiKey = localStorage.getItem('yahooApiKey');

    if (yahooApiKey) {
        apiKeyModal.style.display = 'none';
        mainContent.style.display = 'block';
    } else {
        apiKeyModal.style.display = 'flex';
        mainContent.style.display = 'none';
    }
});

// APIキー保存
saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key.length < 10) {
        alert('正しいAPIキーを入力してください');
        return;
    }

    yahooApiKey = key;
    localStorage.setItem('yahooApiKey', key);
    apiKeyModal.style.display = 'none';
    mainContent.style.display = 'block';
});

// 設定ボタン
settingsBtn.addEventListener('click', () => {
    apiKeyModal.style.display = 'flex';
    apiKeyInput.value = yahooApiKey;
});

// CSVファイル読み込み
csvFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        csvData = parseCSV(text);

        if (csvData.length === 0) {
            throw new Error('CSVデータが空です');
        }

        csvStatus.className = 'status success';
        csvStatus.textContent = `✓ ${csvData.length}件の商品を読み込みました`;
        startSearchBtn.disabled = false;
    } catch (error) {
        csvStatus.className = 'status error';
        csvStatus.textContent = `✗ エラー: ${error.message}`;
        startSearchBtn.disabled = true;
    }
});

// CSV パース (BOM対応)
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

        if (!brand || !item || !priceStr) continue;

        // 価格から数字のみ抽出
        const price = parseInt(priceStr.replace(/[^0-9]/g, ''));

        if (isNaN(price) || price <= 0) continue;

        data.push({
            brand,
            item,
            originalPrice: price
        });
    }

    return data;
}

// 検索開始
startSearchBtn.addEventListener('click', async () => {
    const minProfit = parseInt(minProfitMarginInput.value) || 40;
    const maxItems = parseInt(maxSearchItemsInput.value) || 20;
    const resultsPerItem = parseInt(resultsPerItemInput.value) || 5;

    searchResults = [];
    startSearchBtn.disabled = true;
    progressSection.style.display = 'block';
    resultsSection.style.display = 'none';

    const itemsToSearch = csvData.slice(0, maxItems);

    for (let i = 0; i < itemsToSearch.length; i++) {
        const item = itemsToSearch[i];

        // 進捗更新
        const progress = ((i + 1) / itemsToSearch.length) * 100;
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${i + 1} / ${itemsToSearch.length}`;

        try {
            const results = await searchYahooShopping(item, minProfit, resultsPerItem);
            searchResults.push(...results);
        } catch (error) {
            console.error(`検索エラー (${item.brand} ${item.item}):`, error);
        }

        // API制限対策: 1秒待機
        await sleep(1000);
    }

    // 検索完了
    progressSection.style.display = 'none';
    displayResults();
    startSearchBtn.disabled = false;
});

// Yahoo Shopping API検索
async function searchYahooShopping(item, minProfitMargin, maxResults) {
    const query = `${item.brand} ${item.item}`;
    const maxPrice = Math.floor(item.originalPrice * (1 - minProfitMargin / 100));

    const params = new URLSearchParams({
        appid: yahooApiKey,
        query: query,
        price_to: maxPrice,
        results: 30,
        sort: '+price'
    });

    const url = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?${params}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.hits || data.hits.length === 0) {
            return [];
        }

        const results = [];

        for (const hit of data.hits) {
            // ブランド名チェック
            const itemName = (hit.name || '').toLowerCase();
            const description = (hit.description || '').toLowerCase();
            const brandName = item.brand.toLowerCase();

            if (!itemName.includes(brandName) && !description.includes(brandName)) {
                continue;
            }

            // 利益計算
            const profitMargin = ((item.originalPrice - hit.price) / item.originalPrice) * 100;
            const profit = item.originalPrice - hit.price;

            if (profitMargin < minProfitMargin) {
                continue;
            }

            results.push({
                brand: item.brand,
                originalItem: item.item,
                originalPrice: item.originalPrice,
                name: hit.name,
                price: hit.price,
                profit: profit,
                profitMargin: Math.floor(profitMargin),
                image: hit.image?.medium || hit.image?.small || '',
                url: hit.url,
                description: hit.description || ''
            });

            if (results.length >= maxResults) {
                break;
            }
        }

        return results;

    } catch (error) {
        console.error('Yahoo API Error:', error);
        return [];
    }
}

// 結果表示
function displayResults() {
    if (searchResults.length === 0) {
        resultsSection.style.display = 'block';
        resultsStats.textContent = '利益商品が見つかりませんでした';
        resultsContainer.innerHTML = '';
        return;
    }

    // 統計情報
    const totalProfit = searchResults.reduce((sum, r) => sum + r.profit, 0);
    const avgProfit = Math.floor(totalProfit / searchResults.length);

    resultsStats.innerHTML = `
        <strong>${searchResults.length}件</strong>の利益商品を発見 |
        平均利益: <strong>¥${avgProfit.toLocaleString()}</strong> |
        合計予想利益: <strong>¥${totalProfit.toLocaleString()}</strong>
    `;

    // カード表示
    resultsContainer.innerHTML = searchResults.map(result => `
        <div class="result-card">
            <img src="${result.image || 'https://placehold.co/300x200?text=No+Image'}" alt="${result.name}">
            <div class="result-card-content">
                <div class="brand">${result.brand} - ${result.originalItem}</div>
                <h3>${result.name}</h3>
                <div class="prices">
                    <span class="price">¥${result.price.toLocaleString()}</span>
                    <span class="original-price">¥${result.originalPrice.toLocaleString()}</span>
                </div>
                <div class="profit">
                    利益: ¥${result.profit.toLocaleString()} (${result.profitMargin}%)
                </div>
                <a href="${result.url}" target="_blank" class="link-btn">Yahoo!で見る</a>
            </div>
        </div>
    `).join('');

    resultsSection.style.display = 'block';
}

// CSV エクスポート
exportResultsBtn.addEventListener('click', () => {
    if (searchResults.length === 0) {
        alert('エクスポートする結果がありません');
        return;
    }

    // CSVヘッダー
    let csv = 'ブランド,元商品名,メルカリ価格,Yahoo商品名,Yahoo価格,利益,利益率,URL\n';

    // データ行
    searchResults.forEach(r => {
        csv += `"${r.brand}","${r.originalItem}",${r.originalPrice},"${r.name.replace(/"/g, '""')}",${r.price},${r.profit},${r.profitMargin}%,"${r.url}"\n`;
    });

    // ダウンロード
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `profit_items_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
});

// ユーティリティ
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
