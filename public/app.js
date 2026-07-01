// ================================================================= //
// ================= GLOBAL STATE & CONFIGURATION ================== //
// ================================================================= //

let selectedYear = null;
const MONTHS = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
];
const currentDeviceMonth = MONTHS[new Date().getMonth()] || "JULI";
let activeMonthKlaim = currentDeviceMonth;
let activeMonthRadiologi = currentDeviceMonth;
let activeRadiologiType = "ICU"; // "ICU" or "HCU"

let klaimRecords = [];
let radiologiRecords = [];

// ================================================================= //
// ==================== HELPER UTILITY FUNCTIONS ==================== //
// ================================================================= //

function formatRupiah(num) {
  if (num === undefined || num === null || isNaN(num)) return "Rp0,00";
  const absVal = Math.abs(num);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(absVal);
  
  return num < 0 ? `-${formatted}` : formatted;
}

// Extract float number from Indonesian formatted string (e.g. "22.324.000,00" -> 22324000)
function parseFormattedNumber(valStr) {
  if (!valStr) return 0;
  let str = String(valStr).trim();
  if (str === '') return 0;
  
  // Remove currency symbol (Rp)
  str = str.replace(/Rp\s?/g, '');
  
  // Find decimal part
  let integerPart = str;
  let decimalPart = '00';
  
  // Check if there is a decimal separator at the end
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');
  const lastSeparator = Math.max(lastDot, lastComma);
  
  if (lastSeparator !== -1 && lastSeparator > str.length - 4) {
    integerPart = str.substring(0, lastSeparator);
    decimalPart = str.substring(lastSeparator + 1);
    if (decimalPart.length === 1) {
      decimalPart += '0';
    } else if (decimalPart.length > 2) {
      decimalPart = decimalPart.substring(0, 2);
    }
  }
  
  // Strip all non-digits
  const cleanedInt = integerPart.replace(/\D/g, '');
  const cleanedDec = decimalPart.replace(/\D/g, '');
  
  const parsedInt = parseInt(cleanedInt) || 0;
  const parsedDec = parseInt(cleanedDec) || 0;
  
  return parseFloat(`${parsedInt}.${parsedDec}`);
}

