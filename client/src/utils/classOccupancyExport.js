/**
 * Export utilities for Class Occupancy
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

/**
 * Helper function to format class with type
 * Hides "Full Time" but shows "Part Time" and other types
 */
function formatClassWithType(className, type) {
  const classStr = className || "N/A";
  if (!type) return classStr;
  
  const typeStr = String(type).trim().toUpperCase().replace(/\s+/g, ' ');
  
  // Only add type if it's NOT Full Time (check various formats)
  if (typeStr === "FULL TIME" || typeStr === "FULLTIME" || typeStr === "FULL-TIME") {
    return classStr;
  }
  
  return `${classStr} ${type}`;
}

/**
 * Build class occupancy grid with all classes organized by days:
 * - One sheet/document with all classes
 * - Organized by days (Monday, Tuesday, etc.)
 */
function buildAllClassesOccupancyGrid(classes, schedules, timeSlots) {
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

  const header = ["CLASS", "BRANCH", "SEMESTER", "TYPE", ...timeSlots];
  const allRows = [];
  
  days.forEach((day, dayIndex) => {
    const colIndex = dayToColIndex[day.key];
    
    // Add day header row (spans all columns)
    allRows.push({
      isDayHeader: true,
      dayLabel: day.label,
      colSpan: header.length
    });
    
    classes.forEach((classData) => {
      const groups = {};
      schedules.forEach((schedule) => {
        if (schedule.timetableId !== classData.id) return;
        
        const classType = schedule.class || classData.class || "N/A";
        const branch = schedule.branch || classData.branch || "N/A";
        const semester = schedule.semester || classData.semester || "N/A";
        const type = schedule.type || classData.type || "N/A";
        const groupKey = `${classType}|${branch}|${semester}|${type}`;
        
        if (!groups[groupKey]) {
          groups[groupKey] = {
            class: classType,
            branch: branch,
            semester: semester,
            type: type,
            schedules: []
          };
        }
        
        groups[groupKey].schedules.push(schedule);
      });

      const groupedArray = Object.values(groups);
      
      if (groupedArray.length === 0) {
        const row = [classData.class || "N/A", classData.branch || "N/A", classData.semester || "N/A", classData.type || "N/A"];
        timeSlots.forEach(() => row.push("—"));
        allRows.push(row);
      } else {
        groupedArray.forEach((group) => {
          const row = [group.class, group.branch, group.semester, group.type];
          
          timeSlots.forEach((slot, rowIndex) => {
            const matches = group.schedules.filter((s) => {
              return s.rowIndex === rowIndex && s.colIndex === colIndex;
            });
            
            if (matches.length === 0) {
              row.push("—");
            } else {
              const cellContent = matches.map((occ) => {
                const parts = [];
                if (occ.course) parts.push(occ.course);
                if (occ.teacher) parts.push(`(${occ.teacher})`);
                if (occ.room) parts.push(`[${occ.room}]`);
                if (occ.remark) parts.push(`{${occ.remark}}`);
                return parts.join(" ");
              }).join(", ");
              
              row.push(cellContent);
            }
          });
          
          allRows.push(row);
        });
      }
    });
    
    if (dayIndex < days.length - 1) {
      allRows.push({ isSpacingRow: true, colSpan: header.length });
    }
  });
  
  return { header, rows: allRows };
}

/**
 * Build grid data for a single day (Actual PDF split by day)
 */
