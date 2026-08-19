/**
 * Export utilities for Teacher Occupancy
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatCellOccupancy, abbreviateText } from "./abbreviations";

const cleanTime = (t) => String(t || "").replace(/\s+/g, "").trim().toLowerCase();

/**
 * Build teacher occupancy grid for a specific day
 */
function buildTeacherOccupancyGrid(teachers, schedules, timeSlots, dayKey, dayLabel) {
  const dayToColIndex = {
    "Mon": 0,
    "Tue": 1,
    "Wed": 2,
    "Thu": 3,
    "Fri": 4,
    "Sat": 5
  };
  
  const colIndex = dayToColIndex[dayKey];
  const header = ["Teacher", ...timeSlots];
  
  const body = teachers.map((teacher) => {
    const teacherName = teacher.name || teacher.ID || "Unknown";
    const teacherId = String(teacher.unid || '');
    
    const row = [teacherName];
    
    timeSlots.forEach((timeSlot, rowIndex) => {
      const matches = schedules.filter((s) => {
        const teacherIds = s.teacherId ? String(s.teacherId).split(',').map(id => id.trim()).filter(Boolean) : [];
        const teacherMatch = teacherIds.includes(teacherId);
        const timeMatch = cleanTime(s.time) === cleanTime(timeSlot);
        const dayMatch = s.colIndex === colIndex;
        return teacherMatch && timeMatch && dayMatch;
      });
      
      if (matches.length === 0) {
        row.push("—");
      } else {
        row.push(formatCellOccupancy(matches));
      }
    });
    
    return row;
  });
  
  return { header, body, dayLabel };
}

/**
 * Export teacher occupancy to PDF (separate pages for each day)
 */
