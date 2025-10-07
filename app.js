// グローバル変数
let yahooApiKey = null;
let csvFile = null;
let searchResults = [];
let selectedProducts = []; // 選択された商品を保持
let partners = []; // 外注先リスト

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

// 送信モーダルを開く（とりあえずコンソール出力）
function openSendModal() {
    console.log('選択された商品:', selectedProducts);
    alert(`${selectedProducts.length}件の商品が選択されています。\n\n詳細はコンソールを確認してください。`);
}

// ========================================
// 外注先管理機能
// ========================================

// LocalStorageから外注先リストを読み込み
function loadPartnersFromStorage() {
    const stored = localStorage.getItem('partners');
    if (stored) {
        try {
            partners = JSON.parse(stored);
        } catch (e) {
            console.error('外注先データの読み込みエラー:', e);
            partners = [];
        }
    }
}

// LocalStorageに外注先リストを保存
function savePartnersToStorage() {
    localStorage.setItem('partners', JSON.stringify(partners));
}

// 外注先管理モーダルを開く
function openPartnersModal() {
    document.getElementById('partnersModal').style.display = 'flex';
    displayPartnersList();
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
    } else {
        // LINE送信
        if (!lineId) {
            alert('LINE User IDを入力してください');
            return;
        }
    }

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

// ユーティリティ
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ボタンのクリックイベント
document.getElementById('batchSearchBtn').addEventListener('click', startBatchSearch);
