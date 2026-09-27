# CivicAI — AI-Powered Municipal Grievance Redressal Platform


## 🏛️ Overview

**CivicAI** is an AI-powered civic-tech platform that simplifies how citizens report and track municipal issues.

Instead of navigating complicated municipal forms or figuring out which department is responsible for an issue, a citizen can simply **capture or upload a photo**, provide their location, and submit a complaint.

CivicAI combine **computer vision, multimodal AI, deterministic authority routing, complaint tracking, and automated SLA escalation** into one workflow.

### How it works

```text
Citizen
   │
   │ Photo + GPS
   ▼
┌──────────────────────┐
│   Computer Vision    │
│  Civic Issue Detect. │
└──────────┬───────────┘
           │
           │ Known / confident issue
           ▼
┌──────────────────────┐
│   Multimodal AI      │
│ Issue Interpretation │
│ Severity & Risk      │
│ Description          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Complaint Generation │
│ + Ticket ID          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Authority Routing    │
│ Based on Issue/Area  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Complaint Tracking   │
│ + SLA Monitoring     │
└──────────┬───────────┘
           │
           ▼
      SLA Deadline
           │
      ┌────┴─────┐
      │          │
   Resolved   Overdue
                 │
                 ▼
        Automatic Email
          Escalation
```

The core design principle is:

> AI interprets the civic issue; deterministic backend logic handles routing, tracking, deadlines, and escalation.

This keeps critical operational decisions predictable while using AI where visual and semantic reasoning is actually useful.

---

## ✨ Key Capabilities

| Feature | Description |
|---|---|
| 📸 Computer Vision Detection | A custom-trained computer vision model acts as the specialized perception layer for known civic issues. |
| 🤖 Multimodal AI Interpretation | Multimodal AI analyzes the submitted evidence and provides richer issue understanding, severity, safety-risk assessment, and descriptions. |
| 🔄 AI Fallback Pipeline | Low-confidence or unfamiliar visual cases can be passed to the multimodal AI layer instead of relying solely on the CV detector. |
| 🎫 Automatic Complaint Generation | CivicAI generates a structured complaint title and detailed description and assigns a unique public ticket ID such as `CIV-2026-XXXXX`. |
| 🏢 Deterministic Authority Routing | Complaints are routed to the configured municipal authority based on issue category and location. |
| 📍 GPS & Location Tagging | Browser geolocation captures incident coordinates and supports location/address information in the complaint. |
| 📊 Complaint Tracking | Citizens and authorities can track complaint status and view the complaint lifecycle. |
| ⏱️ SLA Monitoring | Each complaint receives a configurable resolution deadline based on issue type and severity. |
| 📧 Automatic SLA Escalation | When an unresolved complaint exceeds its SLA, CivicAI automatically sends an email escalation to the assigned authority. |
| 🔁 Recurring Escalation Protection | Escalation history is stored to prevent repeated email spam and support controlled follow-up intervals. |
| 🏛️ Authority Dashboard | Authorities can view complaints assigned to their department, inspect severity and safety risks, and update complaint status. |
| 📷 Resolution Evidence | Authorities can provide resolution-photo evidence as part of the complaint resolution workflow. |
| 📝 Status History | Complaint status transitions are tracked as part of the complaint timeline. |

---

## 🧠 AI Architecture

CivicAI uses a hybrid AI pipeline rather than forcing every decision through a single model.

### 1. Computer Vision Layer

The custom CV model is responsible for detecting known civic issue classes.

Example categories include:

- Potholes
- Garbage
- Damaged electrical infrastructure
- Fallen trees
- Other supported civic infrastructure issues

The CV layer provides a specialized perception step that can run locally and produce model confidence information.

### 2. Multimodal AI Layer

The multimodal AI layer provides broader visual and semantic reasoning.

It can help determine:

- What the issue is
- Issue description
- Severity
- Public safety risk
- Relevant complaint information
- Cases where the specialized CV detector is uncertain

### Hybrid Decision Flow

```text
                Image
                  │
                  ▼
          ┌───────────────┐
          │  CV Detector  │
          └───────┬───────┘
                  │
          ┌───────┴────────┐
          │                │
      Confident         Uncertain /
      known issue       unfamiliar case
          │                │
          │                ▼
          │        Multimodal AI
          │                │
          └───────┬────────┘
                  ▼
          Issue Understanding
                  │
                  ▼
          Severity + Safety Risk
                  │
                  ▼
          Complaint Generation
```

