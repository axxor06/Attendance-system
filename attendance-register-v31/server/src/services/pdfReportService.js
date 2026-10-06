import PDFDocument from 'pdfkit';

const PRIMARY_COLOR = '#4F46E5';
const TEXT_COLOR = '#1F2937';
const MUTED_COLOR = '#6B7280';
const DANGER_COLOR = '#DC2626';

function drawHeader(doc, title, subtitle) {
  doc
    .rect(0, 0, doc.page.width, 90)
    .fill(PRIMARY_COLOR);

  doc
    .fillColor('#FFFFFF')
    .fontSize(20)
    .font('Helvetica-Bold')
    .text(title, 50, 28, { align: 'left' });

  if (subtitle) {
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#E0E7FF')
      .text(subtitle, 50, 56);
  }

  doc.fillColor(TEXT_COLOR).font('Helvetica');
  doc.y = 110;
}

function drawTableHeader(doc, columns, x, y) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF');
  doc.rect(x, y, columns.reduce((sum, c) => sum + c.width, 0), 22).fill(PRIMARY_COLOR);
  doc.fillColor('#FFFFFF');
  let cx = x;
  columns.forEach((col) => {
    doc.text(col.label, cx + 4, y + 6, { width: col.width - 8, align: col.align || 'left' });
    cx += col.width;
  });
  doc.fillColor(TEXT_COLOR).font('Helvetica');
  return y + 22;
}

function drawTableRow(doc, columns, values, x, y, options = {}) {
  let cx = x;
  columns.forEach((col, i) => {
    const isLowPct = options.lowPercentageIndex === i && options.isLow;
    doc
      .fillColor(isLowPct ? DANGER_COLOR : TEXT_COLOR)
      .fontSize(9.5)
      .text(String(values[i]), cx + 4, y + 5, { width: col.width - 8, align: col.align || 'left' });
    cx += col.width;
  });
  doc.fillColor(TEXT_COLOR);
  return y + 20;
}

function ensurePageSpace(doc, y, neededHeight, columns, redrawHeader) {
  if (y + neededHeight > doc.page.height - 60) {
    doc.addPage();
    const newY = redrawHeader ? redrawHeader() : 50;
    return newY;
  }
  return y;
}

/**
 * Generates a subject-wise attendance report PDF for a faculty/HOD view.
 * rows: [{ registerNumber, name, total, present, percentage }]
 * Returns a Buffer.
 */
export function buildSubjectAttendancePdf({ subjectName, subjectCode, className, rows, generatedAt }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawHeader(doc, 'Subject Attendance Report', `${subjectName} (${subjectCode}) - ${className || ''}`);

    doc
      .fontSize(9)
      .fillColor(MUTED_COLOR)
      .text(`Generated: ${(generatedAt || new Date()).toLocaleString()}`, 50, doc.y);
    doc.moveDown(1);

    const columns = [
      { label: 'Reg. No.', width: 90 },
      { label: 'Name', width: 180 },
      { label: 'Attended', width: 80, align: 'center' },
      { label: 'Total', width: 70, align: 'center' },
      { label: 'Percentage', width: 90, align: 'center' },
    ];

    let y = drawTableHeader(doc, columns, 50, doc.y + 5);

    rows.forEach((r, idx) => {
      y = ensurePageSpace(doc, y, 22, columns, () => {
        drawHeader(doc, 'Subject Attendance Report', `${subjectName} (${subjectCode}) - continued`);
        return drawTableHeader(doc, columns, 50, doc.y + 5);
      });
      if (idx % 2 === 0) {
        doc.rect(50, y, columns.reduce((s, c) => s + c.width, 0), 20).fill('#F9FAFB');
        doc.fillColor(TEXT_COLOR);
      }
      y = drawTableRow(
        doc,
        columns,
        [r.registerNumber || '-', r.name, r.present, r.total, `${r.percentage}%`],
        50,
        y,
        { lowPercentageIndex: 4, isLow: r.percentage < 75 }
      );
    });

    doc.end();
  });
}

/**
 * Generates a personal attendance report PDF for a single student.
 */
export function buildStudentAttendancePdf({ studentName, registerNumber, overall, subjectWise, generatedAt }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawHeader(doc, 'Student Attendance Report', `${studentName} (${registerNumber || 'N/A'})`);

    doc
      .fontSize(9)
      .fillColor(MUTED_COLOR)
      .text(`Generated: ${(generatedAt || new Date()).toLocaleString()}`, 50, doc.y);
    doc.moveDown(0.5);

    doc
      .fontSize(12)
      .fillColor(TEXT_COLOR)
      .font('Helvetica-Bold')
      .text(`Overall Attendance: ${overall.present}/${overall.total} (${overall.percentage}%)`, 50, doc.y + 5);
    doc.font('Helvetica');
    doc.moveDown(1);

    const columns = [
      { label: 'Subject Code', width: 100 },
      { label: 'Subject Name', width: 200 },
      { label: 'Attended', width: 80, align: 'center' },
      { label: 'Total', width: 60, align: 'center' },
      { label: 'Percentage', width: 70, align: 'center' },
    ];

    let y = drawTableHeader(doc, columns, 50, doc.y + 5);

    subjectWise.forEach((s, idx) => {
      y = ensurePageSpace(doc, y, 22, columns, () => {
        drawHeader(doc, 'Student Attendance Report', `${studentName} - continued`);
        return drawTableHeader(doc, columns, 50, doc.y + 5);
      });
      if (idx % 2 === 0) {
        doc.rect(50, y, columns.reduce((s2, c) => s2 + c.width, 0), 20).fill('#F9FAFB');
        doc.fillColor(TEXT_COLOR);
      }
      y = drawTableRow(
        doc,
        columns,
        [s.subjectCode, s.subjectName, s.present, s.total, `${s.percentage}%`],
        50,
        y,
        { lowPercentageIndex: 4, isLow: s.percentage < 75 }
      );
    });

    doc.end();
  });
}

/**
 * Generates a class-wide monthly attendance report PDF.
 */
export function buildClassMonthlyPdf({ className, monthLabel, rows, generatedAt }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawHeader(doc, 'Monthly Attendance Report', `${className} - ${monthLabel}`);

    doc
      .fontSize(9)
      .fillColor(MUTED_COLOR)
      .text(`Generated: ${(generatedAt || new Date()).toLocaleString()}`, 50, doc.y);
    doc.moveDown(1);

    const columns = [
      { label: 'Reg. No.', width: 90 },
      { label: 'Name', width: 200 },
      { label: 'Attended', width: 80, align: 'center' },
      { label: 'Total', width: 70, align: 'center' },
      { label: 'Percentage', width: 80, align: 'center' },
    ];

    let y = drawTableHeader(doc, columns, 50, doc.y + 5);

    rows.forEach((r, idx) => {
      y = ensurePageSpace(doc, y, 22, columns, () => {
        drawHeader(doc, 'Monthly Attendance Report', `${className} - continued`);
        return drawTableHeader(doc, columns, 50, doc.y + 5);
      });
      if (idx % 2 === 0) {
        doc.rect(50, y, columns.reduce((s, c) => s + c.width, 0), 20).fill('#F9FAFB');
        doc.fillColor(TEXT_COLOR);
      }
      y = drawTableRow(
        doc,
        columns,
        [r.registerNumber || '-', r.name, r.present, r.total, `${r.percentage}%`],
        50,
        y,
        { lowPercentageIndex: 4, isLow: r.percentage < 75 }
      );
    });

    doc.end();
  });
}
