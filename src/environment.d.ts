declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PAYLOAD_SECRET: string
      DATABASE_URI: string
      NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: string
      NEXT_PUBLIC_SERVER_URL: string
      VERCEL_PROJECT_PRODUCTION_URL: string
      // Deployment environment, set per Coolify resource. Only "production"
      // is search-indexable; all other values (preview/staging/unset) are
      // served with an X-Robots-Tag: noindex header from src/proxy.ts.
      BUILD_ENV?: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
