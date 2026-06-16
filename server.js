const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  initDb,
  getKlaimRecords,
  addKlaimRecord,
  updateKlaimRecord,
  deleteKlaimRecord,
  getRadiologiRecords,
  addRadiologiRecord,
  updateRadiologiRecord,
  deleteRadiologiRecord
} = require('./db');
const { exportListKlaim, exportRadiologi } = require('./exporter');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Simple ID Generator helper
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Authentication Middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader === 'Bearer admin-session-token') {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Please login first.' });
  }
}

// === AUTHENTICATION ENDPOINTS ===

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    res.json({ success: true, token: 'admin-session-token' });
  } else {
    res.status(400).json({ error: 'Username atau Password salah.' });
  }
});

app.get('/api/auth/verify', requireAuth, (req, res) => {
  res.json({ valid: true });
});

// === LIST KLAIM ENDPOINTS ===

// GET all list klaim records for a year (optional filter by month)
app.get('/api/klaim', requireAuth, async (req, res) => {
  const { year, month } = req.query;
  
  if (!year) {
    return res.status(400).json({ error: 'Tahun wajib ditentukan.' });
  }
  
  try {
    const results = await getKlaimRecords(year, month);
    res.json(results);
  } catch (err) {
    console.error('Error fetching klaim:', err);
    res.status(500).json({ error: 'Gagal mengambil data List Klaim.' });
  }
});

// POST new list klaim record (draft)
app.post('/api/klaim', requireAuth, async (req, res) => {
  const {
    year, month, no_rm, dx, tx, klaim, biling, kelas, plus_minus, krs, tgl_mengerjakan, catatan, los
  } = req.body;
  
  if (!year || !month) {
    return res.status(400).json({ error: 'Tahun dan Bulan wajib diisi.' });
  }
  
  // Format arrays for DX and TX, clean up empty items
  const cleanDx = Array.isArray(dx) ? dx.map(s => s.trim()).filter(Boolean) : [];
  const cleanTx = Array.isArray(tx) ? tx.map(s => s.trim()).filter(Boolean) : [];
  
  const newRecord = {
    id: generateId(),
    year: parseInt(year),
    month: month.toUpperCase(),
    no_rm: no_rm ? no_rm.trim() : '',
    dx: cleanDx,
    tx: cleanTx,
    klaim: klaim ? parseInt(klaim) : 0,
    biling: biling ? parseInt(biling) : 0,
    kelas: kelas ? kelas.trim() : '',
    plus_minus: plus_minus !== undefined && plus_minus !== null && plus_minus !== '' ? parseInt(plus_minus) : (parseInt(klaim || 0) - parseInt(biling || 0)),
    krs: krs || '',
    tgl_mengerjakan: tgl_mengerjakan || '',
    catatan: catatan ? catatan.trim() : '',
    los: los ? los.trim() : '',
    createdAt: new Date().toISOString()
  };
  
  try {
    const saved = await addKlaimRecord(newRecord);
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error inserting klaim:', err);
    res.status(500).json({ error: 'Gagal menyimpan data List Klaim.' });
  }
});

// PUT update list klaim record
app.put('/api/klaim/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const {
    no_rm, dx, tx, klaim, biling, kelas, plus_minus, krs, tgl_mengerjakan, catatan, los
  } = req.body;
  
  const cleanDx = Array.isArray(dx) ? dx.map(s => s.trim()).filter(Boolean) : [];
  const cleanTx = Array.isArray(tx) ? tx.map(s => s.trim()).filter(Boolean) : [];
  
  const updatedData = {
    no_rm: no_rm ? no_rm.trim() : '',
    dx: cleanDx,
    tx: cleanTx,
    klaim: klaim ? parseInt(klaim) : 0,
    biling: biling ? parseInt(biling) : 0,
    kelas: kelas ? kelas.trim() : '',
    plus_minus: plus_minus !== undefined && plus_minus !== null && plus_minus !== '' ? parseInt(plus_minus) : (parseInt(klaim || 0) - parseInt(biling || 0)),
    krs: krs || '',
    tgl_mengerjakan: tgl_mengerjakan || '',
    catatan: catatan ? catatan.trim() : '',
    los: los ? los.trim() : ''
  };
  
  try {
    const updated = await updateKlaimRecord(id, updatedData);
    if (!updated) {
      return res.status(404).json({ error: 'Data List Klaim tidak ditemukan.' });
    }
    res.json(updated);
  } catch (err) {
    console.error('Error updating klaim:', err);
    res.status(500).json({ error: 'Gagal memperbarui data List Klaim.' });
  }
});