The system does not claim that the custom CV model is inherently more accurate than a multimodal model. Its purpose is to provide a specialized, measurable perception layer for known civic classes while allowing multimodal AI to handle broader interpretation.

---

## ⏱️ SLA & Automatic Escalation

A major part of CivicAI is ensuring that submitting a complaint does not become the end of the process.

Every new complaint receives a configurable SLA deadline.

Example configuration:

| Issue Type | Base SLA |
|---|---|
| Damaged Electrical Infrastructure | 24 hours |
| Fallen Tree | 24 hours |
| Garbage | 72 hours |
| Pothole | 168 hours |
| Other Infrastructure | 336 hours |

Severity can further shorten the configured deadline.

> **Note:** These values are application configuration for the prototype and are not presented as actual government-mandated resolution timelines.

### Escalation Workflow

```text
Complaint Created
       │
       ▼
SLA Deadline Calculated
       │
       ▼
Background Scheduler
checks periodically
       │
       ▼
Is complaint overdue?
       │
   ┌───┴────┐
   │        │
  NO       YES
   │        │
   │        ▼
   │   Is it resolved?
   │        │
   │    ┌───┴────┐
   │    │        │
   │   YES       NO
   │    │        │
   │   Stop      ▼
   │        Send Email
   │        Escalation
   │             │
   │             ▼
   │      Record Escalation
   │
   └───────────────
```

The backend scheduler checks overdue complaints automatically.

When an unresolved complaint exceeds its configured SLA:

1. The assigned authority is identified.
2. An automated email is generated.
3. The email contains the complaint ID, issue, severity, location, status, and SLA information.
4. The escalation timestamp is recorded.
5. The escalation counter is incremented.
6. Further escalation is controlled using the stored escalation timestamp.

This allows CivicAI to move from simple complaint registration toward complaint accountability.

---

## 🏛️ Complaint Lifecycle

A typical complaint follows this lifecycle:

```text
SUBMITTED
    │
    ▼
ASSIGNED
    │
    ▼
IN_PROGRESS
    │
    ▼
RESOLVED
```

The complaint stores:

- Public complaint ID
- Issue type
- Category
- Severity
- Safety risk
- AI-generated description
- Complaint title
- Complaint description
- Original image
- Resolution image when provided
- GPS coordinates
- Location information
- Assigned authority
- Current status
- Status history
- SLA deadline
- Escalation count
- Last escalation timestamp
- Creation/update timestamps

---

## 🏢 Authority Operations

Authorities receive complaints routed to their configured department.

The authority workflow allows officials to:

- View assigned complaints
- Search/filter complaints
- Inspect issue information
- Review severity and safety risk
- View location information
- Update complaint status
- Track SLA status
- Provide resolution evidence
- Monitor overdue complaints
- See escalation information

### SLA Status

The citizen and authority interfaces can surface SLA state such as:

```
🟢 SLA: On Track
24.6 hours remaining
```

or:

```
🟠 SLA: Due Soon
8 hours remaining
```

or:

```
🔴 SLA: Overdue
Overdue by 5 hours
📧 Escalated to authority · 1 time
```

---

## 🛠️ Technology Stack

### Frontend
- React 19
- Vite
- Tailwind CSS
- React Router
- Lucide Icons

### Backend
- FastAPI
- Uvicorn
- Pydantic v2
- SQLAlchemy 2.0
- Alembic

### AI / ML
- Custom computer vision model for known civic issue detection
- Multimodal AI for broader visual interpretation and fallback reasoning
- Configurable AI model/provider through backend environment configuration

### Database
- SQLite for local development and prototype deployment
- SQLAlchemy ORM
- Alembic database migrations

### Storage
- Local `/uploads` storage for development
- Cloudinary support for cloud-based image storage

### Automation
- Python background scheduler using the FastAPI application lifecycle
- SMTP email delivery
- Gmail SMTP supported
- Configurable SLA rules and escalation intervals

---

## 📁 Project Structure

The project is organized around a React frontend and FastAPI backend.

