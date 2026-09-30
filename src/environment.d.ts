declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PAYLOAD_SECRET: string
      DATABASE_URI: string
      NEXT_PUBLIC_SERVER_URL: string
      /** Read at runtime; wins over NEXT_PUBLIC_SERVER_URL, which is compiled in. */
      SERVER_URL?: string
      /** Read at render time; unset, no analytics tag is rendered. */
      GOOGLE_ANALYTICS_ID?: string
      /** Read at runtime; wins over NEXT_PUBLIC_TURNSTILE_SITE_KEY. */
      TURNSTILE_SITE_KEY?: string
      VERCEL_PROJECT_PRODUCTION_URL: string
      BUILD_ENV?: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
