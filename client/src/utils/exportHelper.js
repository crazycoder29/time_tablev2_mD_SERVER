/**
 * Export helper utilities for timetable tables.
 *
 * Export table layout (Excel-style):
 * - Weekdays are COLUMNS
 * - Time periods are ROWS
 *
 * Notes about the current UI data model:
 * - Your stored keys are dataKey(dayIndex, timeIndex, batchIndex)
 *   where dayIndex maps to "days" and timeIndex maps to "timeSlots".
 * - A single (dayIndex,timeIndex) cell may contain multiple batches.
 *   We represent those as "subCells" stacked inside the same export cell.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import * as XLSX from "xlsx";

import { DEFAULT_DAYS, normalize, dataKey } from "./dataHelpers";
import { getBatchCount } from "./timetableHelpers";
import { getExportHeader } from "./exportSettings";

function resolveTables({ tableId, batches, batchData, batchesByTable, batchDataByTable }) {
  if (batchesByTable && batchDataByTable) {
    const firstTableId = tableId ?? Object.keys(batchesByTable)[0] ?? "Table 1";
    return {
      tableId: firstTableId,
      batchesForTable: batchesByTable[firstTableId] ?? {},
      batchDataForTable: batchDataByTable[firstTableId] ?? {},
    };
  }

  const singleTableId = tableId ?? "Table 1";
  return {
    tableId: singleTableId,
    batchesForTable: batches ?? {},
    batchDataForTable: batchData ?? {},
  };
}

function compactLines(lines) {
  return (lines ?? []).map(normalize).filter(Boolean);
}

function buildCellSubText({ entry, batchIndex, totalBatches }) {
  const course = normalize(entry?.course);
  const teacher = normalize(entry?.teacher);
  const room = normalize(entry?.room);
  const batchName = normalize(entry?.batchName);
  const remark = normalize(entry?.remark);

  const label = batchName || (totalBatches > 1 ? `B${batchIndex + 1}` : "");
  const bodyLines = compactLines([course, teacher, room, remark ? `(${remark})` : null]);

  if (!label && bodyLines.length === 0) return "";
  if (!label) return bodyLines.join("\n");
  if (bodyLines.length === 0) return label;

  return [label, ...bodyLines].join("\n");
}

/**
 * Builds an export grid where:
 * - head: ["Time", ...days]
 * - body: rows for each timeSlot, with day cells filled from timetable data.
 *
 * @returns {{ tableId: string, head: string[][], body: string[][] }}
 */
