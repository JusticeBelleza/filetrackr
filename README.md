# 📂 Filetrackr Document Management System

![Version](https://img.shields.io/badge/version-1.2.1-blue.svg)
![React](https://img.shields.io/badge/React-19.2.8-61DAFB.svg?logo=react)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4.3.3-38B2AC.svg?logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-Powered-3ECF8E.svg?logo=supabase)

A modern, real-time document routing and tracking system built for the Provincial Health Office. Filetrackr eliminates lost paperwork by providing a strict digital trail, electronic signatures, and real-time accountability for every document moving through the organization.

---

## ✨ Key Features

* **Zero-Latency Notifications:** A highly optimized, decoupled caching system that calculates "New" document badges instantly without waiting for database round-trips.
* **Real-Time Routing:** Documents are tracked live. As soon as a document is routed to a new department, receiving clerks get instant notifications via Supabase Realtime WebSockets.
* **Immutable Digital Trail:** Every action — creation, handover, rejection, and completion — is securely logged with exact timestamps, locations, and personnel involved.
* **Installable PWA:** Fully configured as a Progressive Web App (PWA), allowing staff to install the tracker directly onto their mobile home screens for a native-app experience.
* **Smart History Folders:** Completed and voided documents are automatically grouped by category into collapsible folders, featuring smart read-receipt tracking to highlight unread archives.
* **Mobile-First UX:** Designed for on-the-go personnel, featuring a custom "liquid" sliding bottom navigation bar, native-feeling bottom-sheet modals, and touch-friendly routing interfaces.
* **Advanced Admin Portal:** Comprehensive dashboard for managing departments, document categories, and employee access. Includes secure Edge Functions for role-based access control and force-resetting user passwords.

---

## 🛠️ Technology Stack

### Frontend

* **Core:** React via Vite
* **Styling:** Tailwind CSS
* **State & Data Fetching:** `@tanstack/react-query` and Zustand
* **Icons & UI Elements:** `lucide-react`, `sonner`
* **Utilities:** `jspdf`

### Backend — Supabase

* **Authentication:** Supabase Auth
* **Database:** PostgreSQL with strict Row Level Security (RLS)
* **Storage:** Supabase Storage
* **Serverless:** Deno Edge Functions
* **Realtime:** Postgres Changes subscriptions

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

You will also need a Supabase project set up.

### Installation

#### 1. Install Dependencies

Ensure you are in the project directory:

```bash
npm install
```

#### 2. Environment Setup

Create a `.env.local` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> **Security:** Never commit `.env.local` or private credentials to GitHub.

#### 3. Run the Development Server

```bash
npm run dev
```

---

## ☁️ Supabase Edge Functions Deployment

If you are modifying administrative backend functions such as creating employees or resetting passwords, install and authenticate the Supabase CLI.

Deploy the Edge Functions:

```bash
supabase functions deploy create-employee
supabase functions deploy reset-password
```

For the complete database schema and RLS policies, see:

[`FileTrackr_Architecture.md`](./Architecture.md)

---

## 📱 Interface Highlights

| Feature                    | Description                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Zero-Delay UI Sync**     | Real-time event listeners and local storage syncing ensure notification badges disappear immediately when a folder or tab is opened. |
| **Searchable Comboboxes**  | Custom-built accessible dropdowns handle hundreds of employees without lagging.                                                      |
| **Priority Flags**         | Documents can be flagged as **RUSH**, visually alerting receiving departments with pulsing red indicators.                           |
| **Certificate Generation** | E-signatures are displayed as professional, verified certificates within the digital trail.                                          |

---

## 🏗️ Architecture

```text
┌──────────────────────────────┐
│        Filetrackr PWA        │
│                              │
│  React + Vite + Tailwind CSS │
│  React Query + Zustand       │
└──────────────┬───────────────┘
               │
               │ Supabase Client
               ▼
┌──────────────────────────────┐
│           Supabase           │
│                              │
│  ┌────────────┐ ┌──────────┐ │
│  │ PostgreSQL │ │   Auth   │ │
│  │ + RLS      │ │          │ │
│  └────────────┘ └──────────┘ │
│                              │
│  ┌────────────┐ ┌──────────┐ │
│  │  Storage   │ │ Realtime │ │
│  └────────────┘ └──────────┘ │
│                              │
│       Deno Edge Functions    │
└──────────────────────────────┘
```

---

## 🔐 Security

Filetrackr follows a zero-trust security model.

Security mechanisms include:

* PostgreSQL Row Level Security (RLS)
* Supabase Authentication
* Role-based access control
* Secure Edge Functions
* Immutable document audit logs
* Protected document attachments
* Server-side authorization for administrative operations

Sensitive operations should always be validated server-side rather than relying solely on frontend restrictions.

---

## 📂 Project Documentation

| Document                                                     | Description                                     |
| ------------------------------------------------------------ | ----------------------------------------------- |
| [`Architecture.md`](./Architecture.md) | Database schema, ERD, and RLS security policies |

---

## 👨‍💻 Developer Information

**Designed & Developed by**

### Justice P. Belleza

*ICT Officer Designate, Provincial Health Office*

Built to streamline bureaucratic routing, ensure accountability, and modernize public health office operations.

---

## 📄 License

This project is intended for use by the Provincial Health Office.

Add the applicable license or internal-use policy for your organization.
