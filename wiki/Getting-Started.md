[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)

## Requirements

```
docker
Node.js version 24.15.0+
pnpm
```

## Quick Start

1. [Clone the repo](https://github.com/digitalgroundgame/pragmatic-papers.git) and `cd` into it.

2. _(Optional)_ Set up the private display font — see [Private Font Setup](#private-font-setup) below. Don't worry you can come back to this later.

3. Run `pnpm install`. The preinstall hook copies `apps/pragmatic-papers/.env` from `.env.example` if missing.

4. Start dev:

   ```bash
   pnpm dev
   ```

5. Open [http://localhost:8000](http://localhost:8000).

## Private Font Setup

The `@digitalgroundgame/fonts` package contains the proprietary display font. It is optional — the site works without it, falling back to system fonts. If you don't have access, skip this section.

If you do have access, create a **Classic GitHub Personal Access Token (PAT)** at [GitHub Settings → Tokens](https://github.com/settings/tokens) with the `read:packages` scope.

The project `.npmrc` references `GH_FONT_READ` — you just need that variable set before running `pnpm install`. Choose whichever method suits you:

- **Mac/Linux — shell profile** (applies to every terminal automatically):

  ```bash
  # ~/.zshrc or ~/.bashrc
  export GH_FONT_READ=ghp_your_token_here
  ```

- **Windows (PowerShell)** — set permanently for your user:

  ```powershell
  [System.Environment]::SetEnvironmentVariable("GH_FONT_READ", "ghp_your_token_here", "User")
  ```

  Alternatively, open **System Properties → Advanced → Environment Variables** (search "environment variables" in the Start menu) and add `GH_FONT_READ` under "User variables".

Restart your terminal after setting the variable, then re-run `pnpm install`. You should see `✓ Fonts copied to public/fonts` in the output.

## Seeding the Database

In order to see some basic content and website functionality it is key to seed your development database with mock content.

1. Navigate to `http://localhost:8000/admin`
2. Create a new user. The credentials don't matter here as its local.
3. When you land on the dashboard click the `Seed your database` link.
4. Wait a few moments and now your website will have some example content when returning to browsing `http://localhost:8000`

Or seed from the terminal, without the browser, while `pnpm dev` is stopped:

```bash
pnpm dev:db-seed
```

It seeds the same content as the button, and works on an empty database too (e.g. right after `pnpm dev:db-nuke`). Like the button, it first deletes every article, volume, page and media file in the database, not just seeded ones. It only runs against a local database with local media storage.

> [!TIP]
> If your docker database ever gets into a unrecoverable state, or you are switch branches that have different database schemas, be sure to run `pnpm dev:db-nuke` to blow away your database and start fresh.

Read more about [Seeding The Database](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Seeding-the-Database)

## Helpful Commands

Here are the most important scripts available in the root `package.json`:

- `pnpm dev`: Start the application in development mode.
- `pnpm dev:db`: Start the development docker container. This happens automatically when running `pnpm dev`.
- `pnpm dev:db-down`: Stop the development docker container.
- `pnpm dev:db-nuke`: Stop the container _and_ remove the database volume.
- `pnpm lint:fix`: Lint files with `eslint`.
- `pnpm format:fix`: Format files with `prettier`.
- `pnpm check-types`: Runs typescript compiler in no emit mode to check for type errors.
- `pnpm migrate:create "name_of_migration"`: Create the necessary database migrations for your pull request.

> [!NOTE]
> **Database Migrations**
>
> You do not need to run migrations against your development database, since Drizzle ORM's push mode automatically syncs data changes to your database while in development mode.
>
> Migrations will be required for preview, staging & production environments to properly deploy.

## Further Reading

- [How to Contribute](https://github.com/digitalgroundgame/pragmatic-papers/wiki/How-to-Contribute)
- [Creating Migrations](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Migrations)
