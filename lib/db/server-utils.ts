import 'server-only';
import { generateId } from 'ai';
import { genSaltSync, hashSync } from 'bcrypt-ts';

export function generateHashedPassword(password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  return hash;
}

export function generateDummyPassword() {
  const password = generateId(12);
  const hashedPassword = generateHashedPassword(password);

  return hashedPassword;
}
