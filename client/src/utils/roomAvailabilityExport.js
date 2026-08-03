/**
 * Export utilities for Room Availability
 * Supports "actual" (landscape A2, day-section headers, FACULTY merge) and
 * "mobile" (portrait A4, DAY + FACULTY merged columns) formats.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export const DAYS = [
  { key: "mon", label: "Mon", fullLabel: "MONDAY" },
  { key: "tue", label: "Tue", fullLabel: "TUESDAY" },
  { key: "wed", label: "Wed", fullLabel: "WEDNESDAY" },
  { key: "thu", label: "Thu", fullLabel: "THURSDAY" },
  { key: "fri", label: "Fri", fullLabel: "FRIDAY" },
  { key: "sat", label: "Sat", fullLabel: "SATURDAY" },
];

export const isAvailable = (room, dayKey, time) =>
  room?.availability?.day?.[dayKey]?.time?.some((s) => s.time === time) ?? false;

// Sort rooms alphabetically by faculty then ID
const sortByFaculty = (rooms) =>
  [...rooms].sort((a, b) => {
    const fa = (a.faculty || "").toLowerCase();
    const fb = (b.faculty || "").toLowerCase();
    if (fa !== fb) return fa.localeCompare(fb);
    return (a.ID || "").localeCompare(b.ID || "");
  });

/**
 * Build actual grid for Excel
 */
function buildActualGrid(rooms, timeSlots) {
  const sorted = sortByFaculty(rooms);
  const header = ["FACULTY", "ROOM", "CAPACITY", ...timeSlots];
  const allRows = [];

  DAYS.forEach((day, dayIdx) => {
    allRows.push({ isDayHeader: true, dayLabel: day.fullLabel, colSpan: header.length });

    let i = 0;
    while (i < sorted.length) {
      const faculty = sorted[i].faculty || "N/A";
      const group = [];
      while (i < sorted.length && (sorted[i].faculty || "N/A") === faculty) {
        group.push(sorted[i]);
        i++;
      }
      group.forEach((room, gi) => {
        const row = [
          gi === 0
            ? { v: faculty, _facultyFirst: true, _facultyRowSpan: group.length }
            : { v: null, _facultyMerged: true },
          room.ID || room.name || "N/A",
          room.capacity ?? "N/A",
        ];
        timeSlots.forEach((time) => {
          row.push(isAvailable(room, day.key, time) ? "✓" : "—");
        });
        allRows.push(row);
      });
    }

    if (dayIdx < DAYS.length - 1) allRows.push({ isSpacingRow: true });
  });

  return { header, rows: allRows };
}

/**
 * Build actual grid for a single day
 */
function buildActualSingleDayGrid(day, rooms, timeSlots) {
  const sorted = sortByFaculty(rooms);
  const header = ["FACULTY", "ROOM", "CAPACITY", ...timeSlots];
  const allRows = [];

  let i = 0;
  while (i < sorted.length) {
    const faculty = sorted[i].faculty || "N/A";
    const group = [];
    while (i < sorted.length && (sorted[i].faculty || "N/A") === faculty) {
      group.push(sorted[i]);
      i++;
    }
    group.forEach((room, gi) => {
      const row = [
        gi === 0
          ? { v: faculty, _facultyFirst: true, _facultyRowSpan: group.length }
          : { v: null, _facultyMerged: true },
        room.ID || room.name || "N/A",
        room.capacity ?? "N/A",
      ];
      timeSlots.forEach((time) => {
        row.push(isAvailable(room, day.key, time) ? "✓" : "—");
      });
      allRows.push(row);
    });
  }

  return { header, rows: allRows };
}

/**
 * Build mobile grid for all days (Single sheet)
 */
function buildMobileGrid(rooms, timeSlots) {
  const sorted = sortByFaculty(rooms);
  const header = ["DAY", "FACULTY", "ROOM", "CAP", ...timeSlots];
  const allRows = [];

  DAYS.forEach((day) => {
    let dayStart = allRows.length;
    let dayCount = 0;

    let i = 0;
    while (i < sorted.length) {
      const faculty = sorted[i].faculty || "N/A";
      const group = [];
      while (i < sorted.length && (sorted[i].faculty || "N/A") === faculty) {
        group.push(sorted[i]);
        i++;
      }
      let facStart = allRows.length;
      group.forEach((room) => {
        const row = [
          day.fullLabel,
          faculty,
          room.ID || room.name || "N/A",
          room.capacity ?? "N/A",
        ];
        timeSlots.forEach((time) => {
          row.push(isAvailable(room, day.key, time) ? "✓" : "—");
        });
        allRows.push(row);
        dayCount++;
      });
      allRows[facStart]._facultyFirst = true;
      allRows[facStart]._facultyRowSpan = group.length;
    }

    if (dayCount > 0) {
      allRows[dayStart]._dayFirst = true;
      allRows[dayStart]._dayRowSpan = dayCount;
    }
  });

  return { header, rows: allRows };
}

