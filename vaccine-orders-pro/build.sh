#!/bin/bash
set -e

# Build the React frontend first
echo "Building React frontend..."
npm install
npm run build
echo "Frontend built successfully"

# Move frontend dist to backend static directory
echo "Copying frontend to backend staticfiles..."
rm -rf backend/staticfiles
mkdir -p backend/staticfiles
cp -r dist/* backend/staticfiles/

# Setup Django backend
echo "Setting up Django backend..."
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

echo "Build completed successfully!"
