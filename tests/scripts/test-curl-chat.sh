#!/bin/bash

echo "🧪 Testing Chat API with selectedSources parameter..."

curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, test message"}
    ],
    "selectedSources": ["neon", "openai"]
  }' \
  --max-time 10 \
  --silent \
  --show-error \
  | head -200