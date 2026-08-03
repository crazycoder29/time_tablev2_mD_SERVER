import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

/**
 * Export a complete list of courses in two balanced columns, grouped/categorized dynamically by department/branch.
 */
export function exportCourseListToPdf(courses, teachers, fileName = "dei-course-list") {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  // Create a map of teacher unid -> teacher name/ID
  const teacherMap = {};
  teachers.forEach(t => {
    const key = t.unid ? String(t.unid) : "";
    if (key) {
      teacherMap[key] = t.ID || t.name || "Unknown";
    }
  });

  // Dynamic Grouping logic based on department field
  const groups = {};
  courses.forEach(c => {
    const dept = c.department ? String(c.department).trim().toUpperCase() : "OTHER DEPARTMENTS";
    if (!groups[dept]) {
      groups[dept] = [];
    }
    groups[dept].push(c);
  });

  // Sort courses inside each department alphabetically by course code/name
  Object.keys(groups).forEach(dept => {
    groups[dept].sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  });

  // Convert to sorted sections list
  const sectionsList = Object.keys(groups).map(dept => ({
    title: dept,
    data: groups[dept]
  })).sort((a, b) => a.title.localeCompare(b.title));

  const toRoman = (num) => {
    const romanMap = {
      1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
      6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X'
    };
    const match = String(num).match(/(\d+)/);
    const numValue = match ? parseInt(match[1]) : null;
    return romanMap[numValue] || String(num);
  };

  // Header & Title
  const drawPageHeaders = (d) => {
    d.setFont("helvetica", "bold");
    d.setFontSize(14);
    d.setTextColor(30, 41, 59);
    d.text("DAYALBAGH EDUCATIONAL INSTITUTE", 105, 12, { align: "center" });

    d.setFont("helvetica", "bold");
    d.setFontSize(10);
    d.setTextColor(100, 116, 139);
    d.text("ENGINEERING FACULTY - MASTER COURSE DIRECTORY", 105, 17, { align: "center" });

    d.setDrawColor(226, 232, 240);
    d.setLineWidth(0.5);
    d.line(15, 20, 195, 20);
  };

  drawPageHeaders(doc);

  // Column geometry details
  const colWidth = 85;
  const gap = 10;
  const leftMargin = 15;
  const col1Left = leftMargin;
  const col2Left = leftMargin + colWidth + gap;
  const pageBottom = 280; // safe margin

  let currentPage = 1;
  let currentCol = "left"; // "left" or "right"
  let currentY = 34; // Start Y on the page containing the banner
  let isFirstPageOfBranch = true;
  
  const fontSize = 7.5;
  const cellPadding = 1.3;

  const getRowLinesCount = (c) => {
    const codeLines = c.code ? 1 : 0;
    const nameText = c.name || "";
    const nameLines = Math.max(1, Math.ceil(nameText.length / 20));
    const courseLines = codeLines + nameLines;

    const assignedTeachers = Array.isArray(c.teachers)
      ? c.teachers.map(tid => teacherMap[String(tid)] || tid).join(", ")
      : "";
    const teacherLines = Math.max(1, Math.ceil(assignedTeachers.length / 16));

    return Math.max(courseLines, teacherLines);
  };

  const getRowHeight = (c, fSize, padding) => {
    const linesCount = getRowLinesCount(c);
    const textHeight = linesCount * (fSize * 0.352778 * 1.25);
    return textHeight + (padding * 2);
  };

  const advanceColumnWithinBranch = (branchTitle) => {
    if (currentCol === "left") {
      currentCol = "right";
      currentY = isFirstPageOfBranch ? 34 : 27;
    } else {
      doc.addPage();
      currentPage++;
      drawPageHeaders(doc);
      
      // Draw continuation header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`${branchTitle} (Continued)`, 15, 24);
      
      isFirstPageOfBranch = false;
      currentCol = "left";
      currentY = 27;
    }
  };

  sectionsList.forEach((sec, secIdx) => {
    // If it is not the first section, force a page break
    if (secIdx > 0) {
      doc.addPage();
      currentPage++;
      drawPageHeaders(doc);
      isFirstPageOfBranch = true;
      currentCol = "left";
    }

    // Draw the Branch Header Banner (Full Width)
    doc.setFillColor(30, 41, 59);
    doc.rect(15, 22, 180, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(sec.title, 105, 27.5, { align: "center" });

    currentY = 34; // Reset startY on first page of new branch
    let remainingCourses = [...sec.data];

    while (remainingCourses.length > 0) {
      const xOffset = currentCol === "left" ? col1Left : col2Left;
      const tableHeaderHeight = 6;
      const firstRowHeight = getRowHeight(remainingCourses[0], fontSize, cellPadding);

      // If remaining height cannot fit header + at least 1 course row
      if (currentY + tableHeaderHeight + firstRowHeight > pageBottom) {
        advanceColumnWithinBranch(sec.title);
        continue;
      }

      const availableSpace = pageBottom - currentY;
      const rowsSpace = availableSpace - tableHeaderHeight;

      let slice = [];
      let currentSliceHeight = 0;
      while (remainingCourses.length > 0) {
        const nextCourse = remainingCourses[0];
        const nextCourseHeight = getRowHeight(nextCourse, fontSize, cellPadding);
        if (currentSliceHeight + nextCourseHeight > rowsSpace) {
          break;
        }
        slice.push(remainingCourses.shift());
        currentSliceHeight += nextCourseHeight;
      }

      if (slice.length === 0) {
        advanceColumnWithinBranch(sec.title);
        continue;
      }

      const body = slice.map((c) => {
        const assignedTeachers = Array.isArray(c.teachers)
          ? c.teachers.map(tid => teacherMap[String(tid)] || tid).join(", ")
          : "—";
        const courseLabel = c.code ? `${c.code}\n${c.name}` : c.name;
        const sNo = sec.data.indexOf(c) + 1;
        return [
          sNo,
          courseLabel,
          toRoman(c.semester) || "—",
          assignedTeachers || "—"
        ];
      });

      autoTable(doc, {
        head: [["S.No.", "Course & Code", "Sem", "Teachers"]],
        body: body,
        startY: currentY,
        margin: { left: xOffset },
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
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 38 },
          2: { cellWidth: 10, halign: "center" },
          3: { cellWidth: 29, fontSize: fontSize - 0.5 }
        }
      });

      currentY = doc.lastAutoTable.finalY + 4;
    }
  });

  // Page numbering
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, 15, 289);
  }

  doc.save(`${fileName}.pdf`);
}

