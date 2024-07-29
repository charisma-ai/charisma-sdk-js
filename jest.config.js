export default {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/?(*.)+(spec|test).[tj]s?(x)"],
  moduleFileExtensions: ["ts", "js", "json", "node"],
  setupFiles: ["./jest.setup.ts"],
  globals: {
    "ts-test": {
      isolatedModules: true,
      tsconfig: "tsconfig.json",
    },
  },
};
