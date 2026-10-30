module.exports = {
  transform: { '^.+\\.ts?$': 'ts-jest' },
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testMatch: ['**/*.test.ts?(x)'],
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'js'],
  collectCoverageFrom: ['src/**/*.ts']
};