import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../server/prisma";

type JsonRecord = Record<string, unknown>;

const dbPath = path.join(process.cwd(), "data", "db.json");

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getRecords(
  db: Record<string, unknown>,
  name: string,
): JsonRecord[] {
  const value = db[name];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
}

function getId(record: JsonRecord): string {
  if (typeof record.id !== "string" || record.id.trim() === "") {
    throw new Error("Record is missing a valid string id.");
  }

  return record.id;
}

/**
 * Converts JSON date values into JavaScript Date objects.
 *
 * Empty strings, null, undefined, and invalid dates become null.
 * This prevents Prisma DateTime fields from receiving invalid values.
 */
function cleanRecord(record: JsonRecord): JsonRecord {
  const cleaned: JsonRecord = { ...record };

  const dateFields = [
    "birthDate",
    "createdAt",
    "updatedAt",
    "lastLogin",
    "lockedUntil",
    "startDate",
    "endDate",
    "uploadedAt",
    "attendanceDate",
    "sessionExpiry",
    "timeRecorded",
    "activityDate",
    "dateRecorded",
    "publishedAt",
    "expiresAt",
    "releasedAt",
  ];

  for (const field of dateFields) {
    if (!(field in cleaned)) {
      continue;
    }

    const value = cleaned[field];

    // Empty/null date values should become null.
    if (
      value === "" ||
      value === null ||
      value === undefined
    ) {
      cleaned[field] = null;
      continue;
    }

    // Convert valid date strings to Date objects.
    if (typeof value === "string") {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        console.warn(
          `⚠️ Invalid date detected in field "${field}". Setting it to null.`,
        );

        cleaned[field] = null;
      } else {
        cleaned[field] = date;
      }
    }
  }

  return cleaned;
}

async function upsertRecords(
  collectionName: string,
  model: any,
  records: JsonRecord[],
) {
  let imported = 0;
  let failed = 0;

  console.log(
    `\n[${collectionName}] ${records.length} records`,
  );

  for (const record of records) {
    const id = getId(record);
    const cleanedRecord = cleanRecord(record);

    try {
      await model.upsert({
        where: {
          id,
        },
        create: cleanedRecord,
        update: cleanedRecord,
      });

      imported++;

      console.log(
        `  ✓ ${imported}/${records.length} - ${id}`,
      );
    } catch (error) {
      failed++;

      console.error(
        `\n❌ ${collectionName} failed for ID ${id}`,
      );

      console.error("Record:");
      console.error(cleanedRecord);

      console.error("\nPrisma error:");
      console.error(error);

      throw error;
    }
  }

  console.log(
    `✅ ${collectionName}: ${imported} imported`,
  );

  return {
    imported,
    failed,
  };
}

