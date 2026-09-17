import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { getSampleCurriculumData } from '../src/utils/collegeUtils.ts';

const firebaseConfig = {
  apiKey: "AIzaSyDSrHm0gkjUdZd9orCJTk_5KMQ9gmuvw8g",
  authDomain: "ctu-attendance-app.firebaseapp.com",
  projectId: "ctu-attendance-app",
  storageBucket: "ctu-attendance-app.firebasestorage.app",
  messagingSenderId: "733711197577",
  appId: "1:733711197577:web:8dc26e9e15fc3927ae6d58",
  measurementId: "G-2YJ7KKN53D"
};

async function uploadToFirebase() {
  console.log('⚡ Initializing Firebase App...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log('📦 Loading BSIT curriculum, subjects, and section class lists...');
  const { programs, subjects, sections } = getSampleCurriculumData();

  console.log(`- Programs: ${programs.length}`);
  console.log(`- Subjects: ${subjects.length}`);
  console.log(`- Sections: ${sections.length}`);
  let studentCount = 0;
  sections.forEach(s => {
    studentCount += s.students?.length || 0;
  });
  console.log(`- Total Students across sections: ${studentCount}`);

  console.log('🔄 Uploading in Firestore batches...');

  // Firestore allows up to 500 writes per batch.
  // Let's batch upload programs, subjects, and sections
  const batch = writeBatch(db);

  for (const prog of programs) {
    const docRef = doc(db, 'curriculum_programs', prog.id);
    batch.set(docRef, prog, { merge: true });
  }

  for (const subj of subjects) {
    const docRef = doc(db, 'curriculum_subjects', subj.id);
    batch.set(docRef, subj, { merge: true });
  }

  for (const sec of sections) {
    const docRef = doc(db, 'curriculum_sections', sec.id);
    batch.set(docRef, sec, { merge: true });
  }

  await batch.commit();
  console.log('✅ SUCCESS: All BSIT programs, major subjects, class sections, and student rosters successfully uploaded to Firebase Firestore!');
  process.exit(0);
}

uploadToFirebase().catch(err => {
  console.error('❌ Upload failed:', err);
  process.exit(1);
});
