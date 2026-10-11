import type { Tour } from "./types"

/** From the dashboard to an article's edit view, and the controls a writer uses there. */
export const articlesTour: Tour = {
  key: "articles",
  title: "Find and edit an article",
  steps: [
    {
      path: "/admin",
      element: "#card-articles",
      title: "Articles",
      description:
        "Every article lives here. The Articles link in the sidebar goes to the same place.",
      side: "bottom",
    },
    {
      path: "/admin/collections/articles",
      element: ".list-header__title-actions",
      title: "Start a new article",
      description: "Create New opens an empty article. It's saved as a draft as you type.",
      side: "bottom",
    },
    {
      path: "/admin/collections/articles",
      element: ".search-bar",
      title: "Find one",
      description: "Search by title, or use Filters to narrow the list by author, status or topic.",
      side: "bottom",
    },
    {
      path: "/admin/collections/articles",
      element: 'table tbody tr:first-child a[href^="/admin/collections/articles/"]',
      title: "Open an article",
      description: "Click a title to open it. Next opens this one.",
      side: "bottom",
      follow: true,
    },
    {
      path: "/admin/collections/articles/:id",
      element: ".tabs-field__tabs",
      title: "Content, SEO and Narration",
      description:
        "The article's text and blocks are on Content. SEO sets how it looks in search results and when shared, and Narration holds its audio.",
      side: "bottom",
    },
    {
      path: "/admin/collections/articles/:id",
      element: ".doc-controls__meta",
      title: "Status",
      description:
        "Draft or Published. Changes save as a draft on their own, so readers only see them once you publish.",
      side: "bottom",
    },
    {
      path: "/admin/collections/articles/:id",
      element: "#live-preview-toggler",
      title: "Preview",
      description: "See the article as readers will, next to the editor, while you write.",
      side: "bottom",
    },
    {
      path: "/admin/collections/articles/:id",
      element: ".form-submit",
      title: "Publish",
      description:
        "Publish puts your changes on the site. The arrow beside it can schedule them for later.",
      side: "left",
    },
  ],
}
