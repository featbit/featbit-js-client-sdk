import { hashSerializeUser } from "../../src/utils/serializeUser";

describe('hashSerializeUser', () => {
  it('returns the SHA-256 hash synchronously', () => {
    const hash = hashSerializeUser({
      keyId: 'user-key',
      name: 'Jane',
      customizedProperties: [
        {name: 'plan', value: 'pro'},
        {name: 'age', value: '42'},
      ],
    });

    expect(typeof hash).toBe('string');
    expect(hash).toBe('2b09b5c00fc1325ea88282641bc96b3c1e5dd70add30dc6908d14ecf06da08a6');
  });

  it('returns an empty string for an undefined user', () => {
    expect(hashSerializeUser(undefined)).toBe('');
  });
});
