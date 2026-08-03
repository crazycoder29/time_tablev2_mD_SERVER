/**
 * Academic Abbreviations Utility for Timetable and Schedule Export
 */

export function abbreviateText(text) {
  if (!text) return "";
  let str = String(text).trim();

  // If text is a raw numeric 10+ digit timestamp (e.g. 1774493604981), discard it
  if (/^\d{10,}$/.test(str)) {
    return "";
  }

  const replacements = [
    // Program / Degree
    [/\bBachelor of Technology\b/gi, "BT"],
    [/\bB\.?\s*Tech\b/gi, "BT"],
    [/\bMaster of Technology\b/gi, "MT"],
    [/\bM\.?\s*Tech\b/gi, "MT"],
    [/\bBachelor of Science\b/gi, "BS"],
    [/\bB\.?\s*Sc\b/gi, "BS"],
    [/\bMaster of Science\b/gi, "MS"],
    [/\bM\.?\s*Sc\b/gi, "MS"],
    [/\bFull Time\b/gi, "FT"],
    [/\bfull-time\b/gi, "FT"],
    [/\bPart Time\b/gi, "PT"],
    [/\bpart-time\b/gi, "PT"],

    // Branches
    [/\bAgricultural Engineering\b/gi, "ARE"],
    [/\bFootwear Engineering\b/gi, "FTW"],
    [/\bFootwear Technology\b/gi, "FTW"],
    [/\bFootwear\b/gi, "FTW"],
    [/\bCivil Engineering\b/gi, "CE"],
    [/\bElectrical Engineering\b/gi, "EE"],
    [/\bMechanical Engineering\b/gi, "ME"],
    [/\bComputer Science\b/gi, "CS"],

    // Semesters
    [/\bSemester\s*(\d+)\b/gi, "S$1"],
    [/\bSem\s*(\d+)\b/gi, "S$1"],

    // Batches
    [/\bBatch\s*([A-Z0-9]+)\b/gi, "$1"],

    // Types
    [/\bLecture\b/gi, "L"],
    [/\bPractical\b/gi, "P"],
    [/\bTutorial\b/gi, "T"],
    [/\bLab\b/gi, "P"],
  ];

  replacements.forEach(([pattern, replacement]) => {
    str = str.replace(pattern, replacement);
  });

  return str;
}

/**
 * Format cell occupancy entries with abbreviations and vertical side-by-side partitions
 * if multiple classes exist in the same time slot.
 * Shows ONLY the Course Code / ID (e.g. EEM310, MEM101), NOT the full course name.
 */
export function formatCellOccupancy(matches) {
  if (!matches || matches.length === 0) return "—";

  const getCourseCodeOnly = (occ) => {
    let code = occ.code || occ.courseCode || "";
    let name = occ.course || occ.courseName || "";

    // Filter out raw numeric timestamp IDs (e.g. 1774493604981)
    if (/^\d{10,}$/.test(String(code).trim())) code = "";
    if (/^\d{10,}$/.test(String(name).trim())) name = "";

    code = String(code).trim();
    name = String(name).trim();

    // Show ONLY Course Code / ID (e.g., EEM310, MEM101)
    const target = code || name || "";
    return abbreviateText(target);
  };

  if (matches.length === 1) {
    const occ = matches[0];
    const classInfo = abbreviateText(
      [occ.class, occ.branch, occ.semester ? `S${occ.semester}` : "", occ.type].filter(Boolean).join(" ")
    );
    const batchInfo = occ.batch ? `(${abbreviateText(occ.batch)})` : "";
    const courseCode = getCourseCodeOnly(occ);
    const roomInfo = occ.room ? `R:${abbreviateText(occ.room)}` : "";

    return [
      [classInfo, batchInfo].filter(Boolean).join(" "),
      courseCode,
      roomInfo,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // Multiple classes / batches in the same time slot -> Vertical Partitions (Side-by-side columns)
  const columns = matches.map((occ, idx) => {
    const classInfo = abbreviateText(
      [occ.class, occ.branch, occ.semester ? `S${occ.semester}` : "", occ.type].filter(Boolean).join(" ")
    );
    const batchInfo = occ.batch ? `(${abbreviateText(occ.batch)})` : `(B${idx + 1})`;

    const courseCode = getCourseCodeOnly(occ);
    const roomInfo = occ.room ? `R:${abbreviateText(occ.room)}` : "";

    return [
      [classInfo, batchInfo].filter(Boolean).join(" "),
      courseCode,
      roomInfo,
    ].filter(Boolean);
  });

  // Build side-by-side vertical partitions using clean ASCII dividers
  const maxLines = Math.max(...columns.map((c) => c.length));
  const sideBySideLines = [];

  for (let l = 0; l < maxLines; l++) {
    const lineParts = columns.map((c) => c[l] || "");
    sideBySideLines.push(lineParts.join("   |   "));
  }

  return sideBySideLines.join("\n");
}