```text
civicai/
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   │
│   │   ├── models/
│   │   │   ├── complaint.py
│   │   │   ├── authority.py
│   │   │   └── status_history.py
│   │   │
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── complaint_service.py
│   │   │   ├── email_service.py
│   │   │   ├── escalation_service.py
│   │   │   └── sla_service.py
│   │   │
│   │   ├── api/
│   │   ├── main.py
│   │   └── seed.py
│   │
│   ├── alembic/
│   ├── requirements.txt
│   └── .env
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   └── ...
│
├── package.json
└── README.md
```

---

## 🚀 Quickstart

### Prerequisites

Make sure the following are installed:

- Node.js 18+
- Python 3.10+
- Git
- An API key for the configured multimodal AI provider
- SMTP credentials if automatic email escalation is being tested

### 1. Backend Setup

Navigate to the backend:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/macOS
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

#### Configure Environment Variables

Create:

```
backend/.env
```

Example:

```env
DATABASE_URL=sqlite:///./civicai.db

LLM_API_KEY=your_ai_api_key_here
LLM_MODEL=your_configured_multimodal_model

API_V1_STR=/api
ENVIRONMENT=development

CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Optional cloud image storage
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# SMTP / Automatic SLA Escalation
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
SMTP_USE_TLS=true
```

#### Security

Never commit the real `.env` file.

Add it to `.gitignore`:

```
.env
*.env
```

For Gmail SMTP, use a Gmail App Password rather than your normal Gmail account password.

### 2. Database Setup

Run Alembic migrations:

```bash
alembic upgrade head
```

The database schema includes:

- Authorities
- Complaints
- Status history
- SLA deadlines
- Escalation timestamps
- Escalation counts

### 3. Seed Initial Data

If the project seed script is available:

```bash
python app/seed.py
```

This can be used to populate initial authority/demo data.

### 4. Start the Backend

For local development:

```bash
uvicorn app.main:app --reload --port 8000
```

Backend:

```
http://localhost:8000
```

Swagger documentation:

```
http://localhost:8000/docs
```

Health check:

```
http://localhost:8000/api/health
```

### 5. Start the Frontend

Open another terminal and return to the project root:

```bash
cd ..
```

Install dependencies:

```bash
npm install
```

Start Vite:

```bash
npm run dev
```

Frontend:

```
http://localhost:5173
```

---

## 📡 Core API Endpoints

The API is exposed under the `/api` prefix.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/analyze` | Analyze submitted visual evidence using the AI pipeline |
| POST | `/api/complaints` | Create a civic complaint and generate a public ticket ID |
| GET | `/api/complaints` | Retrieve complaints with available filtering/query parameters |
| GET | `/api/complaints/{id}` | Retrieve a complaint and its status information |
| PATCH | `/api/complaints/{id}/status` | Update the complaint status |
| GET | `/api/authorities` | Retrieve configured municipal authorities |
| GET | `/api/health` | Backend health check |

Example complaint ticket:

```
CIV-2026-95782
```

---

## 📧 Automatic Email Escalation

The SLA system runs automatically in the backend.

The application starts a background scheduler during FastAPI startup:

```text
FastAPI starts
     ↓
SLA scheduler starts
     ↓
Checks overdue complaints
     ↓
Runs periodically
```

The scheduler checks for complaints where:

```
current_time > sla_deadline
AND
status != RESOLVED
```

If an eligible complaint is found, CivicAI sends an email to the assigned authority.

Example escalation information:

```
CivicAI SLA Escalation

Complaint ID: CIV-2026-95782
Issue: damaged_electrical
Severity: high
Location: Kartavya Path, Raisina Hill, New Delhi

SLA Deadline:
September 27, 2026

Current Status:
SUBMITTED

The complaint has exceeded its configured resolution SLA.
```

The system records:

- `last_escalation_at`
- `escalation_count`

to prevent uncontrolled repeated emails.

---

## 🧪 Testing

### Backend syntax check

```bash
python -m py_compile app/main.py
```

### Database migrations

```bash
alembic upgrade head
```

### Health check

Open:

```
http://localhost:8000/api/health
```

### Swagger

Open:

```
http://localhost:8000/docs
```

### SLA testing

For development/testing, an existing complaint's SLA deadline can be temporarily moved into the past to verify the escalation workflow.

The expected flow is:

```text
Overdue Complaint
      ↓
SLA Scheduler
      ↓
Escalation Service
      ↓
SMTP
      ↓
Authority Email
      ↓
