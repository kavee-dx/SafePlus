/** @type {import("jest").Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  clearMocks: true,
  collectCoverageFrom: ["src/services/kaveesha-shelterApi.ts"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: { lines: 80, functions: 80, branches: 80, statements: 80 },
  },
};
