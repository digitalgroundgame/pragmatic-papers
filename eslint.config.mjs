import eslintConfigNext from "eslint-config-next/core-web-vitals"
import eslintConfigNextTypescript from "eslint-config-next/typescript"
import eslintConfigPrettier from "eslint-config-prettier"
import pluginReact from "eslint-plugin-react"
import globals from "globals"

const eslintConfig = [
  ...eslintConfigNext,
  ...eslintConfigNextTypescript,
  {
    plugins: { react: pluginReact },
    settings: { react: { version: "detect" } },
    rules: {
      // Allow console.warn and console.error until we set up something like sentry
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": ["warn"],
      "no-alert": ["warn"],
      "no-unused-vars": "off", // Turn off base rule as it can report incorrect errors
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error"],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-empty-function": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/no-use-before-define": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/prefer-ts-expect-error": "error",
      "prefer-const": ["error"],
      "react/jsx-boolean-value": ["error", "never"],
      "react/jsx-curly-brace-presence": ["error", { props: "never", children: "ignore" }],
      "react/no-danger": "warn",
      "react/prefer-es6-class": "error",
      "react/prefer-stateless-function": "warn",
      "react/self-closing-comp": "error",
      "react/sort-comp": [
        "error",
        {
          order: ["static-methods", "lifecycle", "everything-else", "render"],
          groups: {
            lifecycle: [
              "displayName",
              "propTypes",
              "contextTypes",
              "childContextTypes",
              "mixins",
              "statics",
              "defaultProps",
              "constructor",
              "getDefaultProps",
              "state",
              "getInitialState",
              "getChildContext",
              "getDerivedStateFromProps",
              "componentWillMount",
              "UNSAFE_componentWillMount",
              "componentDidMount",
              "componentWillReceiveProps",
              "UNSAFE_componentWillReceiveProps",
              "shouldComponentUpdate",
              "componentWillUpdate",
              "UNSAFE_componentWillUpdate",
              "getSnapshotBeforeUpdate",
              "componentDidUpdate",
              "componentDidCatch",
              "componentWillUnmount",
            ],
          },
        },
      ],
      // Intentionally using <a> instead of next/link to avoid RSC Vary headers
      // that prevent Cloudflare free-tier from caching page responses.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  // Add Node.js globals for config files (e.g. next-sitemap.config.cjs uses process.env and module.exports)
  {
    files: ["**/*.config.js", "**/*.config.cjs", "**/*.config.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".next/**",
      "out/**",
      "**/next-env.d.ts",
      "src/migrations/**",
      "src/payload-types.ts",
    ],
  },
  eslintConfigPrettier,
]

export default eslintConfig
