import 'dotenv/config'
import bcrypt from 'bcryptjs'
import prisma from './prisma.js'

async function seed() {
  console.log('🌱 Seeding SMARTCLASS database...')

  // Default admin account
  const adminPassword = await bcrypt.hash('admin123', 12)
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      role: 'ADMIN',
      isFirstLogin: true,
    },
  })
  await prisma.admin.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { userId: adminUser.id, fullName: 'System Administrator' },
  })
  console.log('✅ Admin account: username=admin, password=admin123')

  // Default system settings
  const settings = [
    { key: 'schoolName', value: 'Exequiel R. Lina High School' },
    { key: 'currentAcademicYear', value: '2024-2025' },
    { key: 'currentSemester', value: '1st Semester' },
    { key: 'systemVersion', value: 'v1.0.0' },
    { key: 'inactivityTimeout', value: '10' },
    { key: 'sessionCodeExpiry', value: '30' },
  ]
  for (const s of settings) {
    await prisma.systemSetting.upsert({ where: { key: s.key }, update: {}, create: s })
  }
  console.log('✅ System settings')

  // Default announcement categories
  const categories = [
    { name: 'School Announcements', icon: '📢', order: 1 },
    { name: 'Upcoming Events', icon: '📅', order: 2 },
    { name: 'Class Schedule', icon: '📚', order: 3 },
    { name: 'Emergency Hotlines', icon: '📞', order: 4 },
  ]
  for (const c of categories) {
    await prisma.announcementCategory.upsert({ where: { name: c.name }, update: {}, create: c })
  }
  console.log('✅ Announcement categories')

  // Sample academic year
  const year = await prisma.academicYear.upsert({
    where: { name: '2024-2025' },
    update: {},
    create: { name: '2024-2025', isCurrent: true },
  })

  // Grade levels
  const grade11 = await prisma.gradeLevel.upsert({
    where: { name: 'Grade 11' },
    update: {},
    create: { name: 'Grade 11', order: 11 },
  })
  const grade12 = await prisma.gradeLevel.upsert({
    where: { name: 'Grade 12' },
    update: {},
    create: { name: 'Grade 12', order: 12 },
  })

  // Strands
  const stemStrand = await prisma.strand.upsert({
    where: { id: (await prisma.strand.findFirst({ where: { name: 'STEM', gradeLevelId: grade11.id } }))?.id || 'new-stem' },
    update: {},
    create: { name: 'STEM', gradeLevelId: grade11.id },
  }).catch(() => prisma.strand.create({ data: { name: 'STEM', gradeLevelId: grade11.id } }))

  const abmStrand = await prisma.strand.upsert({
    where: { id: (await prisma.strand.findFirst({ where: { name: 'ABM', gradeLevelId: grade11.id } }))?.id || 'new-abm' },
    update: {},
    create: { name: 'ABM', gradeLevelId: grade11.id },
  }).catch(() => prisma.strand.create({ data: { name: 'ABM', gradeLevelId: grade11.id } }))

  // Sections
  const sectionA = await prisma.section.upsert({
    where: { id: (await prisma.section.findFirst({ where: { name: 'Section A', gradeLevelId: grade11.id } }))?.id || 'new-sec-a' },
    update: {},
    create: { name: 'Section A', gradeLevelId: grade11.id, strandId: stemStrand.id },
  }).catch(() => prisma.section.create({ data: { name: 'Section A', gradeLevelId: grade11.id, strandId: stemStrand.id } }))

  const sectionB = await prisma.section.upsert({
    where: { id: (await prisma.section.findFirst({ where: { name: 'Section B', gradeLevelId: grade11.id } }))?.id || 'new-sec-b' },
    update: {},
    create: { name: 'Section B', gradeLevelId: grade11.id, strandId: abmStrand.id },
  }).catch(() => prisma.section.create({ data: { name: 'Section B', gradeLevelId: grade11.id, strandId: abmStrand.id } }))

  // Sample subjects
  const subjects = [
    { name: 'General Mathematics', code: 'MATH-GEN-11' },
    { name: 'Oral Communication', code: 'ENG-ORAL-11' },
    { name: 'General Chemistry', code: 'SCI-CHEM-11' },
    { name: 'Physical Education', code: 'PE-11' },
  ]
  const createdSubjects: any[] = []
  for (const s of subjects) {
    const sub = await prisma.subject.upsert({ where: { code: s.code }, update: {}, create: s })
    createdSubjects.push(sub)
  }

  // Sample teacher
  const teacherPw = await bcrypt.hash('teacher123', 12)
  const existingTeacher = await prisma.teacher.findUnique({ where: { email: 'teacher@erlhs.edu.ph' } })
  if (!existingTeacher) {
    const teacherUser = await prisma.user.create({
      data: { email: 'teacher@erlhs.edu.ph', passwordHash: teacherPw, role: 'TEACHER', isFirstLogin: true },
    })
    const teacher = await prisma.teacher.create({
      data: {
        userId: teacherUser.id,
        fullName: 'Maria Santos',
        email: 'teacher@erlhs.edu.ph',
        department: 'Science Department',
        employeeId: 'EMP-001',
      },
    })
    await prisma.teacherProfile.create({ data: { teacherId: teacher.id } })

    // Assign subjects
    for (const sub of createdSubjects.slice(0, 2)) {
      await prisma.teacherSubjectAssignment.create({
        data: { teacherId: teacher.id, subjectId: sub.id, sectionId: sectionA.id, academicYearId: year.id },
      })
    }
    console.log('✅ Sample teacher: teacher@erlhs.edu.ph / teacher123')
  }

  // Sample student
  const studentPw = await bcrypt.hash('student123', 12)
  const existingStudent = await prisma.student.findUnique({ where: { studentNumber: '2024-00001' } })
  if (!existingStudent) {
    const studentUser = await prisma.user.create({
      data: { email: 'student@erlhs.edu.ph', passwordHash: studentPw, role: 'STUDENT', isFirstLogin: true },
    })
    const student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        studentNumber: '2024-00001',
        studentCode: 'SC-DEMO01',
        fullName: 'Juan Dela Cruz',
        email: 'student@erlhs.edu.ph',
        gender: 'Male',
      },
    })
    await prisma.studentProfile.create({ data: { studentId: student.id } })
    await prisma.studentSectionAssignment.create({
      data: { studentId: student.id, sectionId: sectionA.id, academicYearId: year.id, gradeLevelId: grade11.id },
    })
    console.log('✅ Sample student: 2024-00001 / student123')
  }

  // Sample announcement
  const schoolCat = await prisma.announcementCategory.findUnique({ where: { name: 'School Announcements' } })
  if (schoolCat) {
    const existing = await prisma.announcement.findFirst({ where: { title: 'Welcome to SMARTCLASS!' } })
    if (!existing) {
      await prisma.announcement.create({
        data: {
          title: 'Welcome to SMARTCLASS!',
          categoryId: schoolCat.id,
          description: 'SMARTCLASS is now live! Students and teachers can log in using their assigned credentials.',
          publishStatus: 'published',
          publishedAt: new Date(),
          displayPriority: 10,
        },
      })
    }
  }
  console.log('✅ Sample announcement')

  console.log('\n🎉 Database seeded successfully!')
  console.log('\n📋 Login Credentials:')
  console.log('  Admin:   username=admin, password=admin123')
  console.log('  Teacher: email=teacher@erlhs.edu.ph, password=teacher123')
  console.log('  Student: number=2024-00001, password=student123')
  console.log('\n⚠️  All demo accounts require password change on first login.')
}

seed().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
