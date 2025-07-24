// Client-safe environment checks using process.env directly
export const isProductionEnvironment = process.env.NODE_ENV === 'production';
export const isDevelopmentEnvironment = process.env.NODE_ENV === 'development';
export const isTestEnvironment =
  process.env.NODE_ENV === 'test' || !!process.env.PLAYWRIGHT_TEST_BASE_URL;

export const guestRegex = /^guest-\d+$/;

// Dummy password hash (generated server-side, constant for client usage)
export const DUMMY_PASSWORD =
  '$2a$10$placeholder.dummy.password.hash.for.guest.users';
