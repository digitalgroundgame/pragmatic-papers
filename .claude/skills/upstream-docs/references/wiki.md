# Repo wiki (`digitalgroundgame/pragmatic-papers.wiki`)

The whole wiki is checked out (it's small). Site:
`https://github.com/digitalgroundgame/pragmatic-papers/wiki/<Page-Name>`. `Home.md` has the
table of contents; `_Sidebar.md` and `_Footer.md` are shared chrome.

The pages' source is `wiki/` in this repo, published to the wiki by the **Wiki sync** workflow
with each release. Read and **edit** them there (see the "Wiki" section of `AGENTS.md`); this
cache is the published copy, which describes production and lags `wiki/` on `dev`.

The wiki explains process for people; `AGENTS.md`, the skills and the code are the source of
truth for agents. When the two disagree, say so rather than picking one.

| Question                                     | Page                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| How the pieces fit together                  | `Architecture.md`, `Key-Technologies.md`                                                               |
| Which environments exist and how they deploy | `Environments.md`                                                                                      |
| Releasing, hotfixes                          | `Creating-Releases.md`, `Creating-Hotfix-Releases.md`                                                  |
| Opening and reviewing PRs, the Claude review | `Creating-Pull-Requests.md`, `Pull-Request-Checklist.md`, `Claude-Code-Review.md`, `PR-Screenshots.md` |
| Getting started, contributing, story points  | `Getting-Started.md`, `How-to-Contribute.md`, `Story-Points.md`                                        |
| Seeding, visual regression tests             | `Seeding-the-Database.md`, `E2E-Visual-Regression-Testing.md`                                          |
| Common questions                             | `Frequently-Asked-Questions.md`                                                                        |

Pages change; list the directory rather than trusting this table.
