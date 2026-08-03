/**
 * Export utilities for Room Occupancy
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

/**
 * Build room occupancy grid with all rooms organized by days:
 * - One sheet/document with all rooms
 * - Organized by days (Monday, Tuesday, etc.)
 */
function buildAllRoomsOccupancyGrid(rooms, schedules, timeSlots) {
  const days = [
    { key: "Mon", label: "MONDAY" },
    { key: "Tue", label: "TUESDAY" },
    { key: "Wed", label: "WEDNESDAY" },
    { key: "Thu", label: "THURSDAY" },
    { key: "Fri", label: "FRIDAY" },
    { key: "Sat", label: "SATURDAY" },
  ];

  const dayToColIndex = {
    "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5
  };

  const header = ["FACULTY", "ROOM", "CAPACITY", ...timeSlots];
  const allRows = [];
  
  days.forEach((day, dayIndex) => {
    const colIndex = dayToColIndex[day.key];
    
    allRows.push({
      isDayHeader: true,
      dayLabel: day.label,
      colSpan: header.length
    });
    
    rooms.forEach((room) => {
      const roomId = String(room.unid || '');
      const row = [
        room.faculty || "N/A",
        room.name || room.ID || "N/A",
        room.capacity || "N/A"
      ];
      
      timeSlots.forEach((slot, rowIndex) => {
        const matches = schedules.filter((s) => {
          const roomMatch = s.roomId && String(s.roomId) === roomId;
          const timeMatch = s.rowIndex === rowIndex;
          const dayMatch = s.colIndex === colIndex;
          return roomMatch && timeMatch && dayMatch;
        });
        
        if (matches.length === 0) {
          row.push("—");
        } else {
          const cellContent = matches.map((occ) => {
            const parts = [];
            const classNameParts = [];
            if (occ.class) classNameParts.push(occ.class);
            if (occ.branch) classNameParts.push(occ.branch);
            if (occ.semester) classNameParts.push(occ.semester);
            if (occ.type) classNameParts.push(occ.type);
            
            if (classNameParts.length > 0) {
              let classInfo = classNameParts.join(" ");
              if (occ.batch) classInfo += ` (${occ.batch})`;
              parts.push(classInfo);
            }
            
            if (occ.course) parts.push(`${occ.course}`);
            if (occ.teacher) parts.push(`(${occ.teacher})`);
            if (occ.remark) parts.push(`{${occ.remark}}`);
            
            return parts.join(" ");
          }).join(", ");
          
          row.push(cellContent);
        }
      });
      
      allRows.push(row);
    });
    
    if (dayIndex < days.length - 1) {
      allRows.push({ isSpacingRow: true, colSpan: header.length });
    }
  });
  
  return { header, rows: allRows };
}

/**
 * Build room occupancy grid for a single day
 */