/**
 * Export courses list to Excel with separate sheets for each department/branch.
 */
export function exportCourseListToExcel(courses, teachers, fileName = "dei-course-list") {
  const teacherMap = {};
  teachers.forEach(t => {
    const key = t.unid ? String(t.unid) : "";
    if (key) {
      teacherMap[key] = t.ID || t.name || "Unknown";
    }
  });

  const workbook = XLSX.utils.book_new();

  // Grouping logic based on department field
  const groups = {};
  courses.forEach(c => {
    const dept = c.department ? String(c.department).trim().toUpperCase() : "OTHER DEPARTMENTS";
    if (!groups[dept]) {
      groups[dept] = [];
    }
    groups[dept].push(c);
  });

  // Sort departments alphabetically
  const sortedDepts = Object.keys(groups).sort();

  sortedDepts.forEach(dept => {
    const deptCourses = groups[dept];
    deptCourses.sort((a, b) => (a.code || "").localeCompare(b.code || ""));

    const header = ["S.No.", "Course Name", "Course Code", "Semester", "Credits", "Assigned Teachers"];
    const body = deptCourses.map((c, idx) => {
      const assignedTeachers = Array.isArray(c.teachers)
        ? c.teachers.map(tid => teacherMap[String(tid)] || tid).join(", ")
        : "—";
      return [
        idx + 1,
        c.name || "—",
        c.code || "—",
        c.semester || "—",
        c.credits || "—",
        assignedTeachers || "—"
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    const columnWidths = [
      { wch: 8 },
      { wch: 35 },
      { wch: 15 },
      { wch: 10 },
      { wch: 10 },
      { wch: 35 }
    ];
    worksheet["!cols"] = columnWidths;

    // Clean sheet name (max 31 chars, no invalid chars like :, ?, *, /, \)
    const cleanSheetName = dept.replace(/[:\?\*\/\\\[\]]/g, "").substring(0, 30);
    XLSX.utils.book_append_sheet(workbook, worksheet, cleanSheetName || "Courses");
  });

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
