# Deploy to Render in 5 Minutes

## Quick Deploy Steps

### 1. Push Code to GitHub

```bash
cd c:\Users\Neko\Desktop\pharmecomd\pharmecom\vaccine-orders-pro

git init
git remote add origin https://github.com/YOUR_USERNAME/vaccine-orders-pro.git
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

### 2. Deploy on Render

1. **Go to** https://dashboard.render.com
2. **Click** "New +" → "Web Service"
3. **Connect** your GitHub repository
4. **For Backend Service**:
   - Name: `vaccine-orders-backend`
   - Runtime: Python 3.8
   - Build: `cd backend && pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput`
   - Start: `cd backend && gunicorn core.wsgi:application --bind 0.0.0.0:$PORT`
   - Click "Create"

5. **For Frontend Service**:
   - Click "New +" → "Web Service" again
   - Same repo, same branch
   - Name: `vaccine-orders-frontend`
   - Runtime: Node 18
   - Build: `npm install && npm run build`
   - Start: `npm run preview -- --host`
   - Click "Create"

6. **Create PostgreSQL Database**:
   - Click "New +" → "PostgreSQL"
   - Name: `vaccine-orders-db`
   - Instance: Free
   - Click "Create"
   - Copy the connection URL

7. **Add Database to Backend**:
   - Go to Backend service settings
   - Add environment variable `DATABASE_URL` = (paste PostgreSQL URL)
   - Save and Render will redeploy

### 3. Done! ✅

Your app is now live:
- **Frontend**: https://vaccine-orders-frontend.onrender.com
- **API**: https://vaccine-orders-backend.onrender.com/api/

## Environment Variables (Auto-configured)

| Service | Variable | Value |
|---------|----------|-------|
| Backend | `DEBUG` | `False` |
| Backend | `SECRET_KEY` | Auto-generated |
| Backend | `DATABASE_URL` | PostgreSQL URL |
| Frontend | `VITE_API_URL` | Backend URL + `/api` |

## Updates

Just push to GitHub - Render redeploys automatically!

```bash
git add .
git commit -m "Your changes"
git push origin main
```

## Troubleshooting

**Service won't start?**
- Check Render logs (click service → Logs)
- Ensure requirements.txt has all packages

**API calls failing?**
- Check backend `CORS_ALLOWED_ORIGINS` includes frontend URL
- Verify `VITE_API_URL` in frontend matches backend

**Database errors?**
- Ensure PostgreSQL service is running
- Check `DATABASE_URL` is set correctly
- Run migrations: Go to service Shell → `python manage.py migrate`

---

See detailed guide: [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)