/**
 * Build mobile grid for a single day
 */
function buildMobileSingleDayGrid(day, rooms, timeSlots) {
  const sorted = sortByFaculty(rooms);
  const header = ["FACULTY", "ROOM", "CAP", ...timeSlots];
  const allRows = [];

  let i = 0;
  while (i < sorted.length) {
    const faculty = sorted[i].faculty || "N/A";
    const group = [];
    while (i < sorted.length && (sorted[i].faculty || "N/A") === faculty) {
      group.push(sorted[i]);
      i++;
    }
    let facStart = allRows.length;
    group.forEach((room) => {
      const row = [
        faculty,
        room.ID || room.name || "N/A",
        room.capacity ?? "N/A",
      ];
      timeSlots.forEach((time) => {
        row.push(isAvailable(room, day.key, time) ? "✓" : "—");
      });
      allRows.push(row);
    });
    allRows[facStart]._facultyFirst = true;
    allRows[facStart]._facultyRowSpan = group.length;
  }

  return { header, rows: allRows };
}

/**
 * Export room availability to PDF (Landscape A2, one day per page, centered)
 */
export function exportRoomAvailabilityToPdf(rooms, timeSlots, label = "", fileName = "room-availability") {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a2" });

  DAYS.forEach((day, dayIndex) => {
    if (dayIndex > 0) {
      doc.addPage();
    }

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text("DAYALBAGH EDUCATIONAL INSTITUTE", 297, 12, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("ENGINEERING FACULTY", 297, 17, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(`ROOM AVAILABILITY${label ? ` — ${label}` : ""} - ${day.fullLabel}`, 297, 24, { align: "center" });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 28, 579, 28);

    const { header, rows } = buildActualSingleDayGrid(day, rooms, timeSlots);

    const tableBody = [];
    rows.forEach((row) => {
      tableBody.push(row.map((cell, ci) => {
        if (ci === 0 && cell && typeof cell === "object") {
          if (cell._facultyFirst) {
            return { content: cell.v, rowSpan: cell._facultyRowSpan, styles: { valign: "middle", halign: "center", fontStyle: "bold", fillColor: [248, 250, 252] } };
          }
          if (cell._facultyMerged) {
            return { content: "", styles: { fillColor: [248, 250, 252] } };
          }
        }
        return cell && typeof cell === "object" ? (cell.v ?? "") : cell;
      }));
    });

    autoTable(doc, {
      head: [header],
      body: tableBody,
      startY: 32,
      theme: "grid",
      rowPageBreak: 'avoid',
      styles: { fontSize: 5.5, cellPadding: 1.5, overflow: "linebreak", halign: "center", valign: "middle", lineWidth: 0.1, lineColor: [226, 232, 240], minCellHeight: 6, textColor: [15, 23, 42] },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 25 }, 2: { cellWidth: 20 } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index > 2) {
          if (data.cell.raw === "✓") {
            data.cell.styles.fillColor = [187, 247, 208];
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fontStyle = "bold";
          } else if (data.cell.raw === "—") {
            data.cell.styles.fillColor = [255, 255, 255];
            data.cell.styles.textColor = [160, 160, 160];
          }
        }
      },
      margin: { top: 32, bottom: 15, left: 15, right: 15 },
    });
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, 15, 412);
  }

  doc.save(`${fileName}.pdf`);
}

/**
 * Export room availability to PDF in mobile format
 */
