#!/usr/bin/env node

/**
 * Get OpenAI Vector Store Files
 * Retrieve all files and their details from the vector store
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env.local") });

const VECTOR_STORE_ID = process.env.OPENAI_VECTORSTORE;
const API_KEY = process.env.OPENAI_API_KEY;

async function getVectorStoreFiles() {
  if (!(API_KEY && VECTOR_STORE_ID)) {
    console.log("❌ Missing API key or vector store ID");
    return;
  }

  console.log(`📄 Getting files from vector store: ${VECTOR_STORE_ID}`);

  try {
    // Get files in vector store
    const filesResponse = await fetch(
      `https://api.openai.com/v1/vector_stores/${VECTOR_STORE_ID}/files`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
      },
    );

    if (filesResponse.ok) {
      const filesData = await filesResponse.json();
      console.log(`✅ Found ${filesData.data.length} files in vector store:`);

      for (const file of filesData.data) {
        console.log(`\n📄 File: ${file.id}`);
        console.log(`   Status: ${file.status}`);
        console.log(
          `   Created: ${new Date(file.created_at * 1000).toISOString()}`,
        );
        console.log(`   Vector Store ID: ${file.vector_store_id}`);

        if (file.last_error) {
          console.log(`   ❌ Error: ${file.last_error.message}`);
        }

        // Get file details
        try {
          const fileResponse = await fetch(
            `https://api.openai.com/v1/files/${file.id}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (fileResponse.ok) {
            const fileDetails = await fileResponse.json();
            console.log(`   📝 Filename: ${fileDetails.filename}`);
            console.log(
              `   📊 Size: ${Math.round(fileDetails.bytes / 1024)} KB`,
            );
            console.log(`   🎯 Purpose: ${fileDetails.purpose}`);
          }
        } catch (error) {
          console.log(`   ⚠️ Could not get file details: ${error.message}`);
        }
      }
    } else {
      const error = await filesResponse.text();
      console.log(
        `❌ Failed to get files: ${filesResponse.status} ${filesResponse.statusText}`,
      );
      console.log(error);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

getVectorStoreFiles().catch(console.error);