export function exportTeacherOccupancyToPdf(teachers, schedules, timeSlots, fileName = "teacher-occupancy") {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a2"
  });
  
  const hasSunday = (schedules || []).some(s => String(s.day).trim().toLowerCase() === "sun");
  const days = [
    { key: "Mon", label: "Monday" },
    { key: "Tue", label: "Tuesday" },
    { key: "Wed", label: "Wednesday" },
    { key: "Thu", label: "Thursday" },
    { key: "Fri", label: "Friday" },
    { key: "Sat", label: "Saturday" },
  ];
  if (hasSunday) {
    days.push({ key: "Sun", label: "Sunday" });
  }
  
  days.forEach((day, dayIndex) => {
    if (dayIndex > 0) {
      doc.addPage();
    }
    
    const { header, body, dayLabel } = buildTeacherOccupancyGrid(
      teachers,
      schedules,
      timeSlots,
      day.key,
      day.label
    );
    
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
    doc.text(`TEACHER OCCUPANCY - ${dayLabel.toUpperCase()}`, 297, 24, { align: "center" });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 28, 579, 28);
    
    autoTable(doc, {
      head: [header],
      body: body,
      startY: 32,
      theme: "grid",
      rowPageBreak: 'avoid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        overflow: "linebreak",
        halign: "center",
        valign: "top",
        lineWidth: 0.1,
        lineColor: [226, 232, 240],
        textColor: [15, 23, 42]
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
        fontSize: 8.5,
        cellPadding: 3
      },
      columnStyles: {
        0: {
          fontStyle: "bold",
          halign: "left",
          cellWidth: 35
        }
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index > 0) {
          if (data.cell.raw !== "—") {
            data.cell.styles.fillColor = [220, 252, 231];
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
 * Export teacher occupancy to Excel (separate sheets for each day)
 */
export function exportTeacherOccupancyToExcel(teachers, schedules, timeSlots, fileName = "teacher-occupancy") {
  const workbook = XLSX.utils.book_new();
  
  const hasSunday = (schedules || []).some(s => String(s.day).trim().toLowerCase() === "sun");
  const days = [
    { key: "Mon", label: "Monday" },
    { key: "Tue", label: "Tuesday" },
    { key: "Wed", label: "Wednesday" },
    { key: "Thu", label: "Thursday" },
    { key: "Fri", label: "Friday" },
    { key: "Sat", label: "Saturday" },
  ];
  if (hasSunday) {
    days.push({ key: "Sun", label: "Sunday" });
  }
  
  days.forEach((day) => {
    const { header, body } = buildTeacherOccupancyGrid(
      teachers,
      schedules,
      timeSlots,
      day.key,
      day.label
    );
    
    const data = [header, ...body];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    const columnWidths = [
      { wch: 20 },
      ...timeSlots.map(() => ({ wch: 25 }))
    ];
    worksheet["!cols"] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, day.label);
  });
  
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Export a complete list of staff in one sheet (A4 Portrait), grouped by department.
 */
export function exportStaffListToPdf(teachers, fileName = "staff-list") {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  // Grouping logic based on department field
  const mechanical = [];
  const footwear = [];
  const electrical = [];
  const civil = [];
  const agriculture = [];
  const other = [];

  teachers.forEach(t => {
    const dept = (t.department || "").toLowerCase();
    if (dept.includes("mechan")) {
      mechanical.push(t);
    } else if (dept.includes("foot") || dept.includes("wear")) {
      footwear.push(t);
    } else if (dept.includes("elect")) {
      electrical.push(t);
    } else if (dept.includes("civil")) {
      civil.push(t);
    } else if (dept.includes("agri")) {
      agriculture.push(t);
    } else {
      other.push(t);
    }
  });

  // Sort alphabetically by name
  const sortByName = (a, b) => (a.name || "").localeCompare(b.name || "");
  mechanical.sort(sortByName);
  footwear.sort(sortByName);
  electrical.sort(sortByName);
  civil.sort(sortByName);
  agriculture.sort(sortByName);
  other.sort(sortByName);

  // Balanced column grouping
  const sectionsList = [
    { title: "MECHANICAL ENGINEERING", data: mechanical },
    { title: "ELECTRICAL ENGINEERING", data: electrical },
    { title: "CIVIL ENGINEERING", data: civil },
    { title: "FOOTWEAR TECHNOLOGY", data: footwear },
    { title: "AGRICULTURAL ENGINEERING", data: agriculture },
    { title: "OTHER DEPARTMENTS", data: other }
  ].filter(s => s.data.length > 0);

  const col1 = [];
  const col2 = [];
  let col1Count = 0;
  let col2Count = 0;

  // Distribute sections to balance counts
  sectionsList.forEach(sec => {
    if (col1Count <= col2Count) {
      col1.push(sec);
      col1Count += sec.data.length + 3; // Account for headers and padding
    } else {
      col2.push(sec);
      col2Count += sec.data.length + 3;
    }
  });

  // Header & Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("DAYALBAGH EDUCATIONAL INSTITUTE", 105, 12, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("ENGINEERING FACULTY - STAFF DIRECTORY", 105, 17, { align: "center" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, 20, 195, 20);

  // Column geometry details
  const colWidth = 85;
  const gap = 10;
  const leftMargin = 15;
  const col1Left = leftMargin;
  const col2Left = leftMargin + colWidth + gap;
  const startY = 25;

  const availableHeight = 297 - startY - 15; // 257mm available
  
  // Starting values
  let fontSize = 8.5;
  let cellPadding = 1.8;

  // Height calculation logic for auto-scaling
  const calculateRequiredHeight = (colSections, fSize, padding) => {
    let height = 0;
    colSections.forEach(sec => {
      height += 6; // Section Title row
      height += 5; // Table headers row
      const rowHeight = (fSize * 0.352778) + (padding * 2);
      height += sec.data.length * rowHeight;
      height += 8; // Spacing
    });
    return height;
  };

  // Adjust parameters dynamically to fit in a single page
  while (fontSize > 5.0 && cellPadding > 0.4) {
    const h1 = calculateRequiredHeight(col1, fontSize, cellPadding);
    const h2 = calculateRequiredHeight(col2, fontSize, cellPadding);
    if (Math.max(h1, h2) <= availableHeight) {
      break;
    }
    fontSize -= 0.2;
    cellPadding -= 0.1;
  }

  // Draw Column 1
  let currentY1 = startY;
  col1.forEach(sec => {
    const body = sec.data.map((t, idx) => [
      idx + 1,
      t.name || "—",
      t.ID || "—"
    ]);

    autoTable(doc, {
      head: [[{ content: sec.title, colSpan: 3, styles: { halign: "center", fillColor: [30, 41, 59], textColor: [255, 255, 255] } }], ["S.No.", "Name", "Acronym"]],
      body: body,
      startY: currentY1,
      margin: { left: col1Left },
      tableWidth: colWidth,
      theme: "grid",
      styles: {
        fontSize: fontSize,
        cellPadding: cellPadding,
        valign: "middle",
        lineWidth: 0.1,
        lineColor: [226, 232, 240],
        textColor: [15, 23, 42]
      },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontStyle: "bold"
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 55 },
        2: { cellWidth: 20, halign: "center", fontStyle: "bold" }
      },
      didParseCell: (data) => {
        if (data.row.index === 0 && data.section === "head") {
          data.cell.styles.fontSize = fontSize + 0.5;
          data.cell.styles.fontStyle = "bold";
        }
      }
    });

    currentY1 = doc.lastAutoTable.finalY + 6;
  });

  // Draw Column 2
  let currentY2 = startY;
  col2.forEach(sec => {
    const body = sec.data.map((t, idx) => [
      idx + 1,
      t.name || "—",
      t.ID || "—"
    ]);

    autoTable(doc, {
      head: [[{ content: sec.title, colSpan: 3, styles: { halign: "center", fillColor: [30, 41, 59], textColor: [255, 255, 255] } }], ["S.No.", "Name", "Acronym"]],
      body: body,
      startY: currentY2,
      margin: { left: col2Left },
      tableWidth: colWidth,
      theme: "grid",
      styles: {
        fontSize: fontSize,
        cellPadding: cellPadding,
        valign: "middle",
        lineWidth: 0.1,
        lineColor: [226, 232, 240],
        textColor: [15, 23, 42]
      },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontStyle: "bold"
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 55 },
        2: { cellWidth: 20, halign: "center", fontStyle: "bold" }
      },
      didParseCell: (data) => {
        if (data.row.index === 0 && data.section === "head") {
          data.cell.styles.fontSize = fontSize + 0.5;
          data.cell.styles.fontStyle = "bold";
        }
      }
    });

    currentY2 = doc.lastAutoTable.finalY + 6;
  });

  // Add single page numbering footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Page 1 of 1", 195, 290, { align: "right" });

  doc.save(`${fileName}.pdf`);
}

