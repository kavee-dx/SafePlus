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
  collectCoverageFrom: [
    "validators/kaveesha-dispatchValidators.ts",
    "models/kaveesha-rescueDispatch.ts",
    "middlewares/kaveesha-requireTeamLeader.ts",
    "middlewares/kaveesha-requireDistrictBoard.ts",
    "middlewares/kaveesha-requireRescueOrganization.ts",
    "middlewares/kaveesha-requireShelterManager.ts",
    "services/kaveesha-dispatchEvents.ts",
  ],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: { lines: 80, functions: 80, branches: 80, statements: 80 },
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      { diagnostics: false, isolatedModules: true, tsconfig: false },
    ],
  },
};
