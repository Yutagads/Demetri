import "dotenv/config";
import { prisma } from "../server/prisma";

async function main() {
  console.log("==========================================");
  console.log(" SMARTCLASS IMPORT VERIFICATION");
  console.log("==========================================");

  await prisma.$connect();

  console.log("\nConnected to PostgreSQL.\n");

  const checks = [
    ["users", (prisma as any).user],
    ["admins", (prisma as any).admin],
    ["students", (prisma as any).student],
    ["teachers", (prisma as any).teacher],
    ["studentProfiles", (prisma as any).studentProfile],
    ["teacherProfiles", (prisma as any).teacherProfile],
    ["academicYears", (prisma as any).academicYear],
    ["gradeLevels", (prisma as any).gradeLevel],
    ["strands", (prisma as any).strand],
    ["sections", (prisma as any).section],
    ["subjects", (prisma as any).subject],
    ["studentSectionAssignments", (prisma as any).studentSectionAssignment],
    ["teacherSubjectAssignments", (prisma as any).teacherSubjectAssignment],
    ["classSchedules", (prisma as any).classSchedule],
    ["attendanceSessions", (prisma as any).attendanceSession],
    ["attendanceRecords", (prisma as any).attendanceRecord],
    ["academicActivities", (prisma as any).academicActivity],
    ["studentScores", (prisma as any).studentScore],
    ["announcementCategories", (prisma as any).announcementCategory],
    ["announcements", (prisma as any).announcement],
    ["systemSettings", (prisma as any).systemSetting],
    ["presentationMaterials", (prisma as any).presentationMaterial],
    ["importedSheets", (prisma as any).importedSheet],
    ["finalGrades", (prisma as any).finalGrade],
  ];

  for (const [name, model] of checks) {
    try {
      const count = await model.count();

      console.log(
        `${String(name).padEnd(35)} ${count} records`
      );
    } catch (error) {
      console.log(
        `❌ ${String(name).padEnd(35)} ERROR`
      );
      console.error(error);
    }
  }

  console.log("\n==========================================");
  console.log(" VERIFICATION COMPLETE");
  console.log("==========================================");
}

main()
  .catch((error) => {
    console.error("\n❌ Verification failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });