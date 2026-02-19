# Render Deployment Checklist - Fixed Infinite Load Issue

## Problem
The app at https://renderphamecom.onrender.com/ was loading infinitely. Root causes identified:
1. Frontend build was not included in deployment (static files missing)
2. API base URL for production not properly configured
3. vite build output not directed to Django's static files directory

## Solution Implemented

### 1. Frontend Build Configuration
- **File:** `vite.config.ts`
- **Change:** Updated `build.outDir` to output directly to `backend/staticfiles`
  - This is Django's `STATIC_ROOT` directory
  - Whitenoise will serve these files in production
  
### 2. Template Engine & API URL
- **File:** `vite.config.ts`
- **Change:** API_URL defaults to `/api` in production (relative URL)
  - This allows API calls to work on the same domain
  - Works for https://renderphamecom.onrender.com/ → calls /api/...

### 3. Build Process
- **File:** `render.yaml`
- **Change:** Build command now includes frontend build
  ```
  npm install -g bun && bun install && bun run build && ...
  ```
  - Bun (package manager) installed globally
  - Frontend built to `backend/staticfiles/`
  - Then Python dependencies installed
  - Then Django migrations and collectstatic run

### 4. Static File Configuration
- **File:** `backend/core/settings.py`
- **Config:**
  - `STATIC_URL = "/static/"`
  - `STATIC_ROOT = BASE_DIR / "staticfiles"`
  - Whitenoise enabled for production
  - Files in STATIC_ROOT served by Whitenoise + Gunicorn

### 5. Frontend Serving
- **File:** `backend/api/views.py` - FrontendCatchallView
- **Config:** Serves `backend/staticfiles/index.html` for SPA routes
  - Non-API, non-admin routes → React app
  - Enables client-side routing

## Testing Locally

### Build Frontend
```bash
cd vaccine-orders-pro
npm run build
# Outputs to: backend/staticfiles/
```

### Check Frontend Files
```bash
ls backend/staticfiles/
# Should show: index.html, assets/, favicon.ico, robots.txt, etc.
```

### Run Django
```bash
cd backend
python manage.py collectstatic --noinput  # Gathers all static files
python manage.py runserver
```

**Note:** In development, Whitenoise needs to be explicitly enabled or configured to serve from STATIC_ROOT. In production on Render, Whitenoise will serve static files automatically.

## Production Behavior on Render

1. **Build Phase:**
   - Bun installs dependencies
   - Vite builds React app → `backend/staticfiles/`
   - Pip installs Python dependencies
   - Django runs migrations
   - Django collectstatic (gathers admin and library static files)

2. **Runtime Phase:**
   - Gunicorn starts Django app
   - Whitenoise middleware serves static files from `backend/staticfiles/`
   - FrontendCatchallView handles SPA routing
   - API requests routed to Django REST endpoints

3. **URL Routing:**
   - `/` → React app (index.html from FrontendCatchallView)
   - `/static/*` → Served by Whitenoise from STATIC_ROOT
   - `/api/*` → Django REST API views
   - `/admin/` → Django admin (also from STATIC_ROOT)

## Files Changed

- [render.yaml](./render.yaml) - Build command updated
- [vite.config.ts](./vite.config.ts) - Build output and API URL configured
- [backend/core/settings.py](./backend/core/settings.py) - Static files config
- [backend/api/views.py](./backend/api/views.py) - FrontendCatchallView (no change, already correct)

## Deployment Steps

1. Commit changes to git
2. Push to GitHub
3. Render will automatically:
   - Detect changes
   - Run buildCommand (frontend + Python setup)
   - Run startCommand (Gunicorn)
   - App should load without infinite loop

## Troubleshooting

- **App still loading infinitely:**
  - Check Render logs for error messages
  - Verify frontend index.html exists in `backend/staticfiles/`
  - Check API_BASE in vite config

- **Static files (CSS/JS) not loading:**
  - Verify Whitenoise is enabled in MIDDLEWARE
  - Check STATIC_ROOT and STATIC_URL in settings
  - Ensure frontend assets in `backend/staticfiles/assets/`

- **API calls failing:**
  - Verify API_BASE is `/api` (not hardcoded domain)
  - Check backend is running (Django logs via Render dashboard)
  - Verify CORS_ALLOWED_ORIGINS includes Render domain

## Next Steps After Deployment

Once deployed and working:
1. Test cart functionality in production
2. Verify image uploads work (media disk configured)
3. Monitor Render logs for any errors
4. Consider optimizing bundle size (JS chunk is ~1MB uncompressed)
