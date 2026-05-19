/* ============================================================
   SecureFedHE · Website Dashboard Logic
   CSV parsing, Chart.js rendering, and Demo Data
   ============================================================ */

// ── Global State ─────────────────────────────────────────────
const datasets = {};
const chartInstances = {};

const COLORS = {
    baseline:  { main: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)',   border: 'rgba(6, 182, 212, 0.8)' },
    he_eps10:  { main: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)',  border: 'rgba(99, 102, 241, 0.8)' },
    he_eps20:  { main: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)',  border: 'rgba(139, 92, 246, 0.8)' },
    he_eps50:  { main: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.8)' },
    ring:      { main: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.8)' },
};

const LABELS = {
    baseline:  'Ring 1 (Vanilla)',
    he_eps10:  'Ring 2 (ε=10)',
    he_eps20:  'Ring 2 (ε=20)',
    he_eps50:  'Ring 2 (ε=50)',
    ring:      'Ring 3 (Decentralised)',
};

// ── CSV Parser ───────────────────────────────────────────────
function parseCSV(text) {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, j) => {
            const val = values[j];
            row[h] = isNaN(val) ? val : parseFloat(val);
        });
        rows.push(row);
    }
    return rows;
}

// ── File Upload Handlers ─────────────────────────────────────
document.querySelectorAll('.csv-input').forEach(input => {
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const ring = this.getAttribute('data-ring');
        const reader = new FileReader();

        reader.onload = function(ev) {
            const data = parseCSV(ev.target.result);
            if (data.length > 0) {
                datasets[ring] = data;
                const status = document.querySelector(`[data-status="${ring}"]`);
                status.textContent = `✓ Loaded ${data.length} rounds`;
                status.classList.add('success');
                input.closest('.upload-card').classList.add('loaded');
                checkReady();
            }
        };
        reader.readAsText(file);
    });
});

function checkReady() {
    const btn = document.getElementById('btnGenerateCharts');
    btn.disabled = Object.keys(datasets).length === 0;
}

// ── Demo Data Generator ──────────────────────────────────────
function loadDemoData() {
    const rounds = 20;

    datasets.baseline = generateDemoRing('baseline', rounds, {
        startAcc: 0.2255, endAcc: 0.7943, wallTime: 350, encOverhead: 0, commBytes: 24832400
    });
    datasets.he_eps10 = generateDemoRing('selectiveHE', rounds, {
        startAcc: 0.2180, endAcc: 0.7928, wallTime: 370, encOverhead: 0.035, commBytes: 24853200
    });
    datasets.he_eps20 = generateDemoRing('selectiveHE', rounds, {
        startAcc: 0.2210, endAcc: 0.7935, wallTime: 368, encOverhead: 0.033, commBytes: 24853200
    });
    datasets.he_eps50 = generateDemoRing('selectiveHE', rounds, {
        startAcc: 0.2240, endAcc: 0.7940, wallTime: 365, encOverhead: 0.032, commBytes: 24853200
    });
    datasets.ring = generateDemoRing('ring', rounds, {
        startAcc: 0.2100, endAcc: 0.7890, wallTime: 400, encOverhead: 0.045, commBytes: 25100000
    });

    Object.keys(LABELS).forEach(key => {
        const status = document.querySelector(`[data-status="${key}"]`);
        if (status && datasets[key]) {
            status.textContent = `✓ Demo: ${datasets[key].length} rounds`;
            status.classList.add('success');
            status.closest('.upload-card').classList.add('loaded');
        }
    });

    checkReady();
    generateAllCharts();
}