export function buildTimetableExportGrid({
  tableId,
  days,
  timeSlots,
  batches,
  batchData,
  batchesByTable,
  batchDataByTable,
}) {
  // IMPORTANT: UI indexing
  // - rowIndex => time slot index
  // - colIndex => day index
  // Keys are stored as `${rowIndex}-${colIndex}` and `${rowIndex}-${colIndex}-${batchIndex}`
  const normalizedDays = (days?.length ? days : DEFAULT_DAYS).map(normalize);
  const normalizedSlots = (timeSlots ?? []).map(normalize);

  const resolved = resolveTables({ tableId, batches, batchData, batchesByTable, batchDataByTable });

  const head = [["Time", ...normalizedDays]];

  const isSameCell = (r1, r2, c) => {
    const count1 = getBatchCount(resolved.batchesForTable, r1, c);
    const count2 = getBatchCount(resolved.batchesForTable, r2, c);
    if (count1 !== count2) return false;
    let hasData = false;
    for (let i = 0; i < count1; i++) {
       const d1 = resolved.batchDataForTable[dataKey(r1, c, i)] || {};
       const d2 = resolved.batchDataForTable[dataKey(r2, c, i)] || {};
       if (d1.course) hasData = true;
       if (d1.course !== d2.course) return false;
       if (d1.teacher !== d2.teacher) return false;
       if (d1.room !== d2.room) return false;
       if (d1.batchName !== d2.batchName) return false;
       if (d1.remark !== d2.remark) return false;
    }
    return hasData;
  };

  const skipMatrix = {};

  const isRowMerged = (r) => !!resolved.batchDataForTable[`${r}-0-0`]?.isRowMerged;

  const body = normalizedSlots.map((slotLabel, timeIndex) => {
    const row = [slotLabel || ""]; // first column is Time
    const rowMerged = isRowMerged(timeIndex);

    for (let dayIndex = 0; dayIndex < normalizedDays.length; dayIndex += 1) {
      if (rowMerged && dayIndex > 0) {
        continue;
      }
      if (skipMatrix[`${timeIndex}-${dayIndex}`]) {
        continue;
      }

      let span = 1;
      for (let r = timeIndex + 1; r < normalizedSlots.length; r++) {
        if (isSameCell(r, r - 1, dayIndex)) {
          span++;
          skipMatrix[`${r}-${dayIndex}`] = true;
        } else {
          break;
        }
      }

      const count = getBatchCount(resolved.batchesForTable, timeIndex, dayIndex);
      const parts = [];

      for (let batchIndex = 0; batchIndex < count; batchIndex += 1) {
        const key = dataKey(timeIndex, dayIndex, batchIndex);
        const entry = resolved.batchDataForTable?.[key] ?? {};
        const text = buildCellSubText({ entry, batchIndex, totalBatches: count });
        if (text) parts.push(text);
      }

      const cellValue = parts.length <= 1
        ? (span > 1 ? { content: parts[0] ?? "", rowSpan: span } : (parts[0] ?? ""))
        : (() => {
            const maxLines = Math.max(
              ...parts.map((p) => Math.max(1, String(p).split("\n").length))
            );
            const placeholder = Array.from({ length: maxLines }, () => " ").join("\n");
            return { content: placeholder, subCells: parts, rowSpan: span };
          })();

      if (rowMerged) {
        if (cellValue && typeof cellValue === "object") {
          row.push({ ...cellValue, colSpan: normalizedDays.length });
        } else {
          row.push({ content: cellValue, colSpan: normalizedDays.length });
        }
      } else {
        row.push(cellValue);
      }
    }

    return row;
  });

  return { tableId: resolved.tableId, head, body };
}

function buildPdfTitle(meta, tableId) {
  const cls = normalize(meta?.class);
  const br = normalize(meta?.branch);
  const sem = normalize(meta?.semester);
  const type = normalize(meta?.type);

  const parts = compactLines([
    [cls, br, sem, type].filter(Boolean).join(" ")
  ]);

  return parts.join(" - ") || "Timetable";
}

function sanitizeFileBaseName(base) {
  const safe = normalize(base || "timetable")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return safe || "timetable";
}

function saveBlobFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function cellToPlainText(cell) {
  if (!cell) return "";
  if (typeof cell === "string") return cell;
  if (typeof cell === "object") {
    if (Array.isArray(cell.subCells)) {
      // Horizontal representation for non-PDF outputs.
      return cell.subCells.filter(Boolean).join(" | ");
    }
    if (cell.content !== undefined) {
      return cellToPlainText(cell.content);
    }
  }
  return String(cell);
}

function gridToAoa(grid) {
  const headRow = (grid.head?.[0] ?? []).map(cellToPlainText);
  const bodyRows = (grid.body ?? []).map((row) => {
    const flatRow = [];
    row.forEach((cell) => {
      flatRow.push(cellToPlainText(cell));
      const cSpan = (cell && typeof cell === "object") ? (cell.colSpan || 1) : 1;
      for (let i = 1; i < cSpan; i++) {
        flatRow.push("");
      }
    });
    return flatRow;
  });
  return [headRow, ...bodyRows];
}

/**
 * Exports a timetable table to PDF.
 *
 * This uses the export grid format (time rows × weekday columns).
 */
function calculateTimeColWidth(docInstance, grid, fontSize, cellPadding) {
  docInstance.setFont("helvetica", "bold");
  docInstance.setFontSize(fontSize);
  let maxW = docInstance.getTextWidth("Time");
  (grid.body || []).forEach((row) => {
    const text = String(row[0] || "");
    const w = docInstance.getTextWidth(text);
    if (w > maxW) maxW = w;
  });
  // Extra safety margin of 18pt so time strings like "9:00 AM - 1:00 PM" never clip or wrap
  return Math.ceil(maxW + cellPadding * 2 + 18);
}

