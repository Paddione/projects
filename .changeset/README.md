# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and changelog automation.

## What is a Changeset?

A changeset is a markdown file that describes a code change and its semver impact. When PRs with changesets are merged, a "Version Packages" PR is automatically created (or updated) that bumps versions and updates changelogs.

## Adding a Changeset

When your PR includes user-facing changes, run:

```bash
npx changeset
```

This will prompt you to:
1. Select which packages changed
2. Choose a semver bump type (major / minor / patch)
3. Write a summary of the change

A new markdown file will be created in this `.changeset/` directory. Commit it with your PR.

## How Releases Work

1. You open a PR that includes one or more changeset files
2. The PR is reviewed and merged to `master`
3. A GitHub Action detects the changesets and creates/updates a **Version Packages** PR
4. That PR bumps `package.json` versions and updates `CHANGELOG.md` files
5. When the Version Packages PR is merged, packages are published (if configured)

## When NOT to Add a Changeset

- Internal refactors with no user-facing impact
- CI/CD changes
- Documentation-only changes
- Test additions/fixes
