/**
 * Stock Manager V2 - ストックリストのファイル保存対応版
 * LocalStorageとファイル両方で管理
 */

// ストックリスト管理
let stockList = [];

function initStockList() {
    // ローカルストレージから読み込み
    const saved = localStorage.getItem('csvFusionStockList');
    if (saved) {
        try {
            stockList = JSON.parse(saved);

            // 古いデータフォーマットを新しいフォーマットに変換
            let needsUpdate = false;
            stockList = stockList.map(item => {
                // avgPriceが存在する場合、productCodeに変換
                if (item.avgPrice !== undefined && item.productCode === undefined) {
                    item.productCode = item.avgPrice;
                    delete item.avgPrice;
                    needsUpdate = true;
                }
                return item;
            });

            // データが更新された場合は保存し直す
            if (needsUpdate) {
                localStorage.setItem('csvFusionStockList', JSON.stringify(stockList));
                console.log('古いデータフォーマットを新しいフォーマットに変換しました');
            }

            console.log('LocalStorageから読み込み:', stockList.length + '件');
        } catch (e) {
            console.error('Failed to load stock list:', e);
            stockList = [];
        }
    }

    // ストックパネルのHTMLを動的に追加
    addStockPanelToDOM();

    // パネル更新（LocalStorageのデータを表示）
    updateStockPanel();

    // ステータス更新のみ（ファイル読み込みはしない）
    if (stockList.length > 0) {
        updateStatus(`${stockList.length}件のストック商品`);
    }
}

function addStockPanelToDOM() {
    // ストックパネルのHTML
    const stockPanelHTML = `
        <!-- ストックリスト パネル -->
        <div id="stockPanel" class="stock-panel">
            <div class="stock-header">
                <h3>📦 ストックリスト</h3>
                <button class="close-btn" onclick="toggleStockPanel()">×</button>
            </div>
            <div class="stock-controls">
                <button class="btn btn-add" onclick="toggleManualAddForm()" style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);">
                    ➕ 手動追加
                </button>
                <label class="file-load-btn">
                    📂 CSVから読込
                    <input type="file" id="stockFileInput" accept=".csv" style="display: none;" onchange="handleStockFileUpload(event)">
                </label>
                <button class="btn btn-save" onclick="saveStockToFile()">
                    💾 保存
                </button>
                <button class="btn btn-export" onclick="exportStockList()">
                    📥 別名保存
                </button>
                <button class="btn btn-clear" onclick="clearStockList()">
                    🗑️ クリア
                </button>
            </div>
            <div id="manualAddForm" style="display: none; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px; margin: 10px 0;">
                <h4 style="color: white; margin-bottom: 10px;">手動で商品を追加</h4>
                <div style="display: grid; gap: 10px;">
                    <input type="text" id="manualBrand" placeholder="ブランド名" style="padding: 8px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;">
                    <input type="text" id="manualGroup" placeholder="グループ名（必須）" style="padding: 8px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;">
                    <input type="number" id="manualCount" placeholder="件数" style="padding: 8px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;">
                    <input type="text" id="manualModePrice" placeholder="最頻値価格（例：5000）" style="padding: 8px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;" onblur="this.value = formatPrice(this.value) || this.value">
                    <input type="text" id="manualProductCode" placeholder="商品コード（例：12020301）" style="padding: 8px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;">
                    <input type="text" id="manualPriceRange" placeholder="価格帯（例：3000-8000）" style="padding: 8px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;" onblur="this.value = formatPriceRange(this.value) || this.value">
                    <div style="display: flex; gap: 10px;">
                        <button onclick="addManualStock()" style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">追加</button>
                        <button onclick="toggleManualAddForm()" style="flex: 1; padding: 8px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">キャンセル</button>
                    </div>
                </div>
            </div>
            <div class="stock-status" id="stockStatus"></div>
            <div id="stockItems" class="stock-items"></div>
        </div>

        <!-- ストックリスト切り替えボタン -->
        <button id="stockToggleBtn" class="stock-toggle-btn" onclick="toggleStockPanel()">
            📦 ストック (<span id="stockCount">0</span>)
        </button>

        <!-- 非表示のダウンロードリンク -->
        <a id="downloadLink" style="display: none;"></a>
    `;

    // ボディに追加
    document.body.insertAdjacentHTML('beforeend', stockPanelHTML);

    // スタイルを追加
    addStockStyles();
}