// Convert float number to Indonesian formatted string (e.g. 22324000 -> "22.324.000,00")
function formatNumberToIndonesian(num) {
  if (num === undefined || num === null || isNaN(num)) return "0,00";
  const parts = Number(num).toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  const formattedInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedInt},${decimalPart}`;
}

// Setup formatting handlers for form text inputs
function setupFormattedInput(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  
  el.addEventListener('focus', (e) => {
    const val = parseFormattedNumber(el.value);
    if (val === 0) {
      el.value = '';
    } else {
      el.value = val.toFixed(2).replace('.', ',');
    }
  });
  
  el.addEventListener('blur', (e) => {
    const val = parseFormattedNumber(el.value);
    el.value = formatNumberToIndonesian(val);
    calculatePlusMinus();
  });
}

function calculatePlusMinus() {
  const klaimIn = document.getElementById('klaim-klaim');
  const bilingIn = document.getElementById('klaim-biling');
  const plusMinusIn = document.getElementById('klaim-plusminus');
  if (!klaimIn || !bilingIn || !plusMinusIn) return;
  
  const klaim = parseFormattedNumber(klaimIn.value);
  const biling = parseFormattedNumber(bilingIn.value);
  
  const plusMinus = klaim - biling;
  plusMinusIn.value = formatNumberToIndonesian(plusMinus);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    // YYYY-MM-DD -> DD-MM-YYYY
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

// Convert YYYY-MM-DD date representation to standard Datepicker format
function parseDateForInput(dateStr) {
  if (!dateStr) return '';
  // Check if it is a full ISO timestamp
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  return dateStr;
}

// Fetch helper with auth header
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(url, { ...options, headers });
  
  if (res.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }
  
  return res;
}

// ================================================================= //
// ==================== AUTH & NAVIGATION FLOW ===================== //
// ================================================================= //

function showPage(pageId) {
  document.querySelectorAll('.page-container').forEach(el => {
    el.classList.remove('active');
  });
  
  const target = document.getElementById(pageId);
  target.classList.add('active');
}

async function verifyToken() {
  const token = localStorage.getItem('token');
  if (!token) {
    showPage('auth-container');
    return false;
  }
  
  try {
    const res = await apiFetch('/api/auth/verify');
    if (res.ok) {
      if (selectedYear) {
        showPage('dashboard-container');
      } else {
        showPage('year-container');
      }
      return true;
    }
  } catch (err) {
    console.error('Token verification failed:', err);
  }
  
  logout();
  return false;
}

function logout() {
  localStorage.removeItem('token');
  selectedYear = null;
  showPage('auth-container');
}

// ================================================================= //
// ================= MONTH FILTER BAR GENERATOR ==================== //
// ================================================================= //

function renderMonthFilters(containerId, activeMonth, onClickCallback) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  MONTHS.forEach(m => {
    const btn = document.createElement('button');
    btn.className = `month-tab ${m === activeMonth ? 'active' : ''}`;
    btn.textContent = m;
    btn.addEventListener('click', () => {
      onClickCallback(m);
    });
    container.appendChild(btn);
  });
}

// ================================================================= //
// ==================== DATA RENDERING LOGIC ======================= //
// ================================================================= //

// --- List Klaim (ICU) ---

async function fetchKlaim() {
  if (!selectedYear) return;
  try {
    const res = await apiFetch(`/api/klaim?year=${selectedYear}&month=${activeMonthKlaim}`);
    if (res.ok) {
      klaimRecords = await res.json();
      renderKlaimTable();
    }
  } catch (err) {
    console.error('Error fetching klaim records:', err);
  }
}

function renderKlaimTable() {
  const tbody = document.getElementById('klaim-list');
  const emptyState = document.getElementById('klaim-empty');
  const table = document.getElementById('table-klaim');
  const searchVal = document.getElementById('klaim-search').value.toLowerCase().trim();
  
  tbody.innerHTML = '';
  
  // Filter by search query
  let filtered = klaimRecords;
  if (searchVal) {
    filtered = klaimRecords.filter(r => 
      r.no_rm.toLowerCase().includes(searchVal) || 
      r.catatan.toLowerCase().includes(searchVal) ||
      (r.dx && r.dx.some(d => d.toLowerCase().includes(searchVal))) ||
      (r.tx && r.tx.some(t => t.toLowerCase().includes(searchVal)))
    );
  }
  
  if (filtered.length === 0) {
    table.classList.add('hidden');
    emptyState.classList.remove('hidden');
    document.getElementById('klaim-sum-value').textContent = formatRupiah(0);
    return;
  }
  
  table.classList.remove('hidden');
  emptyState.classList.add('hidden');
  
  let runningNo = 1;
  let totalPlusMinus = 0;
  
  filtered.forEach(record => {
    const dxs = Array.isArray(record.dx) && record.dx.length > 0 ? record.dx : [''];
    const txs = Array.isArray(record.tx) && record.tx.length > 0 ? record.tx : [''];
    const maxLines = Math.max(dxs.length, txs.length);
    
    // Accumulate total summation of plus_minus
    totalPlusMinus += record.plus_minus || 0;
    
    for (let i = 0; i < maxLines; i++) {
      const tr = document.createElement('tr');
      if (i > 0) {
        tr.className = 'sub-row';
      }
      
      if (i === 0) {
        // First line of patient record - fill all cells
        tr.innerHTML = `
          <td>${runningNo++}</td>
          <td>${record.no_rm || '-'}</td>
          <td>${dxs[i] || '-'}</td>
          <td>${txs[i] || '-'}</td>
          <td>${formatRupiah(record.klaim)}</td>
          <td>${formatRupiah(record.biling)}</td>
          <td>${record.kelas || '-'}</td>
          <td>${formatRupiah(record.plus_minus)}</td>
          <td>${formatDate(record.krs)}</td>
          <td>${formatDate(record.tgl_mengerjakan)}</td>
          <td>${record.catatan || '-'}</td>
          <td>${record.los || '-'}</td>
          <td class="col-actions">
            <div class="action-buttons">
              <button class="btn-action-edit" onclick="openEditKlaimModal('${record.id}')" title="Ubah Draft">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-action-delete" onclick="deleteKlaimRecord('${record.id}')" title="Hapus Draft">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          </td>
        `;
      } else {
        // Extra lines - only fill DX, TX columns, leave others blank with helper CSS class
        tr.innerHTML = `
          <td class="empty-merge-cell"></td>
          <td class="empty-merge-cell"></td>
          <td>${dxs[i] || '-'}</td>
          <td>${txs[i] || '-'}</td>
          <td class="empty-merge-cell"></td>
          <td class="empty-merge-cell"></td>
          <td class="empty-merge-cell"></td>
          <td class="empty-merge-cell"></td>
          <td class="empty-merge-cell"></td>
          <td class="empty-merge-cell"></td>
          <td class="empty-merge-cell"></td>
          <td class="empty-merge-cell"></td>
          <td class="empty-merge-cell"></td>
        `;
      }
      tbody.appendChild(tr);
    }
  });
  
  // Update UI Sum Header Badge
  document.getElementById('klaim-sum-value').textContent = formatRupiah(totalPlusMinus);
}

// --- Radiologi (ICU & HCU) ---

async function fetchRadiologi() {
  if (!selectedYear) return;
  try {
    const res = await apiFetch(`/api/radiologi?year=${selectedYear}&month=${activeMonthRadiologi}&tipe=${activeRadiologiType}`);
    if (res.ok) {
      radiologiRecords = await res.json();
      renderRadiologiTable();
    }
  } catch (err) {
    console.error('Error fetching radiologi records:', err);
  }
}

function renderRadiologiTable() {
  const tbody = document.getElementById('radiologi-list');
  const emptyState = document.getElementById('radiologi-empty');
  const table = document.getElementById('table-radiologi');
  const searchVal = document.getElementById('radiologi-search').value.toLowerCase().trim();
  
  tbody.innerHTML = '';
  
  let filtered = radiologiRecords;
  if (searchVal) {
    filtered = radiologiRecords.filter(r => 
      r.no_rm_nama.toLowerCase().includes(searchVal) ||
      r.permintaan.toLowerCase().includes(searchVal) ||
      r.diagnosa.toLowerCase().includes(searchVal)
    );
  }
  
  // Set headers depending on ICU / HCU structure
  const diagHeader = document.querySelector('#table-radiologi th:nth-child(6)');
  if (diagHeader) {
    diagHeader.textContent = activeRadiologiType === "ICU" ? "DIAGNO0SA" : "DIAGNOSA";
  }
  const noHeader = document.querySelector('#table-radiologi th:nth-child(1)');
  if (noHeader) {
    noHeader.textContent = activeRadiologiType === "HCU" ? "NO" : "No";
  }
  
  if (filtered.length === 0) {
    table.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }
  
  table.classList.remove('hidden');
  emptyState.classList.add('hidden');
  
  let runningNo = 1;
  
  filtered.forEach(record => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${runningNo++}</td>
      <td>${record.no_rm_nama || '-'}</td>
      <td>${formatDate(record.tgl_pemeriksaan)}</td>
      <td>${formatDate(record.tgl_krs)}</td>
      <td>${record.permintaan || '-'}</td>
      <td>${record.diagnosa || '-'}</td>
      <td class="col-actions">
        <div class="action-buttons">
          <button class="btn-action-edit" onclick="openEditRadiologiModal('${record.id}')" title="Ubah Draft">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-action-delete" onclick="deleteRadiologiRecord('${record.id}')" title="Hapus Draft">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ================================================================= //
// ==================== MODALS FORM DYNAMIC LOGIC ================== //
// ================================================================= //

// Dynamic DX inputs manager
function renderDxInputs(dxArray = ['']) {
  const container = document.getElementById('dx-list-inputs');
  container.innerHTML = '';
  
  dxArray.forEach((val, idx) => {
    const row = document.createElement('div');
    row.className = 'dynamic-input-row';
    row.innerHTML = `
      <input type="text" class="input-dx" placeholder="cth: S09.7 (SAH SDH)" value="${val}">
      ${dxArray.length > 1 ? `<button type="button" class="btn-remove-row" onclick="removeDxInput(${idx})">&times;</button>` : ''}
    `;
    container.appendChild(row);
  });
}

window.removeDxInput = function(index) {
  const inputs = Array.from(document.querySelectorAll('.input-dx')).map(el => el.value);
  inputs.splice(index, 1);
  renderDxInputs(inputs);
};

document.getElementById('btn-add-dx').addEventListener('click', () => {
  const inputs = Array.from(document.querySelectorAll('.input-dx')).map(el => el.value);
  inputs.push('');
  renderDxInputs(inputs);
});

// Dynamic TX inputs manager
function renderTxInputs(txArray = ['']) {
  const container = document.getElementById('tx-list-inputs');
  container.innerHTML = '';
  
  txArray.forEach((val, idx) => {
    const row = document.createElement('div');
    row.className = 'dynamic-input-row';
    row.innerHTML = `
      <input type="text" class="input-tx" placeholder="cth: 96.71" value="${val}">
      ${txArray.length > 1 ? `<button type="button" class="btn-remove-row" onclick="removeTxInput(${idx})">&times;</button>` : ''}
    `;
    container.appendChild(row);
  });
}

window.removeTxInput = function(index) {
  const inputs = Array.from(document.querySelectorAll('.input-tx')).map(el => el.value);
  inputs.splice(index, 1);
  renderTxInputs(inputs);
};

document.getElementById('btn-add-tx').addEventListener('click', () => {
  const inputs = Array.from(document.querySelectorAll('.input-tx')).map(el => el.value);
  inputs.push('');
  renderTxInputs(inputs);
});

// Auto-calculate plus_minus logic with formatting
function setupAutoPlusMinusCalculation() {
  setupFormattedInput('klaim-klaim');
  setupFormattedInput('klaim-biling');
  
  const klaimIn = document.getElementById('klaim-klaim');
  const bilingIn = document.getElementById('klaim-biling');
  if (klaimIn && bilingIn) {
    const calc = () => {
      calculatePlusMinus();
    };
    klaimIn.addEventListener('input', calc);
    bilingIn.addEventListener('input', calc);
  }
}

// ================================================================= //
// ==================== MODAL ACTIONS (CRUD FRONTEND) ============== //
// ================================================================= //

// Modal triggers helper
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('active');
}

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal(btn.getAttribute('data-close'));
  });
});

// --- List Klaim CRUD Modal ---

window.openAddKlaimModal = function() {
  document.getElementById('modal-klaim-title').textContent = `Tambah Draft Pasien ICU (${activeMonthKlaim} ${selectedYear})`;
  document.getElementById('klaim-id').value = '';
  document.getElementById('form-klaim').reset();
  
  document.getElementById('klaim-klaim').value = '0,00';
  document.getElementById('klaim-biling').value = '0,00';
  document.getElementById('klaim-plusminus').value = '0,00';
  
  // Reset dynamic inputs
  renderDxInputs(['']);
  renderTxInputs(['']);
  
  openModal('modal-klaim');
};

window.openEditKlaimModal = function(id) {
  const record = klaimRecords.find(r => r.id === id);
  if (!record) return;
  
  document.getElementById('modal-klaim-title').textContent = `Ubah Draft Pasien ICU (${activeMonthKlaim} ${selectedYear})`;
  document.getElementById('klaim-id').value = record.id;
  document.getElementById('klaim-no-rm').value = record.no_rm || '';
  document.getElementById('klaim-kelas').value = record.kelas || '3';
  document.getElementById('klaim-los').value = record.los || '';
  
  document.getElementById('klaim-klaim').value = formatNumberToIndonesian(record.klaim);
  document.getElementById('klaim-biling').value = formatNumberToIndonesian(record.biling);
  document.getElementById('klaim-plusminus').value = formatNumberToIndonesian(
    record.plus_minus !== undefined ? record.plus_minus : (record.klaim - record.biling)
  );
  
  document.getElementById('klaim-krs').value = parseDateForInput(record.krs);
  document.getElementById('klaim-tgl-kerja').value = parseDateForInput(record.tgl_mengerjakan);
  document.getElementById('klaim-catatan').value = record.catatan || '';
  
  renderDxInputs(record.dx && record.dx.length > 0 ? record.dx : ['']);
  renderTxInputs(record.tx && record.tx.length > 0 ? record.tx : ['']);
  
  openModal('modal-klaim');
};

document.getElementById('form-klaim').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('klaim-id').value;
  const no_rm = document.getElementById('klaim-no-rm').value;
  const kelas = document.getElementById('klaim-kelas').value;
  const los = document.getElementById('klaim-los').value;
  const klaim = document.getElementById('klaim-klaim').value;
  const biling = document.getElementById('klaim-biling').value;
  const plus_minus = document.getElementById('klaim-plusminus').value;
  const krs = document.getElementById('klaim-krs').value;
  const tgl_mengerjakan = document.getElementById('klaim-tgl-kerja').value;
  const catatan = document.getElementById('klaim-catatan').value;
  
  const dx = Array.from(document.querySelectorAll('.input-dx')).map(el => el.value.trim()).filter(Boolean);
  const tx = Array.from(document.querySelectorAll('.input-tx')).map(el => el.value.trim()).filter(Boolean);
  
  const payload = {
    year: selectedYear,
    month: activeMonthKlaim,
    no_rm,
    dx,
    tx,
    klaim: parseFormattedNumber(klaim),
    biling: parseFormattedNumber(biling),
    kelas,
    plus_minus: parseFormattedNumber(plus_minus),
    krs,
    tgl_mengerjakan,
    catatan,
    los
  };
  
  try {
    let res;
    if (id) {
      // Edit record
      res = await apiFetch(`/api/klaim/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      // Add new record
      res = await apiFetch('/api/klaim', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    
    if (res.ok) {
      closeModal('modal-klaim');
      fetchKlaim();
    } else {
      const err = await res.json();
      alert('Error: ' + err.error);
    }
  } catch (err) {
    console.error('Failed to save klaim draft:', err);
  }
});

