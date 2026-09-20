# 🎓 Class Check - College Student Attendance System (PWA)

> A modern, offline-first Progressive Web App (PWA) designed specifically for **College Professors, Lecturers, and University Instructors** to take daily roll calls in lecture halls/labs, easily bulk-add students, monitor exam eligibility (<75% absence drop limits), and seamlessly sync data with Firebase Firestore and Vercel.

---

## 📚 Comprehensive Documentation

Complete documentation with high-resolution screenshots, architecture diagrams, and user guides is available in the [`docs/`](./docs/README.md) directory:

- 📄 **Word Document Format**: [**`Class_Check_Full_Documentation.docx`**](./docs/Class_Check_Full_Documentation.docx) *(Full formatted manual with embedded figures)*

| Document | Description |
| :--- | :--- |
| [🛠️ **Technology Stack Specification**](./docs/technology-stack.md) | In-depth breakdown of React 19, TypeScript 5.7, Vite 6, PWA Workbox, Firebase 11, Vanilla CSS tokens, and dependencies |
| [💻 **Software Engineering & Dev Guide**](./docs/development-guide.md) | Design patterns (Service Repository, Pub/Sub, Pure Parsers), dev setup, testing, coding standards, and CI/CD |
| [📖 **Faculty & Instructor User Manual**](./docs/user-guide.md) | Complete guide for logging in, setting up classes, taking roll calls (List, Flashcards, Seating Grid), and tracking exam eligibility |
| [🏛️ **University Department & Admin Guide**](./docs/admin-guide.md) | Administrative guide for managing degree programs, subject catalogs, and master block rosters |
| [🏗️ **System Architecture & Design**](./docs/architecture.md) | React 19 + Vite architecture, offline-first storage engine, and Firestore data isolation model |
| [🚀 **Deployment & Cloud Sync Guide**](./docs/deployment-and-offline.md) | PWA installation on iOS/Android/Desktop, Firebase Firestore sync, and Vercel/Firebase hosting |
| [🗄️ **Database Schema & Data Models**](./docs/database-schema.md) | TypeScript interfaces, Entity Relationship Diagrams (ERD), and LocalStorage/Firestore schemas |


---

## 🌟 Key Features

- **📱 Progressive Web App (PWA) & Offline Sync**:
  - Works 100% offline in university basements, lecture halls, or with unstable Wi-Fi.
  - Automatically caches all app assets and student records using IndexedDB and Firestore multi-tab local cache.
  - Live connectivity indicator: 🟢 Online, 🟠 Offline (Local Mode), 🔄 Cloud Syncing.
  - Installable directly to Home Screen on iOS, Android, macOS, and Windows.

- **📚 College Course & Subject Management**:
  - Manage multiple subjects (e.g. `CS-301 Database Systems`, `IT-204 Web Apps`).
  - Configure Course Codes, Sections/Blocks (`BSIT-3A`), Semesters, Rooms/Halls, Schedules, and custom color tags.

- **⚡ Effortless Student Roster (Single & Smart Bulk Paste)**:
  - **Smart Bulk Paste**: Paste raw rosters directly from Excel, Google Sheets, Canvas, Blackboard, or University Portals (`ID, Name, Major, Year` or simple name lists).
  - Automatic College Student ID detection and sequential ID generation.
  - **CSV File Upload**: One-click import for CSV roster sheets.
  - In-place student editing and enrollment management.

- **✅ Tactile 1-Tap Daily Attendance Roll Call**:
  - Date selector with previous/next day shortcuts.
  - Session type tags: **Lecture**, **Laboratory**, **Tutorial**, **Exam**.
  - 4-way tactile status buttons:
    - 🟢 **Present (P)**
    - 🔴 **Absent (A)**
    - 🟡 **Late (L)**
    - 🔵 **Excused (E)**
  - Fast batch shortcuts: *"Mark All Present"* (with confetti animation) and *"Mark Unmarked Absent"*.
  - Student-specific remarks modal (e.g., *"Medical certificate submitted"*, *"Varsity competition"*).

- **📊 College Exam Eligibility & Dean's Warning Analytics**:
  - **Dean's Absence Thresholds**:
    - **Eligible (Good)**: $\ge 80\%$ attendance.
    - **Warning (At Risk)**: $75\% - 79\%$ attendance.
    - **Critical (FDA / Dropped)**: $< 75\%$ attendance — flags students at risk of exam debarment.
  - Full semester attendance matrix grid.
  - **CSV Export**: One-click export formatted for university registrars and department chairs.

- **☁️ Zero-Code Cloud Setup & JSON Backups**:
  - Works out-of-the-box with local storage (zero configuration needed).
  - Connect your Firebase project anytime directly in the in-app **Settings modal**.
  - One-click full JSON database export and backup restore.

---

## 🚀 Getting Started Locally

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build production bundle (includes PWA Service Worker)
npm run build
```

---

## 🌐 Deployment Guides

### Option 1: Deploy to Vercel (Recommended)

1. Push this repository to your **GitHub** / **GitLab** account.
2. Go to [Vercel Dashboard](https://vercel.com) and click **"Add New Project"**.
3. Import your repository.
4. Framework Preset will be automatically detected as **Vite**.
5. Click **Deploy**!

> **Note**: `vercel.json` is already preconfigured with single-page app (SPA) rewrites.

---

### Option 2: Deploy to Firebase Hosting

1. Install Firebase CLI (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```
2. Login to your Firebase account:
   ```bash
   firebase login
   ```
3. Initialize hosting in this directory:
   ```bash
   firebase use --add <your-firebase-project-id>
   ```
4. Build and deploy:
   ```bash
   npm run build
   firebase deploy --only hosting,firestore
   ```

---

## ⚙️ Connecting Firebase Cloud Sync

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Cloud Firestore** in test or production mode.
3. In Project Settings, add a **Web App** and copy the configuration keys.
4. Open Class Check, click the ⚙️ **Settings** icon in the navbar, paste your `API Key` and `Project ID`, and click **Save & Connect Cloud**.
5. Data will now seamlessly sync across all your devices in real-time while maintaining 100% offline availability!

---

## 📱 Installing on Mobile & Tablets

- **iOS / Safari**: Tap the **Share** button $\rightarrow$ **"Add to Home Screen"**.
- **Android / Chrome**: Tap the **Install App** button in the header or the 3-dots menu $\rightarrow$ **"Install app"**.
- **Desktop (Chrome/Edge)**: Click the install icon in the address bar for a standalone native desktop app window.