export function exportTimetableToPdf({
  fileName,
  meta,
  tableId,
  days,
  timeSlots,
  batches,
  batchData,
  batchesByTable,
  batchDataByTable,
}) {
  const grid = buildTimetableExportGrid({
    tableId,
    days,
    timeSlots,
    batches,
    batchData,
    batchesByTable,
    batchDataByTable,
  });

  const title = buildPdfTitle(meta, grid.tableId);

  const marginX = 24;
  const numDays = Math.max(1, grid.head[0].length - 1);
  const numRows = grid.body.length + 1;
  const baseTargetRowHeight = Math.max(14, Math.min(32, 460 / numRows));
  const baseFontSize = Math.min(9.5, Math.max(6.5, baseTargetRowHeight * 0.38));
  const baseCellPadding = Math.min(6.0, Math.max(2.0, (baseTargetRowHeight - baseFontSize * 1.15) / 2));

  let doc = null;

  // Search from largest scale to smallest scale to find the best 1-page fit
  for (let step = 30; step >= 0; step--) {
    const scale = 0.25 + (step / 30) * 0.75;
    const testFontSize = Math.max(5.0, Math.min(9.5, baseFontSize * scale));
    const testCellPadding = Math.max(1.5, Math.min(6.0, baseCellPadding * scale));

    const tempDoc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const timeColW = Math.max(85, calculateTimeColWidth(tempDoc, grid, testFontSize, testCellPadding));
    const availableW = 841.89 - (marginX * 2) - timeColW;
    const dayW = availableW / numDays;

    const columnStylesConfig = {
      0: { cellWidth: timeColW, fontStyle: "bold", fillColor: [248, 250, 252], textColor: [15, 23, 42], halign: "center", valign: "middle" },
    };
    for (let c = 1; c <= numDays; c++) {
      columnStylesConfig[c] = { cellWidth: dayW, halign: "center", valign: "middle" };
    }

    const testDoc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    const exportHeader = getExportHeader();
    const instName = (exportHeader.instituteName || "DAYALBAGH EDUCATIONAL INSTITUTE").toUpperCase();
    const facName = (exportHeader.facultyName || "ENGINEERING FACULTY").toUpperCase();

    testDoc.setFont("helvetica", "bold");
    testDoc.setFontSize(13);
    testDoc.setTextColor(30, 41, 59);
    testDoc.text(instName, 841.89 / 2, 28, { align: "center" });
    
    testDoc.setFont("helvetica", "bold");
    testDoc.setFontSize(9.5);
    testDoc.setTextColor(100, 116, 139);
    testDoc.text(facName, 841.89 / 2, 42, { align: "center" });
    
    testDoc.setFont("helvetica", "bold");
    testDoc.setFontSize(11);
    testDoc.setTextColor(30, 41, 59);
    testDoc.text(title.toUpperCase(), 841.89 / 2, 58, { align: "center" });

    testDoc.setDrawColor(226, 232, 240);
    testDoc.setLineWidth(0.75);
    testDoc.line(marginX, 66, 841.89 - marginX, 66);

    autoTable(testDoc, {
      head: grid.head,
      body: grid.body,
      startY: 74,
      theme: "grid",
      rowPageBreak: 'avoid',
      margin: { top: 74, bottom: 25, left: marginX, right: marginX },
      styles: {
        fontSize: testFontSize,
        cellPadding: testCellPadding,
        overflow: "linebreak",
        halign: "center",
        valign: "middle",
        lineColor: [203, 213, 225],
        lineWidth: 0.5,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        lineColor: [203, 213, 225],
        lineWidth: 0.5,
        fontSize: testFontSize + 0.5,
      },
      columnStyles: columnStylesConfig,
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        if (data.column.index === 0) return;

        const raw = data.cell.raw;
        if (!raw || typeof raw !== "object" || !Array.isArray(raw.subCells)) return;

        const subCells = raw.subCells.filter(Boolean);
        const n = subCells.length;
        if (n === 0) return;

        const pad = 2;
        const fontSize = testFontSize;
        testDoc.setFontSize(fontSize);
        const colSpan = (raw && typeof raw === "object") ? (raw.colSpan || 1) : 1;
        const cellWidth = dayW * colSpan;
        const segMaxW = Math.max(1, cellWidth / n - pad * 2);

        let maxLinesRequired = 0;
        for (let i = 0; i < n; i++) {
          const lines = String(subCells[i]).split("\n");
          let totalLines = 0;
          for (const l of lines) {
            const wrapped = testDoc.splitTextToSize(l, segMaxW);
            totalLines += (wrapped.length > 0 ? wrapped.length : 1);
          }
          if (totalLines > maxLinesRequired) maxLinesRequired = totalLines;
        }

        const placeholderLines = Array.from({ length: maxLinesRequired }, () => " ");
        data.cell.text = placeholderLines;
        data.cell.styles.textColor = [255, 255, 255];
      },
      didDrawCell: (data) => {
        if (data.section !== "body") return;
        if (data.column.index === 0) return;

        const raw = data.cell.raw;
        if (!raw || typeof raw !== "object" || !Array.isArray(raw.subCells)) return;

        const subCells = raw.subCells.filter(Boolean);
        const n = subCells.length;
        if (n === 0) return;

        const { cell } = data;
        const pad = 2;
        const fontSize = testFontSize;
        const lineHeight = fontSize * 1.2;
        const segW = cell.width / n;

        if (n > 1) {
          testDoc.setDrawColor(203, 213, 225);
          testDoc.setLineWidth(0.5);
          for (let i = 1; i < n; i += 1) {
            const x = cell.x + segW * i;
            testDoc.line(x, cell.y, x, cell.y + cell.height);
          }
        }

        testDoc.setTextColor(15, 23, 42);
        testDoc.setFontSize(fontSize);

        for (let i = 0; i < n; i += 1) {
          const segX = cell.x + segW * i;
          const segMaxW = Math.max(1, segW - pad * 2);
          const lines = String(subCells[i])
            .split("\n")
            .flatMap((line) => testDoc.splitTextToSize(line, segMaxW));

          let cursorY = cell.y + pad + fontSize;
          for (const line of lines) {
            if (cursorY > cell.y + cell.height - pad) break;
            testDoc.text(String(line), segX + segW / 2, cursorY, { maxWidth: segMaxW, align: "center" });
            cursorY += lineHeight;
          }
        }
      },
    });

    const numPages = testDoc.internal.getNumberOfPages();
    const finalY = testDoc.lastAutoTable ? testDoc.lastAutoTable.finalY : 0;

    // Check if it fits on a single page (A4 Landscape height is 595.28 pt)
    if (numPages === 1 && finalY <= 570) {
      doc = testDoc;
      break;
    }

    if (step === 0 && !doc) {
      doc = testDoc;
    }
  }

  // Ensure document has strictly 1 page
  if (doc) {
    while (doc.internal.getNumberOfPages() > 1) {
      doc.deletePage(doc.internal.getNumberOfPages());
    }
  }

  // Footer & Watermark
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, marginX, 582);
  }

  const safe = sanitizeFileBaseName(fileName || title);
  doc.save(`${safe}.pdf`);
}

