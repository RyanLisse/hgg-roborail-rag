#!/usr/bin/env node

/**
 * Test Chat API with selectedSources parameter
 */

import fetch from 'node-fetch';

const CHAT_API_URL = 'http://localhost:3000/api/chat';

async function testChatAPI() {
  console.log('🧪 Testing Chat API with selectedSources...');

  const testPayload = {
    messages: [
      { role: 'user', content: 'Hello, can you help me with data analysis?' },
    ],
    selectedSources: ['neon', 'openai'],
  };

  try {
    console.log(
      '📤 Sending request with payload:',
      JSON.stringify(testPayload, null, 2),
    );

    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', response.headers.raw());

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Chat API Error:', response.status, errorText);
      return;
    }

    // For streaming responses, we need to handle the stream
    if (response.headers.get('content-type')?.includes('text/plain')) {
      console.log('✅ Received streaming response');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            console.log(
              '📄 Stream chunk:',
              line.substring(0, 100) + (line.length > 100 ? '...' : ''),
            );
          }
        }
      }
    } else {
      const data = await response.json();
      console.log('✅ Chat API Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testChatAPI();
