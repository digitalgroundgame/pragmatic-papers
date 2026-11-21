---
name: wiki
description: Create or edit a page in this repo's GitHub wiki (digitalgroundgame/pragmatic-papers.wiki), a separate git repository. Use whenever adding, editing or linking a wiki page, or updating the wiki's Table of Contents.
---

# Wiki

The repo wiki lives at `https://github.com/digitalgroundgame/pragmatic-papers/wiki` and is a separate git repository. To create or edit wiki pages:

```bash
git clone https://github.com/digitalgroundgame/pragmatic-papers.wiki.git /tmp/wiki
# create or edit .md files in /tmp/wiki
cd /tmp/wiki
git add <file>
git commit -m "docs: ..."
git push
```

> [!NOTE]
> Commit signing does not work in the wiki repo from the **remote/cloud execution environment** — the signing server is scoped to the main repo. If running in that context and a push fails due to signing, ask the user to re-run the session locally (e.g. in Cursor or another terminal where their git signing is configured), then retry the push.

After adding a new page, update `Home.md` to add it to the Table of Contents under the appropriate section, and match the back-link style used by other pages:

```md
[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)
```