function addStockStyles() {
    const styles = `
        <style>
        /* ストックパネル */
        .stock-panel {
            position: fixed;
            right: -400px;
            top: 0;
            width: 400px;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            box-shadow: -3px 0 15px rgba(0,0,0,0.2);
            transition: right 0.3s ease;
            z-index: 1000;
            display: flex;
            flex-direction: column;
        }

        .stock-panel.open {
            right: 0;
        }

        .stock-header {
            padding: 20px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.2);
        }

        .stock-header h3 {
            margin: 0;
            font-size: 20px;
        }

        .close-btn {
            background: transparent;
            border: none;
            color: white;
            font-size: 28px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .close-btn:hover {
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
        }

        .stock-controls {
            padding: 15px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
        }

        .stock-controls .btn, .file-load-btn {
            padding: 8px;
            border: 1px solid rgba(255,255,255,0.3);
            background: rgba(255,255,255,0.1);
            color: white;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            text-align: center;
            transition: all 0.3s;
        }

        .file-load-btn {
            display: block;
        }

        .stock-controls .btn:hover, .file-load-btn:hover {
            background: rgba(255,255,255,0.2);
        }

        .btn-save {
            background: rgba(76, 175, 80, 0.3) !important;
        }

        .btn-save:hover {
            background: rgba(76, 175, 80, 0.5) !important;
        }

        .stock-status {
            padding: 10px 15px;
            color: white;
            font-size: 12px;
            background: rgba(0,0,0,0.2);
            display: none;
        }

        .stock-status.show {
            display: block;
        }

        .stock-items {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
        }

        .stock-item {
            background: white;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            position: relative;
            animation: slideIn 0.3s ease;
        }

        .stock-item .remove-btn {
            position: absolute;
            top: 5px;
            right: 5px;
            background: #ff4444;
            color: white;
            border: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .stock-item .remove-btn:hover {
            background: #cc0000;
        }

        .stock-item .use-btn {
            position: absolute;
            top: 5px;
            right: 35px;
            background: #4CAF50;
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .stock-item .use-btn:hover {
            background: #66BB6A;
        }

        .stock-item .edit-btn {
            position: absolute;
            top: 5px;
            right: 65px;
            background: #2196F3;
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .stock-item .edit-btn:hover {
            background: #42A5F5;
        }

        .stock-item h4 {
            margin: 0 0 10px 0;
            color: #333;
            padding-right: 30px;
            font-size: 14px;
            word-break: break-all;
        }

        /* ストック切り替えボタン */
        .stock-toggle-btn {
            position: fixed;
            right: 20px;
            bottom: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 20px;
            border-radius: 50px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 999;
            transition: transform 0.3s;
        }

        .stock-toggle-btn:hover {
            transform: scale(1.05);
        }

        /* 追加ボタン（テーブル内） */
        .add-to-stock-btn {
            background: #4caf50;
            color: white;
            border: none;
            padding: 5px 12px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.3s;
        }

        .add-to-stock-btn:hover {
            background: #45a049;
            transform: scale(1.05);
        }

        .add-to-stock-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }

        /* 通知 */
        @keyframes slideInNotification {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOutNotification {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInNotification 0.3s ease;
        }

        .notification.success {
            background: #4caf50;
            color: white;
        }

        .notification.warning {
            background: #ff9800;
            color: white;
        }

        .notification.error {
            background: #f44336;
            color: white;
        }
        </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
}

function addToStock(rowData) {
    // 重複チェック
    const exists = stockList.some(item =>
        item.groupName === rowData.groupName &&
        item.brandName === rowData.brandName
    );

    if (!exists) {
        stockList.push({
            ...rowData,
            addedAt: new Date().toISOString(),
            id: Date.now() + Math.random() // ユニークID
        });
        saveStockList();
        updateStockPanel();
        showStockNotification('ストックに追加しました', 'success');

        // 自動保存は無効化（手動保存のみ）
        // saveStockToFile(true); // silent mode

        // ボタンを無効化
        updateAddButtons();
    } else {
        showStockNotification('既にストックに存在します', 'warning');
    }
}

function removeFromStock(id) {
    stockList = stockList.filter(item => item.id !== id);
    saveStockList();
    updateStockPanel();
    updateAddButtons();

    // 自動保存は無効化（手動保存のみ）
    // saveStockToFile(true); // silent mode
}

function saveStockList() {
    localStorage.setItem('csvFusionStockList', JSON.stringify(stockList));
}

function updateStockPanel() {
    const stockItems = document.getElementById('stockItems');
    const stockCount = document.getElementById('stockCount');

    if (!stockItems || !stockCount) return;

    stockCount.textContent = stockList.length;

    if (stockList.length === 0) {
        stockItems.innerHTML = '<div style="text-align: center; color: white; padding: 20px;">ストックされた商品はありません</div>';
        return;
    }

    stockItems.innerHTML = stockList.map(item => `
        <div class="stock-item" id="stock-item-${item.id}">
            <button class="remove-btn" onclick="removeFromStock(${item.id})">×</button>
            <button class="use-btn" onclick="useStockItem(${item.id})" title="メインテーブルに表示">📤</button>
            <button class="edit-btn" onclick="editStockItem(${item.id})" title="編集">✏️</button>
            <div class="stock-content" id="content-${item.id}">
                <h4>${item.groupName}</h4>
                <div style="font-size: 12px; color: #666; margin: 5px 0;">
                    ${item.brandName || 'ブランド不明'}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                    <div>
                        <div style="font-size: 11px; color: #888;">件数</div>
                        <div style="font-weight: bold;">${item.count || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="font-size: 11px; color: #888;">最頻値</div>
                        <div style="font-weight: bold;">${item.modePrice || 'N/A'}</div>
                    </div>
                </div>
                <div style="margin-top: 10px; font-size: 11px; color: #999;">
                    追加日時: ${new Date(item.addedAt).toLocaleString('ja-JP')}
                </div>
            </div>
            <div class="edit-form" id="edit-${item.id}" style="display: none; padding: 10px;">
                <input type="text" id="edit-brand-${item.id}" value="${item.brandName || ''}" placeholder="ブランド名" style="width: 100%; padding: 5px; margin-bottom: 5px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;">
                <input type="text" id="edit-group-${item.id}" value="${item.groupName || ''}" placeholder="グループ名" style="width: 100%; padding: 5px; margin-bottom: 5px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;">
                <input type="text" id="edit-count-${item.id}" value="${item.count || ''}" placeholder="件数" style="width: 100%; padding: 5px; margin-bottom: 5px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;">
                <input type="text" id="edit-mode-${item.id}" value="${item.modePrice || ''}" placeholder="最頻値" style="width: 100%; padding: 5px; margin-bottom: 5px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;" onblur="this.value = formatPrice(this.value) || this.value">
                <input type="text" id="edit-productCode-${item.id}" value="${item.productCode || ''}" placeholder="商品コード" style="width: 100%; padding: 5px; margin-bottom: 5px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;">
                <input type="text" id="edit-range-${item.id}" value="${item.priceRange || ''}" placeholder="価格帯" style="width: 100%; padding: 5px; margin-bottom: 5px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;" onblur="this.value = formatPriceRange(this.value) || this.value">
                <div style="display: flex; gap: 5px; margin-top: 10px;">
                    <button onclick="saveStockEdit(${item.id})" style="flex: 1; padding: 6px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">保存</button>
                    <button onclick="cancelStockEdit(${item.id})" style="flex: 1; padding: 6px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">キャンセル</button>
                </div>
            </div>
        </div>
    `).join('');
}

function toggleStockPanel() {
    const panel = document.getElementById('stockPanel');
    if (panel) {
        panel.classList.toggle('open');
    }
}

// 同じフォルダにstock_list.csvとして保存
async function saveStockToFile(silent = false) {
    if (stockList.length === 0 && !silent) {
        showStockNotification('保存する商品がありません', 'warning');
        return;
    }

    // CSV形式でエクスポート
    const headers = ['ブランド', 'グループ名', '件数', '最頻値価格', '商品コード', '価格帯', '追加日時'];
    const rows = stockList.map(item => [
        item.brandName || '',
        item.groupName || '',
        item.count || '',
        item.modePrice || '',
        // 商品コードを出力（複数の場合はカンマ区切り）
        item.productCode || '',
        item.priceRange || '',
        new Date(item.addedAt).toLocaleString('ja-JP')
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // サーバー経由で保存を試みる
    try {
        const response = await fetch('http://localhost:3001/save-stock', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: csvContent
        });

        if (response.ok) {
            const result = await response.json();
            if (!silent) {
                showStockNotification('デスクトップに保存しました', 'success');
                updateStatus(`最終保存: ${new Date().toLocaleTimeString('ja-JP')}`);
            }
            console.log('✅ ファイル保存成功:', result.path);
            return;
        }
    } catch (error) {
        // サーバーが起動していない場合は通常のダウンロード
        console.log('📥 ローカルサーバー未起動のため、通常のダウンロードに切り替え');
    }

    // フォールバック: 通常のダウンロード
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.getElementById('downloadLink') || document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'stock_list.csv'; // 固定ファイル名
    link.click();

    if (!silent) {
        showStockNotification('stock_list.csv としてダウンロードしました', 'success');
        updateStatus(`最終保存: ${new Date().toLocaleTimeString('ja-JP')}`);
    }
}

// 別名で保存（日付付き）
function exportStockList() {
    if (stockList.length === 0) {
        showStockNotification('エクスポートする商品がありません', 'warning');
        return;
    }

    // CSV形式でエクスポート
    const headers = ['ブランド', 'グループ名', '件数', '最頻値価格', '商品コード', '価格帯', '追加日時'];
    const rows = stockList.map(item => [
        item.brandName || '',
        item.groupName || '',
        item.count || '',
        item.modePrice || '',
        // 商品コードを出力（複数の場合はカンマ区切り）
        item.productCode || '',
        item.priceRange || '',
        new Date(item.addedAt).toLocaleString('ja-JP')
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // BOM付きUTF-8で出力
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stock_list_${new Date().toISOString().split('T')[0]}_${Date.now()}.csv`;
    link.click();

    showStockNotification('ストックリストをエクスポートしました', 'success');
}

// CSVファイルから読み込み
function handleStockFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim());

            if (lines.length <= 1) {
                showStockNotification('CSVファイルが空です', 'warning');
                return;
            }

            // ヘッダー行をスキップ
            const newStockList = [];
            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
                if (parts && parts.length >= 6) {
                    const cleanPart = (str) => str.replace(/^"|"$/g, '').replace(/""/g, '"');

                    // E列（parts[4]）は商品コード
                    const productCodeValue = cleanPart(parts[4]);

                    const stockItem = {
                        brandName: cleanPart(parts[0]),
                        groupName: cleanPart(parts[1]),
                        count: cleanPart(parts[2]),
                        modePrice: cleanPart(parts[3]),
                        priceRange: cleanPart(parts[5]),
                        addedAt: parts[6] ? cleanPart(parts[6]) : new Date().toISOString(),
                        id: Date.now() + Math.random() + i
                    };

                    // E列は商品コードとして保存（カンマ区切りで複数対応）
                    stockItem.productCode = productCodeValue; // カンマ区切りのまま保存

                    newStockList.push(stockItem);
                }
            }

            if (newStockList.length > 0) {
                // 既存のリストとマージするか確認
                if (stockList.length > 0) {
                    if (confirm('既存のストックリストに追加しますか？\n「キャンセル」を選択すると置き換えます。')) {
                        // マージ（重複チェック付き）
                        newStockList.forEach(newItem => {
                            const exists = stockList.some(item =>
                                item.groupName === newItem.groupName &&
                                item.brandName === newItem.brandName
                            );
                            if (!exists) {
                                stockList.push(newItem);
                            }
                        });
                    } else {
                        // 置き換え
                        stockList = newStockList;
                    }
                } else {
                    stockList = newStockList;
                }

                saveStockList();
                updateStockPanel();
                updateAddButtons();
                showStockNotification(`${newStockList.length}件の商品を読み込みました`, 'success');
                updateStatus(`${file.name} から読み込み完了`);
            }
        } catch (error) {
            console.error('CSV読み込みエラー:', error);
            showStockNotification('CSVファイルの読み込みに失敗しました', 'error');
        }
    };

    reader.readAsText(file, 'UTF-8');
}

