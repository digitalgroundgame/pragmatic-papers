import { isAdmin } from "@/access/roles"
import { Articles } from "@/collections/Articles"
import { Categories } from "@/collections/Categories"
import { Interactives } from "@/collections/Interactives"
import { InteractiveSnapshots } from "@/collections/InteractiveSnapshots"
import { MapAssets } from "@/collections/MapAssets"
import { Media } from "@/collections/Media"
import { Merch } from "@/collections/Merch"
import { Pages } from "@/collections/Pages"
import { Topics } from "@/collections/Topics"
import { Users } from "@/collections/Users"
import { Volumes } from "@/collections/Volumes"
import { Webhooks } from "@/collections/Webhooks"
import { defaultLexical } from "@/fields/defaultLexical"
import { Footer } from "@/Footer/config"
import { ArticleRecommendations } from "@/globals/ArticleRecommendations/config"
import { Integrations } from "@/globals/Integrations/config"
import { Ticker } from "@/globals/Ticker/config"
import { SiteSettings } from "@/globals/SiteSettings/config"
import { Header } from "@/Header/config"
import { canRunJobs } from "@/jobs/access"
import { syncInteractiveDataTask } from "@/jobs/syncInteractiveData"
import { syncShopifyProductsTask } from "@/jobs/syncShopifyProducts"
import { updateRecommendationsTask } from "@/jobs/updateRecommendations"
import { plugins } from "@/plugins"
import { searchVectorAfterSchemaInit } from "@/plugins/searchVector"
import { sentryPayloadPlugin, skipPluginErrorsInPino } from "@/sentryPayload"
import { getServerSideURL } from "@/utilities/getURL"
import { migrations } from "@/migrations"
import { type PostgresAdapter, postgresAdapter } from "@payloadcms/db-postgres"
import path from "path"
import pretty from "pino-pretty"
import { buildConfig, type SharpDependency } from "payload"
import sharp from "@/cloudflare/sharp"
import { fileURLToPath } from "url"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  logger: {
    options: {
      level: process.env.PAYLOAD_LOG_LEVEL || "info",
      hooks: { logMethod: skipPluginErrorsInPino },
    },
    destination: pretty({
      colorize: process.stdout.isTTY,
      translateTime: "SYS:HH:MM:ss",
      ignore: "pid,hostname",
      sync: true,
    }),
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
      providers: [
        "@/providers/MathJaxProvider#MathJaxProviderRoot",
        "@/components/AdminBar/AdminBarHintProvider#AdminBarHintProvider",
      ],
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
      // Notice a connection the server dropped while idle instead of finding out on the
      // next query. (No connectionTimeoutMillis: pg-pool also applies it to queries waiting
      // for a free client, which would turn a busy pool into failed requests.)
      keepAlive: true,
      // A Cloudflare Worker can't reuse a socket opened during another request, so in one,
      // give each query a fresh connection (Hyperdrive pools them for us).
      ...(globalThis.navigator?.userAgent === "Cloudflare-Workers" && { maxUses: 1 }),
    },
    // prevent schema push in prod/test for static schema determinism and noise reduction
    push: process.env.NODE_ENV === "development",
    // Images built in GitHub Actions (dockerfiles/PragmaticPapers.ci.Dockerfile) never
    // touch the real database while building, so they migrate when Payload starts (Payload
    // only does under NODE_ENV=production). Coolify's builds run `payload migrate` instead.
    prodMigrations: process.env.BUILT_WITHOUT_DATABASE === "true" ? migrations : undefined,
    afterSchemaInit: [searchVectorAfterSchemaInit],
  }),
  /**
   * The admin saves a document as multipart, and busboy — which parses it — truncates any
   * field over 1 MiB rather than refusing it, so Payload was handed half a JSON document and
   * `JSON.parse` failed on the cut ("Unterminated string at position 1048515"). An interactive
   * snapshot carries the researcher's whole feed in one field, which is past that on its own.
   * Raised to 32 MB: the ceiling is only there to stop a runaway request, and ours are known.
   */
  bodyParser: { limits: { fieldSize: 32 * 1024 * 1024 } },
  onInit: async (payload) => {
    // When the database server closes a connection sitting idle in the pool (a restart,
    // an admin_shutdown), node-postgres drops the client and emits "error" on the pool.
    // Payload only listens on the one client it holds, so with no listener here the event
    // is thrown as an uncaught exception. The pool opens a new connection on the next
    // query, so a warning is all it needs. Commands that skip connecting
    // (`disableDBConnect`) have no pool yet.
    const { pool } = payload.db as unknown as Partial<PostgresAdapter>
    pool?.on("error", (err) => {
      payload.logger.warn({ err }, "Postgres closed an idle connection")
    })
  },
  collections: [
    // The admin sidebar lists groups in the order their first entry appears here.
    Articles,
    Volumes,
    Topics,
    Media,
    Pages,
    Interactives,
    InteractiveSnapshots,
    MapAssets,
    Merch,
    Users,
    Webhooks,
    Categories,
  ],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer, Ticker, SiteSettings, Integrations, ArticleRecommendations],
  // Nothing here reads Payload's GraphQL API (the site and admin use the Local and REST
  // APIs), and its errors reach `afterError` with their status nested on `originalError`,
  // which the Sentry plugin reads as a 500: anyone could fill Sentry from /api/graphql.
  graphQL: { disable: true },
  plugins: [...plugins, sentryPayloadPlugin],
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
        if (!isAdmin(req.user)) {
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
      run: canRunJobs,
    },
    autoRun: [{ cron: "*/5 * * * *", queue: "default" }],
    tasks: [updateRecommendationsTask, syncShopifyProductsTask, syncInteractiveDataTask],
  },
})
