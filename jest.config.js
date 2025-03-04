export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testMatch: ["**/?(*.)+(spec|test).[tj]s?(x)"],
  moduleFileExtensions: ["ts", "js", "json", "node"],
  moduleNameMapper: {
    "^(.*)\\.js$": "$1",
  },
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  globals: {
    "ts-jest": {
      isolatedModules: true,
      tsconfig: "tsconfig.json",
    },
  },
};
