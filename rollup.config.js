import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import strip from "rollup-plugin-strip";
import uglify from "rollup-plugin-uglify";

import pkg from "./package.json";

export default {
  input: "src/index.ts",
  output: [
    {
      file: pkg.main,
      format: "umd",
      exports: "named",
      sourcemap: true,
      name: "Charisma"
    },
    { file: pkg.module, format: "es", exports: "named", sourcemap: true }
  ],
  plugins: [
    resolve({
      browser: true
    }),
    commonjs(),
    typescript({
      typescript: require("typescript")
    }),
    strip({
      functions: ["debug"]
    }),
    uglify()
  ],
  onwarn(warning, onwarn) {
    if (warning.code === "THIS_IS_UNDEFINED") {
      return;
    }

    onwarn(warning);
  }
};
