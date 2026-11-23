# ExamSecure Mobile App — React Native (Expo)

## 📱 Candidate Portal Mobile App

This is the **mobile version** of ExamSecure, targeting the **Candidate Portal only**.
Built with React Native + Expo SDK 52.

---

## Project Structure

```
ExamSecureMobile/
├── app/
│   ├── _layout.tsx               ← Root navigator (Expo Router)
│   ├── index.tsx                 ← Redirects to /candidate/login
│   └── candidate/
│       ├── login.tsx             ← Screen 1: Login & Eligibility Verification
│       ├── role-application.tsx  ← Screen 2: Role, Skills & Degree
│       ├── system-check.tsx      ← Screen 3: Camera, Mic, Rules Agreement
│       ├── exam.tsx              ← Screen 4: Proctored Exam Runner
│       └── submitted.tsx         ← Screen 5: Submission Receipt
├── services/
│   ├── api.ts                    ← All backend API calls (same endpoints)
│   └── sessionStorage.ts         ← AsyncStorage session management
├── constants/
│   └── theme.ts                  ← Brand design tokens (#017846 palette)
├── types/
│   └── candidate.ts              ← TypeScript interfaces
└── package.json
```

---

## Setup & Run

### 1. Install dependencies

```bash
cd ExamSecureMobile
npm install
```

### 2. Configure the backend URL

Create a `.env` file or set in `app.json`:
```bash
EXPO_PUBLIC_API_BASE_URL=https://your-backend.com/api
```

> For local dev on Android emulator, use `http://10.0.2.2:8080/api`  
> For iOS simulator, use `http://localhost:8080/api`

### 3. Start the app

```bash
npx expo start
# Press 'a' for Android emulator
# Press 'i' for iOS simulator
# Scan QR code with Expo Go app on physical device
```

---

## Screen Flow

```
Login → Role Application → System Check → Exam → Submission Confirmation
```

---

## Key Features (Mobile-Native)

| Feature | Implementation |
|---|---|
| **Anti-Cheat** | `AppState` listener detects background switch |
| **Screen-on** | `expo-keep-awake` prevents sleep during exam |
| **Back Block** | `BackHandler` blocks Android back button |
| **Camera** | `expo-camera` live preview in system check |
| **Microphone** | `expo-av` with animated level bar |
| **Auto-save** | Debounced API save on each answer tap |
| **Session** | `AsyncStorage` persists session across app restarts |
| **Timer** | Calibrated against server `serverOffset` |
| **Heartbeat** | 30s polls for exam termination / extra time |

---

## Brand Colors

| Token | Hex | Usage |
|---|---|---|
| Primary | `#017846` | Buttons, accents, icons |
| Primary Light | `#EAF6EF` | Card backgrounds, badges |
| Primary Dark | `#014D32` | Dark text on light bg |
| Background | `#F8FAFC` | Screen backgrounds |
| Surface | `#FFFFFF` | Card surfaces |

---

## Production Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build Android APK/AAB
eas build --platform android

# Build iOS IPA
eas build --platform ios
```
