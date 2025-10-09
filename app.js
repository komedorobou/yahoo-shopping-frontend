// グローバル変数
let yahooApiKey = null;
let csvFile = null;
let searchResults = [];
let selectedProducts = []; // 選択された商品を保持
let partners = []; // 外注先リスト
let currentPartnerTab = 'approved'; // 現在表示中のタブ

// Supabase設定
const SUPABASE_URL = 'https://czwwlrrgtmiagujdjxdr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6d3dscnJndG1pYWd1amRqeGRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMDM4NDgsImV4cCI6MjA3NTU3OTg0OH0.hKmaKImJP4ApCHoL4lHk8VjzShoQowyLx_e81wkKGis';

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

    // 外注先リストを読み込み
    loadPartnersFromStorage();
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
        let cardIndex = 0; // カードのインデックス
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
                    appendResultCard(resultsContainer, result, cardIndex++);
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

            // 在庫フィルター
            const includeUnknown = document.getElementById('includeUnknownStock').checked;
            const stockStatus = hit.inStock !== false ? '在庫あり' : '在庫状況不明';

            // トグルOFFで在庫不明を除外
            if (!includeUnknown && stockStatus === '在庫状況不明') {
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
                stock: stockStatus
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
function appendResultCard(container, item, index) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.dataset.index = index; // インデックスを保存

    // 商品データをカードに保存
    card.dataset.productData = JSON.stringify(item);

    card.innerHTML = `
        <div class="card-checkbox-container">
            <input type="checkbox" class="card-checkbox" id="checkbox-${index}" onchange="toggleProductSelect(this, ${index})">
            <label for="checkbox-${index}" class="checkbox-label"></label>
        </div>
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
            <button class="skip-btn" onclick="toggleSkip(this)">見送り</button>
        </div>
    `;
    container.appendChild(card);
}

// 見送りトグル
function toggleSkip(button) {
    const card = button.closest('.result-card');
    const isSkipped = card.classList.toggle('skipped');

    if (isSkipped) {
        button.textContent = '見送り済み';
        button.style.background = 'rgba(148, 163, 184, 0.3)';
    } else {
        button.textContent = '見送り';
        button.style.background = '';
    }

    // 統計を再計算
    recalculateStats();
}

// 統計再計算
function recalculateStats() {
    const allCards = document.querySelectorAll('.result-card');
    const activeResults = [];

    allCards.forEach(card => {
        if (!card.classList.contains('skipped')) {
            // カードから利益情報を抽出
            const profitText = card.querySelector('.profit-price').textContent;
            const profit = parseInt(profitText.replace(/[^0-9]/g, ''));
            activeResults.push({ profit });
        }
    });

    // 統計更新
    document.getElementById('successfulSearches').textContent = activeResults.length;

    if (activeResults.length > 0) {
        const avgProfit = Math.floor(
            activeResults.reduce((sum, item) => sum + (item.profit || 0), 0) / activeResults.length
        );
        const totalProfit = Math.floor(
            activeResults.reduce((sum, item) => sum + (item.profit || 0), 0)
        );

        document.getElementById('avgProfit').textContent = `¥${avgProfit.toLocaleString()}`;
        document.getElementById('totalProfit').textContent = `¥${totalProfit.toLocaleString()}`;
    } else {
        document.getElementById('avgProfit').textContent = '¥0';
        document.getElementById('totalProfit').textContent = '¥0';
    }
}

