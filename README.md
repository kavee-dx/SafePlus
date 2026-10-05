# 🛡️ SafePlus

### Smart Disaster Early-Warning & Emergency Coordination System for Sri Lanka

SafePlus is a smart disaster management platform designed to support **early warning, real-time disaster monitoring, emergency coordination, and citizen safety** in Sri Lanka.

The system connects citizens with the **Disaster Management Centre (DMC)** and emergency response teams through dedicated mobile and web applications.

---

## 🌍 Project Overview

Natural disasters such as floods, landslides, cyclones, and severe weather events can require rapid communication and coordinated emergency response.

**SafePlus** provides a centralized platform for:

* 🚨 Early disaster warnings
* 📍 Real-time disaster location monitoring
* 📱 Citizen emergency reporting
* 🗺️ Interactive disaster maps
* 👥 Rescue team coordination
* 🔔 Emergency notifications
* 📊 Disaster monitoring and reporting
* 🆘 Emergency response coordination

The system consists of a **Citizen Mobile Application**, a **DMC Web Portal**, and a centralized **Backend API**.

---

## 🏗️ System Architecture

```text
                         ┌──────────────────────────┐
                         │       SafePlus API       │
                         │                          │
                         │  Node.js + Express.js    │
                         │  TypeScript              │
                         │  JWT + RBAC              │
                         │  Socket.IO               │
                         └────────────┬─────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
        ┌─────────────────────┐             ┌─────────────────────┐
        │   Citizen Mobile    │             │    DMC Web Portal   │
        │        App          │             │                     │
        │                     │             │ React + TypeScript  │
        │ React Native +      │             │ Vite                │
        │ Expo + TypeScript   │             │                     │
        └──────────┬──────────┘             └──────────┬──────────┘
                   │                                   │
                   └─────────────────┬─────────────────┘
                                     ▼
                         ┌──────────────────────────┐
                         │ PostgreSQL + PostGIS     │
                         │                          │
                         │ Spatial & Disaster Data  │
                         └──────────────────────────┘
```

---

## 📱 Applications

### Citizen Mobile Application

The SafePlus Citizen App allows members of the public to interact with the disaster management system.

Planned capabilities include:

* 🚨 Receive disaster warnings
* 📍 Report disasters and incidents
* 🗺️ View nearby disaster information
* 🆘 Request emergency assistance
* 📡 Receive real-time status updates
* 📴 Offline support
* 🔔 Push notifications
* 👤 Secure authentication

**Technology:**

* React Native
* Expo
* TypeScript
* NativeWind
* Zustand
* TanStack Query
* Expo SQLite
* Expo Notifications
* MapLibre / OpenStreetMap

---

### 🖥️ DMC Web Portal

The DMC Portal provides a centralized operational interface for disaster management authorities.

Planned capabilities include:

* 📊 Disaster monitoring dashboard
* 🚨 Disaster alerts
* 🗺️ Live disaster map
* 🚑 Rescue team coordination
* 📋 Incident management
* 📈 Reports and analytics
* 🔔 Emergency notifications
* 👥 Role-based access control

**Technology:**

* React
* TypeScript
* Vite
* React Router
* Zustand
* TanStack Query
* Axios
* Lucide React

---

## ⚙️ Backend

The SafePlus backend provides the central API and real-time communication layer.

### Technology

| Technology      | Purpose                 |
| --------------- | ----------------------- |
| Node.js         | Runtime                 |
| Express.js      | REST API                |
| TypeScript      | Type safety             |
| PostgreSQL      | Relational database     |
| PostGIS         | Spatial data            |
| JWT             | Authentication          |
| bcrypt          | Password hashing        |
| Socket.IO       | Real-time communication |
| Cloudinary      | Media storage           |
| Swagger/OpenAPI | API documentation       |

---

## 🗄️ Database

SafePlus uses **PostgreSQL with PostGIS** to support both standard relational data and geographical information.

Current core entities include:

```text
Users
  │
  └── Disasters
```

The database is designed to support future spatial features such as:

* Disaster coordinates
* Emergency locations
* Rescue team locations
* Safe zones
* Evacuation areas
* Geographic disaster analysis

---

## 📁 Project Structure

```text
SafePlus/
│
├── backend/
│   ├── config/
│   ├── migrations/
│   ├── routes/
│   ├── server.ts
│   ├── migrate.ts
│   └── package.json
│
├── citizen-app/
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── services/
│   │   ├── store/
│   │   └── ...
│   └── package.json
│
├── dmc-portal/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── services/
│   │   ├── store/
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── utils/
│   │   └── constants/
│   └── package.json
│
└── docs/
    ├── architecture/
    ├── api/
    ├── database/
    └── diagrams/
```

---

## 🔐 Security

SafePlus is designed with security and role-based access in mind.

