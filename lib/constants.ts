import { generateDummyPassword } from './db/utils';

// Client-safe environment checks using process.env directly
export const isProductionEnvironment = process.env.NODE_ENV === 'production';
export const isDevelopmentEnvironment = process.env.NODE_ENV === 'development';
export const isTestEnvironment =
  process.env.NODE_ENV === 'test' || !!process.env.PLAYWRIGHT_TEST_BASE_URL;

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();