window.deleteKlaimRecord = async function(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus draft ini?')) return;
  try {
    const res = await apiFetch(`/api/klaim/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchKlaim();
    }
  } catch (err) {
    console.error('Error deleting klaim:', err);
  }
};

// --- Radiologi CRUD Modal ---

window.openAddRadiologiModal = function() {
  document.getElementById('modal-radiologi-title').textContent = `Tambah Draft Radiologi ${activeRadiologiType} (${activeMonthRadiologi} ${selectedYear})`;
  document.getElementById('radiologi-id').value = '';
  document.getElementById('form-radiologi').reset();
  openModal('modal-radiologi');
};

window.openEditRadiologiModal = function(id) {
  const record = radiologiRecords.find(r => r.id === id);
  if (!record) return;
  
  document.getElementById('modal-radiologi-title').textContent = `Ubah Draft Radiologi ${activeRadiologiType} (${activeMonthRadiologi} ${selectedYear})`;
  document.getElementById('radiologi-id').value = record.id;
  document.getElementById('radio-no-rm-nama').value = record.no_rm_nama || '';
  document.getElementById('radio-tgl-pemeriksaan').value = parseDateForInput(record.tgl_pemeriksaan);
  document.getElementById('radio-tgl-krs').value = parseDateForInput(record.tgl_krs);
  document.getElementById('radio-permintaan').value = record.permintaan || '';
  document.getElementById('radio-diagnosa').value = record.diagnosa || '';
  
  openModal('modal-radiologi');
};

document.getElementById('form-radiologi').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('radiologi-id').value;
  const no_rm_nama = document.getElementById('radio-no-rm-nama').value;
  const tgl_pemeriksaan = document.getElementById('radio-tgl-pemeriksaan').value;
  const tgl_krs = document.getElementById('radio-tgl-krs').value;
  const permintaan = document.getElementById('radio-permintaan').value;
  const diagnosa = document.getElementById('radio-diagnosa').value;
  
  const payload = {
    year: selectedYear,
    month: activeMonthRadiologi,
    tipe: activeRadiologiType,
    no_rm_nama,
    tgl_pemeriksaan,
    tgl_krs,
    permintaan,
    diagnosa
  };
  
  try {
    let res;
    if (id) {
      res = await apiFetch(`/api/radiologi/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      res = await apiFetch('/api/radiologi', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    
    if (res.ok) {
      closeModal('modal-radiologi');
      fetchRadiologi();
    } else {
      const err = await res.json();
      alert('Error: ' + err.error);
    }
  } catch (err) {
    console.error('Failed to save radiologi:', err);
  }
});

window.deleteRadiologiRecord = async function(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus draft radiologi ini?')) return;
  try {
    const res = await apiFetch(`/api/radiologi/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchRadiologi();
    }
  } catch (err) {
    console.error('Error deleting radiologi:', err);
  }
};

// ================================================================= //
// ==================== EXCEL DOWNLOAD ACTIONS ===================== //
// ================================================================= //

async function downloadExcelFile(apiEndpoint, filename) {
  const token = localStorage.getItem('token');
  if (!token) return;
  
  try {
    const res = await fetch(`${apiEndpoint}?year=${selectedYear}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (res.status === 401) {
      logout();
      return;
    }
    
    if (!res.ok) {
      const err = await res.json();
      alert('Gagal mengekspor: ' + err.error);
      return;
    }
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download error:', err);
    alert('Terjadi kesalahan saat mengunduh file Excel.');
  }
}

// ================================================================= //
// ==================== INITIALIZATION & BINDING =================== //
// ================================================================= //

function setupEventListeners() {
  // Login Form Submission
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userVal = document.getElementById('username').value;
    const passVal = document.getElementById('password').value;
    
    const errorMsg = document.getElementById('login-error');
    errorMsg.classList.add('hidden');
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userVal, password: passVal })
      });
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        showPage('year-container');
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error) {
          alert('Gagal masuk: ' + data.error);
        } else {
          errorMsg.classList.remove('hidden');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Koneksi ke server gagal.');
    }
  });

  // Year select click handler
  document.querySelectorAll('.year-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedYear = btn.getAttribute('data-year');
      proceedToDashboard();
    });
  });

  // Custom Year selection handler
  document.getElementById('custom-year-btn').addEventListener('click', () => {
    const val = document.getElementById('custom-year').value;
    if (val && val >= 2000 && val <= 2100) {
      selectedYear = val;
      proceedToDashboard();
    } else {
      alert('Tahun tidak valid. Masukkan tahun antara 2000 - 2100.');
    }
  });

  // Change year button
  document.getElementById('change-year-btn').addEventListener('click', () => {
    selectedYear = null;
    showPage('year-container');
  });

  // Logout button with confirmation dialog
  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm("Apakah Anda yakin ingin keluar?")) {
      logout();
    }
  });

  // Sidebar navigation switching
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const targetSection = item.getAttribute('data-target');
      document.querySelectorAll('.dashboard-section').forEach(sec => {
        sec.classList.remove('active');
      });
      document.getElementById(targetSection).classList.add('active');
      
      // Auto-fetch data if switching tabs
      if (targetSection === 'section-klaim') {
        fetchKlaim();
      } else if (targetSection === 'section-radiologi') {
        fetchRadiologi();
      }
    });
  });

  // Add Klaim Button
  document.getElementById('add-klaim-btn').addEventListener('click', () => {
    openAddKlaimModal();
  });

  // Add Radiologi Button
  document.getElementById('add-radiologi-btn').addEventListener('click', () => {
    openAddRadiologiModal();
  });

  // Search filter event listeners (with debounce/input handler)
  document.getElementById('klaim-search').addEventListener('input', renderKlaimTable);
  document.getElementById('radiologi-search').addEventListener('input', renderRadiologiTable);

  // ICU / HCU Toggle for Radiologi
  document.getElementById('btn-toggle-icu').addEventListener('click', () => {
    document.getElementById('btn-toggle-icu').classList.add('active');
    document.getElementById('btn-toggle-hcu').classList.remove('active');
    activeRadiologiType = "ICU";
    document.getElementById('radiologi-type-title').textContent = "ICU";
    fetchRadiologi();
  });

  document.getElementById('btn-toggle-hcu').addEventListener('click', () => {
    document.getElementById('btn-toggle-hcu').classList.add('active');
    document.getElementById('btn-toggle-icu').classList.remove('active');
    activeRadiologiType = "HCU";
    document.getElementById('radiologi-type-title').textContent = "HCU";
    fetchRadiologi();
  });

  // EXPORT EXCEL DOWNLOAD CLICK HANDLERS
  document.getElementById('export-klaim-btn').addEventListener('click', () => {
    downloadExcelFile('/api/export/klaim', `LIST_DIAGNOSA_${selectedYear}.xlsx`);
  });

  document.getElementById('export-radiologi-btn').addEventListener('click', () => {
    downloadExcelFile('/api/export/radiologi', `RADIOLOGI_${selectedYear}.xlsx`);
  });

  // Initialize auto arithmetic calculation fields on forms
  setupAutoPlusMinusCalculation();
}

function proceedToDashboard() {
  document.getElementById('display-year').textContent = selectedYear;
  
  // Render filters and fetch data
  renderMonthFilters('klaim-month-filters', activeMonthKlaim, (month) => {
    activeMonthKlaim = month;
    renderMonthFilters('klaim-month-filters', activeMonthKlaim, arguments.callee);
    fetchKlaim();
  });
  
  renderMonthFilters('radiologi-month-filters', activeMonthRadiologi, (month) => {
    activeMonthRadiologi = month;
    renderMonthFilters('radiologi-month-filters', activeMonthRadiologi, arguments.callee);
    fetchRadiologi();
  });
  
  showPage('dashboard-container');
  
  // Fetch initial active section
  const activeNav = document.querySelector('.nav-item.active');
  const targetSection = activeNav.getAttribute('data-target');
  if (targetSection === 'section-klaim') {
    fetchKlaim();
  } else if (targetSection === 'section-radiologi') {
    fetchRadiologi();
  }
}

// Window load init check
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  logout(); // Force login screen on every new visit
});
