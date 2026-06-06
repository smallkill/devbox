// ESLint 9 flat config — TypeScript across api/ and watchdog/ workspaces.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.wrangler/**", "site/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        // Cloudflare Workers / Web runtime globals
        crypto: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        URL: "readonly",
      },
    },
  },
);