/**
 * Exports multiple tables into a single multi-page PDF.
 */
export function exportTimetablesToPdf({ fileName, meta, tables }) {
  const safe = sanitizeFileBaseName(fileName || meta?.name || "timetable");

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  const marginX = 24;

  (tables ?? []).forEach((t, index) => {
    if (index > 0) doc.addPage();

    const grid = buildTimetableExportGrid(t);
    const tableMeta = t.meta || meta;
    const title = buildPdfTitle(tableMeta, grid.tableId);

    const exportHeader = getExportHeader();
    const instName = (exportHeader.instituteName || "DAYALBAGH EDUCATIONAL INSTITUTE").toUpperCase();
    const facName = (exportHeader.facultyName || "ENGINEERING FACULTY").toUpperCase();

    // Branded Centered Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(instName, 841.89 / 2, 28, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(facName, 841.89 / 2, 42, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(title.toUpperCase(), 841.89 / 2, 58, { align: "center" });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.75);
    doc.line(marginX, 66, 841.89 - marginX, 66);

    const numDays = Math.max(1, grid.head[0].length - 1);
    const numRows = grid.body.length + 1;
    const baseTargetRowHeight = Math.max(14, Math.min(32, 460 / numRows));
    const baseFontSize = Math.min(9.5, Math.max(6.5, baseTargetRowHeight * 0.38));
    const baseCellPadding = Math.min(6.0, Math.max(2.0, (baseTargetRowHeight - baseFontSize * 1.15) / 2));

    let bestFontSize = baseFontSize;
    let bestCellPadding = baseCellPadding;
    let bestTimeColW = 85;
    let bestDayW = (841.89 - marginX * 2 - bestTimeColW) / numDays;

    for (let step = 30; step >= 0; step--) {
      const scale = 0.25 + (step / 30) * 0.75;
      const testFontSize = Math.max(5.0, Math.min(9.5, baseFontSize * scale));
      const testCellPadding = Math.max(1.5, Math.min(6.0, baseCellPadding * scale));

      const tempDoc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const timeColW = Math.max(85, calculateTimeColWidth(tempDoc, grid, testFontSize, testCellPadding));
      const availableW = 841.89 - (marginX * 2) - timeColW;
      const dayW = availableW / numDays;

      const columnStylesConfig = {
        0: { cellWidth: timeColW, fontStyle: "bold", fillColor: [248, 250, 252], textColor: [15, 23, 42], halign: "center", valign: "middle" },
      };
      for (let c = 1; c <= numDays; c++) {
        columnStylesConfig[c] = { cellWidth: dayW, halign: "center", valign: "middle" };
      }

      const testDoc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      autoTable(testDoc, {
        head: grid.head,
        body: grid.body,
        startY: 74,
        theme: "grid",
        rowPageBreak: 'avoid',
        margin: { top: 74, bottom: 25, left: marginX, right: marginX },
        styles: {
          fontSize: testFontSize,
          cellPadding: testCellPadding,
          overflow: "linebreak",
          halign: "center",
          valign: "middle",
          lineColor: [203, 213, 225],
          lineWidth: 0.5,
          textColor: [15, 23, 42],
        },
        headStyles: {
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          lineColor: [203, 213, 225],
          lineWidth: 0.5,
          fontSize: testFontSize + 0.5,
        },
        columnStyles: columnStylesConfig,
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          if (data.column.index === 0) return;

          const raw = data.cell.raw;
          if (!raw || typeof raw !== "object" || !Array.isArray(raw.subCells)) return;

          const subCells = raw.subCells.filter(Boolean);
          const n = subCells.length;
          if (n === 0) return;

          const pad = 2;
          const fontSize = testFontSize;
          testDoc.setFontSize(fontSize);
          const colSpan = (raw && typeof raw === "object") ? (raw.colSpan || 1) : 1;
          const cellWidth = dayW * colSpan;
          const segMaxW = Math.max(1, cellWidth / n - pad * 2);

          let maxLinesRequired = 0;
          for (let i = 0; i < n; i++) {
            const lines = String(subCells[i]).split("\n");
            let totalLines = 0;
            for (const l of lines) {
              const wrapped = testDoc.splitTextToSize(l, segMaxW);
              totalLines += (wrapped.length > 0 ? wrapped.length : 1);
            }
            if (totalLines > maxLinesRequired) maxLinesRequired = totalLines;
          }

          const placeholderLines = Array.from({ length: maxLinesRequired }, () => " ");
          data.cell.text = placeholderLines;
          data.cell.styles.textColor = [255, 255, 255];
        },
      });

      const numPages = testDoc.internal.getNumberOfPages();
      const finalY = testDoc.lastAutoTable ? testDoc.lastAutoTable.finalY : 0;

      if (numPages === 1 && finalY <= 570) {
        bestFontSize = testFontSize;
        bestCellPadding = testCellPadding;
        bestTimeColW = timeColW;
        bestDayW = dayW;
        break;
      }

      if (step === 0) {
        bestFontSize = testFontSize;
        bestCellPadding = testCellPadding;
        bestTimeColW = timeColW;
        bestDayW = dayW;
      }
    }

    const columnStylesConfig = {
      0: { cellWidth: bestTimeColW, fontStyle: "bold", fillColor: [248, 250, 252], textColor: [15, 23, 42], halign: "center", valign: "middle" },
    };
    for (let c = 1; c <= numDays; c++) {
      columnStylesConfig[c] = { cellWidth: bestDayW, halign: "center", valign: "middle" };
    }

    autoTable(doc, {
      head: grid.head,
      body: grid.body,
      startY: 74,
      theme: "grid",
      rowPageBreak: 'avoid',
      margin: { top: 74, bottom: 25, left: marginX, right: marginX },
      styles: {
        fontSize: bestFontSize,
        cellPadding: bestCellPadding,
        overflow: "linebreak",
        halign: "center",
        valign: "middle",
        lineColor: [203, 213, 225],
        lineWidth: 0.5,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        lineColor: [203, 213, 225],
        lineWidth: 0.5,
        fontSize: bestFontSize + 0.5,
      },
      columnStyles: columnStylesConfig,
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        if (data.column.index === 0) return;

        const raw = data.cell.raw;
        if (!raw || typeof raw !== "object" || !Array.isArray(raw.subCells)) return;

        const subCells = raw.subCells.filter(Boolean);
        const n = subCells.length;
        if (n === 0) return;

        const pad = 2;
        const fontSize = bestFontSize;
        doc.setFontSize(fontSize);
        const colSpan = (raw && typeof raw === "object") ? (raw.colSpan || 1) : 1;
        const cellWidth = bestDayW * colSpan;
        const segMaxW = Math.max(1, cellWidth / n - pad * 2);

        let maxLinesRequired = 0;
        for (let i = 0; i < n; i++) {
          const lines = String(subCells[i]).split("\n");
          let totalLines = 0;
          for (const l of lines) {
            const wrapped = doc.splitTextToSize(l, segMaxW);
            totalLines += (wrapped.length > 0 ? wrapped.length : 1);
          }
          if (totalLines > maxLinesRequired) maxLinesRequired = totalLines;
        }

        const placeholderLines = Array.from({ length: maxLinesRequired }, () => " ");
        data.cell.text = placeholderLines;
        data.cell.styles.textColor = [255, 255, 255];
      },
      didDrawCell: (data) => {
        if (data.section !== "body") return;
        if (data.column.index === 0) return;

        const raw = data.cell.raw;
        if (!raw || typeof raw !== "object" || !Array.isArray(raw.subCells)) return;

        const subCells = raw.subCells.filter(Boolean);
        const n = subCells.length;
        if (n === 0) return;

        const { cell } = data;
        const pad = 2;
        const fontSize = bestFontSize;
        const lineHeight = fontSize * 1.2;
        const segW = cell.width / n;

        if (n > 1) {
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.5);
          for (let i = 1; i < n; i += 1) {
            const x = cell.x + segW * i;
            doc.line(x, cell.y, x, cell.y + cell.height);
          }
        }

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(fontSize);

        for (let i = 0; i < n; i += 1) {
          const segX = cell.x + segW * i;
          const segMaxW = Math.max(1, segW - pad * 2);
          const lines = String(subCells[i])
            .split("\n")
            .flatMap((line) => doc.splitTextToSize(line, segMaxW));

          let cursorY = cell.y + pad + fontSize;
          for (const line of lines) {
            if (cursorY > cell.y + cell.height - pad) break;
            doc.text(String(line), segX + segW / 2, cursorY, { maxWidth: segMaxW, align: "center" });
            cursorY += lineHeight;
          }
        }
      },
    });
  });

  // Footer & Watermark
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, marginX, 582);
  }

  doc.save(`${safe}.pdf`);
}

