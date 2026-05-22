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
cd partsvcs
```

### 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Configure Onshape API credentials

Get your API keys from: **Onshape → Account Settings → API Keys → Create New API Key**

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your keys:
#   ONSHAPE_ACCESS_KEY=...
#   ONSHAPE_SECRET_KEY=...
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

1. Go to **Admin** tab → **+ Add Part**
2. Fill in the part name and the Onshape IDs from the document URL:
   ```
   https://cad.onshape.com/documents/<DOCUMENT_ID>/w/.../e/<ELEMENT_ID>
   ```
3. Choose element type: **Part Studio** or **Assembly**
4. Click **Add Part**

### Detecting new versions

After naming a version like `26.05.0` in Onshape:

1. Go to **Admin → [Part name]**
2. Click **↺ Sync from Onshape**
3. New CalVer versions appear in the **Pending Approval** list

> You can also sync all parts at once from the Admin home page.

### Releasing a version

1. In the Pending list, click **✓ Mark Released**
2. Images are fetched from Onshape in the background (takes ~10–30 seconds)
3. Optionally add release notes (click the note area to edit inline)

The version is now visible to field staff.

### Staff view

Field staff open the app URL on their phone, pick a part, and see:
- The **current approved version** prominently at top with 4 views
  (isometric, front, right, top)
- Full **version history** below for comparison
- No login required

---

## Version naming

The system auto-detects versions matching this regex: `^\d{2}\.\d{2}(\.\d+)?$`

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
partsvcs/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── database.py          # SQLite setup
│   ├── onshape_client.py    # Onshape API (thumbnails, shaded views)
│   ├── routers/
│   │   ├── parts.py         # CRUD for parts
│   │   ├── versions.py      # Version queries
│   │   ├── admin.py         # Release / unrelease
│   │   └── onshape_sync.py  # CalVer detection + image fetching
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── StaffHome.jsx   # Part list (field staff)
│       │   ├── PartView.jsx    # Version comparison (field staff)
│       │   ├── AdminHome.jsx   # Admin part list
│       │   └── AdminPart.jsx   # Admin version management
│       └── api/client.js       # API wrapper
├── dev.sh      # Start both servers for development
└── start.sh    # Build + serve for production
```
