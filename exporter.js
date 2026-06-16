const ExcelJS = require('exceljs');

const MONTHS = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
];

const thinBorder = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } }
};

// Helper to format Date string (YYYY-MM-DD) into a Date object or null
function parseExcelDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr; // Fallback to string if invalid
  // ExcelJS needs UTC or local date. Let's return local date.
  return d;
}

async function exportListKlaim(year, records) {
  const workbook = new ExcelJS.Workbook();
  
  // Filter records for this year
  const yearRecords = records.filter(r => r.year === parseInt(year));
  
  // Get months that have data
  const monthsWithData = MONTHS.filter(m => yearRecords.some(r => r.month.toUpperCase() === m));
  
  // If no months have data, create at least the current month or January as placeholder
  if (monthsWithData.length === 0) {
    const currentMonthIndex = new Date().getMonth();
    monthsWithData.push(MONTHS[currentMonthIndex]);
  }
  
  for (const month of monthsWithData) {
    const sheetName = `${month} ${year}`;
    const sheet = workbook.addWorksheet(sheetName);
    
    // Set view grid lines
    sheet.views = [{ showGridLines: true }];
    
    // Setup Column widths
    sheet.columns = [
      { width: 6 },   // A: NO
      { width: 26 },  // B: NO RM / NAMA PASIEN
      { width: 28 },  // C: DX
      { width: 28 },  // D: TX
      { width: 20 },  // E: KLAIM
      { width: 20 },  // F: BILING
      { width: 9 },   // G: KELAS
      { width: 20 },  // H: PLUS / MINUS
      { width: 16 },  // I: KRS
      { width: 20 },  // J: TGL MENGERJAKAN
      { width: 32 },  // K: CATATAN
      { width: 12 }   // L: LOS
    ];
    
    // Title Row (Row 1)
    sheet.mergeCells('A1:L1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `LIST KLAIM ${month} ${year}`;
    titleCell.font = { name: 'Calibri', size: 18, bold: true };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' }
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 40;
    
    // Empty rows (2 & 3)
    sheet.getRow(2).height = 18;
    sheet.getRow(3).height = 18;
    
    // Header Row (Row 4)
    const headerRow = sheet.getRow(4);
    headerRow.height = 30;
    const headers = [
      { text: "NO", fill: "FF356854" },
      { text: "NO RM", fill: "FF356854" },
      { text: "DX", fill: "FF356854" },
      { text: "TX", fill: "FF356854" },
      { text: "KLAIM", fill: "FF356854" },
      { text: "BILING", fill: "FF356854" },
      { text: "KELAS", fill: "FF356854" },
      { text: "PLUS / MINUS", fill: "FF356854" },
      { text: "KRS", fill: "FF274E13", textColor: "FFFFFFFF" },
      { text: "TGL MENGERJAKAN", fill: "FF274E13", textColor: "FFFFFFFF" },
      { text: "CATATAN", fill: "FF274E13", textColor: "FFFFFFFF" },
      { text: "LOS", fill: "FF134F5C", textColor: "FFFFFFFF" }
    ];
    
    headers.forEach((h, idx) => {
      const colIdx = idx + 1;
      const cell = headerRow.getCell(colIdx);
      cell.value = h.text;
      cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: h.textColor || 'FF000000' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: h.fill } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    });
    
    // Data Rows (Row 5 onwards)
    const monthRecords = yearRecords.filter(r => r.month.toUpperCase() === month);
    let currentRowIdx = 5;
    let runningNo = 1;
    
    for (const record of monthRecords) {
      const dxs = Array.isArray(record.dx) && record.dx.length > 0 ? record.dx : [''];
      const txs = Array.isArray(record.tx) && record.tx.length > 0 ? record.tx : [''];
      const maxLines = Math.max(dxs.length, txs.length);
      
      const startRow = currentRowIdx;
      
      for (let i = 0; i < maxLines; i++) {
        const row = sheet.getRow(currentRowIdx);
        row.height = 20;
        
        // Apply thin borders and default font to all cells in the patient row
        for (let c = 1; c <= 12; c++) {
          const cell = row.getCell(c);
          cell.font = { name: 'Calibri', size: 11 };
          cell.border = thinBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        
        // Write DX and TX on every line
        row.getCell(3).value = dxs[i] || ''; // DX
        row.getCell(4).value = txs[i] || ''; // TX
        
        // Write master record details on the first line only
        if (i === 0) {
          row.getCell(1).value = runningNo++; // NO
          row.getCell(2).value = record.no_rm || ''; // NO RM / Nama Pasien
          
          const klaimCell = row.getCell(5);
          klaimCell.value = record.klaim !== undefined ? Number(record.klaim) : null;
          klaimCell.numFmt = '[$Rp-421]#,##0';
          
          const bilingCell = row.getCell(6);
          bilingCell.value = record.biling !== undefined ? Number(record.biling) : null;
          bilingCell.numFmt = '[$Rp-421]#,##0';
          
          row.getCell(7).value = record.kelas !== undefined ? String(record.kelas) : '';
          
          // PLUS / MINUS Column
          const plusMinusCell = row.getCell(8);
          const computedVal = Number(record.klaim || 0) - Number(record.biling || 0);
          // If the user manually provided a value, we can use it, otherwise use the Excel formula
          if (record.plus_minus !== undefined && record.plus_minus !== null && record.plus_minus !== '') {
            plusMinusCell.value = { 
              formula: `E${currentRowIdx}-F${currentRowIdx}`, 
              result: Number(record.plus_minus) 
            };
          } else {
            plusMinusCell.value = { 
              formula: `E${currentRowIdx}-F${currentRowIdx}`, 
              result: computedVal 
            };
          }
          plusMinusCell.numFmt = '[$Rp-421]#,##0';
          plusMinusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          
          // Dates
          const krsCell = row.getCell(9);
          krsCell.value = parseExcelDate(record.krs);
          krsCell.numFmt = 'mm-dd-yyyy';
          
          const tglMengerjakanCell = row.getCell(10);
          tglMengerjakanCell.value = parseExcelDate(record.tgl_mengerjakan);
          tglMengerjakanCell.numFmt = 'mm-dd-yyyy';
          
          row.getCell(11).value = record.catatan || '';
          row.getCell(12).value = record.los || '';
        }
        
        currentRowIdx++;
      }
    }
    
    // Add Total Summation Row at the bottom
    const totalRowIdx = currentRowIdx;
    const totalRow = sheet.getRow(totalRowIdx);
    totalRow.height = 24;
    
    // Apply borders and styling to all cells in total row
    for (let c = 1; c <= 12; c++) {
      const cell = totalRow.getCell(c);
      cell.font = { name: 'Calibri', size: 11, bold: true };
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
    
    // Merge columns A-G (1 to 7) for "TOTAL" label
    sheet.mergeCells(`A${totalRowIdx}:G${totalRowIdx}`);
    const mergeLabelCell = sheet.getCell(`A${totalRowIdx}`);
    mergeLabelCell.value = "TOTAL";
    mergeLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
    
    // Calculate total PLUS/MINUS
    const plusMinusSumCell = totalRow.getCell(8);
    // Find all rows where first-line patients are placed
    let tempRow = 5;
    const formulaRows = [];
    let calculatedTotal = 0;
    for (const record of monthRecords) {
      formulaRows.push(tempRow);
      const val = record.plus_minus !== undefined && record.plus_minus !== null && record.plus_minus !== '' 
        ? Number(record.plus_minus) 
        : (Number(record.klaim || 0) - Number(record.biling || 0));
      calculatedTotal += val;
      
      const dxs = Array.isArray(record.dx) && record.dx.length > 0 ? record.dx : [''];
      const txs = Array.isArray(record.tx) && record.tx.length > 0 ? record.tx : [''];
      tempRow += Math.max(dxs.length, txs.length);
    }
    
    if (formulaRows.length > 0) {
      // Create sum list like H5+H7+H11 or simply sum the whole column which is fine too
      // Excel SUM ignores empty strings, so SUM(H5:H{currentRowIdx-1}) is perfect and handles everything correctly!
      plusMinusSumCell.value = { 
        formula: `SUM(H5:H${totalRowIdx - 1})`,
        result: calculatedTotal
      };
    } else {
      plusMinusSumCell.value = 0;
    }
    plusMinusSumCell.numFmt = '[$Rp-421]#,##0';
  }
  
  return await workbook.xlsx.writeBuffer();
}

async function exportRadiologi(year, records) {
  const workbook = new ExcelJS.Workbook();
  const types = ["ICU", "HCU"];
  
  for (const type of types) {
    const sheetName = `daftar hasil - (${type})`;
    const sheet = workbook.addWorksheet(sheetName);
    
    // Enable gridlines
    sheet.views = [{ showGridLines: true }];
    
    // Column widths
    sheet.columns = [
      { width: 6 },   // A: No
      { width: 32 },  // B: NO RM / NAMA
      { width: 20 },  // C: TGL PEMERIKSAAN
      { width: 20 },  // D: TANGGAL KRS
      { width: 36 },  // E: PERMINTAAN RADIOLOGI
      { width: 36 }   // F: DIAGNOSA / DIAGNO0SA
    ];
    
    // Filter records for this year, this type (ICU/HCU)
    const typeRecords = records.filter(r => r.year === parseInt(year) && r.tipe.toUpperCase() === type);
    
    // Get months with data
    const monthsWithData = MONTHS.filter(m => typeRecords.some(r => r.month.toUpperCase() === m));
    
    // If no data, create at least current month or April as template
    if (monthsWithData.length === 0) {
      monthsWithData.push("APRIL"); // fallback to show structure
    }
    
    let currentRowIdx = 1;
    let isFirstMonth = true;
    
    for (const month of monthsWithData) {
      // Add empty spacing rows if not the first month
      if (!isFirstMonth) {
        for (let s = 0; s < 3; s++) {
          const row = sheet.getRow(currentRowIdx);
          row.height = 18;
          currentRowIdx++;
        }
      }
      
      // Title Row
      // Merged A:F (Cols 1 to 6).
      sheet.mergeCells(`A${currentRowIdx}:F${currentRowIdx}`);
      const titleCell = sheet.getCell(`A${currentRowIdx}`);
      titleCell.value = `BACAAN RADIOLOGI (-) ${type} (BULAN ${month})`;
      titleCell.font = { name: 'Arial', size: 10, bold: true };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' }
      };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.border = thinBorder;
      sheet.getRow(currentRowIdx).height = 24;
      
      currentRowIdx++;
      
      // Header Row
      const headerRow = sheet.getRow(currentRowIdx);
      headerRow.height = 24;
      
      const colHeaders = [
        type === "HCU" ? "NO" : "No",
        "NO RM / NAMA",
        "TGL PEMERIKSAAN",
        "TANGGAL KRS",
        "PERMINTAAN RADIOLOGI",
        type === "ICU" ? "DIAGNO0SA" : "DIAGNOSA"
      ];
      
      colHeaders.forEach((hText, idx) => {
        const colIdx = idx + 1; // Col A is index 1
        const cell = headerRow.getCell(colIdx);
        cell.value = hText;
        cell.font = { name: 'Arial', size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEA9999' } // pink
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });
      
      currentRowIdx++;
      
      // Data Rows
      const monthRecords = typeRecords.filter(r => r.month.toUpperCase() === month);
      
      let runningNo = 1;
      
      // Write database records
      for (const record of monthRecords) {
        const row = sheet.getRow(currentRowIdx);
        row.height = 20;
        
        // Col A (No)
        const noCell = row.getCell(1);
        noCell.value = runningNo++;
        noCell.alignment = { horizontal: 'center', vertical: 'middle' };
        noCell.font = { name: 'Calibri', size: 12 };
        noCell.numFmt = '@';
        noCell.border = thinBorder;
        
        // Col B (NO RM / NAMA)
        const rmCell = row.getCell(2);
        rmCell.value = record.no_rm_nama || '';
        rmCell.alignment = { horizontal: 'center', vertical: 'middle' };
        rmCell.font = { name: 'Calibri', size: 12 };
        rmCell.numFmt = '@';
        rmCell.border = thinBorder;
        
        // Col C (TGL PEMERIKSAAN)
        const tglPemCell = row.getCell(3);
        tglPemCell.value = parseExcelDate(record.tgl_pemeriksaan);
        tglPemCell.alignment = { horizontal: 'center', vertical: 'middle' };
        tglPemCell.font = { name: 'Calibri', size: 12 };
        tglPemCell.numFmt = 'dd-mm-yyyy';
        tglPemCell.border = thinBorder;
        
        // Col D (TANGGAL KRS)
        const tglKrsCell = row.getCell(4);
        tglKrsCell.value = parseExcelDate(record.tgl_krs);
        tglKrsCell.alignment = { horizontal: 'center', vertical: 'middle' };
        tglKrsCell.font = { name: 'Arial', size: 11 };
        tglKrsCell.numFmt = 'dd-mm-yyyy';
        tglKrsCell.border = thinBorder;
        
        // Col E (PERMINTAAN RADIOLOGI)
        const permCell = row.getCell(5);
        permCell.value = record.permintaan || '';
        permCell.alignment = { horizontal: 'center', vertical: 'middle' };
        permCell.font = { name: 'Calibri', size: 12 };
        permCell.border = thinBorder;
        
        // Col F (DIAGNOSA / DIAGNO0SA)
        const diagCell = row.getCell(6);
        diagCell.value = record.diagnosa || '';
        diagCell.alignment = { horizontal: 'center', vertical: 'middle' };
        diagCell.font = { name: 'Calibri', size: 12 };
        diagCell.border = thinBorder;
        
        currentRowIdx++;
      }
      
      isFirstMonth = false;
    }
  }
  
  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  exportListKlaim,
  exportRadiologi
};
