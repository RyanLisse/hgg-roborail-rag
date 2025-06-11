import { generateDummyPassword } from './db/utils';
import { isProduction, isDevelopment, testConfig } from './env';

export const isProductionEnvironment = isProduction;
export const isDevelopmentEnvironment = isDevelopment;
export const isTestEnvironment = testConfig.isPlaywrightTest;

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();