// ソート機能
function sortResults() {
    const sortValue = document.getElementById('sortSelect').value;
    const container = document.querySelector('.results-container');
    if (!container) return;

    const cards = Array.from(container.querySelectorAll('.result-card'));

    // 標準順（元の順番）の場合はdata-index属性でソート
    if (sortValue === 'default') {
        cards.sort((a, b) => {
            const indexA = parseInt(a.dataset.index) || 0;
            const indexB = parseInt(b.dataset.index) || 0;
            return indexA - indexB;
        });
    } else {
        cards.sort((a, b) => {
            const getProfit = (card) => parseInt(card.querySelector('.profit-price').textContent.replace(/[^0-9]/g, '')) || 0;
            const getMargin = (card) => parseInt(card.querySelector('.profit-badge').textContent.replace(/[^0-9]/g, '')) || 0;
            const getPrice = (card) => parseInt(card.querySelector('.yahoo-price').textContent.replace(/[^0-9]/g, '')) || 0;

            switch (sortValue) {
                case 'profit-desc':
                    return getProfit(b) - getProfit(a);
                case 'profit-asc':
                    return getProfit(a) - getProfit(b);
                case 'margin-desc':
                    return getMargin(b) - getMargin(a);
                case 'margin-asc':
                    return getMargin(a) - getMargin(b);
                case 'price-asc':
                    return getPrice(a) - getPrice(b);
                case 'price-desc':
                    return getPrice(b) - getPrice(a);
                default:
                    return 0;
            }
        });
    }

    // カードを再配置
    cards.forEach(card => container.appendChild(card));
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

// 商品選択トグル
function toggleProductSelect(checkbox, index) {
    const card = checkbox.closest('.result-card');
    const productData = JSON.parse(card.dataset.productData);

    if (checkbox.checked) {
        // 選択された商品を配列に追加
        selectedProducts.push({
            index: index,
            data: productData
        });
    } else {
        // 選択解除：配列から削除
        selectedProducts = selectedProducts.filter(p => p.index !== index);
    }

    // 選択数カウントを更新
    updateSelectedCount();
}

// 選択数カウント更新
function updateSelectedCount() {
    const countElement = document.getElementById('selectedCount');
    const sendBtn = document.getElementById('sendSelectedBtn');

    if (countElement) {
        countElement.textContent = selectedProducts.length;
    }

    // 送信ボタンの有効/無効を切り替え
    if (sendBtn) {
        if (selectedProducts.length > 0) {
            sendBtn.style.opacity = '1';
            sendBtn.style.pointerEvents = 'auto';
        } else {
            sendBtn.style.opacity = '0.5';
            sendBtn.style.pointerEvents = 'none';
        }
    }
}

// ========================================
// 商品送信機能
// ========================================

let selectedPartnerId = null; // 選択された送信先

// 送信モーダルを開く
function openSendModal() {
    if (selectedProducts.length === 0) {
        alert('商品が選択されていません');
        return;
    }

    // 選択商品数を表示
    document.getElementById('selectedProductCount').textContent = `${selectedProducts.length} 件`;

    // 外注先リストを表示
    displayPartnerSelectList();

    // モーダルを表示
    document.getElementById('sendModal').style.display = 'flex';
}

// 送信モーダルを閉じる
function closeSendModal() {
    document.getElementById('sendModal').style.display = 'none';
    selectedPartnerId = null;
}

// 送信先選択リストを表示
function displayPartnerSelectList() {
    const listContainer = document.getElementById('partnerSelectList');

    if (partners.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(148, 163, 184, 0.7);">
                外注先が登録されていません<br>
                <small>「👥 外注先管理」から登録してください</small>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = partners.map((partner, index) => {
        const sendMethodBadge = partner.sendMethod === 'email'
            ? '<span style="display: inline-block; padding: 3px 10px; background: rgba(0, 184, 217, 0.2); border: 1px solid rgba(0, 184, 217, 0.4); border-radius: 12px; font-size: 11px; font-weight: 600; color: #00B8D9;">📧 メール</span>'
            : '<span style="display: inline-block; padding: 3px 10px; background: rgba(0, 255, 163, 0.2); border: 1px solid rgba(0, 255, 163, 0.4); border-radius: 12px; font-size: 11px; font-weight: 600; color: #00FFA3;">💬 LINE</span>';

        // LINE送信だがUser IDが未設定の場合は送信不可
        const isDisabled = partner.sendMethod === 'line' && !partner.lineId;
        const disabledStyle = isDisabled ? 'opacity: 0.5; cursor: not-allowed;' : 'cursor: pointer;';
        const disabledNote = isDisabled ? '<div style="color: #FF6B9D; font-size: 11px; margin-top: 5px;">※LINE User IDが未設定です</div>' : '';

        return `
            <div onclick="${isDisabled ? '' : `selectPartner(${index})`}"
                 id="partner_select_${index}"
                 style="padding: 15px; margin-bottom: 10px; background: rgba(0, 255, 163, 0.05); border: 2px solid rgba(0, 255, 163, 0.2); border-radius: 8px; transition: all 0.3s; ${disabledStyle}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="margin-bottom: 5px;">${sendMethodBadge}</div>
                        <div style="font-size: 16px; font-weight: 700; color: #00FFA3; margin-bottom: 5px;">
                            ${partner.name}
                        </div>
                        ${partner.email ? `<div style="font-size: 12px; color: rgba(148, 163, 184, 0.9);">📧 ${partner.email}</div>` : ''}
                        ${partner.lineId ? `<div style="font-size: 12px; color: rgba(148, 163, 184, 0.9);">💬 連携済み</div>` : ''}
                        ${disabledNote}
                    </div>
                    <div class="partner-check-icon" style="width: 30px; height: 30px; border: 2px solid rgba(0, 255, 163, 0.5); border-radius: 50%; display: none; align-items: center; justify-content: center;">
                        <span style="color: #00FFA3; font-size: 18px; font-weight: 900;">✓</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 送信先を選択
function selectPartner(index) {
    // 以前の選択を解除
    document.querySelectorAll('#partnerSelectList > div').forEach(div => {
        div.style.borderColor = 'rgba(0, 255, 163, 0.2)';
        div.style.background = 'rgba(0, 255, 163, 0.05)';
        const icon = div.querySelector('.partner-check-icon');
        if (icon) icon.style.display = 'none';
    });

    // 新しい選択を適用
    const selectedDiv = document.getElementById(`partner_select_${index}`);
    selectedDiv.style.borderColor = '#00FFA3';
    selectedDiv.style.background = 'rgba(0, 255, 163, 0.15)';
    selectedDiv.style.boxShadow = '0 0 20px rgba(0, 255, 163, 0.3)';
    const icon = selectedDiv.querySelector('.partner-check-icon');
    if (icon) icon.style.display = 'flex';

    selectedPartnerId = index;
}

// 送信確認
async function confirmSend() {
    if (selectedPartnerId === null) {
        alert('送信先を選択してください');
        return;
    }

    const partner = partners[selectedPartnerId];
    const productCount = selectedProducts.length;

    if (!confirm(`${partner.name} に ${productCount}件の商品を送信しますか？`)) {
        return;
    }

    // 送信ボタンを無効化
    const sendBtn = document.getElementById('confirmSendBtn');
    sendBtn.disabled = true;
    sendBtn.textContent = '送信中...';
    sendBtn.style.opacity = '0.5';

    try {
        // 送信方法に応じて処理を分岐
        if (partner.sendMethod === 'email') {
            await sendByEmail(partner);
        } else {
            await sendByLine(partner);
        }

        alert(`${partner.name} に送信しました！`);

        // 送信成功後、選択をクリア
        selectedProducts = [];
        updateSelectedCount();

        // チェックボックスを全て外す
        document.querySelectorAll('.card-checkbox').forEach(cb => cb.checked = false);

        // モーダルを閉じる
        closeSendModal();

    } catch (error) {
        alert(`送信エラー: ${error.message}`);
        console.error('送信エラー:', error);
    } finally {
        // ボタンを元に戻す
        sendBtn.disabled = false;
        sendBtn.textContent = '送信する';
        sendBtn.style.opacity = '1';
    }
}

// メール送信
async function sendByEmail(partner) {
    if (!partner.email) {
        throw new Error('メールアドレスが設定されていません');
    }

    const products = selectedProducts.map(p => p.data);

    const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            to: partner.email,
            partnerName: partner.name,
            products: products
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'メール送信に失敗しました');
    }

    return await response.json();
}

// LINE送信
async function sendByLine(partner) {
    if (!partner.lineId) {
        throw new Error('LINE User IDが設定されていません');
    }

    const products = selectedProducts.map(p => p.data);

    const response = await fetch('/api/send-line', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userId: partner.lineId,
            partnerName: partner.name,
            products: products
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'LINE送信に失敗しました');
    }

    return await response.json();
}

// ========================================
// 外注先管理機能
// ========================================

// Supabaseから外注先リストを読み込み
async function loadPartnersFromStorage() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/partners?order=created_at.desc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('外注先リストの取得に失敗しました');
        }

        const supabasePartners = await response.json();

        // Supabaseのデータ形式をアプリの形式に変換
        partners = supabasePartners.map(p => ({
            name: p.name,
            sendMethod: p.send_method,
            email: p.email,
            lineId: p.line_id,
            affiliateId: p.affiliate_id
        }));

        // 互換性のためLocalStorageにも保存
        localStorage.setItem('partners', JSON.stringify(partners));

    } catch (error) {
        console.error('外注先データの読み込みエラー:', error);
        // エラー時はLocalStorageから読み込み（フォールバック）
        const stored = localStorage.getItem('partners');
        if (stored) {
            try {
                partners = JSON.parse(stored);
            } catch (e) {
                partners = [];
            }
        }
    }
}

// LocalStorageに外注先リストを保存
function savePartnersToStorage() {
    localStorage.setItem('partners', JSON.stringify(partners));
}

// 外注先管理モーダルを開く
async function openPartnersModal() {
    document.getElementById('partnersModal').style.display = 'flex';
    await loadPartnersFromStorage(); // Supabaseから外注先リストを読み込み
    displayPartnersList();
    loadPendingPartners(); // 承認待ちリストを読み込み
    switchPartnerTab('approved'); // デフォルトは承認済みタブ
    cancelPartnerForm(); // フォームを初期状態に戻す
}

// 外注先管理モーダルを閉じる
function closePartnersModal() {
    document.getElementById('partnersModal').style.display = 'none';
    cancelPartnerForm(); // フォームを閉じる
}

// 外注先リストを表示
function displayPartnersList() {
    const listContainer = document.getElementById('partnersList');

    if (partners.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(148, 163, 184, 0.7);">
                まだ外注先が登録されていません
            </div>
        `;
        return;
    }

    listContainer.innerHTML = partners.map((partner, index) => {
        const sendMethodBadge = partner.sendMethod === 'email'
            ? '<span style="display: inline-block; padding: 4px 12px; background: rgba(0, 184, 217, 0.2); border: 1px solid rgba(0, 184, 217, 0.4); border-radius: 15px; font-size: 12px; font-weight: 600; color: #00B8D9; margin-bottom: 8px;">📧 メール送信</span>'
            : '<span style="display: inline-block; padding: 4px 12px; background: rgba(0, 255, 163, 0.2); border: 1px solid rgba(0, 255, 163, 0.4); border-radius: 15px; font-size: 12px; font-weight: 600; color: #00FFA3; margin-bottom: 8px;">💬 LINE送信</span>';

        // LINE招待リンク（LINE User IDが未設定の場合のみ表示）
        const lineInviteSection = partner.sendMethod === 'line' && !partner.lineId ? `
            <div style="margin-top: 10px; padding: 12px; background: rgba(0, 255, 163, 0.1); border: 1px solid rgba(0, 255, 163, 0.3); border-radius: 8px;">
                <div style="font-size: 12px; color: rgba(148, 163, 184, 0.9); margin-bottom: 8px;">
                    👇 この招待リンクを外注先に送ってください
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="text" readonly value="https://line.me/R/ti/p/@398odcen?liff.state=partner_${partner.id}"
                           id="inviteLink_${partner.id}"
                           style="flex: 1; padding: 8px; background: rgba(17, 24, 39, 0.9); border: 1px solid rgba(0, 255, 163, 0.5); border-radius: 5px; color: #00FFA3; font-size: 12px; font-family: monospace;">
                    <button onclick="copyInviteLink(${partner.id})" style="padding: 8px 15px; background: linear-gradient(135deg, #00FFA3 0%, #00B8D9 100%); border: none; border-radius: 5px; color: #000; font-weight: 700; cursor: pointer; white-space: nowrap;">
                        📋 コピー
                    </button>
                </div>
            </div>
        ` : '';

        return `
            <div style="padding: 20px; background: rgba(0, 255, 163, 0.05); border: 1px solid rgba(0, 255, 163, 0.2); border-radius: 10px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        ${sendMethodBadge}
                        <div style="font-size: 18px; font-weight: 700; color: #00FFA3; margin-bottom: 8px;">
                            ${partner.name}
                        </div>
                        ${partner.email ? `
                            <div style="color: rgba(148, 163, 184, 0.9); font-size: 14px; margin-bottom: 5px;">
                                📧 ${partner.email}
                            </div>
                        ` : ''}
                        ${partner.lineId ? `
                            <div style="color: rgba(148, 163, 184, 0.9); font-size: 14px; margin-bottom: 5px;">
                                💬 ${partner.lineId} <span style="color: #00FFA3;">✓ 連携済み</span>
                            </div>
                        ` : ''}
                        ${partner.affiliateId ? `
                            <div style="color: rgba(148, 163, 184, 0.9); font-size: 14px;">
                                🔗 ${partner.affiliateId}
                            </div>
                        ` : ''}
                        ${lineInviteSection}
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="editPartner(${index})" style="padding: 8px 15px; background: rgba(0, 184, 217, 0.2); border: 1px solid rgba(0, 184, 217, 0.4); border-radius: 5px; color: #00B8D9; font-weight: 600; cursor: pointer;">
                            編集
                        </button>
                        <button onclick="deletePartner(${index})" style="padding: 8px 15px; background: rgba(255, 107, 157, 0.2); border: 1px solid rgba(255, 107, 157, 0.4); border-radius: 5px; color: #FF6B9D; font-weight: 600; cursor: pointer;">
                            削除
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 招待リンクをコピー
function copyInviteLink(partnerId) {
    const input = document.getElementById(`inviteLink_${partnerId}`);
    input.select();
    document.execCommand('copy');
    alert('招待リンクをコピーしました！\n外注先に送ってください。');
}

// 送信方法による入力フィールド切り替え
function toggleSendMethodFields() {
    const emailField = document.getElementById('emailField');
    const lineField = document.getElementById('lineField');
    const methodEmail = document.getElementById('methodEmail');

    if (methodEmail.checked) {
        emailField.style.display = 'block';
        lineField.style.display = 'none';
    } else {
        emailField.style.display = 'none';
        lineField.style.display = 'block';
    }
}

// 追加フォームを表示
function showAddPartnerForm() {
    const form = document.getElementById('partnerForm');
    const formTitle = document.getElementById('formTitle');

    formTitle.textContent = '新しい外注先を追加';
    document.getElementById('editPartnerId').value = '';
    document.getElementById('partnerName').value = '';
    document.getElementById('partnerEmail').value = '';
    document.getElementById('partnerLineId').value = '';
    document.getElementById('partnerAffiliateId').value = '';
    document.getElementById('methodEmail').checked = true;
    toggleSendMethodFields();

    form.style.display = 'block';
}

// フォームをキャンセル
function cancelPartnerForm() {
    const form = document.getElementById('partnerForm');
    form.style.display = 'none';

    // フォームをクリア
    document.getElementById('editPartnerId').value = '';
    document.getElementById('partnerName').value = '';
    document.getElementById('partnerEmail').value = '';
    document.getElementById('partnerLineId').value = '';
    document.getElementById('partnerAffiliateId').value = '';
}

// 外注先を保存（新規追加または更新）
function savePartner() {
    const name = document.getElementById('partnerName').value.trim();
    const email = document.getElementById('partnerEmail').value.trim();
    const lineId = document.getElementById('partnerLineId').value.trim();
    const affiliateId = document.getElementById('partnerAffiliateId').value.trim();
    const editIndex = document.getElementById('editPartnerId').value;
    const sendMethod = document.getElementById('methodEmail').checked ? 'email' : 'line';

    // 送信方法別バリデーション
    if (sendMethod === 'email') {
        if (!email) {
            alert('メールアドレスを入力してください');
            return;
        }
        // メールアドレスの簡易バリデーション
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            alert('正しいメールアドレスを入力してください');
            return;
        }
    }
    // LINE送信の場合、LINE User IDは任意（友だち追加で自動取得）

    const partnerData = {
        id: editIndex ? partners[editIndex].id : Date.now(),
        name: name || '名前未設定',
        sendMethod: sendMethod,
        email: email || null,
        lineId: lineId || null,
        affiliateId: affiliateId || null,
        createdAt: editIndex ? partners[editIndex].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (editIndex !== '') {
        // 更新
        partners[editIndex] = partnerData;
    } else {
        // 新規追加
        partners.push(partnerData);
    }

    // LocalStorageに保存
    savePartnersToStorage();

    // リストを再表示
    displayPartnersList();

    // フォームを閉じる
    cancelPartnerForm();
}

// 外注先を編集
function editPartner(index) {
    const partner = partners[index];
    const form = document.getElementById('partnerForm');
    const formTitle = document.getElementById('formTitle');

    formTitle.textContent = '外注先を編集';
    document.getElementById('editPartnerId').value = index;
    document.getElementById('partnerName').value = partner.name === '名前未設定' ? '' : partner.name;
    document.getElementById('partnerEmail').value = partner.email || '';
    document.getElementById('partnerLineId').value = partner.lineId || '';
    document.getElementById('partnerAffiliateId').value = partner.affiliateId || '';

    // 送信方法を復元
    if (partner.sendMethod === 'email') {
        document.getElementById('methodEmail').checked = true;
    } else {
        document.getElementById('methodLine').checked = true;
    }
    toggleSendMethodFields();

    form.style.display = 'block';
}

// 外注先を削除
function deletePartner(index) {
    const partner = partners[index];

    if (!confirm(`${partner.name} を削除してもよろしいですか？`)) {
        return;
    }

    partners.splice(index, 1);
    savePartnersToStorage();
    displayPartnersList();
}

// ========================================
// 承認待ちパートナー管理
// ========================================

// タブ切り替え
function switchPartnerTab(tabName) {
    currentPartnerTab = tabName;

    const approvedTab = document.getElementById('approvedTab');
    const pendingTab = document.getElementById('pendingTab');
    const approvedContent = document.getElementById('approvedTabContent');
    const pendingContent = document.getElementById('pendingTabContent');

    if (tabName === 'approved') {
        // 承認済みタブのスタイル
        approvedTab.style.background = 'linear-gradient(135deg, #00FFA3 0%, #00B8D9 100%)';
        approvedTab.style.border = 'none';
        approvedTab.style.color = '#000';

        // 承認待ちタブのスタイル
        pendingTab.style.background = 'rgba(255, 107, 157, 0.2)';
        pendingTab.style.border = '1px solid rgba(255, 107, 157, 0.4)';
        pendingTab.style.color = 'white';

        // コンテンツ表示切り替え
        approvedContent.style.display = 'block';
        pendingContent.style.display = 'none';
    } else {
        // 承認待ちタブのスタイル
        pendingTab.style.background = 'linear-gradient(135deg, #FF6B9D 0%, #C44569 100%)';
        pendingTab.style.border = 'none';
        pendingTab.style.color = '#fff';

        // 承認済みタブのスタイル
        approvedTab.style.background = 'rgba(0, 255, 163, 0.2)';
        approvedTab.style.border = '1px solid rgba(0, 255, 163, 0.4)';
        approvedTab.style.color = 'white';

        // コンテンツ表示切り替え
        approvedContent.style.display = 'none';
        pendingContent.style.display = 'block';
    }
}

// Supabaseから承認待ちリストを取得
async function loadPendingPartners() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/pending_partners?status=eq.pending&order=created_at.desc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('承認待ちリストの取得に失敗しました');
        }

        const pendingPartners = await response.json();

        // 承認待ち数を更新
        document.getElementById('pendingCount').textContent = pendingPartners.length;

        // リストを表示
        displayPendingPartnersList(pendingPartners);

    } catch (error) {
        console.error('承認待ちリスト取得エラー:', error);
        document.getElementById('pendingPartnersList').innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255, 107, 157, 0.7);">
                ⚠️ データの取得に失敗しました
            </div>
        `;
    }
}

// 承認待ちリストを表示
function displayPendingPartnersList(pendingPartners) {
    const listContainer = document.getElementById('pendingPartnersList');

    if (pendingPartners.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(148, 163, 184, 0.7);">
                承認待ちの登録はありません
            </div>
        `;
        return;
    }

    listContainer.innerHTML = pendingPartners.map(pending => {
        const createdDate = new Date(pending.created_at).toLocaleString('ja-JP');

        return `
            <div style="padding: 20px; margin-bottom: 15px; background: rgba(30, 41, 59, 0.4); border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.2);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div>
                        <div style="font-weight: 700; font-size: 16px; color: white; margin-bottom: 5px;">
                            ${pending.display_name || 'LINE User'}
                        </div>
                        <div style="color: rgba(148, 163, 184, 0.7); font-size: 12px;">
                            LINE ID: ${pending.line_id}
                        </div>
                        <div style="color: rgba(148, 163, 184, 0.5); font-size: 11px; margin-top: 5px;">
                            登録日時: ${createdDate}
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button onclick="approvePartner(${pending.id}, '${pending.line_id}', '${pending.display_name || 'LINE User'}')"
                            style="flex: 1; padding: 10px; background: linear-gradient(135deg, #00FFA3 0%, #00B8D9 100%); border: none; border-radius: 8px; color: #000; font-weight: 700; cursor: pointer;">
                        ✓ 承認
                    </button>
                    <button onclick="rejectPartner(${pending.id})"
                            style="flex: 1; padding: 10px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 8px; color: #ef4444; font-weight: 600; cursor: pointer;">
                        × 却下
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// パートナーを承認（pending_partners → partners）
async function approvePartner(pendingId, lineId, displayName) {
    if (!confirm(`${displayName} を外注先として承認しますか？`)) {
        return;
    }

    try {
        // 1. partnersテーブルに追加
        const partner = {
            name: displayName,
            send_method: 'line',
            line_id: lineId,
            email: null,
            affiliate_id: null
        };

        const addResponse = await fetch(`${SUPABASE_URL}/rest/v1/partners`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(partner)
        });

        if (!addResponse.ok) {
            throw new Error('外注先の追加に失敗しました');
        }

        // 2. pending_partnersのステータスを更新
        const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/pending_partners?id=eq.${pendingId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ status: 'approved' })
        });

        if (!updateResponse.ok) {
            throw new Error('承認ステータスの更新に失敗しました');
        }

        // 3. UI更新
        alert(`✅ ${displayName} を承認しました`);
        await loadPendingPartners();
        await loadPartnersFromStorage();
        displayPartnersList(); // 承認済みリストを再表示

    } catch (error) {
        console.error('承認エラー:', error);
        alert('❌ 承認に失敗しました: ' + error.message);
    }
}

// パートナーを却下
async function rejectPartner(pendingId) {
    if (!confirm('この登録を却下しますか？')) {
        return;
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/pending_partners?id=eq.${pendingId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ status: 'rejected' })
        });

        if (!response.ok) {
            throw new Error('却下処理に失敗しました');
        }

        alert('✅ 却下しました');
        loadPendingPartners();

    } catch (error) {
        console.error('却下エラー:', error);
        alert('❌ 却下に失敗しました: ' + error.message);
    }
}

// ユーティリティ
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ボタンのクリックイベント
document.getElementById('batchSearchBtn').addEventListener('click', startBatchSearch);