/**
 * Exports one or more timetables to Excel.
 * - Each timetable becomes a separate sheet.
 */
export function exportTimetablesToExcel({ fileName, meta, tables }) {
  const safe = sanitizeFileBaseName(fileName || meta?.name || "timetable");
  const wb = XLSX.utils.book_new();

  (tables ?? []).forEach((t, index) => {
    const grid = buildTimetableExportGrid(t);
    const aoa = gridToAoa(grid);
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Basic wrapping for readability
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        ws[addr].s = ws[addr].s || {};
        ws[addr].s.alignment = { wrapText: true, vertical: "top" };
      }
    }

    // Dynamic Merges from grid spans (including colSpan and rowSpan)
    const merges = [];
    (grid.body ?? []).forEach((row, rIdx) => {
      let colOffset = 0;
      row.forEach((cell) => {
        const cSpan = (cell && typeof cell === "object") ? (cell.colSpan || 1) : 1;
        const rSpan = (cell && typeof cell === "object") ? (cell.rowSpan || 1) : 1;
        if (cSpan > 1 || rSpan > 1) {
          merges.push({
            s: { r: rIdx + 1, c: colOffset },
            e: { r: rIdx + rSpan, c: colOffset + cSpan - 1 }
          });
        }
        colOffset += cSpan;
      });
    });
    if (merges.length > 0) {
      ws["!merges"] = (ws["!merges"] || []).concat(merges);
    }

    const sheetNameBase = normalize(grid.tableId) || `Table ${index + 1}`;
    const sheetName = sheetNameBase.slice(0, 31) || `Table ${index + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, `${safe}.xlsx`);
}

function buildDocHtml({ meta, grids, tables }) {
  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");

  const tableToHtml = (grid, index) => {
    const headRow = grid.head?.[0] ?? [];
    const rows = [headRow, ...(grid.body ?? [])];
    
    // Use table-specific metadata if available
    const tableMeta = tables?.[index]?.meta || meta;
    const tableTitle = buildPdfTitle(tableMeta, "");

    const tr = (cells, isHead) => {
      const tag = isHead ? "th" : "td";
      return (
        "<tr>" +
        cells
          .map((c) => {
            const text = escapeHtml(cellToPlainText(c)).replace(/\n/g, "<br/>");
            const cSpan = (c && typeof c === "object") ? (c.colSpan || 1) : 1;
            const rSpan = (c && typeof c === "object") ? (c.rowSpan || 1) : 1;
            const attrs = [
              cSpan > 1 ? `colspan="${cSpan}"` : "",
              rSpan > 1 ? `rowspan="${rSpan}"` : "",
            ].filter(Boolean).join(" ");
            return `<${tag}${attrs ? " " + attrs : ""}>${text}</${tag}>`;
          })
          .join("") +
        "</tr>"
      );
    };

    return (
      `<h3 style="margin: 16px 0 6px;">${escapeHtml(tableTitle)}</h3>` +
      '<table border="1" cellspacing="0" cellpadding="4" style="border-collapse: collapse; width: 100%; font-size: 10pt;">' +
      "<thead>" +
      tr(rows[0], true) +
      "</thead>" +
      "<tbody>" +
      rows.slice(1).map((r) => tr(r, false)).join("") +
      "</tbody>" +
      "</table>"
    );
  };

  const mainTitle = tables && tables.length > 1 ? "Timetables" : buildPdfTitle(meta, "");

  return (
    "<!doctype html>" +
    "<html><head><meta charset=\"utf-8\"/>" +
    `<title>${escapeHtml(mainTitle)}</title>` +
    "</head><body>" +
    `<h2 style=\"margin: 0 0 8px;\">${escapeHtml(mainTitle)}</h2>` +
    (grids ?? []).map((g, i) => tableToHtml(g, i)).join("") +
    "</body></html>"
  );
}

/**
 * Exports one or more timetables to a DOC file (HTML-based .doc).
 */
export function exportTimetablesToDoc({ fileName, meta, tables }) {
  const safe = sanitizeFileBaseName(fileName || meta?.name || "timetable");
  const grids = (tables ?? []).map((t) => buildTimetableExportGrid(t));
  const html = buildDocHtml({ meta, grids, tables });
  const blob = new Blob([html], { type: "application/msword" });
  saveBlobFile(blob, `${safe}.doc`);
}

/**
 * (Planned) Excel / DOC exports
 *
 * Excel: will use the same buildTimetableExportGrid() output with an
 * XLSX worksheet generation and (optionally) merges for multi-batch cells.
 * DOC: likely HTML->DOCX conversion or a DOCX generator library.
 */
