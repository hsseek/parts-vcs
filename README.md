# PartVCS

A version control reference system for mechanical parts. Pulls CalVer-named
versions from Onshape, lets you approve releases with one click, and gives
field staff a clean mobile-friendly view to compare part versions by image.

---

## Stack

| Layer    | Tech                        |
|----------|-----------------------------|
| Backend  | Python + FastAPI             |
| Database | SQLite (file: `partsvcs.db`) |
| Frontend | React + Vite                 |
| Images   | Fetched from Onshape API, cached locally |

---

## Setup

### 1. Clone / copy the project

```bash
git clone https://github.com/hsseek/parts-vcs.git
cd parts-vcs
```

### 2. Install backend dependencies

```bash
cd backend
pip3 install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```
# Onshape API keys — Onshape → Account Settings → API Keys → Create New API Key
ONSHAPE_ACCESS_KEY=...
ONSHAPE_SECRET_KEY=...

# Admin login
ADMIN_PASSPHRASE=your_passphrase
ADMIN_SESSION_SECRET=some_long_random_string

# Email notifications for Onshape access requests (optional)
ADMIN_EMAIL=admin@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### 5. Run (development)

```bash
./dev.sh
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

### 6. Run (production)

```bash
./start.sh
```

Builds the frontend and serves everything from port 8000.
Point a reverse proxy (nginx, Caddy) at port 8000 for HTTPS.

---

## Your workflow

### Adding a part

1. Go to **Admin** (enter your passphrase) → **+ Add Part**
2. Paste an Onshape document URL — the app discovers all parts in the document automatically
3. Select the parts you want to track and click **Import Selected**

### Detecting new versions

After naming a version like `26.05.0` in Onshape:

1. Go to **Admin → [Part name]**
2. Click **↺ Sync from Onshape**
3. New CalVer versions appear in the **Pending Approval** list

> You can also sync all parts at once from the Admin home page.

### Releasing a version

1. In the Pending list, click **✓ Mark Released**
2. The Onshape document thumbnail is fetched in the background (takes ~10–30 seconds)
3. Optionally add release notes inline
4. Upload additional images by dragging a file, clicking **+ Add image**, or pressing **Ctrl+V** to paste from clipboard

The version is now visible to field staff.

### Staff view

Field staff open the app URL on their phone, pick a part, and see:

- The **current approved version** prominently at the top with its image
- Full **version history** below for comparison
- Navigate images with **arrow keys**, **h / l**, or by clicking the left/right edges of the image
- A **Request permission** link on each version to ask the document owner for Onshape access — no login required

---

## Admin authentication

The admin area is protected by a passphrase set in `.env` as `ADMIN_PASSPHRASE`. Navigate to `/admin` and enter the passphrase to access it. Sessions are signed with `ADMIN_SESSION_SECRET` — rotate this value to invalidate all active sessions.

---

## Version naming

The system auto-detects versions matching this pattern: `^\d{2}\.\d{2}(\.\d+)?$`

Examples of detected names: `26.05`, `26.05.0`, `26.05.1`, `25.11`  
Examples of ignored names: `Add clearance`, `Decrease spring force`, `v2`, `Draft`

---

## Deployment options

**Railway / Render (recommended for simplicity)**
- Push to GitHub
- Connect to Railway or Render
- Set environment variables in their dashboard
- They handle HTTPS automatically

**VPS (e.g. DigitalOcean, Hetzner)**
```bash
# Install deps, run start.sh, proxy with nginx/Caddy for HTTPS
```

**Data persistence**
- The SQLite file (`backend/partsvcs.db`) and images (`backend/static/images/`)
  must be on persistent storage if using Docker or cloud platforms.

---

## Project structure

```
parts-vcs/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── database.py          # SQLite setup
│   ├── onshape_client.py    # Onshape API (HMAC auth, thumbnails, part discovery)
│   ├── auth.py              # Passphrase-based session auth
│   ├── routers/
│   │   ├── parts.py         # CRUD for parts
│   │   ├── versions.py      # Version queries
│   │   ├── admin.py         # Release / unrelease, image management
│   │   ├── onshape_sync.py  # CalVer detection, document discovery, image fetching
│   │   ├── auth_router.py   # Login / logout endpoints
│   │   └── request_access.py# Onshape access request email
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── StaffHome.jsx   # Part list (field staff)
│       │   ├── PartView.jsx    # Version comparison (field staff)
│       │   ├── AdminHome.jsx   # Admin part list + Onshape API status
│       │   └── AdminPart.jsx   # Admin version management
│       └── api/client.js       # API wrapper
├── dev.sh      # Start both servers for development
└── start.sh    # Build + serve for production
```
