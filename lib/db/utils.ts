import { generateId } from 'ai';

// Client-safe utility functions
export function generateTempId() {
  return generateId(12);
}

// Note: For password hashing, use server-utils.ts functions
