import { Banner } from "@payloadcms/ui/elements/Banner"
import React from "react"

import { SeedButton } from "./SeedButton"
import "./index.scss"

const baseClass = "before-dashboard"

const BeforeDashboard: React.FC = () => {
  // These are dev instructions, so we don't want to show them in production but feel free to make a component
  // for the production dashboard if you want to show something different.
  if (process.env.NODE_ENV === "production") {
    return null
  }

  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to your dashboard!</h4>
      </Banner>
      Here&apos;s what to do next:
      <ul className={`${baseClass}__instructions`}>
        <li>
          <SeedButton />
          {
            " with a few volumes, articles, authors, and images to jump-start your local development, then "
          }
          <a href="/" target="_blank">
            visit the website
          </a>
          {" to see the results."}
        </li>
        <li>
          {"Modify your "}
          <a
            href="https://payloadcms.com/docs/configuration/collections"
            rel="noopener noreferrer"
            target="_blank"
          >
            collections
          </a>
          {" and add more "}
          <a
            href="https://payloadcms.com/docs/fields/overview"
            rel="noopener noreferrer"
            target="_blank"
          >
            fields
          </a>
          {
            " as needed for your task. If you are new to Payload, we also recommend you check out the "
          }
          <a
            href="https://payloadcms.com/docs/getting-started/what-is-payload"
            rel="noopener noreferrer"
            target="_blank"
          >
            Getting Started
          </a>
          {" docs."}
        </li>
      </ul>
      {"Pro Tip: This block is a "}
      <a
        href="https://payloadcms.com/docs/admin/custom-components/overview#base-component-overrides"
        rel="noopener noreferrer"
        target="_blank"
      >
        custom component
      </a>
      , you can remove it at any time by updating your <strong>payload.config</strong>.
    </div>
  )
}

export default BeforeDashboard
