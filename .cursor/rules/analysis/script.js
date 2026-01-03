// グローバル変数
let reportsData = [];
let allTasks = [];
let charts = {};

// カテゴリ定義
const categories = {
    '会議・ミーティング': ['ミーティング', '会議', '打ち合わせ', 'スタンドアップ', 'デイリー', '週次', '月次', '商談', 'アポイント'],
    '資料作成': ['資料', 'スライド', '提案', '報告書', '手順書', 'ドキュメント', '作成', '整備'],
    '開発・デプロイ': ['開発', 'デプロイ', 'バグ', '修正', '対応', '実装', 'コード', 'テスト', '動作確認'],
    '顧客対応・商談': ['顧客', 'クライアント', '商談', 'ヒアリング', '問い合わせ', '対応', '提案', 'リサーチ'],
    'その他': []
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
});

// イベントリスナーの初期化
function initializeEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // クリックでファイル選択
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // ドラッグ&ドロップ
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // フィルターボタン
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filterTasks(e.target.dataset.category);
        });
    });
}

// ドラッグオーバー処理
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('uploadArea').classList.add('dragover');
}

// ドラッグリーブ処理
function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('uploadArea').classList.remove('dragover');
}

// ドロップ処理
function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('uploadArea').classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files).filter(file => file.name.endsWith('.md'));
    processFiles(files);
}

// ファイル選択処理
function handleFileSelect(e) {
    const files = Array.from(e.target.files).filter(file => file.name.endsWith('.md'));
    processFiles(files);
}

// ファイル処理
async function processFiles(files) {
    if (files.length === 0) return;

    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';

    for (const file of files) {
        const text = await file.text();
        const reportData = parseReport(text, file.name);
        if (reportData) {
            reportsData.push(reportData);
            allTasks.push(...reportData.tasks);
            
            // ファイルタグを追加
            const fileTag = document.createElement('div');
            fileTag.className = 'file-tag';
            fileTag.innerHTML = `
                <span>${file.name}</span>
                <button class="remove-btn" data-filename="${file.name}">×</button>
            `;
            fileTag.querySelector('.remove-btn').addEventListener('click', () => {
                removeFile(file.name);
            });
            fileList.appendChild(fileTag);
        }
    }

    updateDashboard();
}

// ファイル削除
function removeFile(filename) {
    reportsData = reportsData.filter(r => r.filename !== filename);
    allTasks = [];
    reportsData.forEach(r => allTasks.push(...r.tasks));
    
    // ファイルタグを更新
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    reportsData.forEach(report => {
        const fileTag = document.createElement('div');
        fileTag.className = 'file-tag';
        fileTag.innerHTML = `
            <span>${report.filename}</span>
            <button class="remove-btn" data-filename="${report.filename}">×</button>
        `;
        fileTag.querySelector('.remove-btn').addEventListener('click', () => {
            removeFile(report.filename);
        });
        fileList.appendChild(fileTag);
    });
    
    updateDashboard();
}

// 日報の解析
function parseReport(text, filename) {
    const lines = text.split('\n');
    const report = {
        filename: filename,
        date: extractDate(text),
        tasks: []
    };

    let inTimeSection = false;
    let currentTimeSlot = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 時間セクションの開始を検出
        if (line.includes('**時間**') || line.includes('## 本日の業務内容')) {
            inTimeSection = true;
            continue;
        }

        // 次のセクションに移ったら終了
        if (inTimeSection && (line.startsWith('## ') || line.startsWith('#'))) {
            if (!line.includes('業務内容')) {
                break;
            }
        }

        // 時間帯の抽出
        if (inTimeSection) {
            const timeMatch = line.match(/(\d{2}:\d{2})[～〜~](\d{2}:\d{2})/);
            if (timeMatch) {
                currentTimeSlot = `${timeMatch[1]}～${timeMatch[2]}`;
                const taskText = line.split('：').slice(1).join('：').trim();
                if (taskText) {
                    const tasks = splitTasks(taskText);
                    tasks.forEach(task => {
                        if (task.trim()) {
                            report.tasks.push({
                                text: task.trim(),
                                timeSlot: currentTimeSlot,
                                date: report.date,
                                category: categorizeTask(task.trim())
                            });
                        }
                    });
                }
            } else if (currentTimeSlot && line.startsWith('-') && line.includes('：')) {
                const taskText = line.split('：').slice(1).join('：').trim();
                if (taskText) {
                    const tasks = splitTasks(taskText);
                    tasks.forEach(task => {
                        if (task.trim()) {
                            report.tasks.push({
                                text: task.trim(),
                                timeSlot: currentTimeSlot,
                                date: report.date,
                                category: categorizeTask(task.trim())
                            });
                        }
                    });
                }
            }
        }
    }

    return report.tasks.length > 0 ? report : null;
}

// 日付の抽出
function extractDate(text) {
    // タイトルから日付を抽出
    const titleMatch = text.match(/#\s*日報\s*(\d{4})\/(\d{2})\/(\d{2})/);
    if (titleMatch) {
        return `${titleMatch[1]}-${titleMatch[2]}-${titleMatch[3]}`;
    }
    
    // ファイル名から日付を抽出
    const filenameMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (filenameMatch) {
        return filenameMatch[1];
    }
    
    return '不明';
}

// タスクの分割（句点や読点で分割）
function splitTasks(text) {
    // 句点、読点、または「。」「、」で分割
    return text.split(/[。、，,]/).filter(t => t.trim().length > 0);
}

// タスクのカテゴリ分類
function categorizeTask(taskText) {
    const lowerText = taskText.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
        if (category === 'その他') continue;
        
        for (const keyword of keywords) {
            if (lowerText.includes(keyword.toLowerCase())) {
                return category;
            }
        }
    }
    
    return 'その他';
}

