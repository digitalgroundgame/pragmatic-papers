import { Articles } from "@/collections/Articles"
import { Categories } from "@/collections/Categories"
import { Media } from "@/collections/Media"
import { Pages } from "@/collections/Pages"
import { Topics } from "@/collections/Topics"
import { Users } from "@/collections/Users"
import { Volumes } from "@/collections/Volumes"
import { Webhooks } from "@/collections/Webhooks"
import { defaultLexical } from "@/fields/defaultLexical"
import { Footer } from "@/Footer/config"
import { ArticleRecommendations } from "@/globals/ArticleRecommendations/config"
import { Header } from "@/Header/config"
import { updateRecommendationsTask } from "@/jobs/updateRecommendations"
import { plugins } from "@/plugins"
import { searchVectorAfterSchemaInit } from "@/plugins/searchVector"
import { getServerSideURL } from "@/utilities/getURL"
import { postgresAdapter } from "@payloadcms/db-postgres"
import path from "path"
import { buildConfig, type PayloadRequest, type SharpDependency } from "payload"
import sharp from "sharp"
import { fileURLToPath } from "url"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  logger: {
    options: {
      level: process.env.PAYLOAD_LOG_LEVEL || "info",
      transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
    },
  },
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeLogin` statement on line 15.
      beforeLogin: ["@/components/BeforeLogin"],
      beforeDashboard: ["@/components/BeforeDashboard"],
      graphics: {
        Icon: "@/components/Logo/icons/PaperIcon#PaperIconAdmin",
        Logo: "@/components/Logo/icons/LogomarkIcon#LogomarkIcon",
      },
      providers: ["@/providers/MathJaxProvider#MathJaxProviderRoot"],
    },
    meta: {
      title: "Dashboard",
      description: "The Pragmatic Papers Admin Dashboard",
      icons: [
        {
          rel: "icon",
          type: "image/png",
          url: "/favicon.svg",
        },
      ],
      titleSuffix: " | The Pragmatic Papers CMS",
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: "Mobile",
          name: "mobile",
          width: 375,
          height: 667,
        },
        {
          label: "Tablet",
          name: "tablet",
          width: 768,
          height: 1024,
        },
        {
          label: "Desktop",
          name: "desktop",
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI,
    },
    // prevent schema push in prod/test for static schema determinism and noise reduction
    push: process.env.NODE_ENV === "development",
    afterSchemaInit: [searchVectorAfterSchemaInit],
  }),
  collections: [Pages, Articles, Volumes, Media, Categories, Users, Webhooks, Topics],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer, ArticleRecommendations],
  plugins: [...plugins],
  secret: process.env.PAYLOAD_SECRET,
  sharp: sharp as unknown as SharpDependency,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  endpoints: [
    {
      path: "/health",
      method: "get",
      handler: async () => {
        return Response.json({
          status: "ok",
          timestamp: new Date().toISOString(),
        })
      },
    },
    {
      path: "/article-recommendations/run",
      method: "post",
      handler: async (req) => {
        if (!req.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 })
        }
        const job = await req.payload.jobs.queue({
          task: "updateRecommendations",
          input: {},
        })
        const result = await req.payload.jobs.run({ queue: "default", limit: 1 })
        return Response.json({ jobId: job.id, result })
      },
    },
  ],
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get("authorization")
        return authHeader === `Bearer ${process.env.CRON_SECRET}`
      },
    },
    autoRun: [{ cron: "*/5 * * * *", queue: "default" }],
    tasks: [updateRecommendationsTask],
  },
})