function buildSingleDayRoomOccupancyGrid(day, rooms, schedules, timeSlots) {
  const header = ["FACULTY", "ROOM", "CAPACITY", ...timeSlots];
  const colIndex = { "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5 }[day.key];
  const allRows = [];

  rooms.forEach((room) => {
    const roomId = String(room.unid || '');
    const row = [
      room.faculty || "N/A",
      room.name || room.ID || "N/A",
      room.capacity || "N/A"
    ];
    
    timeSlots.forEach((slot, rowIndex) => {
      const matches = schedules.filter((s) => {
        const roomMatch = s.roomId && String(s.roomId) === roomId;
        const timeMatch = s.rowIndex === rowIndex;
        const dayMatch = s.colIndex === colIndex;
        return roomMatch && timeMatch && dayMatch;
      });
      
      if (matches.length === 0) {
        row.push("—");
      } else {
        const cellContent = matches.map((occ) => {
          const parts = [];
          const classNameParts = [];
          if (occ.class) classNameParts.push(occ.class);
          if (occ.branch) classNameParts.push(occ.branch);
          if (occ.semester) classNameParts.push(occ.semester);
          if (occ.type) classNameParts.push(occ.type);
          
          if (classNameParts.length > 0) {
            let classInfo = classNameParts.join(" ");
            if (occ.batch) classInfo += ` (${occ.batch})`;
            parts.push(classInfo);
          }
          
          if (occ.course) parts.push(`${occ.course}`);
          if (occ.teacher) parts.push(`(${occ.teacher})`);
          if (occ.remark) parts.push(`{${occ.remark}}`);
          
          return parts.join(" ");
        }).join(", ");
        
        row.push(cellContent);
      }
    });
    
    allRows.push(row);
  });

  return { header, rows: allRows };
}

/**
 * Export room occupancy to PDF with all rooms organized by days (One page per day)
 */
export function exportRoomOccupancyToPdf(rooms, schedules, timeSlots, fileName = "room-occupancy") {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a2"
  });

  const days = [
    { key: "Mon", label: "MONDAY" },
    { key: "Tue", label: "TUESDAY" },
    { key: "Wed", label: "WEDNESDAY" },
    { key: "Thu", label: "THURSDAY" },
    { key: "Fri", label: "FRIDAY" },
    { key: "Sat", label: "SATURDAY" },
  ];

  days.forEach((day, dayIndex) => {
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
    doc.text(`ROOM OCCUPANCY - ${day.label}`, 297, 24, { align: "center" });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 28, 579, 28);

    const { header, rows } = buildSingleDayRoomOccupancyGrid(day, rooms, schedules, timeSlots);

    autoTable(doc, {
      head: [header],
      body: rows,
      startY: 32,
      theme: "grid",
      rowPageBreak: 'avoid',
      styles: {
        fontSize: 5.5,
        cellPadding: 1.5,
        overflow: "linebreak",
        halign: "center",
        valign: "middle",
        lineWidth: 0.1,
        lineColor: [226, 232, 240],
        minCellHeight: 6,
        textColor: [15, 23, 42]
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
        fontSize: 6.5,
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 25, halign: "center", fontSize: 5.5 },
        1: { cellWidth: 25, halign: "center", fontSize: 5.5 },
        2: { cellWidth: 20, halign: "center", fontSize: 5.5 }
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index > 2) {
          if (data.cell.raw !== "—" && data.cell.raw !== "" && typeof data.cell.raw === 'string') {
            data.cell.styles.fillColor = [219, 234, 254];
            data.cell.styles.fontSize = 5.5;
          } else {
            data.cell.styles.fillColor = [255, 255, 255];
            data.cell.styles.textColor = [160, 160, 160];
          }
        }
      },
      margin: { top: 32, bottom: 15, left: 15, right: 15 }
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
 * Export room occupancy to Excel
 */
export function exportRoomOccupancyToExcel(rooms, schedules, timeSlots, fileName = "room-occupancy") {
  const workbook = XLSX.utils.book_new();
  
  const { header, rows } = buildAllRoomsOccupancyGrid(rooms, schedules, timeSlots);
  
  const data = [header];
  const merges = [];
  let currentRow = 1;
  
  rows.forEach((row) => {
    if (row.isDayHeader) {
      data.push([row.dayLabel]);
      merges.push({
        s: { r: currentRow, c: 0 },
        e: { r: currentRow, c: row.colSpan - 1 }
      });
      currentRow++;
    } else if (row.isSpacingRow) {
      data.push([""]);
      currentRow++;
    } else {
      data.push(row);
      currentRow++;
    }
  });
  
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  const columnWidths = [
    { wch: 15 },
    { wch: 15 },
    { wch: 10 },
    ...timeSlots.map(() => ({ wch: 25 }))
  ];
  worksheet["!cols"] = columnWidths;
  
  if (merges.length > 0) {
    worksheet["!merges"] = merges;
  }
  
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellAddress]) continue;
    
    worksheet[cellAddress].s = {
      fill: { fgColor: { rgb: "3B82F6" } },
      font: { bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" }
    };
  }
  
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const cellAddressFirst = XLSX.utils.encode_cell({ r: row, c: 0 });
    const firstCellValue = worksheet[cellAddressFirst] ? worksheet[cellAddressFirst].v : "";
    const isDayHeader = rows[row - 1] && rows[row - 1].isDayHeader;
    
    if (isDayHeader) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) {
          worksheet[cellAddress] = { v: "" };
        }
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: "93C5FD" } },
          font: { bold: true, color: { rgb: "1E3A8A" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
      }
    } else if (firstCellValue === "") {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) {
          worksheet[cellAddress] = { v: "" };
        }
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: "F0F0F0" } }
        };
      }
    } else {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) continue;
        
        const cellValue = worksheet[cellAddress].v;
        
        if (col > 2 && cellValue && cellValue !== "—") {
          worksheet[cellAddress].s = {
            fill: { fgColor: { rgb: "DBEAFE" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true }
          };
        } else {
          worksheet[cellAddress].s = {
            alignment: { horizontal: "center", vertical: "center" }
          };
        }
      }
    }
  }
  
  XLSX.utils.book_append_sheet(workbook, worksheet, "Room Occupancy");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Build mobile room occupancy grid
 */