function buildSingleDayClassOccupancyGrid(day, classes, schedules, timeSlots) {
  const toRoman = (num) => {
    const romanMap = {
      1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
      6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X'
    };
    const match = String(num).match(/(\d+)/);
    const numValue = match ? parseInt(match[1]) : null;
    return romanMap[numValue] || String(num);
  };

  const header = ["CLASS", "BRANCH", "SEMESTER", "TYPE", ...timeSlots];
  const colIndex = { "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5 }[day.key];
  const allRows = [];

  classes.forEach((classData) => {
    const groups = {};
    schedules.forEach((schedule) => {
      if (schedule.timetableId !== classData.id) return;
      
      const classType = schedule.class || classData.class || "N/A";
      const branch = schedule.branch || classData.branch || "N/A";
      const semester = schedule.semester || classData.semester || "N/A";
      const type = schedule.type || classData.type || "N/A";
      const groupKey = `${classType}|${branch}|${semester}|${type}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          class: classType,
          branch: branch,
          semester: semester,
          type: type,
          schedules: []
        };
      }
      
      groups[groupKey].schedules.push(schedule);
    });

    const groupedArray = Object.values(groups);
    
    if (groupedArray.length === 0) {
      const classWithType = formatClassWithType(classData.class, classData.type);
      const row = [classWithType, classData.branch || "N/A", toRoman(classData.semester) || "N/A", classData.type || "N/A"];
      timeSlots.forEach(() => row.push("—"));
      allRows.push(row);
    } else {
      groupedArray.forEach((group) => {
        const classWithType = formatClassWithType(group.class, group.type);
        const row = [classWithType, group.branch, toRoman(group.semester), group.type];
        
        timeSlots.forEach((slot, rowIndex) => {
          const matches = group.schedules.filter((s) => {
            return s.rowIndex === rowIndex && s.colIndex === colIndex;
          });
          
          if (matches.length === 0) {
            row.push("—");
          } else {
            const cellContent = matches.map((occ) => {
              const parts = [];
              if (occ.course) parts.push(occ.course);
              if (occ.teacher) parts.push(`(${occ.teacher})`);
              if (occ.room) parts.push(`[${occ.room}]`);
              if (occ.remark) parts.push(`{${occ.remark}}`);
              return parts.join(" ");
            }).join(", ");
            row.push(cellContent);
          }
        });
        
        allRows.push(row);
      });
    }
  });

  return { header, rows: allRows };
}

/**
 * Export class occupancy to PDF with all classes organized by days (One day per page, centered, equal margins)
 */
export function exportClassOccupancyToPdf(classes, schedules, timeSlots, fileName = "class-occupancy", branchColors = {}) {
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

  const hexToRgb = (hex) => {
    if (!hex || hex === '#FFFFFF') return [255, 255, 255];
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [255, 255, 255];
  };

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
    doc.text(`CLASS OCCUPANCY - ${day.label}`, 297, 24, { align: "center" });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 28, 579, 28);

    const { header, rows } = buildSingleDayClassOccupancyGrid(day, classes, schedules, timeSlots);

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
        2: { cellWidth: 20, halign: "center", fontSize: 5.5 },
        3: { cellWidth: 20, halign: "center", fontSize: 5.5 }
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.row && data.row.raw) {
          const branch = data.row.raw[1];
          const color = branchColors[branch];
          const hasColor = color && color !== '#FFFFFF';

          if (data.column.index >= 0 && data.column.index <= 3) {
            if (hasColor) {
              data.cell.styles.fillColor = hexToRgb(color);
            }
          }
          if (data.column.index > 3) {
            if (data.cell.raw !== "—" && data.cell.raw !== "" && typeof data.cell.raw === 'string') {
              if (hasColor) {
                data.cell.styles.fillColor = hexToRgb(color);
              } else {
                data.cell.styles.fillColor = [220, 252, 231];
              }
              data.cell.styles.fontSize = 5.5;
            } else {
              data.cell.styles.fillColor = [255, 255, 255];
              data.cell.styles.textColor = [160, 160, 160];
            }
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
 * Export class occupancy to Excel with all classes organized by days
 */
export function exportClassOccupancyToExcel(classes, schedules, timeSlots, fileName = "class-occupancy", branchColors = {}) {
  const workbook = XLSX.utils.book_new();

  const hexToExcelRgb = (hex) => {
    if (!hex || hex === '#FFFFFF') return null;
    return hex.replace('#', '');
  };
  
  const { header, rows } = buildAllClassesOccupancyGrid(classes, schedules, timeSlots);
  
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
    { wch: 12 },
    { wch: 12 },
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
      fill: { fgColor: { rgb: "334155" } },
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
          fill: { fgColor: { rgb: "475569" } },
          font: { bold: true, color: { rgb: "FFFFFF" } },
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
      const branchCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 1 })];
      const branch = branchCell ? branchCell.v : null;
      const branchColor = branch ? hexToExcelRgb(branchColors[branch]) : null;
      
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) continue;
        
        const cellValue = worksheet[cellAddress].v;
        
        if (branchColor && (col <= 3 || (cellValue && cellValue !== "—"))) {
          worksheet[cellAddress].s = {
            fill: { fgColor: { rgb: branchColor } },
            alignment: { horizontal: "center", vertical: "center", wrapText: col > 3 }
          };
        } else if (col > 3 && cellValue && cellValue !== "—") {
          worksheet[cellAddress].s = {
            fill: { fgColor: { rgb: "C8E6C9" } },
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
  
  XLSX.utils.book_append_sheet(workbook, worksheet, "Class Occupancy");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Build grid data for mobile format with days as first column and merged cells
 */
function buildMobileClassesOccupancyGrid(classes, schedules, timeSlots) {
  const toRoman = (num) => {
    const romanMap = {
      1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
      6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X'
    };
    const match = String(num).match(/(\d+)/);
    const numValue = match ? parseInt(match[1]) : null;
    return romanMap[numValue] || String(num);
  };

  const header = ["DAY", "CLS", "BR", "SM", ...timeSlots];
  const allRows = [];

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

  days.forEach((day) => {
    const colIndex = dayToColIndex[day.key];
    const dayStartRow = allRows.length;
    
    classes.forEach((classData) => {
      const groups = {};
      schedules.forEach((schedule) => {
        if (schedule.timetableId !== classData.id) return;
        
        const classType = schedule.class || classData.class || "N/A";
        const branch = schedule.branch || classData.branch || "N/A";
        const semester = schedule.semester || classData.semester || "N/A";
        const type = schedule.type || classData.type || "N/A";
        const groupKey = `${classType}|${branch}|${semester}|${type}`;
        
        if (!groups[groupKey]) {
          groups[groupKey] = {
            class: classType,
            branch: branch,
            semester: semester,
            type: type,
            schedules: []
          };
        }
        
        groups[groupKey].schedules.push(schedule);
      });

      const groupedArray = Object.values(groups);
      
      if (groupedArray.length === 0) {
        const classWithType = formatClassWithType(classData.class, classData.type);
        const row = [
          day.fullLabel,
          classWithType, 
          classData.branch || "N/A", 
          toRoman(classData.semester) || "N/A"
        ];
        timeSlots.forEach(() => row.push("—"));
        allRows.push(row);
      } else {
        groupedArray.forEach((group) => {
          const classWithType = formatClassWithType(group.class, group.type);
          const row = [
            day.fullLabel,
            classWithType, 
            group.branch, 
            toRoman(group.semester)
          ];
          
          timeSlots.forEach((slot, rowIndex) => {
            const matches = group.schedules.filter((s) => {
              return s.rowIndex === rowIndex && s.colIndex === colIndex;
            });
            
            if (matches.length === 0) {
              row.push("—");
            } else {
              const cellContent = matches.map((occ) => {
                const parts = [];
                if (occ.course) parts.push(`C: ${occ.course}`);
                if (occ.teacher) parts.push(`T: ${occ.teacher}`);
                if (occ.roomIdOnly) parts.push(`[${occ.roomIdOnly}]`);
                if (occ.batch) parts.push(occ.batch);
                if (occ.remark) parts.push(`{${occ.remark}}`);
                return parts.join(" ");
              }).join(", ");
              
              row.push(cellContent);
            }
          });
          
          allRows.push(row);
        });
      }
    });
    
    const dayEndRow = allRows.length - 1;
    if (dayEndRow >= dayStartRow) {
      allRows[dayEndRow].isDayEnd = true;
      allRows[dayStartRow].dayMerge = {
        startRow: dayStartRow,
        endRow: dayEndRow,
        dayLabel: day.fullLabel
      };
    }
  });

  // Mark branch ends within each day
  for (let i = 0; i < allRows.length; i++) {
    const currentRow = allRows[i];
    const nextRow = allRows[i + 1];
    if (nextRow) {
      const currentDay = currentRow[0];
      const nextDay = nextRow[0];
      const currentBranch = currentRow[2];
      const nextBranch = nextRow[2];
      if (currentDay === nextDay && currentBranch !== nextBranch) {
        currentRow.isBranchEnd = true;
      }
    }
  }
  
  return { header, rows: allRows };
}

/**
 * Build mobile single day grid for multi-page layout
 */
function buildMobileSingleDayClassesOccupancyGrid(day, classes, schedules, timeSlots) {
  const toRoman = (num) => {
    const romanMap = {
      1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
      6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X'
    };
    const match = String(num).match(/(\d+)/);
    const numValue = match ? parseInt(match[1]) : null;
    return romanMap[numValue] || String(num);
  };

  const header = ["CLS", "BR", "SM", ...timeSlots];
  const allRows = [];
  const colIndex = { "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5 }[day.key];

  classes.forEach((classData) => {
    const groups = {};
    schedules.forEach((schedule) => {
      if (schedule.timetableId !== classData.id) return;
      
      const classType = schedule.class || classData.class || "N/A";
      const branch = schedule.branch || classData.branch || "N/A";
      const semester = schedule.semester || classData.semester || "N/A";
      const type = schedule.type || classData.type || "N/A";
      const groupKey = `${classType}|${branch}|${semester}|${type}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          class: classType,
          branch: branch,
          semester: semester,
          type: type,
          schedules: []
        };
      }
      
      groups[groupKey].schedules.push(schedule);
    });

    const groupedArray = Object.values(groups);
    
    if (groupedArray.length === 0) {
      const classWithType = formatClassWithType(classData.class, classData.type);
      const row = [classWithType, classData.branch || "N/A", toRoman(classData.semester) || "N/A"];
      timeSlots.forEach(() => row.push("—"));
      allRows.push(row);
    } else {
      groupedArray.forEach((group) => {
        const classWithType = formatClassWithType(group.class, group.type);
        const row = [classWithType, group.branch, toRoman(group.semester)];
        
        timeSlots.forEach((slot, rowIndex) => {
          const matches = group.schedules.filter((s) => {
            return s.rowIndex === rowIndex && s.colIndex === colIndex;
          });
          
          if (matches.length === 0) {
            row.push("—");
          } else {
            const cellContent = matches.map((occ) => {
              const parts = [];
              if (occ.course) parts.push(`C: ${occ.course}`);
              if (occ.teacher) parts.push(`T: ${occ.teacher}`);
              if (occ.roomIdOnly) parts.push(`[${occ.roomIdOnly}]`);
              if (occ.batch) parts.push(occ.batch);
              if (occ.remark) parts.push(`{${occ.remark}}`);
              return parts.join(" ");
            }).join(", ");
            row.push(cellContent);
          }
        });
        allRows.push(row);
      });
    }
  });

  // Mark branch ends
  for (let i = 0; i < allRows.length; i++) {
    const currentRow = allRows[i];
    const nextRow = allRows[i + 1];
    if (nextRow) {
      const currentBranch = currentRow[1];
      const nextBranch = nextRow[1];
      if (currentBranch !== nextBranch) {
        currentRow.isBranchEnd = true;
      }
    }
  }

  return { header, rows: allRows };
}