function generateDemoRing(phase, rounds, cfg) {
    const data = [];
    for (let r = 1; r <= rounds; r++) {
        const progress = r / rounds;
        const accCurve = 1 - Math.exp(-3.5 * progress);
        const acc = cfg.startAcc + (cfg.endAcc - cfg.startAcc) * accCurve;
        
        data.push({
            round_num: r,
            eval_acc: +(acc + (Math.random() - 0.5) * 0.005).toFixed(4),
            comm_bytes: cfg.commBytes,
            wall_time_s: +(cfg.wallTime + (Math.random() - 0.5) * 100).toFixed(1),
            enc_overhead_s: +(cfg.encOverhead + Math.random() * 0.01).toFixed(3),
        });
    }
    return data;
}

// ── Chart Generation ─────────────────────────────────────────
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";

function generateAllCharts() {
    if (Object.keys(datasets).length === 0) return;

    document.getElementById('charts-wrapper').style.display = 'block';

    Object.values(chartInstances).forEach(c => c.destroy());

    renderAccuracyChart();
    renderPrivacyChart();
    renderOverheadChart();
    renderCommChart();
    renderSummaryTable();
    updateHeroStats();
}

function makeLineDataset(key, field) {
    if (!datasets[key]) return null;
    const color = COLORS[key];
    return {
        label: LABELS[key],
        data: datasets[key].map(d => +(d[field] * 100).toFixed(2)),
        borderColor: color.border,
        backgroundColor: color.bg,
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.3,
    };
}

function renderAccuracyChart() {
    const ctx = document.getElementById('chartAccuracy').getContext('2d');
    const dsets = Object.keys(LABELS).map(key => makeLineDataset(key, 'eval_acc')).filter(Boolean);
    const maxRounds = Math.max(...Object.values(datasets).map(d => d.length));
    const labels = Array.from({ length: maxRounds }, (_, i) => i + 1);

    chartInstances.chartAccuracy = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: dsets },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false } }
    });
}

