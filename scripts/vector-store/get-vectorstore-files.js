#!/usr/bin/env node

/**
 * Get OpenAI Vector Store Files
 * Retrieve all files and their details from the vector store
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const VECTOR_STORE_ID = process.env.OPENAI_VECTORSTORE;
const API_KEY = process.env.OPENAI_API_KEY;

async function getVectorStoreFiles() {
  if (!(API_KEY && VECTOR_STORE_ID)) {
    return;
  }

  try {
    // Get files in vector store
    const filesResponse = await fetch(
      `https://api.openai.com/v1/vector_stores/${VECTOR_STORE_ID}/files`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
      },
    );

    if (filesResponse.ok) {
      const filesData = await filesResponse.json();

      for (const file of filesData.data) {
        if (file.last_error) {
        }

        // Get file details
        try {
          const fileResponse = await fetch(
            `https://api.openai.com/v1/files/${file.id}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (fileResponse.ok) {
            const _fileDetails = await fileResponse.json();
          }
        } catch (_error) {}
      }
    } else {
      const _error = await filesResponse.text();
    }
  } catch (_error) {}
}

getVectorStoreFiles().catch(console.error);