function buildMobileRoomsOccupancyGrid(rooms, schedules, timeSlots) {
  const days = [
    { key: "Mon", label: "MON", fullLabel: "MONDAY" },
    { key: "Tue", label: "TUE", fullLabel: "TUESDAY" },
    { key: "Wed", label: "WED", fullLabel: "WEDNESDAY" },
    { key: "Thu", label: "THU", fullLabel: "THURSDAY" },
    { key: "Fri", label: "FRI", fullLabel: "FRIDAY" },
    { key: "Sat", label: "SAT", fullLabel: "SATURDAY" },
  ];

  const dayToColIndex = {
    "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5
  };

  const header = ["DAY", "FCT", "ROOM", "CAP", ...timeSlots];
  const allRows = [];

  days.forEach((day) => {
    const colIndex = dayToColIndex[day.key];
    const dayStartRow = allRows.length;
    
    rooms.forEach((room) => {
      const roomId = String(room.unid || '');
      const row = [
        day.fullLabel,
        room.faculty || "N/A",
        room.name || room.ID || "N/A",
        room.capacity || "N/A"
      ];
      
      timeSlots.forEach((slot, rowIndex) => {
        const matches = schedules.filter((s) => {
          const roomMatch = s.roomId && String(s.roomId) === roomId;
          const timeMatch = s.rowIndex === rowIndex;
          const dayMatch = s.colIndex === colIndex;
          return roomMatch && timeMatch && dayMatch;
        });
        
        if (matches.length === 0) {
          row.push("—");
        } else {
          const cellContent = matches.map((occ) => {
            const parts = [];
            const classNameParts = [];
            if (occ.class) classNameParts.push(occ.class);
            if (occ.branch) classNameParts.push(occ.branch);
            if (occ.semester) classNameParts.push(occ.semester);
            
            if (classNameParts.length > 0) {
              let classInfo = classNameParts.join(" ");
              if (occ.batch) classInfo += ` (${occ.batch})`;
              parts.push(classInfo);
            }
            if (occ.course) parts.push(`C: ${occ.course}`);
            if (occ.teacher) parts.push(`T: ${occ.teacher}`);
            if (occ.remark) parts.push(`{${occ.remark}}`);
            return parts.join(" ");
          }).join(", ");
          
          row.push(cellContent);
        }
      });
      
      allRows.push(row);
    });
    
    const dayEndRow = allRows.length - 1;
    if (dayEndRow >= dayStartRow) {
      allRows[dayStartRow].dayMerge = {
        startRow: dayStartRow,
        endRow: dayEndRow,
        dayLabel: day.fullLabel
      };
    }
  });
  
  return { header, rows: allRows };
}

/**
 * Build mobile single day rooms grid for multi-page layout
 */
