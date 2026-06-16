const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// File DB configuration (local fallback)
const DB_PATH = path.join(__dirname, 'database.json');
const BACKUP_PATH = path.join(__dirname, 'database.json.bak');
const TEMP_PATH = path.join(__dirname, 'database.json.tmp');

let pool = null;

// Determine if we should use TiDB
const useTiDB = !!process.env.TIDB_HOST;

// Initialize TiDB connection pool if config is available
function getPool() {
  if (!pool && useTiDB) {
    pool = mysql.createPool({
      host: process.env.TIDB_HOST,
      port: parseInt(process.env.TIDB_PORT) || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: {
        minVersion: 'TLSv1.2'
      },
      connectionLimit: 10,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
  }
  return pool;
}

// === LOCAL FILE DB FALLBACK LOGIC ===

function initLocalFile() {
  if (!fs.existsSync(DB_PATH)) {
    const defaultData = { listKlaim: [], radiologi: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

function readLocalFile() {
  try {
    initLocalFile();
    const content = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading local db file, restoring from backup:', err);
    if (fs.existsSync(BACKUP_PATH)) {
      try {
        const backupContent = fs.readFileSync(BACKUP_PATH, 'utf8');
        fs.writeFileSync(DB_PATH, backupContent, 'utf8');
        return JSON.parse(backupContent);
      } catch (backupErr) {
        console.error('Backup restore failed:', backupErr);
      }
    }
    return { listKlaim: [], radiologi: [] };
  }
}

function writeLocalFile(data) {
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, BACKUP_PATH);
    }
    fs.writeFileSync(TEMP_PATH, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(TEMP_PATH, DB_PATH);
    return true;
  } catch (err) {
    console.error('Error writing local database file:', err);
    throw err;
  }
}

// === DATABASE SERVICE INTERFACE ===

async function initDb() {
  if (useTiDB) {
    console.log('Connecting to TiDB Serverless database...');
    const localPool = getPool();
    
    // Create Tables if they don't exist
    const connection = await localPool.getConnection();
    try {
      // 1. list_klaim
      await connection.query(`
        CREATE TABLE IF NOT EXISTS list_klaim (
          id VARCHAR(36) PRIMARY KEY,
          year INT NOT NULL,
          month VARCHAR(20) NOT NULL,
          no_rm VARCHAR(255),
          klaim BIGINT DEFAULT 0,
          biling BIGINT DEFAULT 0,
          kelas VARCHAR(20),
          plus_minus BIGINT DEFAULT 0,
          krs VARCHAR(50),
          tgl_mengerjakan VARCHAR(50),
          catatan TEXT,
          los VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // 2. klaim_dx
      await connection.query(`
        CREATE TABLE IF NOT EXISTS klaim_dx (
          id INT AUTO_INCREMENT PRIMARY KEY,
          klaim_id VARCHAR(36) NOT NULL,
          dx VARCHAR(255) NOT NULL,
          INDEX (klaim_id)
        )
      `);
      
      // 3. klaim_tx
      await connection.query(`
        CREATE TABLE IF NOT EXISTS klaim_tx (
          id INT AUTO_INCREMENT PRIMARY KEY,
          klaim_id VARCHAR(36) NOT NULL,
          tx VARCHAR(255) NOT NULL,
          INDEX (klaim_id)
        )
      `);
      
      // 4. radiologi
      await connection.query(`
        CREATE TABLE IF NOT EXISTS radiologi (
          id VARCHAR(36) PRIMARY KEY,
          year INT NOT NULL,
          month VARCHAR(20) NOT NULL,
          tipe VARCHAR(20) NOT NULL,
          no_rm_nama VARCHAR(255) NOT NULL,
          tgl_pemeriksaan VARCHAR(50) NOT NULL,
          tgl_krs VARCHAR(50) NOT NULL,
          permintaan VARCHAR(255) NOT NULL,
          diagnosa VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('TiDB database tables checked/initialized successfully.');
    } catch (err) {
      console.error('Failed to initialize TiDB tables:', err);
      throw err;
    } finally {
      connection.release();
    }
  } else {
    console.log('Using local JSON file database fallback.');
    initLocalFile();
  }
}

// --- List Klaim CRUD operations ---

async function getKlaimRecords(year, month) {
  if (useTiDB) {
    const localPool = getPool();
    let query = 'SELECT * FROM list_klaim WHERE year = ?';
    const params = [parseInt(year)];
    
    if (month) {
      query += ' AND UPPER(month) = ?';
      params.push(month.toUpperCase());
    }
    
    query += ' ORDER BY created_at ASC';
    
    const [records] = await localPool.query(query, params);
    
    // Fetch dx and tx for each record
    for (const record of records) {
      const [dxRows] = await localPool.query('SELECT dx FROM klaim_dx WHERE klaim_id = ?', [record.id]);
      const [txRows] = await localPool.query('SELECT tx FROM klaim_tx WHERE klaim_id = ?', [record.id]);
      record.dx = dxRows.map(r => r.dx);
      record.tx = txRows.map(r => r.tx);
    }
    
    return records;
  } else {
    const db = readLocalFile();
    let results = db.listKlaim || [];
    if (year) {
      results = results.filter(r => r.year === parseInt(year));
    }
    if (month) {
      results = results.filter(r => r.month.toUpperCase() === month.toUpperCase());
    }
    return results;
  }
}

async function addKlaimRecord(record) {
  if (useTiDB) {
    const localPool = getPool();
    const connection = await localPool.getConnection();
    try {
      await connection.beginTransaction();
      
      await connection.query(
        `INSERT INTO list_klaim 
         (id, year, month, no_rm, klaim, biling, kelas, plus_minus, krs, tgl_mengerjakan, catatan, los) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id, record.year, record.month, record.no_rm, 
          record.klaim, record.biling, record.kelas, record.plus_minus, 
          record.krs, record.tgl_mengerjakan, record.catatan, record.los
        ]
      );
      
      if (record.dx && record.dx.length > 0) {
        for (const dxVal of record.dx) {
          await connection.query('INSERT INTO klaim_dx (klaim_id, dx) VALUES (?, ?)', [record.id, dxVal]);
        }
      }
      
      if (record.tx && record.tx.length > 0) {
        for (const txVal of record.tx) {
          await connection.query('INSERT INTO klaim_tx (klaim_id, tx) VALUES (?, ?)', [record.id, txVal]);
        }
      }
      
      await connection.commit();
      return record;
    } catch (err) {
      await connection.rollback();
      console.error('Error adding klaim to TiDB:', err);
      throw err;
    } finally {
      connection.release();
    }
  } else {
    const db = readLocalFile();
    db.listKlaim.push(record);
    writeLocalFile(db);
    return record;
  }
}

async function updateKlaimRecord(id, updatedData) {
  if (useTiDB) {
    const localPool = getPool();
    const connection = await localPool.getConnection();
    try {
      await connection.beginTransaction();
      
      await connection.query(
        `UPDATE list_klaim SET 
         no_rm = ?, klaim = ?, biling = ?, kelas = ?, plus_minus = ?, 
         krs = ?, tgl_mengerjakan = ?, catatan = ?, los = ? 
         WHERE id = ?`,
        [
          updatedData.no_rm, updatedData.klaim, updatedData.biling, 
          updatedData.kelas, updatedData.plus_minus, updatedData.krs, 
          updatedData.tgl_mengerjakan, updatedData.catatan, updatedData.los, id
        ]
      );
      
      // Delete old and insert new DX
      await connection.query('DELETE FROM klaim_dx WHERE klaim_id = ?', [id]);
      if (updatedData.dx && updatedData.dx.length > 0) {
        for (const dxVal of updatedData.dx) {
          await connection.query('INSERT INTO klaim_dx (klaim_id, dx) VALUES (?, ?)', [id, dxVal]);
        }
      }
      
      // Delete old and insert new TX
      await connection.query('DELETE FROM klaim_tx WHERE klaim_id = ?', [id]);
      if (updatedData.tx && updatedData.tx.length > 0) {
        for (const txVal of updatedData.tx) {
          await connection.query('INSERT INTO klaim_tx (klaim_id, tx) VALUES (?, ?)', [id, txVal]);
        }
      }
      
      await connection.commit();
      return { id, ...updatedData };
    } catch (err) {
      await connection.rollback();
      console.error('Error updating klaim in TiDB:', err);
      throw err;
    } finally {
      connection.release();
    }
  } else {
    const db = readLocalFile();
    const idx = db.listKlaim.findIndex(r => r.id === id);
    if (idx === -1) return null;
    
    const record = { ...db.listKlaim[idx], ...updatedData };
    db.listKlaim[idx] = record;
    writeLocalFile(db);
    return record;
  }
}

async function deleteKlaimRecord(id) {
  if (useTiDB) {
    const localPool = getPool();
    const connection = await localPool.getConnection();
    try {
      await connection.beginTransaction();
      
      await connection.query('DELETE FROM klaim_dx WHERE klaim_id = ?', [id]);
      await connection.query('DELETE FROM klaim_tx WHERE klaim_id = ?', [id]);
      const [res] = await connection.query('DELETE FROM list_klaim WHERE id = ?', [id]);
      
      await connection.commit();
      return res.affectedRows > 0;
    } catch (err) {
      await connection.rollback();
      console.error('Error deleting klaim from TiDB:', err);
      throw err;
    } finally {
      connection.release();
    }
  } else {
    const db = readLocalFile();
    const len = db.listKlaim.length;
    db.listKlaim = db.listKlaim.filter(r => r.id !== id);
    if (db.listKlaim.length === len) return false;
    writeLocalFile(db);
    return true;
  }
}

// --- Radiologi CRUD operations ---

async function getRadiologiRecords(year, month, tipe) {
  if (useTiDB) {
    const localPool = getPool();
    let query = 'SELECT * FROM radiologi WHERE year = ?';
    const params = [parseInt(year)];
    
    if (tipe) {
      query += ' AND UPPER(tipe) = ?';
      params.push(tipe.toUpperCase());
    }
    if (month) {
      query += ' AND UPPER(month) = ?';
      params.push(month.toUpperCase());
    }
    
    query += ' ORDER BY created_at ASC';
    const [records] = await localPool.query(query, params);
    return records;
  } else {
    const db = readLocalFile();
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
    return results;
  }
}

async function addRadiologiRecord(record) {
  if (useTiDB) {
    const localPool = getPool();
    await localPool.query(
      `INSERT INTO radiologi 
       (id, year, month, tipe, no_rm_nama, tgl_pemeriksaan, tgl_krs, permintaan, diagnosa) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id, record.year, record.month, record.tipe, record.no_rm_nama, 
        record.tgl_pemeriksaan, record.tgl_krs, record.permintaan, record.diagnosa
      ]
    );
    return record;
  } else {
    const db = readLocalFile();
    db.radiologi.push(record);
    writeLocalFile(db);
    return record;
  }
}

async function updateRadiologiRecord(id, updatedData) {
  if (useTiDB) {
    const localPool = getPool();
    await localPool.query(
      `UPDATE radiologi SET 
       no_rm_nama = ?, tgl_pemeriksaan = ?, tgl_krs = ?, permintaan = ?, diagnosa = ? 
       WHERE id = ?`,
      [
        updatedData.no_rm_nama, updatedData.tgl_pemeriksaan, updatedData.tgl_krs, 
        updatedData.permintaan, updatedData.diagnosa, id
      ]
    );
    return { id, ...updatedData };
  } else {
    const db = readLocalFile();
    const idx = db.radiologi.findIndex(r => r.id === id);
    if (idx === -1) return null;
    
    const record = { ...db.radiologi[idx], ...updatedData };
    db.radiologi[idx] = record;
    writeLocalFile(db);
    return record;
  }
}

async function deleteRadiologiRecord(id) {
  if (useTiDB) {
    const localPool = getPool();
    const [res] = await localPool.query('DELETE FROM radiologi WHERE id = ?', [id]);
    return res.affectedRows > 0;
  } else {
    const db = readLocalFile();
    const len = db.radiologi.length;
    db.radiologi = db.radiologi.filter(r => r.id !== id);
    if (db.radiologi.length === len) return false;
    writeLocalFile(db);
    return true;
  }
}

module.exports = {
  initDb,
  getKlaimRecords,
  addKlaimRecord,
  updateKlaimRecord,
  deleteKlaimRecord,
  getRadiologiRecords,
  addRadiologiRecord,
  updateRadiologiRecord,
  deleteRadiologiRecord
};