/**
 * Export class occupancy to PDF in mobile-friendly format (Portrait A4 single sheet or Landscape A4 multi-page)
 */
export function exportClassOccupancyToPdfMobile(classes, schedules, timeSlots, fileName = "class-occupancy-mobile", branchColors = {}, layout = "multi") {
  const hexToRgb = (hex) => {
    if (!hex || hex === '#FFFFFF') return [255, 255, 255];
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [255, 255, 255];
  };

  const days = [
    { key: "Mon", label: "MON", fullLabel: "MONDAY" },
    { key: "Tue", label: "TUE", fullLabel: "TUESDAY" },
    { key: "Wed", label: "WED", fullLabel: "WEDNESDAY" },
    { key: "Thu", label: "THU", fullLabel: "THURSDAY" },
    { key: "Fri", label: "FRI", fullLabel: "FRIDAY" },
    { key: "Sat", label: "SAT", fullLabel: "SATURDAY" },
  ];

  if (layout === "single") {
    const { header, rows } = buildMobileClassesOccupancyGrid(classes, schedules, timeSlots);

    const branchColorsRgb = {};
    rows.forEach(row => {
      const branch = row[2];
      if (branch && branchColors[branch]) {
        branchColorsRgb[branch] = hexToRgb(branchColors[branch]);
      }
    });

    const tableBody = [];
    const processedDayGroups = new Set();

    rows.forEach((row, rowIdx) => {
      const rowData = [];
      const dayValue = row[0];
      if (row.dayMerge && !processedDayGroups.has(dayValue)) {
        processedDayGroups.add(dayValue);

        // Add a time subheader row for this day section if it's not the very first day (or for every day section)
        if (processedDayGroups.size > 1) {
          const subHeaderRow = ["", "CLS", "BR", "SM", ...timeSlots];
          subHeaderRow.isDaySubHeader = true;
          tableBody.push(subHeaderRow);
        }

        const extraSubHeaderCount = processedDayGroups.size > 1 ? 1 : 0;
        rowData.push({
          content: row.dayMerge.dayLabel.split('').join('\n'),
          rowSpan: (row.dayMerge.endRow - row.dayMerge.startRow + 1) + extraSubHeaderCount,
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
      rowData.branchColor = branchColorsRgb[row[2]] || [255, 255, 255];
      rowData.branch = row[2];
      rowData.isDayEnd = row.isDayEnd;
      rowData.isBranchEnd = row.isBranchEnd;
      tableBody.push(rowData);

      // Add a spacer row between days
      if (row.isDayEnd && rowIdx < rows.length - 1) {
        const spacer = [];
        spacer.push(""); // DAY column empty
        for (let i = 1; i < row.length; i++) {
          spacer.push("");
        }
        spacer.isSpacer = true;
        tableBody.push(spacer);
      }
    });

    const pageWidth = 210;
    const margins = 12;
    const availableWidth = pageWidth - margins;
    const numTimeslots = timeSlots.length;
    const fixedColumnWidths = [8, 22, 12, 8];
    const fixedTotalWidth = fixedColumnWidths.reduce((sum, w) => sum + w, 0);
    const timeslotColumnWidth = (availableWidth - fixedTotalWidth) / numTimeslots;

    const totalRows = tableBody.length;
    const baseRowHeight = 260 / Math.max(1, totalRows);
    let doc = null;

    // Test scaling from 0.4 up to 2.2 to find the LARGEST font & padding that fits on EXACTLY 1 page
    for (let step = 0; step < 35; step++) {
      const scale = 0.4 + (step / 34) * 1.8;
      const testPadding = Math.max(0.01, Math.min(1.2, (baseRowHeight * 0.22) * scale));
      const testFontSize = Math.max(1.2, Math.min(8.0, (baseRowHeight * 1.3) * scale));

      const testDoc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      testDoc.setFont("helvetica", "bold");
      testDoc.setFontSize(11);
      testDoc.text("DAYALBAGH EDUCATIONAL INSTITUTE", 105, 10, { align: "center" });
      
      testDoc.setFont("helvetica", "bold");
      testDoc.setFontSize(8.5);
      testDoc.setTextColor(100, 116, 139);
      testDoc.text("ENGINEERING FACULTY", 105, 13.5, { align: "center" });
      
      testDoc.setFont("helvetica", "bold");
      testDoc.setFontSize(9);
      testDoc.setTextColor(30, 41, 59);
      testDoc.text("CLASS OCCUPANCY - MOBILE VIEW (SINGLE SHEET)", 105, 17.5, { align: "center" });

      testDoc.setDrawColor(226, 232, 240);
      testDoc.setLineWidth(0.3);
      testDoc.line(6, 20, 204, 20);

      const columnStyles = {
        0: { cellWidth: fixedColumnWidths[0], halign: "center", fontSize: testFontSize + 0.5, fontStyle: 'bold' },
        1: { cellWidth: fixedColumnWidths[1], halign: "center", fontSize: testFontSize },
        2: { cellWidth: fixedColumnWidths[2], halign: "center", fontSize: testFontSize },
        3: { cellWidth: fixedColumnWidths[3], halign: "center", fontSize: testFontSize }
      };
      for (let i = 0; i < numTimeslots; i++) {
        columnStyles[4 + i] = {
          cellWidth: timeslotColumnWidth,
          halign: "center",
          fontSize: testFontSize - 0.2
        };
      }

      autoTable(testDoc, {
        head: [header],
        body: tableBody,
        startY: 22,
        theme: "grid",
        rowPageBreak: 'avoid',
        tableWidth: availableWidth,
        styles: {
          fontSize: testFontSize,
          fontStyle: "bold",
          cellPadding: {
            top: testPadding,
            bottom: testPadding,
            left: Math.max(0.2, testPadding * 1.1),
            right: Math.max(0.2, testPadding * 1.1)
          },
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
          fontSize: testFontSize + 0.5,
          cellPadding: Math.max(0.25, testPadding)
        },
        columnStyles: columnStyles,
        didParseCell: (data) => {
          if (data.row.raw.isSpacer) {
            data.cell.styles.lineWidth = 0;
            data.cell.styles.fillColor = [255, 255, 255];
            data.cell.styles.cellPadding = { top: 0.5, bottom: 0.5, left: 0, right: 0 };
            data.cell.styles.fontSize = 1;
            return;
          }
          if (data.row.raw.isDaySubHeader) {
            if (data.column.index >= 1) {
              data.cell.styles.fillColor = [30, 41, 59];
              data.cell.styles.textColor = [255, 255, 255];
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.halign = "center";
            }
            return;
          }
          if (data.section !== "body") return;
          const colIdx = data.column.index;
          const branchColor = data.row.raw.branchColor;
          const hasColor = branchColor && !(branchColor[0] === 255 && branchColor[1] === 255 && branchColor[2] === 255);
          if (colIdx === 0) return;
          if (colIdx >= 1 && colIdx <= 3) {
            if (hasColor) data.cell.styles.fillColor = branchColor;
          } else {
            const cellValue = data.cell.raw;
            const isOccupied = cellValue !== "—" && cellValue !== "" && typeof cellValue === "string";
            if (isOccupied) {
              if (hasColor) data.cell.styles.fillColor = branchColor;
              else data.cell.styles.fillColor = [220, 252, 231];
            } else {
              if (hasColor) {
                data.cell.styles.fillColor = branchColor;
                data.cell.styles.textColor = [50, 50, 50];
              } else {
                data.cell.styles.fillColor = [255, 255, 255];
                data.cell.styles.textColor = [160, 160, 160];
              }
            }
          }
        },
        didDrawCell: (data) => {
          if (data.section !== "body") return;
          if (data.row.raw.isSpacer) {
            const d = data.doc;
            d.setDrawColor(0, 0, 0); // Solid black
            d.setLineWidth(0.4);
            const startX = data.cell.x;
            const startY = data.cell.y + data.cell.height / 2;
            const endX = data.cell.x + data.cell.width;
            const endY = data.cell.y + data.cell.height / 2;
            d.line(startX, startY, endX, endY);
          } else {
            // Draw solid black lines horizontally and vertically
            const d = data.doc;
            d.setDrawColor(0, 0, 0); // Solid black
            d.setLineWidth(0.22); // Solid line width
            const startX = data.cell.x;
            const startY = data.cell.y;
            const width = data.cell.width;
            const height = data.cell.height;

            // Bottom horizontal line
            d.line(startX, startY + height, startX + width, startY + height);

            // Right vertical line
            d.line(startX + width, startY, startX + width, startY + height);

            // Left vertical line for first column
            if (data.column.index === 0) {
              d.line(startX, startY, startX, startY + height);
            }
          }
        },
        margin: { top: 22, bottom: 12, left: 6, right: 6 }
      });

      const numPages = testDoc.internal.getNumberOfPages();
      const finalY = testDoc.lastAutoTable ? testDoc.lastAutoTable.finalY : 0;

      if (numPages === 1 && finalY <= 284) {
        doc = testDoc; // Keep updated with the best 1-page fit
      } else {
        if (doc) break; // Exceeded 1 page, stop and use previous 1-page doc!
      }
    }

    // Ensure document has strictly 1 page
    if (doc) {
      while (doc.internal.getNumberOfPages() > 1) {
        doc.deletePage(doc.internal.getNumberOfPages());
      }
    }

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
      doc.text(`CLASS OCCUPANCY - ${day.fullLabel}`, 148, 19, { align: "center" });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(10, 22, 287, 22);

      const { header, rows } = buildMobileSingleDayClassesOccupancyGrid(day, classes, schedules, timeSlots);

      const branchColorsRgb = {};
      classes.forEach(cls => {
        if (cls.branch && branchColors[cls.branch]) {
          branchColorsRgb[cls.branch] = hexToRgb(branchColors[cls.branch]);
        }
      });

      const tableBody = rows.map(row => {
        const rowData = [...row];
        rowData.branchColor = branchColorsRgb[row[1]] || [255, 255, 255];
        rowData.branch = row[1];
        rowData.isBranchEnd = row.isBranchEnd;
        return rowData;
      });

      const pageWidth = 297;
      const margins = 20; // 10mm left + 10mm right
      const availableWidth = pageWidth - margins;
      const numTimeslots = timeSlots.length;
      
      const fixedColumnWidths = [25, 20, 12];
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
        body: tableBody,
        startY: 25,
        theme: "grid",
        rowPageBreak: 'avoid',
        tableWidth: availableWidth,
        styles: {
          fontSize: 7,
          fontStyle: "bold",
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
          if (data.section !== "body") return;
          const colIdx = data.column.index;
          const branchColor = data.row.raw.branchColor;
          const hasColor = branchColor && !(branchColor[0] === 255 && branchColor[1] === 255 && branchColor[2] === 255);
          
          if (colIdx >= 0 && colIdx <= 2) {
            if (hasColor) data.cell.styles.fillColor = branchColor;
          } else {
            const cellValue = data.cell.raw;
            const isOccupied = cellValue !== "—" && cellValue !== "" && typeof cellValue === "string";
            if (isOccupied) {
              if (hasColor) data.cell.styles.fillColor = branchColor;
              else data.cell.styles.fillColor = [220, 252, 231];
            } else {
              if (hasColor) {
                data.cell.styles.fillColor = branchColor;
                data.cell.styles.textColor = [50, 50, 50]; // Make dark hyphen text on colored background
              } else {
                data.cell.styles.fillColor = [255, 255, 255];
                data.cell.styles.textColor = [160, 160, 160];
              }
            }
          }
        },
        didDrawCell: (data) => {
          if (data.section !== "body") return;
          if (data.row.index < data.table.body.length - 1) {
            const d = data.doc;
            if (data.row.raw.isBranchEnd) {
              d.setDrawColor(100, 116, 139); // slate-400
              d.setLineWidth(0.15);
            } else {
              d.setDrawColor(203, 213, 225); // slate-300
              d.setLineWidth(0.08);
            }
            const startX = data.cell.x;
            const startY = data.cell.y + data.cell.height;
            const endX = data.cell.x + data.cell.width;
            const endY = data.cell.y + data.cell.height;
            d.line(startX, startY, endX, endY);
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
 * Export class occupancy to Excel in mobile-friendly format
 */
export function exportClassOccupancyToExcelMobile(classes, schedules, timeSlots, fileName = "class-occupancy-mobile", branchColors = {}) {
  const workbook = XLSX.utils.book_new();

  const hexToExcelRgb = (hex) => {
    if (!hex || hex === '#FFFFFF') return null;
    return hex.replace('#', '');
  };
  
  const { header, rows } = buildMobileClassesOccupancyGrid(classes, schedules, timeSlots);
  
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
    { wch: 12 },
    { wch: 10 },
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
      fill: { fgColor: { rgb: "FFEB3B" } },
      font: { bold: true, sz: 8 },
      alignment: { horizontal: "center", vertical: "center" }
    };
  }
  
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const branchCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 2 })];
    const branch = branchCell ? branchCell.v : null;
    const branchColor = branch ? hexToExcelRgb(branchColors[branch]) : null;

    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { v: "" };
      }
      
      const cellValue = worksheet[cellAddress].v;
      
      if (col === 0) {
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: "FFF9C4" } },
          font: { bold: true, sz: 8 },
          alignment: { horizontal: "center", vertical: "center", textRotation: 90 }
        };
      } else if (branchColor && (col <= 3 || (col > 3 && cellValue && cellValue !== "—"))) {
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: branchColor } },
          alignment: { horizontal: "center", vertical: "center", wrapText: col > 3 },
          font: { sz: 8 }
        };
      } else if (col > 3 && cellValue && cellValue !== "—") {
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: "C8E6C9" } },
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
  
  XLSX.utils.book_append_sheet(workbook, worksheet, "Class Occupancy");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
