const express = require('express');
const path = require('path');
const fs = require('fs');
const { readDb, writeDb } = require('./db');
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
app.get('/api/klaim', requireAuth, (req, res) => {
  const { year, month } = req.query;
  const db = readDb();
  let results = db.listKlaim || [];
  
  if (year) {
    results = results.filter(r => r.year === parseInt(year));
  }
  if (month) {
    results = results.filter(r => r.month.toUpperCase() === month.toUpperCase());
  }
  
  res.json(results);
});

// POST new list klaim record (draft)
app.post('/api/klaim', requireAuth, (req, res) => {
  const {
    year, month, no_rm, dx, tx, klaim, biling, kelas, plus_minus, krs, tgl_mengerjakan, catatan, los
  } = req.body;
  
  if (!year || !month) {
    return res.status(400).json({ error: 'Tahun dan Bulan wajib diisi.' });
  }
  
  const db = readDb();
  
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
  
  db.listKlaim.push(newRecord);
  writeDb(db);
  
  res.status(201).json(newRecord);
});

// PUT update list klaim record
app.put('/api/klaim/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const {
    no_rm, dx, tx, klaim, biling, kelas, plus_minus, krs, tgl_mengerjakan, catatan, los
  } = req.body;
  
  const db = readDb();
  const recordIndex = db.listKlaim.findIndex(r => r.id === id);
  
  if (recordIndex === -1) {
    return res.status(404).json({ error: 'Data List Klaim tidak ditemukan.' });
  }
  
  const cleanDx = Array.isArray(dx) ? dx.map(s => s.trim()).filter(Boolean) : [];
  const cleanTx = Array.isArray(tx) ? tx.map(s => s.trim()).filter(Boolean) : [];
  
  const updatedRecord = {
    ...db.listKlaim[recordIndex],
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
    updatedAt: new Date().toISOString()
  };
  
  db.listKlaim[recordIndex] = updatedRecord;
  writeDb(db);
  
  res.json(updatedRecord);
});

// DELETE list klaim record
app.delete('/api/klaim/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const initialLength = db.listKlaim.length;
  
  db.listKlaim = db.listKlaim.filter(r => r.id !== id);
  
  if (db.listKlaim.length === initialLength) {
    return res.status(404).json({ error: 'Data List Klaim tidak ditemukan.' });
  }
  
  writeDb(db);
  res.json({ success: true, message: 'Data List Klaim berhasil dihapus.' });
});

// === RADIOLOGI ENDPOINTS ===

// GET all radiologi records for a year and type (optional filter by month)
app.get('/api/radiologi', requireAuth, (req, res) => {
  const { year, month, tipe } = req.query;
  const db = readDb();
  let results = db.radiologi || [];
  
  if (year) {
    results = results.filter(r => r.year === parseInt(year));
  }
  if (tipe) {
    results = results.filter(r => r.tipe.toUpperCase() === tipe.toUpperCase());
  }
  if (month) {
    results = results.filter(r => r.month.toUpperCase() === month.toUpperCase());
  }
  
  res.json(results);
});

// POST new radiologi record
app.post('/api/radiologi', requireAuth, (req, res) => {
  const { year, month, tipe, no_rm_nama, tgl_pemeriksaan, tgl_krs, permintaan, diagnosa } = req.body;
  
  // Validate all fields for radiologi are required
  if (!year || !month || !tipe || !no_rm_nama || !tgl_pemeriksaan || !tgl_krs || !permintaan || !diagnosa) {
    return res.status(400).json({ error: 'Semua isian radiologi wajib diisi.' });
  }
  
  const db = readDb();
  
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
  
  db.radiologi.push(newRecord);
  writeDb(db);
  
  res.status(201).json(newRecord);
});

// PUT update radiologi record
app.put('/api/radiologi/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { no_rm_nama, tgl_pemeriksaan, tgl_krs, permintaan, diagnosa } = req.body;
  
  if (!no_rm_nama || !tgl_pemeriksaan || !tgl_krs || !permintaan || !diagnosa) {
    return res.status(400).json({ error: 'Semua isian radiologi wajib diisi.' });
  }
  
  const db = readDb();
  const recordIndex = db.radiologi.findIndex(r => r.id === id);
  
  if (recordIndex === -1) {
    return res.status(404).json({ error: 'Data Radiologi tidak ditemukan.' });
  }
  
  const updatedRecord = {
    ...db.radiologi[recordIndex],
    no_rm_nama: no_rm_nama.trim(),
    tgl_pemeriksaan: tgl_pemeriksaan.trim(),
    tgl_krs: tgl_krs.trim(),
    permintaan: permintaan.trim(),
    diagnosa: diagnosa.trim(),
    updatedAt: new Date().toISOString()
  };
  
  db.radiologi[recordIndex] = updatedRecord;
  writeDb(db);
  
  res.json(updatedRecord);
});

// DELETE radiologi record
app.delete('/api/radiologi/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const initialLength = db.radiologi.length;
  
  db.radiologi = db.radiologi.filter(r => r.id !== id);
  
  if (db.radiologi.length === initialLength) {
    return res.status(404).json({ error: 'Data Radiologi tidak ditemukan.' });
  }
  
  writeDb(db);
  res.json({ success: true, message: 'Data Radiologi berhasil dihapus.' });
});

// === EXPORT TO EXCEL ENDPOINTS ===

// Export List Klaim
app.get('/api/export/klaim', requireAuth, async (req, res) => {
  const { year } = req.query;
  if (!year) {
    return res.status(400).json({ error: 'Tahun wajib ditentukan untuk ekspor.' });
  }
  
  try {
    const db = readDb();
    const buffer = await exportListKlaim(year, db.listKlaim || []);
    
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
    const db = readDb();
    const buffer = await exportRadiologi(year, db.radiologi || []);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="RADIOLOGI_${year}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting radiologi:', err);
    res.status(500).json({ error: 'Gagal mengekspor data Radiologi.' });
  }
});


app.listen(PORT, () => {
  console.log(`Server ICU/HCU Patient Recap running on http://localhost:${PORT}`);
});
