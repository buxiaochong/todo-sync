import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initDb, resetDb } from '../src/db.js';
import { registerDevice, refreshToken, revokeToken } from '../src/auth.js';

beforeAll(async () => {
  await initDb();
});

describe('Device registration', () => {
  beforeEach(() => resetDb());

  it('should register a macOS device', () => {
    const device = registerDevice('macos');
    expect(device.id).toBeDefined();
    expect(device.token).toBeDefined();
    expect(device.expiresAt).toBeDefined();
  });

  it('should register a harmony device', () => {
    const device = registerDevice('harmony');
    expect(device.id).toBeDefined();
    expect(device.token).toBeDefined();
  });

  it('should generate unique tokens for different devices', () => {
    const d1 = registerDevice('macos');
    const d2 = registerDevice('macos');
    expect(d1.token).not.toBe(d2.token);
  });
});

describe('Token refresh', () => {
  beforeEach(() => resetDb());

  it('should refresh token for existing device', () => {
    const device = registerDevice('macos');
    const result = refreshToken(device.id);
    expect(result).not.toBeNull();
    expect(result.token).toBeDefined();
    expect(result.token).not.toBe(device.token);
  });

  it('should return null for non-existent device', () => {
    const result = refreshToken('non-existent');
    expect(result).toBeNull();
  });
});

describe('Token revocation', () => {
  beforeEach(() => resetDb());

  it('should revoke token for existing device', () => {
    const device = registerDevice('macos');
    const result = revokeToken(device.id);
    expect(result).toBe(true);
  });

  it('should return false for non-existent device', () => {
    const result = revokeToken('non-existent');
    expect(result).toBe(false);
  });
});
