// @vitest-environment node
import type { NextConfig } from "next"
import { describe, expect, it } from "vitest"

import { WORKER_STUBS, withCloudflare } from "../withCloudflare"

type WebpackFn = NonNullable<NextConfig["webpack"]>

class NormalModuleReplacementPlugin {
  constructor(
    readonly pattern: RegExp,
    readonly replacement: string,
  ) {}
}

function runWebpack(config: NextConfig, isServer: boolean) {
  const webpackConfig = {
    externals: ["drizzle-kit", "sharp", "@google-analytics/data", "pino"],
    resolve: { alias: { existing: "/somewhere" } },
    plugins: [] as unknown[],
  }
  const options = { isServer, webpack: { NormalModuleReplacementPlugin } }
  return (config.webpack as WebpackFn)(
    webpackConfig,
    options as unknown as Parameters<WebpackFn>[1],
  )
}

describe("withCloudflare", () => {
  const base: NextConfig = {
    output: "standalone",
    serverExternalPackages: ["drizzle-kit", "sharp", "pino", "@google-analytics/data"],
    webpack: (config) => ({ ...config, fromBase: true }),
  }
  const config = withCloudflare(base)

  it("keeps the base config", () => {
    expect(config.output).toBe("standalone")
  })

  it("takes the stubbed packages off serverExternalPackages", () => {
    expect(config.serverExternalPackages).toEqual(["pino"])
  })

  it("traces pg-cloudflare, which Node's resolution never reaches", () => {
    expect(config.outputFileTracingIncludes?.["/**/*"]).toEqual([
      expect.stringContaining("pg-cloudflare"),
    ])
  })

  it("runs the base webpack function, then aliases each stub", () => {
    const resolved = runWebpack(config, false)
    expect(resolved.fromBase).toBe(true)
    expect(resolved.externals).toEqual(["pino"])
    expect(resolved.resolve.alias.existing).toBe("/somewhere")
    for (const name of WORKER_STUBS) {
      expect(resolved.resolve.alias[`${name}$`]).toMatch(/stubs[\\/]unavailable\.ts$/)
    }
  })

  it("keeps pg external on the server, for OpenNext to bundle with workerd", () => {
    expect(runWebpack(config, true).externals).toEqual(["pino", "pg"])
    expect(runWebpack(config, false).externals).not.toContain("pg")
  })

  it("swaps src/cloudflare/sharp.ts for the stub", () => {
    const [plugin] = runWebpack(config, true).plugins as NormalModuleReplacementPlugin[]
    expect(plugin).toBeInstanceOf(NormalModuleReplacementPlugin)
    expect(plugin!.pattern.test("/app/src/cloudflare/sharp.ts")).toBe(true)
    expect(plugin!.pattern.test("/app/src/utilities/sharp.ts")).toBe(false)
    expect(plugin!.replacement).toMatch(/stubs[\\/]unavailable\.ts$/)
  })
})
