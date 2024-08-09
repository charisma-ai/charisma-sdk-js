export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testMatch: ["**/?(*.)+(spec|test).[tj]s?(x)"],
  moduleFileExtensions: ["ts", "js", "json", "node"],
  globals: {
    "ts-test": {
      isolatedModules: true,
      tsconfig: "tsconfig.json",
    },
  },
};