// DELETE list klaim record
app.delete('/api/klaim/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  
  try {
    const success = await deleteKlaimRecord(id);
    if (!success) {
      return res.status(404).json({ error: 'Data List Klaim tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Data List Klaim berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting klaim:', err);
    res.status(500).json({ error: 'Gagal menghapus data List Klaim.' });
  }
});

// === RADIOLOGI ENDPOINTS ===

// GET all radiologi records for a year and type (optional filter by month)
app.get('/api/radiologi', requireAuth, async (req, res) => {
  const { year, month, tipe } = req.query;
  
  if (!year) {
    return res.status(400).json({ error: 'Tahun wajib ditentukan.' });
  }
  
  try {
    const results = await getRadiologiRecords(year, month, tipe);
    res.json(results);
  } catch (err) {
    console.error('Error fetching radiologi:', err);
    res.status(500).json({ error: 'Gagal mengambil data Radiologi.' });
  }
});

// POST new radiologi record
app.post('/api/radiologi', requireAuth, async (req, res) => {
  const { year, month, tipe, no_rm_nama, tgl_pemeriksaan, tgl_krs, permintaan, diagnosa } = req.body;
  
  // Validate all fields for radiologi are required
  if (!year || !month || !tipe || !no_rm_nama || !tgl_pemeriksaan || !tgl_krs || !permintaan || !diagnosa) {
    return res.status(400).json({ error: 'Semua isian radiologi wajib diisi.' });
  }
  
  const newRecord = {
    id: generateId(),
    year: parseInt(year),
    month: month.toUpperCase(),
    tipe: tipe.toUpperCase(), // "ICU" or "HCU"
    no_rm_nama: no_rm_nama.trim(),
    tgl_pemeriksaan: tgl_pemeriksaan.trim(),
    tgl_krs: tgl_krs.trim(),
    permintaan: permintaan.trim(),
    diagnosa: diagnosa.trim(),
    createdAt: new Date().toISOString()
  };
  
  try {
    const saved = await addRadiologiRecord(newRecord);
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error adding radiologi:', err);
    res.status(500).json({ error: 'Gagal menyimpan data Radiologi.' });
  }
});

// PUT update radiologi record
app.put('/api/radiologi/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { no_rm_nama, tgl_pemeriksaan, tgl_krs, permintaan, diagnosa } = req.body;
  
  if (!no_rm_nama || !tgl_pemeriksaan || !tgl_krs || !permintaan || !diagnosa) {
    return res.status(400).json({ error: 'Semua isian radiologi wajib diisi.' });
  }
  
  const updatedData = {
    no_rm_nama: no_rm_nama.trim(),
    tgl_pemeriksaan: tgl_pemeriksaan.trim(),
    tgl_krs: tgl_krs.trim(),
    permintaan: permintaan.trim(),
    diagnosa: diagnosa.trim()
  };
  
  try {
    const updated = await updateRadiologiRecord(id, updatedData);
    if (!updated) {
      return res.status(404).json({ error: 'Data Radiologi tidak ditemukan.' });
    }
    res.json(updated);
  } catch (err) {
    console.error('Error updating radiologi:', err);
    res.status(500).json({ error: 'Gagal memperbarui data Radiologi.' });
  }
});

// DELETE radiologi record
app.delete('/api/radiologi/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  
  try {
    const success = await deleteRadiologiRecord(id);
    if (!success) {
      return res.status(404).json({ error: 'Data Radiologi tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Data Radiologi berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting radiologi:', err);
    res.status(500).json({ error: 'Gagal menghapus data Radiologi.' });
  }
});

// === EXPORT TO EXCEL ENDPOINTS ===

// Export List Klaim
app.get('/api/export/klaim', requireAuth, async (req, res) => {
  const { year } = req.query;
  if (!year) {
    return res.status(400).json({ error: 'Tahun wajib ditentukan untuk ekspor.' });
  }
  
  try {
    const records = await getKlaimRecords(year);
    const buffer = await exportListKlaim(year, records);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="LIST_DIAGNOSA_${year}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting list klaim:', err);
    res.status(500).json({ error: 'Gagal mengekspor data List Klaim.' });
  }
});

// Export Radiologi
app.get('/api/export/radiologi', requireAuth, async (req, res) => {
  const { year } = req.query;
  if (!year) {
    return res.status(400).json({ error: 'Tahun wajib ditentukan untuk ekspor.' });
  }
  
  try {
    const records = await getRadiologiRecords(year);
    const buffer = await exportRadiologi(year, records);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="RADIOLOGI_${year}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting radiologi:', err);
    res.status(500).json({ error: 'Gagal mengekspor data Radiologi.' });
  }
});

// Startup logic with DB initialization
initDb().then(() => {
  if (process.env.NODE_ENV !== 'production' || require.main === module) {
    app.listen(PORT, () => {
      console.log(`Server ICU/HCU Patient Recap running on http://localhost:${PORT}`);
    });
  }
}).catch(err => {
  console.error('Failed to initialize database pool:', err);
  process.exit(1);
});

module.exports = app;