function renderPrivacyChart() {
    const ctx = document.getElementById('chartPrivacy').getContext('2d');
    const epsilonData = [];
    if (datasets.he_eps10) epsilonData.push({ eps: 10, acc: datasets.he_eps10[datasets.he_eps10.length - 1].eval_acc * 100 });
    if (datasets.he_eps20) epsilonData.push({ eps: 20, acc: datasets.he_eps20[datasets.he_eps20.length - 1].eval_acc * 100 });
    if (datasets.he_eps50) epsilonData.push({ eps: 50, acc: datasets.he_eps50[datasets.he_eps50.length - 1].eval_acc * 100 });

    let baselineAcc = datasets.baseline ? datasets.baseline[datasets.baseline.length - 1].eval_acc * 100 : null;

    const dsets = [{
        label: 'Selective HE + DP',
        data: epsilonData.map(d => ({ x: d.eps, y: +d.acc.toFixed(2) })),
        borderColor: COLORS.he_eps10.border,
        backgroundColor: COLORS.he_eps10.main,
        borderWidth: 3, tension: 0.3, showLine: true, pointRadius: 6
    }];

    if (baselineAcc) {
        dsets.push({
            label: 'Baseline',
            data: [{ x: 10, y: baselineAcc }, { x: 50, y: baselineAcc }],
            borderColor: COLORS.baseline.border, borderDash: [5, 5], borderWidth: 2, showLine: true, pointRadius: 0
        });
    }

    chartInstances.chartPrivacy = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: dsets },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderOverheadChart() {
    const ctx = document.getElementById('chartOverhead').getContext('2d');
    const configs = [], avgWallTimes = [], avgEncOverheads = [], barColors = [];

    Object.keys(LABELS).forEach(key => {
        if (!datasets[key]) return;
        const d = datasets[key];
        configs.push(LABELS[key]);
        avgWallTimes.push(+(d.reduce((s, r) => s + r.wall_time_s, 0) / d.length).toFixed(1));
        avgEncOverheads.push(+(d.reduce((s, r) => s + r.enc_overhead_s, 0) / d.length).toFixed(3));
        barColors.push(COLORS[key].border);
    });

    chartInstances.chartOverhead = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: configs,
            datasets: [
                { label: 'Avg Wall Time (s)', data: avgWallTimes, backgroundColor: barColors.map(c => c.replace('0.8)', '0.5)')), borderColor: barColors, borderWidth: 1 },
                { label: 'Avg Enc Overhead (s)', data: avgEncOverheads, backgroundColor: barColors, borderColor: barColors, borderWidth: 1 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderCommChart() {
    const ctx = document.getElementById('chartComm').getContext('2d');
    const configs = [], commMB = [], barColors = [];

    Object.keys(LABELS).forEach(key => {
        if (!datasets[key]) return;
        configs.push(LABELS[key]);
        commMB.push(+(datasets[key][0].comm_bytes / (1024 * 1024)).toFixed(2));
        barColors.push(COLORS[key].bg);
    });

    chartInstances.chartComm = new Chart(ctx, {
        type: 'bar',
        data: { labels: configs, datasets: [{ label: 'MB / Round', data: commMB, backgroundColor: barColors, borderColor: barColors.map(c => c.replace('0.1)', '0.8)')), borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderSummaryTable() {
    const tbody = document.getElementById('summaryTableBody');
    tbody.innerHTML = '';
    const bAcc = datasets.baseline ? datasets.baseline[datasets.baseline.length - 1].eval_acc : null;

    Object.keys(LABELS).forEach(key => {
        if (!datasets[key]) return;
        const d = datasets[key], n = d.length;
        const fAcc = d[n - 1].eval_acc, bst = Math.max(...d.map(r => r.eval_acc));
        const drop = bAcc ? ((bAcc - fAcc) * 100) : 0;
        
        tbody.innerHTML += `
            <tr>
                <td style="font-family: var(--font-sans); font-weight: 600; color: #fff;">${LABELS[key]}</td>
                <td>${(fAcc * 100).toFixed(2)}</td>
                <td>${(bst * 100).toFixed(2)}</td>
                <td>${key === 'baseline' ? '—' : (drop >= 0 ? '+' : '') + drop.toFixed(2)}</td>
                <td>${(d.reduce((s, r) => s + r.wall_time_s, 0) / n).toFixed(1)}</td>
                <td>${(d.reduce((s, r) => s + r.enc_overhead_s, 0) / n).toFixed(3)}</td>
                <td>${(d[0].comm_bytes / (1024 * 1024)).toFixed(2)}</td>
            </tr>
        `;
    });
}

function updateHeroStats() {
    let bAcc = 0;
    Object.values(datasets).forEach(d => { const m = Math.max(...d.map(r => r.eval_acc)); if (m > bAcc) bAcc = m; });
    document.getElementById('statAccuracy').textContent = (bAcc * 100).toFixed(2) + '%';

    const eps = [];
    if (datasets.he_eps10) eps.push(10);
    if (datasets.he_eps20) eps.push(20);
    if (datasets.he_eps50) eps.push(50);
    document.getElementById('statPrivacy').textContent = eps.length ? 'ε=' + Math.min(...eps) : '—';

    let tEnc = 0, eCnt = 0;
    ['he_eps10', 'he_eps20', 'he_eps50', 'ring'].forEach(k => {
        if (datasets[k]) datasets[k].forEach(r => { tEnc += r.enc_overhead_s; eCnt++; });
    });
    document.getElementById('statOverhead').textContent = eCnt ? (tEnc / eCnt).toFixed(3) + 's' : '—';

    if (datasets.baseline) {
        const baseA = datasets.baseline[datasets.baseline.length - 1].eval_acc;
        let mDrop = Infinity;
        ['he_eps10', 'he_eps20', 'he_eps50'].forEach(k => {
            if (datasets[k]) {
                const drop = Math.abs(baseA - datasets[k][datasets[k].length - 1].eval_acc) * 100;
                if (drop < mDrop) mDrop = drop;
            }
        });
        document.getElementById('statDrop').textContent = mDrop !== Infinity ? mDrop.toFixed(2) + '%' : '—';
    }
}

function exportChart(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const t = document.createElement('canvas'), ctx = t.getContext('2d');
    t.width = canvas.width * 2; t.height = canvas.height * 2;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, t.width, t.height);
    ctx.scale(2, 2); ctx.drawImage(canvas, 0, 0);
    const a = document.createElement('a'); a.download = `securefedhe_${id}.png`;
    a.href = t.toDataURL('image/png', 1.0); a.click();
}

// ── Interactive Simulation Engine ──────────────────────────
const simNodes = ['A', 'B', 'C'];
let isSimulating = false;

document.getElementById('btnStartSim').addEventListener('click', runSimulation);

async function runSimulation() {
    if (isSimulating) return;
    isSimulating = true;
    const btn = document.getElementById('btnStartSim');
    const statusText = document.getElementById('simStatusText');
    const serverNode = document.getElementById('simServer');
    const packetsContainer = document.getElementById('simPackets');
    
    btn.disabled = true;
    
    // Step 1: Local Training
    statusText.textContent = "Step 1: Hospitals are training local AI models on private patient data...";
    simNodes.forEach(node => {
        const el = document.getElementById(`node${node}`);
        const stateEl = document.getElementById(`state${node}`);
        el.classList.add('training');
        stateEl.textContent = "Training (Plaintext)";
    });
    
    await wait(2500);
    
    // Step 2: Encryption (CKKS + DP)
    statusText.textContent = "Step 2: Applying Differential Privacy and CKKS Homomorphic Encryption...";
    simNodes.forEach(node => {
        const el = document.getElementById(`node${node}`);
        const stateEl = document.getElementById(`state${node}`);
        el.classList.remove('training');
        el.classList.add('encrypting');
        stateEl.textContent = "Encrypted 🔒";
    });
    
    await wait(2000);
    
    // Step 3: Secure Transfer
    statusText.textContent = "Step 3: Transferring encrypted weights to the Main Server...";
    
    // Animate Packets
    simNodes.forEach(node => {
        const nodeEl = document.getElementById(`node${node}`);
        const serverRect = serverNode.getBoundingClientRect();
        const nodeRect = nodeEl.getBoundingClientRect();
        const stageRect = document.querySelector('.sim-stage').getBoundingClientRect();
        
        // Calculate relative positions
        const startX = nodeRect.left - stageRect.left + nodeRect.width / 2 - 15;
        const startY = nodeRect.top - stageRect.top;
        const endX = serverRect.left - stageRect.left + serverRect.width / 2 - 15;
        const endY = serverRect.bottom - stageRect.top;
        
        const packet = document.createElement('div');
        packet.className = 'packet';
        packet.textContent = '🔒';
        packet.style.left = `${startX}px`;
        packet.style.top = `${startY}px`;
        packet.style.setProperty('--tx', `${endX - startX}px`);
        packet.style.setProperty('--ty', `${endY - startY}px`);
        packet.style.setProperty('--ty-half', `${(endY - startY) / 2}px`);
        
        packetsContainer.appendChild(packet);
        
        // Trigger reflow
        void packet.offsetWidth;
        packet.classList.add('flying');
        
        // Cleanup packet
        setTimeout(() => packet.remove(), 2000);
    });
    
    await wait(1800);
    
    // Step 4: Secure Aggregation
    statusText.textContent = "Step 4: Main AI Model aggregates encrypted data. Patient privacy preserved!";
    serverNode.classList.add('aggregating');
    simNodes.forEach(node => {
        const el = document.getElementById(`node${node}`);
        const stateEl = document.getElementById(`state${node}`);
        el.classList.remove('encrypting');
        stateEl.textContent = "Idle";
    });
    
    await wait(2500);
    
    // Reset
    serverNode.classList.remove('aggregating');
    statusText.textContent = "Training round complete! System Idle.";
    btn.disabled = false;
    isSimulating = false;
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