// ダッシュボードの更新
function updateDashboard() {
    if (allTasks.length === 0) {
        document.getElementById('statsSection').style.display = 'none';
        document.getElementById('chartsSection').style.display = 'none';
        document.getElementById('taskListSection').style.display = 'none';
        return;
    }

    document.getElementById('statsSection').style.display = 'block';
    document.getElementById('chartsSection').style.display = 'block';
    document.getElementById('taskListSection').style.display = 'block';

    updateStats();
    updateCharts();
    updateTaskList();
}

// 統計情報の更新
function updateStats() {
    const uniqueReports = new Set(reportsData.map(r => r.date));
    document.getElementById('totalReports').textContent = uniqueReports.size;
    document.getElementById('totalTasks').textContent = allTasks.length;

    const dates = reportsData.map(r => r.date).filter(d => d !== '不明').sort();
    if (dates.length > 0) {
        document.getElementById('dateRange').textContent = `${dates[0]} ～ ${dates[dates.length - 1]}`;
    } else {
        document.getElementById('dateRange').textContent = '-';
    }

    // 最頻出カテゴリ
    const categoryCounts = {};
    allTasks.forEach(task => {
        categoryCounts[task.category] = (categoryCounts[task.category] || 0) + 1;
    });
    const topCategory = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])[0];
    document.getElementById('topCategory').textContent = topCategory ? topCategory[0] : '-';
}

// チャートの更新
function updateCharts() {
    // 既存のチャートを破棄
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    charts = {};

    createTaskFrequencyChart();
    createTimeSlotChart();
    createCategoryCharts();
    createTimelineChart();
}

// タスク頻度チャート
function createTaskFrequencyChart() {
    const taskCounts = {};
    allTasks.forEach(task => {
        const key = task.text.substring(0, 30); // 最初の30文字でグループ化
        taskCounts[key] = (taskCounts[key] || 0) + 1;
    });

    const sorted = Object.entries(taskCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const ctx = document.getElementById('taskFrequencyChart').getContext('2d');
    charts.taskFrequency = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([text]) => text.length > 30 ? text.substring(0, 30) + '...' : text),
            datasets: [{
                label: '出現回数',
                data: sorted.map(([, count]) => count),
                backgroundColor: 'rgba(79, 70, 229, 0.8)',
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// 時間帯別チャート
function createTimeSlotChart() {
    const timeSlotCounts = {};
    allTasks.forEach(task => {
        timeSlotCounts[task.timeSlot] = (timeSlotCounts[task.timeSlot] || 0) + 1;
    });

    const sorted = Object.entries(timeSlotCounts).sort((a, b) => {
        const timeA = a[0].split('～')[0];
        const timeB = b[0].split('～')[0];
        return timeA.localeCompare(timeB);
    });

    const ctx = document.getElementById('timeSlotChart').getContext('2d');
    charts.timeSlot = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([slot]) => slot),
            datasets: [{
                label: 'タスク数',
                data: sorted.map(([, count]) => count),
                backgroundColor: 'rgba(99, 102, 241, 0.8)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// カテゴリ別チャート
function createCategoryCharts() {
    const categoryCounts = {};
    allTasks.forEach(task => {
        categoryCounts[task.category] = (categoryCounts[task.category] || 0) + 1;
    });

    const labels = Object.keys(categoryCounts);
    const data = Object.values(categoryCounts);
    const colors = [
        'rgba(79, 70, 229, 0.8)',
        'rgba(99, 102, 241, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(196, 181, 253, 0.8)'
    ];

    // 円グラフ
    const pieCtx = document.getElementById('categoryPieChart').getContext('2d');
    charts.categoryPie = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // 棒グラフ
    const barCtx = document.getElementById('categoryBarChart').getContext('2d');
    charts.categoryBar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'タスク数',
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: colors.slice(0, labels.length).map(c => c.replace('0.8', '1')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// 時系列チャート
function createTimelineChart() {
    const dateCounts = {};
    allTasks.forEach(task => {
        if (task.date !== '不明') {
            dateCounts[task.date] = (dateCounts[task.date] || 0) + 1;
        }
    });

    const sorted = Object.entries(dateCounts)
        .sort((a, b) => a[0].localeCompare(b[0]));

    const ctx = document.getElementById('timelineChart').getContext('2d');
    charts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sorted.map(([date]) => date),
            datasets: [{
                label: 'タスク数',
                data: sorted.map(([, count]) => count),
                borderColor: 'rgba(79, 70, 229, 1)',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// タスクリストの更新
function updateTaskList() {
    filterTasks('all');
}

// タスクのフィルタリング
function filterTasks(category) {
    const filteredTasks = category === 'all' 
        ? allTasks 
        : allTasks.filter(task => task.category === category);

    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';

    if (filteredTasks.length === 0) {
        taskList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">タスクが見つかりませんでした</p>';
        return;
    }

    filteredTasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        taskItem.innerHTML = `
            <div class="task-item-header">
                <div class="task-text">${escapeHtml(task.text)}</div>
            </div>
            <div class="task-meta">
                <span class="task-category">${escapeHtml(task.category)}</span>
                <span class="task-date">📅 ${escapeHtml(task.date)}</span>
                <span class="task-time">⏰ ${escapeHtml(task.timeSlot)}</span>
            </div>
        `;
        taskList.appendChild(taskItem);
    });
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

