/**
 * Curriculum service — backed by local FastAPI backend
 */

import { apiFetch } from "../api";
import { normalize } from "../../utils/dataHelpers";

/**
 * Generate curriculum ID from class, branch, semester, and type
 */
export function generateCurriculumId({ className, branch, semester, type }) {
  return normalize(`${className}_${branch}_${semester}_${type}`);
}

/**
 * Save a curriculum document
 */
export async function saveCurriculum(curriculumData) {
  const { className, branch, semester, type, courses } = curriculumData;
  
  if (!className || !branch || !semester || !type) {
    throw new Error("Missing required fields: className, branch, semester, type");
  }

  const payload = {
    className,
    branch,
    semester,
    type,
    courses: courses || [],
  };

  const result = await apiFetch("/api/curriculums", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return result.curriculumId || generateCurriculumId({ className, branch, semester, type });
}

/**
 * Fetch a single curriculum by ID
 */
export async function getCurriculum(curriculumId) {
  const result = await apiFetch(`/api/curriculums/${encodeURIComponent(curriculumId)}`);
  return result;
}

/**
 * Fetch all curriculums
 */
export async function listCurriculums() {
  return await apiFetch("/api/curriculums");
}

/**
 * Delete a curriculum
 */
export async function deleteCurriculum(curriculumId) {
  await apiFetch(`/api/curriculums/${encodeURIComponent(curriculumId)}`, { method: "DELETE" });
}

/**
 * Extract curriculum data from timetable schedules
 * Returns a map of classes with their courses and teachers
 */
export function extractCurriculumFromSchedules(schedules) {
  // Group by class + branch + semester to handle multiple semesters
  const classesMap = new Map();

  console.log("Extracting from schedules:", schedules.length);

  schedules.forEach((schedule) => {
    const { courseId, teacherId, class: className, branch, type, semester } = schedule;
    
    // Skip empty cells
    if (!courseId) return;

    // Create unique class key including semester AND type
    const classType = type || "Full Time";
    const classSemester = semester || '1';
    const classKey = `${className}_${branch}_${classSemester}_${classType}`;
    
    if (!classesMap.has(classKey)) {
      console.log("Creating new class entry:", classKey);
      classesMap.set(classKey, {
        className,
        branch,
        semester: classSemester,
        type: classType,
        coursesMap: new Map(), // courseId -> Set of teacherIds
      });
    }

    const classData = classesMap.get(classKey);
    
    // Add course-teacher mapping
    if (!classData.coursesMap.has(courseId)) {
      classData.coursesMap.set(courseId, new Set());
    }
    
    if (teacherId) {
      classData.coursesMap.get(courseId).add(teacherId);
    }
  });

  // Convert Map structure to array format
  const classes = [];
  classesMap.forEach((classData, classKey) => {
    const courses = [];
    classData.coursesMap.forEach((teacherIds, courseId) => {
      courses.push({
        courseId,
        teacherIds: Array.from(teacherIds),
      });
    });

    classes.push({
      classKey,
      className: classData.className,
      branch: classData.branch,
      semester: classData.semester,
      type: classData.type,
      courses,
    });
  });

  return classes;
}