// 起動時の自動読み込み
function loadStockFromFile() {
    // この関数は手動でCSVファイルを読み込むときのみ使用
    // 初期化時には呼ばない（LocalStorageのデータを維持するため）
    console.log('手動でCSVファイル読み込みを待機中');
}

function clearStockList() {
    if (confirm('ストックリストをクリアしますか？\n（stock_list.csvファイルは残ります）')) {
        stockList = [];
        saveStockList();
        updateStockPanel();
        updateAddButtons();
        showStockNotification('ストックリストをクリアしました', 'success');
        updateStatus('クリア済み');
    }
}

function showStockNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutNotification 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function updateStatus(message) {
    const statusEl = document.getElementById('stockStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.classList.add('show');
        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 5000);
    }
}

// 価格をフォーマットする関数
function formatPrice(value) {
    // 数値以外を除去
    const num = String(value).replace(/[^0-9.-]/g, '');

    if (!num) return '';

    // 数値に変換
    const number = parseInt(num, 10);

    if (isNaN(number)) return '';

    // カンマ区切りと円マークを追加
    return '¥' + number.toLocaleString('ja-JP');
}

// 価格帯をフォーマットする関数
function formatPriceRange(value) {
    // ハイフンやチルダで分割
    const parts = String(value).split(/[-~～]/);

    if (parts.length === 2) {
        const min = formatPrice(parts[0]);
        const max = formatPrice(parts[1]);
        if (min && max) {
            return `${min}-${max}`;
        }
    }

    // 単一の価格の場合
    return formatPrice(value);
}

