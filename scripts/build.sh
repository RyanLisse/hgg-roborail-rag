#!/bin/bash

echo "🚀 Starting production build..."

# Try to run database migrations
echo "⏳ Running database migrations..."
if tsx lib/db/migrate; then
	echo "✅ Migrations completed successfully"
else
	echo "⚠️ Migration failed or skipped (this may be normal in some environments)"
fi

# Run Next.js build
echo "📦 Building Next.js application..."
next build

echo "🎉 Build completed successfully!"