export function exportRoomAvailabilityToPdfMobile(rooms, timeSlots, label = "", fileName = "room-availability-mobile", layout = "multi") {
  if (layout === "single") {
    // Single page A4 portrait view
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const { header, rows } = buildMobileGrid(rooms, timeSlots);

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text("DAYALBAGH EDUCATIONAL INSTITUTE", 105, 10, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("ENGINEERING FACULTY", 105, 14, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`ROOM AVAILABILITY${label ? ` — ${label}` : ""} - MOBILE VIEW (SINGLE SHEET)`, 105, 19, { align: "center" });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(6, 22, 204, 22);

    const tableBody = rows.map((row) => {
      const cells = [];
      if (row._dayFirst) {
        cells.push({ content: row[0].split('').join('\n'), rowSpan: row._dayRowSpan, styles: { halign: "center", valign: "middle", fillColor: [241, 245, 249], fontStyle: "bold", fontSize: 7.5, cellPadding: 1 } });
      }
      if (row._facultyFirst) {
        cells.push({ content: row[1], rowSpan: row._facultyRowSpan, styles: { halign: "center", valign: "middle", fillColor: [248, 250, 252], fontStyle: "bold", fontSize: 7.5, cellPadding: 1 } });
      }
      for (let i = 2; i < row.length; i++) cells.push(row[i] ?? "");
      return cells;
    });

    const pageWidth = 210;
    const margins = 12;
    const available = pageWidth - margins;
    const fixedW = [8, 22, 15, 10];
    const tsW = Math.max(5, (available - fixedW.reduce((a, b) => a + b, 0)) / timeSlots.length);
    const colStyles = {
      0: { cellWidth: fixedW[0], halign: "center", fontSize: 7.5, fontStyle: 'bold' },
      1: { cellWidth: fixedW[1], halign: "center", fontSize: 7.5, fontStyle: 'bold' },
      2: { cellWidth: fixedW[2], halign: "center", fontSize: 7.5 },
      3: { cellWidth: fixedW[3], halign: "center", fontSize: 7.5 },
    };
    timeSlots.forEach((_, i) => { colStyles[4 + i] = { cellWidth: tsW, fontSize: 7 }; });

    autoTable(doc, {
      head: [header],
      body: tableBody,
      startY: 25,
      theme: "grid",
      rowPageBreak: 'avoid',
      tableWidth: available,
      styles: { fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak", halign: "center", valign: "middle", lineWidth: 0.1, lineColor: [226, 232, 240], textColor: [15, 23, 42] },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, cellPadding: 2 },
      columnStyles: colStyles,
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index > 3) {
          if (data.cell.raw === "✓") {
            data.cell.styles.fillColor = [187, 247, 208];
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fontStyle = "bold";
          } else if (data.cell.raw === "—") {
            data.cell.styles.fillColor = [255, 255, 255];
            data.cell.styles.textColor = [160, 160, 160];
          }
        }
      },
      showHead: "everyPage",
      margin: { top: 25, bottom: 12, left: 6, right: 6 },
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${totalPages}`, 6, 289);
    }
    doc.save(`${fileName}.pdf`);
  } else {
    // Multi-page A4 Landscape: 1 day per page
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    DAYS.forEach((day, dayIndex) => {
      if (dayIndex > 0) doc.addPage();

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("DAYALBAGH EDUCATIONAL INSTITUTE", 148, 10, { align: "center" });
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("ENGINEERING FACULTY", 148, 14, { align: "center" });
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(`ROOM AVAILABILITY${label ? ` — ${label}` : ""} - ${day.fullLabel}`, 148, 19, { align: "center" });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(10, 22, 287, 22);

      const { header, rows } = buildMobileSingleDayGrid(day, rooms, timeSlots);

      const tableBody = rows.map((row) => {
        const cells = [];
        if (row._facultyFirst) {
          cells.push({ content: row[0], rowSpan: row._facultyRowSpan, styles: { halign: "center", valign: "middle", fillColor: [248, 250, 252], fontStyle: "bold", fontSize: 7.5, cellPadding: 1.5 } });
        }
        for (let i = 1; i < row.length; i++) {
          cells.push(row[i] ?? "");
        }
        return cells;
      });

      const pageWidth = 297;
      const margins = 20;
      const available = pageWidth - margins;
      const fixedW = [25, 20, 12];
      const tsW = (available - fixedW.reduce((a, b) => a + b, 0)) / timeSlots.length;

      const colStyles = {
        0: { cellWidth: fixedW[0], halign: "center", fontSize: 7.5, fontStyle: 'bold' },
        1: { cellWidth: fixedW[1], halign: "center", fontSize: 7.5 },
        2: { cellWidth: fixedW[2], halign: "center", fontSize: 7.5 }
      };
      timeSlots.forEach((_, i) => { colStyles[3 + i] = { cellWidth: tsW, fontSize: 7 }; });

      autoTable(doc, {
        head: [header],
        body: tableBody,
        startY: 25,
        theme: "grid",
        rowPageBreak: 'avoid',
        tableWidth: available,
        styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak", halign: "center", valign: "middle", lineWidth: 0.1, lineColor: [226, 232, 240], textColor: [15, 23, 42] },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, cellPadding: 2 },
        columnStyles: colStyles,
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index > 2) {
            if (data.cell.raw === "✓") {
              data.cell.styles.fillColor = [187, 247, 208];
              data.cell.styles.textColor = [21, 128, 61];
              data.cell.styles.fontStyle = "bold";
            } else if (data.cell.raw === "—") {
              data.cell.styles.fillColor = [255, 255, 255];
              data.cell.styles.textColor = [160, 160, 160];
            }
          }
        },
        margin: { top: 25, bottom: 15, left: 10, right: 10 }
      });
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${totalPages}`, 10, 202);
    }

    doc.save(`${fileName}.pdf`);
  }
}

