import '@testing-library/jest-native/extend-expect';

// Mock expo-sqlite for tests
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  SQLiteProvider: ({ children }: { children: React.ReactNode }) => children,
  useSQLiteContext: jest.fn(),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Stack: {
    Screen: () => null,
  },
  Tabs: ({ children }: { children: React.ReactNode }) => children,
}));