/**
 * Export a single teacher's weekly schedule as a single page A4 PDF grid
 */
export function exportIndividualTeacherOccupancyToPdf(teacher, schedules, timeSlots, fileName = "teacher-schedule") {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const teacherName = teacher.name || teacher.ID || "Unknown";
  const teacherId = String(teacher.unid || '');

  // Header & Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("DAYALBAGH EDUCATIONAL INSTITUTE", 148, 12, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("ENGINEERING FACULTY", 148, 17, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(`WEEKLY SCHEDULE - ${teacherName.toUpperCase()}`, 148, 24, { align: "center" });

  if (teacher.ID || teacher.department) {
    const details = [];
    if (teacher.ID) details.push(`ID: ${teacher.ID}`);
    if (teacher.department) details.push(`Department: ${teacher.department}`);
    if (teacher.faculty) details.push(`Faculty: ${teacher.faculty}`);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(details.join(" | "), 148, 29, { align: "center" });
  }

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, 32, 282, 32);

  const hasSunday = (schedules || []).some(s => String(s.day).trim().toLowerCase() === "sun");
  const days = [
    { key: "Mon", label: "Monday" },
    { key: "Tue", label: "Tuesday" },
    { key: "Wed", label: "Wednesday" },
    { key: "Thu", label: "Thursday" },
    { key: "Fri", label: "Friday" },
    { key: "Sat", label: "Saturday" },
  ];
  if (hasSunday) {
    days.push({ key: "Sun", label: "Sunday" });
  }

  const headers = ["Time Slot", ...days.map(d => d.label)];

  const body = timeSlots.map((timeSlot, rowIndex) => {
    const row = [timeSlot];

    days.forEach((day) => {
      const dayToColIndex = {
        "Mon": 0,
        "Tue": 1,
        "Wed": 2,
        "Thu": 3,
        "Fri": 4,
        "Sat": 5
      };
      
      const colIndex = dayToColIndex[day.key];
      const matches = schedules.filter((s) => {
        const teacherIds = s.teacherId ? String(s.teacherId).split(',').map(id => id.trim()).filter(Boolean) : [];
        const teacherMatch = teacherIds.includes(teacherId);
        const timeMatch = cleanTime(s.time) === cleanTime(timeSlot);
        const dayMatch = s.colIndex === colIndex;
        return teacherMatch && timeMatch && dayMatch;
      });

      if (matches.length === 0) {
        row.push("—");
      } else {
        row.push(formatCellOccupancy(matches));
      }
    });

    return row;
  });

  autoTable(doc, {
    head: [headers],
    body: body,
    startY: 36,
    theme: "grid",
    rowPageBreak: 'avoid',
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: "linebreak",
      halign: "center",
      valign: "top",
      lineWidth: 0.1,
      lineColor: [226, 232, 240],
      textColor: [15, 23, 42]
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
      cellPadding: 2.5
    },
    columnStyles: {
      0: {
        fontStyle: "bold",
        halign: "left",
        cellWidth: 25
      }
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index > 0) {
        if (data.cell.raw !== "—") {
          data.cell.styles.fillColor = [220, 252, 231];
        } else {
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.textColor = [160, 160, 160];
        }
      }
    },
    margin: { top: 36, bottom: 15, left: 15, right: 15 }
  });

  // Page numbering
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Page 1 of 1", 15, 200);

  doc.save(`${fileName}.pdf`);
}

