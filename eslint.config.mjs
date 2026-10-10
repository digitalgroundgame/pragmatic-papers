import eslintConfigNext from "eslint-config-next/core-web-vitals"
import eslintConfigNextTypescript from "eslint-config-next/typescript"
import eslintConfigPrettier from "eslint-config-prettier"
import pluginReact from "eslint-plugin-react"
import storybook from "eslint-plugin-storybook"
import globals from "globals"

// The "@payloadcms/ui" root is pre-bundled with its own copy of the admin's React contexts. A
// field imported from the unbundled deep path is a second module instance reading contexts no
// provider filled, so it type-checks and unit-tests clean but throws on first render in the
// admin.
const payloadUiFields = {
  group: ["@payloadcms/ui/fields/*"],
  message: 'Import Payload field components from "@payloadcms/ui" instead.',
}

// What only this app has: its config, its schema, its features. Utilities and our own plugins
// may not import it. An override's options replace the base rule's, so each one repeats
// payloadUiFields.
const appModules = [
  "@payload-config",
  "@/access/*",
  "@/app/*",
  "@/blocks/*",
  "@/collections/*",
  "@/endpoints/*",
  "@/fields/*",
  "@/globals/*",
  "@/hooks/*",
  "@/jobs/*",
]

const eslintConfig = [
  ...eslintConfigNext,
  ...eslintConfigNextTypescript,
  ...storybook.configs["flat/recommended"],
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
      "no-restricted-imports": ["error", { patterns: [payloadUiFields] }],
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
      // Links go through HoverPrefetchLink, which is next/link only in the Cloudflare
      // Worker build: in front of Coolify, Cloudflare's cache can't tell a page's HTML
      // from the RSC payload next/link fetches for the same URL.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  // src/utilities is the library every feature and plugin builds on, so it depends on none of
  // them: no app modules, no components, no request-scoped Next APIs, no Payload reads.
  {
    files: ["src/utilities/*.ts", "src/utilities/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            payloadUiFields,
            {
              group: [
                ...appModules,
                "@/cloudflare/*",
                "@/components/*",
                "@/data/*",
                "@/integrations/*",
                "@/interactives/*",
                "@/plugins/*",
                "next/headers",
              ],
              message:
                "src/utilities can't depend on a feature. Move the helper next to its feature, or pass the value in.",
            },
          ],
        },
      ],
    },
  },
  // Our plugins (src/plugins/<name>/) are shaped to be published one day: what is this app's
  // comes in through the plugin's options, and Payload through `req.payload`.
  {
    files: ["src/plugins/*/**/*.{ts,tsx}"],
    // docs and notifications predate the rule: they import access, blocks, fields and
    // purgeEdgeCache directly. Drop each from this list once it takes those as options.
    ignores: [
      "**/__tests__/**",
      "**/*.stories.tsx",
      "src/plugins/docs/**",
      "src/plugins/notifications/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            payloadUiFields,
            {
              group: [...appModules, "@/data/*"],
              message:
                "A plugin takes what's app-specific as an option, and reads Payload through req.payload. @/utilities is fine.",
            },
          ],
        },
      ],
    },
  },
  // A story's exports are Storybook's input, not an API other modules call.
  {
    files: ["**/*.stories.tsx", ".storybook/**"],
    rules: { "@typescript-eslint/explicit-module-boundary-types": "off" },
  },
  // Add Node.js globals for plain-JS config files, which may read process.env
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
      "coverage/**",
      "storybook-static/**",
      ".claude/worktrees/**",
      "**/next-env.d.ts",
      "src/migrations/**",
      "src/payload-types.ts",
    ],
  },
  eslintConfigPrettier,
]

export default eslintConfig
