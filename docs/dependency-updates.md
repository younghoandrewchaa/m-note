# Dependency updates

Dependabot checks npm dependencies every Monday at 09:00 Europe/London.
It assigns update PRs to `younghoandrewchaa`, with up to 10 version-update
PRs open at once. Updates start after `.github/dependabot.yml` reaches the
default branch.

Minor and patch updates are grouped by Tiptap, React and its types,
Electron Forge, build tooling, and ESLint. Major updates and Electron
runtime updates remain individually reviewable. Security updates are
managed separately from the weekly version-update schedule.

## Notifications

On the repository, select **Watch > Custom > Pull requests** and
**Security alerts**, preserving any other subscriptions you already use.
In [GitHub notification settings](https://github.com/settings/notifications),
enable GitHub and email delivery for watching and participating activity.
These account delivery preferences also affect other repositories.
Enable individual Dependabot alert emails if you want alerts between
weekly digests. Keep the existing notification email address.

PR notifications arrive when a PR is opened or updated, rather than for
every npm publication. Groups can combine updates, and the open-PR limit
can defer new PRs. Verify delivery when the first real update arrives.

## Review routine

- Review routine PRs weekly; prioritise security fixes when alerts arrive.
- Read release notes and wait for Pull Request Checks to pass before merging.
- For editor changes, check opening, editing, saving, and reopening an existing
  note, including code blocks, tables, and Markdown behavior.
- For Electron, Forge, or native-tooling changes, follow
  [native update checks](testing/native-updates.md) and verify a macOS build.
- Assess major upgrades monthly. Coupled major upgrades may need one
  coordinated migration PR.
- After two weeks, review notification volume and the update backlog.

Merges remain manual. Removing or adjusting the Dependabot configuration
changes future version-update checks; existing PRs require separate review.
