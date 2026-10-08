Some new features arrive switched off. They're **experiments**: finished enough to try, but we want to see them working on staging before readers on the live site get them.

## Where the switches are

Open **Site Settings** (under **System** in the admin's sidebar; only admins and chief editors see it). The **Experiments** group has one checkbox per feature, with a line saying what it covers.

Each site keeps its own settings. Staging and the live site have separate databases, so ticking a box on staging changes nothing on the live site, and the reverse. Pull request previews start with staging's settings.

## What a switch does

When an experiment is off, readers can't reach the feature on that site at all: its pages return "not found", its links and buttons don't appear, and any background job it runs skips.

Saving Site Settings takes effect without a redeploy. Readers normally see the change on their next page load.

## When an experiment is done

Once a feature has proved itself, its checkbox is removed in a later release and the feature is simply on.