// 手動追加フォームの表示/非表示
function toggleManualAddForm() {
    const form = document.getElementById('manualAddForm');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
        if (form.style.display === 'block') {
            // フォームをリセット
            document.getElementById('manualBrand').value = '';
            document.getElementById('manualGroup').value = '';
            document.getElementById('manualCount').value = '';
            document.getElementById('manualModePrice').value = '';
            document.getElementById('manualProductCode').value = '';
            document.getElementById('manualPriceRange').value = '';
            document.getElementById('manualGroup').focus();
        }
    }
}

// 手動でストックに追加
function addManualStock() {
    const groupName = document.getElementById('manualGroup').value.trim();

    if (!groupName) {
        showStockNotification('グループ名は必須です', 'error');
        return;
    }

    // 価格をフォーマット
    const modePriceInput = document.getElementById('manualModePrice').value;
    const productCodeInput = document.getElementById('manualProductCode').value;
    const priceRangeInput = document.getElementById('manualPriceRange').value;

    const stockItem = {
        id: Date.now(),
        brandName: document.getElementById('manualBrand').value.trim() || '',
        groupName: groupName,
        count: document.getElementById('manualCount').value || '',
        modePrice: formatPrice(modePriceInput) || modePriceInput,
        productCode: productCodeInput,
        priceRange: formatPriceRange(priceRangeInput) || priceRangeInput,
        addedAt: new Date().toISOString(),
        data: [] // 手動追加の場合は詳細データなし
    };

    // 重複チェック
    const exists = stockList.some(item =>
        item.groupName === stockItem.groupName &&
        item.brandName === stockItem.brandName
    );

    if (exists) {
        showStockNotification('この商品は既にストックに存在します', 'warning');
        return;
    }

    stockList.push(stockItem);
    saveStockList();
    updateStockPanel();
    showStockNotification('手動でストックに追加しました', 'success');

    // フォームを閉じる
    toggleManualAddForm();
}