Escalation Count Updated
```

> Do not use artificially modified deadlines in production data.

---

## 🔐 Security & Privacy

CivicAI follows several basic security practices:

- API keys are loaded through environment variables.
- SMTP credentials are loaded through environment variables.
- Secrets should never be committed to Git.
- Uploaded files are validated before processing.
- Complaint data is stored through SQLAlchemy models.
- Status transitions are recorded in complaint history.
- Authority routing is handled by backend logic rather than allowing arbitrary client-side routing.
- Email escalation is controlled by backend SLA logic.
- CORS origins are configurable through environment variables.

### Never commit secrets

Do not commit:

- `.env`
- API keys
- Gmail App Passwords
- Cloudinary secrets

If a secret is accidentally exposed, revoke/rotate it immediately.

---

## 🌐 Deployment

CivicAI can be deployed with the frontend and backend as separate services.

Recommended architecture:

```text
                  Internet
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
      Vercel                 Render
     Frontend                Backend
          │                     │
          │                     ├── FastAPI
          │                     ├── SQLite
          │                     ├── CV / AI
          │                     ├── SMTP
          │                     └── SLA Scheduler
          │
          └────────── API ──────┘
```

### Frontend

Build the React application:

```bash
npm run build
```

The production frontend can be deployed to a Vite-compatible hosting provider such as Vercel.

### Backend

Production-style FastAPI command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Do not use `--reload` in production.

### Production Environment Variables

The deployment environment should provide the same required configuration as `.env`, including:

```env
DATABASE_URL=...
LLM_API_KEY=...
LLM_MODEL=...

CORS_ORIGINS=https://your-frontend-domain.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=...
SMTP_USE_TLS=true
```

For production deployments, use persistent database and file storage infrastructure appropriate for the hosting environment.

---

## 🧩 Design Principles

### 1. AI for interpretation, backend for decisions

AI is used where visual and semantic reasoning is useful.

Operational rules such as:

- Authority routing
- SLA deadlines
- Escalation eligibility
- Complaint status
- Email triggering

are handled by deterministic backend logic.

### 2. Don't force agents where deterministic automation is better

CivicAI uses AI where it provides real value instead of turning every backend function into an "agent."

The SLA escalation workflow, for example, is intentionally deterministic:

```text
SLA expired
      +
Complaint unresolved
      ↓
Automatic escalation
```

This makes the system predictable and auditable.

### 3. Accountability beyond complaint registration

The platform is designed around the complete lifecycle:

```text
Report
  ↓
Understand
  ↓
Route
  ↓
Track
  ↓
Monitor SLA
  ↓
Escalate if overdue
  ↓
Resolve
```

This shifts the focus from simply creating complaints to helping maintain accountability throughout the resolution process.

---

## 📊 Example End-to-End Flow

### Citizen

A citizen notices damaged electrical infrastructure.

1. Opens CivicAI
2. Captures/uploads photo
3. Grants location access
4. CV model analyzes the image
5. Multimodal AI interprets the issue
6. Severity and safety risk are determined
7. Complaint is generated
8. Authority is selected
9. Ticket is created

Example:

```
Complaint ID: CIV-2026-95782
Issue: damaged_electrical
Category: electrical
Severity: High
Safety Risk: Yes
Authority: Electrical Department
```

### Authority

The authority sees the complaint in its dashboard:

```
SLA: On Track
24.6 hours remaining
```

The authority updates the status as work progresses:

```text
SUBMITTED
     ↓
ASSIGNED
     ↓
IN_PROGRESS
     ↓
RESOLVED
```

### If the SLA expires

If the complaint remains unresolved after its deadline:

```text
SLA Deadline Passed
       ↓
Scheduler Detects Overdue Complaint
       ↓
Automatic Email
       ↓
Authority Receives Escalation
       ↓
Escalation Recorded
```

---

## 🏆 Hackathon Context

CivicAI was built for the HackIndia 2026 AI & Web3 Builders Hackathon by team CodeNova.

The project focuses on applying AI and automation to a practical civic infrastructure problem:

> How can citizens report municipal issues easily while ensuring that complaints remain visible, trackable, and accountable until resolution?

CivicAI addresses this through a combination of:

- Computer Vision
- Multimodal AI
- Automated complaint generation
- Geographic context
- Deterministic authority routing
- SLA monitoring
- Automated email escalation
- Municipal authority dashboards


---

## 📄 License


Refer to the repository for the applicable project license and usage terms.
