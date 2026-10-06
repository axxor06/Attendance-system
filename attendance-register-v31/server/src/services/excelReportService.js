import ExcelJS from 'exceljs';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  row.height = 22;
}

function autoFitColumns(worksheet, minWidth = 10) {
  worksheet.columns.forEach((column) => {
    let maxLength = minWidth;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLength) maxLength = len;
    });
    column.width = Math.min(maxLength + 2, 40);
  });
}

/**
 * Builds an Excel workbook for a student-wise subject attendance report.
 * rows: [{ name, registerNumber, email, total, present, percentage }]
 */
export async function buildSubjectAttendanceExcel({ subjectName, subjectCode, className, rows, generatedAt }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance Management System';
  workbook.created = generatedAt || new Date();

  const sheet = workbook.addWorksheet('Attendance Report');

  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = `${subjectName} (${subjectCode}) - ${className || ''}`;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:F2');
  sheet.getCell('A2').value = `Generated: ${(generatedAt || new Date()).toLocaleString()}`;
  sheet.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.addRow([]);

  const headerRow = sheet.addRow([
    'Register No.', 'Name', 'Email', 'Classes Attended', 'Total Classes', 'Percentage',
  ]);
  styleHeaderRow(headerRow);

  rows.forEach((r) => {
    const row = sheet.addRow([
      r.registerNumber || '-',
      r.name,
      r.email,
      r.present,
      r.total,
      `${r.percentage}%`,
    ]);
    if (r.percentage < 75) {
      row.getCell(6).font = { color: { argb: 'FFDC2626' }, bold: true };
    }
  });

  autoFitColumns(sheet);
  sheet.views = [{ state: 'frozen', ySplit: 4 }];

  return workbook;
}

/**
 * Builds an Excel workbook for a student's own attendance report
 * (subject-wise breakdown).
 */
export async function buildStudentAttendanceExcel({ studentName, registerNumber, overall, subjectWise, generatedAt }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance Management System';

  const sheet = workbook.addWorksheet('My Attendance');

  sheet.mergeCells('A1:D1');
  sheet.getCell('A1').value = `Attendance Report - ${studentName} (${registerNumber || 'N/A'})`;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:D2');
  sheet.getCell('A2').value = `Overall: ${overall.present}/${overall.total} classes (${overall.percentage}%) | Generated: ${(generatedAt || new Date()).toLocaleString()}`;
  sheet.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.addRow([]);

  const headerRow = sheet.addRow(['Subject Code', 'Subject Name', 'Attended', 'Total', 'Percentage']);
  styleHeaderRow(headerRow);

  subjectWise.forEach((s) => {
    const row = sheet.addRow([s.subjectCode, s.subjectName, s.present, s.total, `${s.percentage}%`]);
    if (s.percentage < 75) {
      row.getCell(5).font = { color: { argb: 'FFDC2626' }, bold: true };
    }
  });

  autoFitColumns(sheet);
  return workbook;
}

/**
 * Builds an Excel workbook for a class-wide monthly attendance report.
 * rows: [{ name, registerNumber, total, present, percentage }]
 */
export async function buildClassMonthlyExcel({ className, monthLabel, rows, generatedAt }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Monthly Report');

  sheet.mergeCells('A1:E1');
  sheet.getCell('A1').value = `${className} - Monthly Attendance (${monthLabel})`;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.addRow([]);
  const headerRow = sheet.addRow(['Register No.', 'Name', 'Attended', 'Total', 'Percentage']);
  styleHeaderRow(headerRow);

  rows.forEach((r) => {
    const row = sheet.addRow([r.registerNumber || '-', r.name, r.present, r.total, `${r.percentage}%`]);
    if (r.percentage < 75) row.getCell(5).font = { color: { argb: 'FFDC2626' }, bold: true };
  });

  autoFitColumns(sheet);
  return workbook;
}