// ストックアイテムを編集
function editStockItem(id) {
    const contentDiv = document.getElementById(`content-${id}`);
    const editDiv = document.getElementById(`edit-${id}`);

    if (contentDiv && editDiv) {
        contentDiv.style.display = 'none';
        editDiv.style.display = 'block';
    }
}

// 編集を保存
function saveStockEdit(id) {
    const item = stockList.find(item => item.id === id);
    if (!item) return;

    // 編集された値を取得
    const brandName = document.getElementById(`edit-brand-${id}`).value.trim();
    const groupName = document.getElementById(`edit-group-${id}`).value.trim();
    const count = document.getElementById(`edit-count-${id}`).value;
    const modePrice = document.getElementById(`edit-mode-${id}`).value;
    const productCode = document.getElementById(`edit-productCode-${id}`).value;
    const priceRange = document.getElementById(`edit-range-${id}`).value;

    if (!groupName) {
        showStockNotification('グループ名は必須です', 'error');
        return;
    }

    // アイテムを更新
    item.brandName = brandName;
    item.groupName = groupName;
    item.count = count;
    item.modePrice = modePrice;
    item.productCode = productCode;
    item.priceRange = priceRange;

    // 保存とUI更新
    saveStockList();
    updateStockPanel();
    showStockNotification('編集を保存しました', 'success');
}

