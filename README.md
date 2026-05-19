# Smart Attendance Tracker

A modern, responsive, Firebase-backed web application built with **Next.js**, designed to manage college attendance, track upcoming academic alerts, and extract actionable insights through an elegant dashboard.

This project is fully optimized for **Vercel Deployment** and structurally prepared for **PWA (Progressive Web App)** or native Android wrapper deployment (via Capacitor or TWA).

## Features
- **Firebase Authentication:** Secure Google OAuth and Email/Password login.
- **Dynamic Dashboard:** Real-time percentage tracking, target metrics, and interactive attendance marking.
- **Notice Board / Alerts:** Centralized academic alerts (exams, internals, granted leaves) natively categorized with intuitive UI tagging.
- **Timetable Library Engine:** Manage presets via an Admin panel, allowing students to adopt pre-filled schedules seamlessly.
- **Mobile-First Responsiveness:** Stacked card interfaces on mobile displays instead of overflow tables.
- **Premium Splash Animation:** Lightweight `framer-motion` initialization sequence.

## Tech Stack
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS (Dark Mode Native)
- **Database / Auth:** Firebase (Firestore + Authentication)
- **Animations:** Framer Motion
- **Icons:** Lucide React

---

## Environment Setup

To run this project locally or deploy it, you must configure the Firebase environment variables. 
Copy the provided `.env.example` to `.env.local` and populate it with your Firebase console credentials:

```bash
cp .env.example .env.local
```

Required variables:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Local Development

Install dependencies and start the development server:
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Vercel Deployment Steps

1. Push your code to a GitHub repository.
2. Log into [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your GitHub repository.
4. Expand the **Environment Variables** section.
5. Add all the `NEXT_PUBLIC_FIREBASE_*` variables from your `.env.local` file.
6. Click **Deploy**.

> **IMPORTANT:** 
> Once deployed, you **must** add your Vercel production domain to your Firebase Authorized Domains:
> 1. Go to Firebase Console -> Authentication -> Settings -> Authorized Domains.
> 2. Click "Add Domain" and paste your Vercel domain (e.g., `your-app.vercel.app`).
> 3. If you do not do this, Google Login will fail in production.

---

## Android App & PWA Readiness

This project follows a strict mobile-first paradigm and incorporates PWA baseline features.
- `public/manifest.json` is configured.
- `theme-color` and `viewport-fit=cover` meta tags are present for notch-safe layouts.
- Environment variables CSS overrides (`env(safe-area-inset-top)`) are globally applied.

**Future Conversion (Capacitor / TWA):**
If you wish to compile this to a native Android `.apk` / `.aab`, this Next.js export is fully compatible with [Capacitor](https://capacitorjs.com/) or Trusted Web Activities (TWA) wrappers.

---

## Admin Configuration

To access the `/admin` route (which controls the preset timetable library), the logged-in user's email must match the authorized admin email configured in the codebase logic (`src/app/admin/page.tsx`). By default, it checks for a specific email. Update the hardcoded admin email in the component to match your intended admin's Google Auth email address.
