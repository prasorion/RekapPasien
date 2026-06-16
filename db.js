const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');
const BACKUP_PATH = path.join(__dirname, 'database.json.bak');
const TEMP_PATH = path.join(__dirname, 'database.json.tmp');

function initDb() {
  if (!fs.existsSync(DB_PATH)) {
    const defaultData = {
      listKlaim: [],
      radiologi: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

function readDb() {
  try {
    initDb();
    const content = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading database file, trying to restore from backup:', err);
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

function writeDb(data) {
  try {
    // 1. Create a backup of current database.json if it exists
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, BACKUP_PATH);
    }
    
    // 2. Write to temp file
    fs.writeFileSync(TEMP_PATH, JSON.stringify(data, null, 2), 'utf8');
    
    // 3. Rename temp file to main database file (atomic operation)
    fs.renameSync(TEMP_PATH, DB_PATH);
    return true;
  } catch (err) {
    console.error('Error writing to database:', err);
    throw err;
  }
}

module.exports = {
  readDb,
  writeDb
};