function buildMobileSingleDayRoomsOccupancyGrid(day, rooms, schedules, timeSlots) {
  const header = ["FCT", "ROOM", "CAP", ...timeSlots];
  const allRows = [];
  const colIndex = { "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5 }[day.key];

  rooms.forEach((room) => {
    const roomId = String(room.unid || '');
    const row = [
      room.faculty || "N/A",
      room.name || room.ID || "N/A",
      room.capacity || "N/A"
    ];

    timeSlots.forEach((slot, rowIndex) => {
      const matches = schedules.filter((s) => {
        const roomMatch = s.roomId && String(s.roomId) === roomId;
        const timeMatch = s.rowIndex === rowIndex;
        const dayMatch = s.colIndex === colIndex;
        return roomMatch && timeMatch && dayMatch;
      });

      if (matches.length === 0) {
        row.push("—");
      } else {
        const cellContent = matches.map((occ) => {
          const parts = [];
          const classNameParts = [];
          if (occ.class) classNameParts.push(occ.class);
          if (occ.branch) classNameParts.push(occ.branch);
          if (occ.semester) classNameParts.push(occ.semester);
          
          if (classNameParts.length > 0) {
            let classInfo = classNameParts.join(" ");
            if (occ.batch) classInfo += ` (${occ.batch})`;
            parts.push(classInfo);
          }
          if (occ.course) parts.push(`C: ${occ.course}`);
          if (occ.teacher) parts.push(`T: ${occ.teacher}`);
          if (occ.remark) parts.push(`{${occ.remark}}`);
          return parts.join(" ");
        }).join(", ");
        row.push(cellContent);
      }
    });

    allRows.push(row);
  });

  return { header, rows: allRows };
}

/**
 * Export room occupancy to PDF in mobile-friendly format (Portrait A4 single sheet or Landscape A4 multi-page)
 */
export function exportRoomOccupancyToPdfMobile(rooms, schedules, timeSlots, fileName = "room-occupancy-mobile", layout = "multi") {
  const days = [
    { key: "Mon", label: "MON", fullLabel: "MONDAY" },
    { key: "Tue", label: "TUE", fullLabel: "TUESDAY" },
    { key: "Wed", label: "WED", fullLabel: "WEDNESDAY" },
    { key: "Thu", label: "THU", fullLabel: "THURSDAY" },
    { key: "Fri", label: "FRI", fullLabel: "FRIDAY" },
    { key: "Sat", label: "SAT", fullLabel: "SATURDAY" },
  ];

  if (layout === "single") {
    // Single page A4 portrait view
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("DAYALBAGH EDUCATIONAL INSTITUTE", 105, 10, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("ENGINEERING FACULTY", 105, 14, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("ROOM OCCUPANCY - MOBILE VIEW (SINGLE SHEET)", 105, 19, { align: "center" });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(6, 22, 204, 22);

    const { header, rows } = buildMobileRoomsOccupancyGrid(rooms, schedules, timeSlots);

    const tableBody = [];
    const processedDayGroups = new Set();

    rows.forEach((row) => {
      const rowData = [];
      const dayValue = row[0];
      if (row.dayMerge && !processedDayGroups.has(dayValue)) {
        processedDayGroups.add(dayValue);
        rowData.push({
          content: row.dayMerge.dayLabel.split('').join('\n'),
          rowSpan: row.dayMerge.endRow - row.dayMerge.startRow + 1,
          styles: { 
            halign: 'center',
            valign: 'middle',
            fillColor: [241, 245, 249],
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: 1
          }
        });
      }
      for (let i = 1; i < row.length; i++) {
        rowData.push(row[i]);
      }
      tableBody.push(rowData);
    });

    const availableHeight = 297 - 25 - 12;
    const finalRowHeight = Math.max(1.2, Math.min(2.5, (availableHeight - 6) / tableBody.length));
    const finalFontSize = Math.max(1.8, Math.min(2.5, finalRowHeight * 0.9));

    const pageWidth = 210;
    const margins = 12;
    const availableWidth = pageWidth - margins;
    const numTimeslots = timeSlots.length;
    const fixedColumnWidths = [8, 22, 15, 10];
    const fixedTotalWidth = fixedColumnWidths.reduce((sum, w) => sum + w, 0);
    const timeslotColumnWidth = (availableWidth - fixedTotalWidth) / numTimeslots;

    const columnStyles = {
      0: { cellWidth: fixedColumnWidths[0], halign: "center", fontSize: finalFontSize + 0.5, fontStyle: 'bold' },
      1: { cellWidth: fixedColumnWidths[1], halign: "center", fontSize: finalFontSize },
      2: { cellWidth: fixedColumnWidths[2], halign: "center", fontSize: finalFontSize },
      3: { cellWidth: fixedColumnWidths[3], halign: "center", fontSize: finalFontSize }
    };
    for (let i = 0; i < numTimeslots; i++) {
      columnStyles[4 + i] = {
        cellWidth: timeslotColumnWidth,
        halign: "center",
        fontSize: finalFontSize - 0.2
      };
    }

    autoTable(doc, {
      head: [header],
      body: tableBody,
      startY: 25,
      theme: "grid",
      rowPageBreak: 'avoid',
      tableWidth: availableWidth,
      styles: {
        fontSize: finalFontSize,
        cellPadding: 0.2,
        overflow: "linebreak",
        halign: "center",
        valign: "middle",
        lineWidth: 0.05,
        lineColor: [226, 232, 240],
        textColor: [15, 23, 42]
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
        fontSize: finalFontSize + 0.5,
        cellPadding: 0.5
      },
      columnStyles: columnStyles,
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index > 3) {
          if (data.cell.raw !== "—" && data.cell.raw !== "" && typeof data.cell.raw === 'string') {
            data.cell.styles.fillColor = [219, 234, 254];
          } else {
            data.cell.styles.fillColor = [255, 255, 255];
            data.cell.styles.textColor = [160, 160, 160];
          }
        }
      },
      margin: { top: 25, bottom: 12, left: 6, right: 6 }
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
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    days.forEach((day, dayIndex) => {
      if (dayIndex > 0) {
        doc.addPage();
      }

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
      doc.text(`ROOM OCCUPANCY - ${day.fullLabel}`, 148, 19, { align: "center" });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(10, 22, 287, 22);

      const { header, rows } = buildMobileSingleDayRoomsOccupancyGrid(day, rooms, schedules, timeSlots);

      const pageWidth = 297;
      const margins = 20;
      const availableWidth = pageWidth - margins;
      const numTimeslots = timeSlots.length;
      
      const fixedColumnWidths = [25, 20, 12]; // FCT, ROOM, CAP
      const fixedTotalWidth = fixedColumnWidths.reduce((sum, w) => sum + w, 0);
      const timeslotColumnWidth = (availableWidth - fixedTotalWidth) / numTimeslots;

      const columnStyles = {
        0: { cellWidth: fixedColumnWidths[0], halign: "center", fontSize: 7 },
        1: { cellWidth: fixedColumnWidths[1], halign: "center", fontSize: 7 },
        2: { cellWidth: fixedColumnWidths[2], halign: "center", fontSize: 7 }
      };
      for (let i = 0; i < numTimeslots; i++) {
        columnStyles[3 + i] = {
          cellWidth: timeslotColumnWidth,
          halign: "center",
          fontSize: 6.5
        };
      }

      autoTable(doc, {
        head: [header],
        body: rows,
        startY: 25,
        theme: "grid",
        rowPageBreak: 'avoid',
        tableWidth: availableWidth,
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          overflow: "linebreak",
          halign: "center",
          valign: "middle",
          lineWidth: 0.1,
          lineColor: [226, 232, 240],
          textColor: [15, 23, 42]
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
          fontSize: 7.5,
          cellPadding: 2
        },
        columnStyles: columnStyles,
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index > 2) {
            const cellValue = data.cell.raw;
            const isOccupied = cellValue !== "—" && cellValue !== "" && typeof cellValue === "string";
            if (isOccupied) {
              data.cell.styles.fillColor = [219, 234, 254];
            } else {
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
 * Export room occupancy to Excel in mobile format
 */
export function exportRoomOccupancyToExcelMobile(rooms, schedules, timeSlots, fileName = "room-occupancy-mobile") {
  const workbook = XLSX.utils.book_new();
  
  const { header, rows } = buildMobileRoomsOccupancyGrid(rooms, schedules, timeSlots);
  
  const data = [header];
  const merges = [];
  let currentRow = 1;
  const dayMerges = [];
  
  rows.forEach((row) => {
    if (row.dayMerge) {
      dayMerges.push({
        startRow: currentRow,
        endRow: currentRow + (row.dayMerge.endRow - row.dayMerge.startRow),
        dayLabel: row.dayMerge.dayLabel
      });
    }
    data.push(row);
    currentRow++;
  });
  
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  const columnWidths = [
    { wch: 5 },
    { wch: 10 },
    { wch: 12 },
    { wch: 8 },
    ...timeSlots.map(() => ({ wch: 18 }))
  ];
  worksheet["!cols"] = columnWidths;
  
  dayMerges.forEach((merge) => {
    merges.push({
      s: { r: merge.startRow, c: 0 },
      e: { r: merge.endRow, c: 0 }
    });
  });
  
  if (merges.length > 0) {
    worksheet["!merges"] = merges;
  }
  
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellAddress]) continue;
    
    worksheet[cellAddress].s = {
      fill: { fgColor: { rgb: "3B82F6" } },
      font: { bold: true, sz: 8, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" }
    };
  }
  
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { v: "" };
      }
      
      const cellValue = worksheet[cellAddress].v;
      
      if (col === 0) {
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: "BBDEFB" } },
          font: { bold: true, sz: 8 },
          alignment: { horizontal: "center", vertical: "center", textRotation: 90 }
        };
      } else if (col > 3 && cellValue && cellValue !== "—") {
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: "BBDEFB" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          font: { sz: 8 }
        };
      } else {
        worksheet[cellAddress].s = {
          alignment: { horizontal: "center", vertical: "center" },
          font: { sz: 8 }
        };
      }
    }
  }
  
  XLSX.utils.book_append_sheet(workbook, worksheet, "Room Occupancy");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
