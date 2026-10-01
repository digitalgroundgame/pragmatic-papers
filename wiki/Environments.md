[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)

## Development

Most of your time will be spent working on your local development server with Docker and Node.js.

## Preview

Once you submit a Pull Request (PR) the `digital-ground-game-deployment-bot` will deploy your PR at `pr-###.pragmaticpapers.com`.

All preview deployments will clone the staging database when building, meaning your preview deployment will inherit any content that already exists on staging. This is useful to test if your migrations are working properly and that your changes are backwards compatible.

This also means any login credentials you use on staging can also be used on preview deployments, so that you can log in and test if your changes in the admin.

## Staging

The `dev` branch deploys to https://staging.pragmaticpapers.com.

Reach out to an organization team member to gain access to the https://staging.pragmaticpapers.com environment.

All previews use staging as their database to copy from. Be sure to create useful mock content on staging so that the entire team can benefit from those mocked pages.

## Production

Production is located at https://pragmaticpapers.com.

Production is only accessible by trusted members on a need-to-have basis.

## Further Reading

- [Architecture Overview](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Architecture-Overview)