/**
 * Export room availability to Excel
 */
export function exportRoomAvailabilityToExcel(rooms, timeSlots, label = "", fileName = "room-availability") {
  const workbook = XLSX.utils.book_new();
  const { header, rows } = buildActualGrid(rooms, timeSlots);

  const data = [header];
  const merges = [];
  let r = 1;

  rows.forEach((row) => {
    if (row.isDayHeader) {
      data.push([row.dayLabel]);
      merges.push({ s: { r, c: 0 }, e: { r, c: row.colSpan - 1 } });
      r++;
    } else if (row.isSpacingRow) {
      data.push([""]);
      r++;
    } else {
      const excelRow = row.map((cell) =>
        cell && typeof cell === "object" ? (cell.v ?? "") : (cell ?? "")
      );
      const fac = row[0];
      if (fac && typeof fac === "object" && fac._facultyFirst && fac._facultyRowSpan > 1) {
        merges.push({ s: { r, c: 0 }, e: { r: r + fac._facultyRowSpan - 1, c: 0 } });
      }
      data.push(excelRow);
      r++;
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 10 }, ...timeSlots.map(() => ({ wch: 14 }))];
  if (merges.length) ws["!merges"] = merges;

  const range = XLSX.utils.decode_range(ws["!ref"]);

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = { fill: { fgColor: { rgb: "22C55E" } }, font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" } };
  }

  for (let row = 1; row <= range.e.r; row++) {
    const firstAddr = XLSX.utils.encode_cell({ r: row, c: 0 });
    if (!ws[firstAddr]) { ws[firstAddr] = { v: "" }; }
    const isDayHdr = typeof ws[firstAddr].v === "string" && DAYS.some((d) => d.fullLabel === ws[firstAddr].v);

    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: row, c });
      if (!ws[addr]) ws[addr] = { v: "" };
      const val = ws[addr].v;
      if (isDayHdr) {
        ws[addr].s = { fill: { fgColor: { rgb: "22C55E" } }, font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" } };
      } else if (c === 0) {
        ws[addr].s = { fill: { fgColor: { rgb: "F0FFF4" } }, font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } };
      } else if (c > 2) {
        ws[addr].s = val === "✓"
          ? { fill: { fgColor: { rgb: "BBF7D0" } }, font: { bold: true, color: { rgb: "15803D" } }, alignment: { horizontal: "center", vertical: "center" } }
          : { alignment: { horizontal: "center", vertical: "center" } };
      } else {
        ws[addr].s = { alignment: { horizontal: "center", vertical: "center" } };
      }
    }
  }

  XLSX.utils.book_append_sheet(workbook, ws, "Room Availability");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Export room availability to Excel in mobile format
 */
export function exportRoomAvailabilityToExcelMobile(rooms, timeSlots, label = "", fileName = "room-availability-mobile") {
  const workbook = XLSX.utils.book_new();
  const { header, rows } = buildMobileGrid(rooms, timeSlots);

  const data = [header];
  const merges = [];
  let r = 1;

  rows.forEach((row) => {
    data.push([...row]);
    if (row._dayFirst && row._dayRowSpan > 1) {
      merges.push({ s: { r, c: 0 }, e: { r: r + row._dayRowSpan - 1, c: 0 } });
    }
    if (row._facultyFirst && row._facultyRowSpan > 1) {
      merges.push({ s: { r, c: 1 }, e: { r: r + row._facultyRowSpan - 1, c: 1 } });
    }
    r++;
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, ...timeSlots.map(() => ({ wch: 13 }))];
  if (merges.length) ws["!merges"] = merges;

  const range = XLSX.utils.decode_range(ws["!ref"]);

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = { fill: { fgColor: { rgb: "22C55E" } }, font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" } };
  }

  for (let row = 1; row <= range.e.r; row++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: row, c: addr });
      if (!ws[addr]) ws[addr] = { v: "" };
      const val = ws[addr].v;
      if (c === 0) {
        ws[addr].s = { fill: { fgColor: { rgb: "22C55E" } }, font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" } };
      } else if (c === 1) {
        ws[addr].s = { fill: { fgColor: { rgb: "F0FFF4" } }, font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } };
      } else if (c > 3) {
        ws[addr].s = val === "✓"
          ? { fill: { fgColor: { rgb: "BBF7D0" } }, font: { bold: true, color: { rgb: "15803D" } }, alignment: { horizontal: "center", vertical: "center" } }
          : { alignment: { horizontal: "center", vertical: "center" } };
      } else {
        ws[addr].s = { alignment: { horizontal: "center", vertical: "center" } };
      }
    }
  }

  XLSX.utils.book_append_sheet(workbook, ws, "Room Availability");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
