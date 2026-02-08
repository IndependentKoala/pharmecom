#!/bin/bash
set -e

# Ensure we're in the vaccine-orders-pro directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Building React frontend..."
echo "Working directory: $(pwd)"

# Clean and reinstall dependencies
rm -rf node_modules package-lock.json

# Install dependencies
npm install

# Build the frontend
echo "Running Vite build..."
npm run build

echo "Frontend built successfully at $(pwd)/dist"

# Move frontend dist to backend static directory
echo "Copying frontend to backend staticfiles..."
rm -rf backend/staticfiles
mkdir -p backend/staticfiles
cp -r dist/* backend/staticfiles/
echo "Frontend copied successfully"

# Setup Django backend
echo "Setting up Django backend..."
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

echo "Build completed successfully!"
