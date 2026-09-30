declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PAYLOAD_SECRET: string
      DATABASE_URI: string
      /** The site's origin, no trailing slash. Read at runtime. */
      SERVER_URL?: string
      /** Read at render time; unset, no analytics tag is rendered. */
      GOOGLE_ANALYTICS_ID?: string
      /** Read at runtime; unset, the newsletter form renders without the widget. */
      TURNSTILE_SITE_KEY?: string
      VERCEL_PROJECT_PRODUCTION_URL: string
      BUILD_ENV?: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