/**
 * Export a single teacher's weekly schedule to Excel as a single sheet grid
 */
export function exportIndividualTeacherOccupancyToExcel(teacher, schedules, timeSlots, fileName = "teacher-schedule") {
  const teacherName = teacher.name || teacher.ID || "Unknown";
  const teacherId = String(teacher.unid || '');

  const hasSunday = (schedules || []).some(s => String(s.day).trim().toLowerCase() === "sun");
  const days = [
    { key: "Mon", label: "Monday" },
    { key: "Tue", label: "Tuesday" },
    { key: "Wed", label: "Wednesday" },
    { key: "Thu", label: "Thursday" },
    { key: "Fri", label: "Friday" },
    { key: "Sat", label: "Saturday" },
  ];
  if (hasSunday) {
    days.push({ key: "Sun", label: "Sunday" });
  }

  const headers = ["Time Slot", ...days.map(d => d.label)];

  const body = timeSlots.map((timeSlot, rowIndex) => {
    const row = [timeSlot];

    days.forEach((day) => {
      const dayToColIndex = {
        "Mon": 0,
        "Tue": 1,
        "Wed": 2,
        "Thu": 3,
        "Fri": 4,
        "Sat": 5
      };
      
      const colIndex = dayToColIndex[day.key];
      const matches = schedules.filter((s) => {
        const teacherIds = s.teacherId ? String(s.teacherId).split(',').map(id => id.trim()).filter(Boolean) : [];
        const teacherMatch = teacherIds.includes(teacherId);
        const timeMatch = cleanTime(s.time) === cleanTime(timeSlot);
        const dayMatch = s.colIndex === colIndex;
        return teacherMatch && timeMatch && dayMatch;
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
          
          if (occ.course) parts.push(occ.course);
          if (occ.room) parts.push(`Room: ${occ.room}`);
          
          return parts.join(" | ");
        }).join(" \n ");

        row.push(cellContent);
      }
    });

    return row;
  });

  const workbook = XLSX.utils.book_new();
  const data = [headers, ...body];
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  const columnWidths = [
    { wch: 15 },
    ...days.map(() => ({ wch: 25 }))
  ];
  worksheet["!cols"] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly Schedule");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

