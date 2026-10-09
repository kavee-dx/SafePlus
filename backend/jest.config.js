/**
 * Jest runs straight from the TypeScript sources; the shared Postgres pool is
 * swapped for a spy so no test can reach the team database.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  setupFilesAfterEnv: ["<rootDir>/tests/setupEnv.ts"],
  moduleNameMapper: {
    "^\\.\\./config/db$": "<rootDir>/tests/__mocks__/db.ts",
    "^\\./db$": "<rootDir>/tests/__mocks__/db.ts",
  },
  clearMocks: true,
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      { diagnostics: false, isolatedModules: true, tsconfig: false },
    ],
  },
};