Key security mechanisms include:

* 🔑 JWT authentication
* 🔒 Password hashing with bcrypt
* 👤 Role-Based Access Control (RBAC)
* 🛡️ Protected API endpoints
* 🔐 Environment variables for sensitive configuration
* 🌐 CORS configuration
* 🗃️ Secure database access

> **Never commit `.env` files, passwords, API keys, database credentials, or other secrets to GitHub.**

---

## 🚀 Getting Started

### Prerequisites

Install the following before running the project:

* Node.js
* npm
* PostgreSQL
* Git
* Expo Go or Android Studio for mobile development

---

### 1. Clone the repository

```bash
git clone https://github.com/kavee-dx/SafePlus.git
cd SafePlus
```

---

### 2. Start the Backend

```bash
cd backend
npm install
npm run dev
```

Backend:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

---

### 3. Start the Citizen App

Open another terminal:

```bash
cd SafePlus/citizen-app
npm install
npx expo start
```

For web:

```text
Press W
```

For Android:

```text
Press A
```

Or scan the Expo QR code using Expo Go.

---

### 4. Start the DMC Portal

Open another terminal:

```bash
cd SafePlus/dmc-portal
npm install
npm run dev
```

The DMC Portal will be available at:

```text
http://localhost:5173
```

---

## 🧪 Development

During development, run the three main applications separately:

```text
Terminal 1
└── Backend
    └── npm run dev

Terminal 2
└── Citizen App
    └── npx expo start

Terminal 3
└── DMC Portal
    └── npm run dev
```

Production builds should be created only when required for deployment or release testing.

---

## 🌿 Git Workflow

To keep team development organized, developers should work on feature branches.

```bash
git checkout main
git pull origin main

git checkout -b feature/your-feature
```

After completing the feature:

```bash
git add .
git commit -m "add your feature"
git push origin feature/your-feature
```

Then create a Pull Request on GitHub.

### Branch examples

```text
main

feature/citizen-emergency-report
feature/dmc-dashboard
feature/disaster-alerts
feature/live-disaster-map
feature/rescue-team-management
feature/notifications
```

---

## 👥 User Roles

SafePlus supports role-based access for different system users.

```text
Citizen
   │
   ├── Report incidents
   ├── Receive alerts
   └── Request assistance

DMC Admin
   │
   ├── Manage system
   ├── Monitor disasters
   └── Manage users

DMC Officer
   │
   ├── Monitor incidents
   ├── Coordinate response
   └── Manage alerts

District Officer
   │
   ├── Manage district incidents
   └── Coordinate local rescue teams
```

---

## 📡 Real-Time Communication

SafePlus uses **Socket.IO** to support real-time communication between the backend and connected clients.

This enables features such as:

* 🚨 Live disaster alerts
* 📍 Real-time location/status updates
* 🚑 Rescue team updates
* 🆘 Emergency request updates
* 🔔 Instant operational notifications

---

## 🗺️ Mapping

SafePlus uses open mapping technologies to support disaster visualization and geographical coordination.

```text
OpenStreetMap
      │
      ▼
   MapLibre
      │
      ▼
SafePlus Map
```

PostGIS provides spatial database capabilities for storing and querying geographical information.

---

## 🎯 Sustainable Development Goals

SafePlus contributes primarily to:

### SDG 11 — Sustainable Cities and Communities

Supporting safer and more resilient communities through improved disaster preparedness and emergency coordination.

### SDG 13 — Climate Action

Supporting communities in preparing for and responding to climate-related disasters and extreme weather events.

---

## 🎓 Academic Project

SafePlus is developed as part of the **Software Engineering / Computer Science coursework at Sri Lanka Institute of Information Technology (SLIIT)**.

The project focuses on applying software engineering principles to a real-world disaster management problem in Sri Lanka.

---

## 🛠️ Development Status

| Component              | Status         |
| ---------------------- | -------------- |
| Backend Foundation     | 🟢 In Progress |
| PostgreSQL + PostGIS   | 🟢 Configured  |
| Citizen App Foundation | 🟢 In Progress |
| DMC Portal Foundation  | 🟢 In Progress |
| Authentication         | 🟡 In Progress |
| Disaster Management    | 🟡 Planned     |
| Real-Time Alerts       | 🟡 Planned     |
| Live Disaster Map      | 🟡 Planned     |
| Rescue Coordination    | 🟡 Planned     |
| Reports & Analytics    | 🟡 Planned     |
| Notifications          | 🟡 Planned     |

---

## 📌 Project Goals

SafePlus aims to provide a unified platform that can:

> **Detect → Alert → Coordinate → Respond → Protect**

The ultimate goal is to improve the speed and coordination of disaster response while providing citizens and authorities with reliable, real-time information.

---

## 📄 License

This project is developed for academic purposes.