// 編集をキャンセル
function cancelStockEdit(id) {
    const contentDiv = document.getElementById(`content-${id}`);
    const editDiv = document.getElementById(`edit-${id}`);

    if (contentDiv && editDiv) {
        contentDiv.style.display = 'block';
        editDiv.style.display = 'none';
    }
}

// ストックアイテムを使用（メインテーブルに表示）
function useStockItem(id) {
    const stockItem = stockList.find(item => item.id === id);
    if (!stockItem || !stockItem.data) {
        showStockNotification('このアイテムのデータがありません', 'error');
        return;
    }

    // メインのdataTableに表示
    const dataTable = document.getElementById('dataTable');
    if (!dataTable) {
        showStockNotification('データテーブルが見つかりません', 'error');
        return;
    }

    // テーブルをクリア
    dataTable.innerHTML = '';

    // ヘッダー作成
    const headers = Object.keys(stockItem.data[0] || {});
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    dataTable.appendChild(headerRow);

    // データ行を追加
    stockItem.data.forEach(rowData => {
        const row = document.createElement('tr');
        row.className = 'group-item';
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = rowData[header] || '';
            row.appendChild(td);
        });
        dataTable.appendChild(row);
    });

    // 統計情報を更新
    if (typeof updateStats === 'function') {
        updateStats();
    }

    showStockNotification(`「${stockItem.groupName}」をテーブルに表示しました`, 'success');

    // パネルを閉じる
    toggleStockPanel();
}

function updateAddButtons() {
    // 既にストックにある商品のボタンを無効化
    document.querySelectorAll('.add-to-stock-btn').forEach(btn => {
        const data = btn.getAttribute('data-stock-info');
        if (data) {
            try {
                const info = JSON.parse(data);
                const exists = stockList.some(item =>
                    item.groupName === info.groupName &&
                    item.brandName === info.brandName
                );
                btn.disabled = exists;
                btn.textContent = exists ? 'ストック済' : '+ ストック';
            } catch (e) {
                console.error('Failed to parse stock info:', e);
            }
        }
    });
}

// ページ読み込み時に初期化
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(initStockList, 100); // 少し遅延させて他の要素が読み込まれるのを待つ
});

// グローバルに関数を公開
// 強制リセット関数（デバッグ用）
window.resetStockData = function() {
    localStorage.removeItem('csvFusionStockList');
    location.reload();
};

window.addToStock = addToStock;
window.removeFromStock = removeFromStock;
window.toggleStockPanel = toggleStockPanel;
window.exportStockList = exportStockList;
window.clearStockList = clearStockList;
window.updateAddButtons = updateAddButtons;
window.saveStockToFile = saveStockToFile;
window.handleStockFileUpload = handleStockFileUpload;
window.useStockItem = useStockItem;
window.toggleManualAddForm = toggleManualAddForm;
window.addManualStock = addManualStock;
window.formatPrice = formatPrice;
window.formatPriceRange = formatPriceRange;
window.editStockItem = editStockItem;
window.saveStockEdit = saveStockEdit;
window.cancelStockEdit = cancelStockEdit;