async function main() {
  console.log("==========================================");
  console.log(" SMARTCLASS JSON → SUPABASE IMPORT");
  console.log("==========================================");

  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `db.json not found at: ${dbPath}`,
    );
  }

  const raw = fs.readFileSync(
    dbPath,
    "utf8",
  );

  let db: Record<string, unknown>;

  try {
    db = JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `db.json contains invalid JSON.\n${String(error)}`,
    );
  }

  console.log(`\nJSON: ${dbPath}`);
  console.log("JSON loaded successfully.");

  await prisma.$connect();

  console.log("✅ Connected to PostgreSQL.");

  /*
   * ==========================================================
   * IMPORT ORDER
   * ==========================================================
   *
   * Parent tables are imported first because other tables
   * depend on their IDs through foreign-key relationships.
   */

  // ==========================================================
  // USERS
  // ==========================================================

  await upsertRecords(
    "users",
    (prisma as any).user,
    getRecords(db, "users"),
  );

  // ==========================================================
  // ADMINS
  // ==========================================================

  await upsertRecords(
    "admins",
    (prisma as any).admin,
    getRecords(db, "admins"),
  );

  // ==========================================================
  // STUDENTS
  // ==========================================================

  await upsertRecords(
    "students",
    (prisma as any).student,
    getRecords(db, "students"),
  );

  // ==========================================================
  // TEACHERS
  // ==========================================================

  await upsertRecords(
    "teachers",
    (prisma as any).teacher,
    getRecords(db, "teachers"),
  );

  // ==========================================================
  // STUDENT PROFILES
  // ==========================================================

  await upsertRecords(
    "studentProfiles",
    (prisma as any).studentProfile,
    getRecords(db, "studentProfiles"),
  );

  // ==========================================================
  // TEACHER PROFILES
  // ==========================================================

  await upsertRecords(
    "teacherProfiles",
    (prisma as any).teacherProfile,
    getRecords(db, "teacherProfiles"),
  );

  // ==========================================================
  // ACADEMIC YEARS
  // ==========================================================

  await upsertRecords(
    "academicYears",
    (prisma as any).academicYear,
    getRecords(db, "academicYears"),
  );

  // ==========================================================
  // GRADE LEVELS
  // ==========================================================

  await upsertRecords(
    "gradeLevels",
    (prisma as any).gradeLevel,
    getRecords(db, "gradeLevels"),
  );

  // ==========================================================
  // STRANDS
  // ==========================================================

  await upsertRecords(
    "strands",
    (prisma as any).strand,
    getRecords(db, "strands"),
  );

  // ==========================================================
  // SECTIONS
  // ==========================================================

  await upsertRecords(
    "sections",
    (prisma as any).section,
    getRecords(db, "sections"),
  );

  // ==========================================================
  // SUBJECTS
  // ==========================================================

  await upsertRecords(
    "subjects",
    (prisma as any).subject,
    getRecords(db, "subjects"),
  );

  // ==========================================================
  // STUDENT SECTION ASSIGNMENTS
  // ==========================================================

  await upsertRecords(
    "studentSectionAssignments",
    (prisma as any).studentSectionAssignment,
    getRecords(db, "studentSectionAssignments"),
  );

  // ==========================================================
  // TEACHER SUBJECT ASSIGNMENTS
  // ==========================================================

  await upsertRecords(
    "teacherSubjectAssignments",
    (prisma as any).teacherSubjectAssignment,
    getRecords(db, "teacherSubjectAssignments"),
  );

  // ==========================================================
  // CLASS SCHEDULES
  // ==========================================================

  await upsertRecords(
    "classSchedules",
    (prisma as any).classSchedule,
    getRecords(db, "classSchedules"),
  );

  // ==========================================================
  // ATTENDANCE SESSIONS
  // ==========================================================

  await upsertRecords(
    "attendanceSessions",
    (prisma as any).attendanceSession,
    getRecords(db, "attendanceSessions"),
  );

  // ==========================================================
  // ATTENDANCE RECORDS
  // ==========================================================

  await upsertRecords(
    "attendanceRecords",
    (prisma as any).attendanceRecord,
    getRecords(db, "attendanceRecords"),
  );

  // ==========================================================
  // ACADEMIC ACTIVITIES
  // ==========================================================

  await upsertRecords(
    "academicActivities",
    (prisma as any).academicActivity,
    getRecords(db, "academicActivities"),
  );

  // ==========================================================
  // STUDENT SCORES
  // ==========================================================

  await upsertRecords(
    "studentScores",
    (prisma as any).studentScore,
    getRecords(db, "studentScores"),
  );

  // ==========================================================
  // ANNOUNCEMENT CATEGORIES
  // ==========================================================

  await upsertRecords(
    "announcementCategories",
    (prisma as any).announcementCategory,
    getRecords(db, "announcementCategories"),
  );

  // ==========================================================
  // ANNOUNCEMENTS
  // ==========================================================

  await upsertRecords(
    "announcements",
    (prisma as any).announcement,
    getRecords(db, "announcements"),
  );

  // ==========================================================
  // SYSTEM SETTINGS
  // ==========================================================

  await upsertRecords(
    "systemSettings",
    (prisma as any).systemSetting,
    getRecords(db, "systemSettings"),
  );

  // ==========================================================
  // PRESENTATION MATERIALS
  // ==========================================================

  await upsertRecords(
    "presentationMaterials",
    (prisma as any).presentationMaterial,
    getRecords(db, "presentationMaterials"),
  );

  // ==========================================================
  // IMPORTED SHEETS
  // ==========================================================

  await upsertRecords(
    "importedSheets",
    (prisma as any).importedSheet,
    getRecords(db, "importedSheets"),
  );

  // ==========================================================
  // FINAL GRADES
  // ==========================================================

  await upsertRecords(
    "finalGrades",
    (prisma as any).finalGrade,
    getRecords(db, "finalGrades"),
  );

  // ==========================================================
  // COMPLETE
  // ==========================================================

  console.log("\n==========================================");
  console.log(" ✅ IMPORT COMPLETE");
  console.log("==========================================");
}

main()
  .catch((error) => {
    console.error("\n==========================================");
    console.error(" ❌ IMPORT FAILED");
    console.error("==========================================");
    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });