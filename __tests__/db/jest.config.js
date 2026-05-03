/**
 * Minimal Jest config for DB-layer tests.
 *
 * DB tests are pure TypeScript logic — no React Native rendering needed.
 * This config avoids the jest-expo preset which triggers the Expo Winter
 * runtime (incompatible with Jest's CJS environment).
 *
 * expo-sqlite is mocked directly in each test file via jest.mock().
 */
module.exports = {
  rootDir: '../../',
  testMatch: ['<rootDir>/__tests__/db/**/*.test.ts'],

  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      {
        configFile: false,
        presets: ['@babel/preset-typescript'],
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
  },

  transformIgnorePatterns: [
    // Transform react-native and its ecosystem (needed for jest-native if used)
    '/node_modules/(?!(react-native|@react-native|@react-native-community)/)',
  ],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // No React Native test environment — pure Node for logic-only DB tests
  testEnvironment: 'node',

  // Reset require cache between tests so each test gets fresh module state.
  // Required because database connection modules use module-level singleton
  // variables that would otherwise persist across tests.
  resetModules: true,

  displayName: 'DB',
};
