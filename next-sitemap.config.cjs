const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  exclude: [
    "/articles-sitemap.xml",
    "/pages-sitemap.xml",
    "/volumes-sitemap.xml",
    "/*",
    "/volumes/*",
    "/articles/*",
    "/authors/*",
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        disallow: "/admin/*",
      },
    ],
    additionalSitemaps: [
      `${SITE_URL}/pages-sitemap.xml`,
      `${SITE_URL}/articles-sitemap.xml`,
      `${SITE_URL}/volumes-sitemap.xml`,
    ],
  },
}
