module.exports = {
  root: true,
  env: {
    es6: true,
    node: true
  },
  extends: ["plugin:prettier/recommended", "eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2017
  },
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "error" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off"
  }
};
