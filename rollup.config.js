import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import strip from "rollup-plugin-strip";
import minify from "rollup-plugin-babel-minify";

import pkg from "./package.json";

const input = "./compiled/index.js";

export default [
  {
    input,
    output: {
      exports: "named",
      file: pkg.browser,
      format: "umd",
      name: "CharismaSDK",
      sourcemap: true
    },
    plugins: [
      resolve({
        browser: true
      }),
      commonjs({
        include: /node_modules/
      }),
      strip({
        functions: ["debug"]
      }),
      minify({
        comments: false
      })
    ]
  },
  {
    input,
    external: Object.keys(pkg.dependencies),
    output: [
      {
        exports: "named",
        file: pkg.module,
        format: "es",
        sourcemap: true
      },
      {
        exports: "named",
        file: pkg.main,
        format: "cjs",
        sourcemap: true
      }
    ],
    plugins: [resolve()]
  }
];
