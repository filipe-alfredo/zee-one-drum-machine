# Git flow

This repository uses `develop` as the integration branch and `main` as the
release branch. Work is done on short-lived feature branches created from
`develop`; `main` is updated only through a pull request from `develop`.

## Current state

At `068acf9` (`feat(export): add format picker with WAV, M4A and MP3`):

- `main` and `origin/main` both point to `068acf9` and the working tree is clean.
- `develop` and `origin/develop` both point to `6efbcb6`, which is **behind**
  `main`. There are no commits exclusive to `develop`, so it can be advanced
  with a fast-forward.
- `stash@{0}` on `feature/resizable-panels-and-row-order` is local work and is
  not part of this flow. Do not drop it.

Before starting new work, bring `develop` up to date:

```bash
git checkout develop
git pull --ff-only origin develop
git merge --ff-only main
git push origin develop
```

After that, `develop` and `main` point to the same commit and the normal flow
can resume.

## Branch rules

| Branch | Role | Direct pushes |
| --- | --- | --- |
| `main` | Released code; protected | No — pull request only |
| `develop` | Integration of completed features | Yes, via merged PR |
| `feature/*` | One change each, created from `develop` | Yes, while working |
| `hotfix/*` | Urgent fix created from `main` | Yes, while working |

The remote rejects direct pushes to `main` and rejects merge commits there. Use
**Squash and merge** when closing PRs, so the history stays linear and the rule
is respected. The initial promotion of the loop work bypassed both rules; that
was an exception and should not be repeated.

## Standard change

1. Align `develop` with `main` as shown above.
2. Create a branch from it: `git checkout -b feature/<short-name> develop`.
3. Implement the change with its tests and documentation.
4. Run the checks listed in [VALIDATION.md](VALIDATION.md): `node --check`,
   `npm test`, the browser harnesses and the Electron smoke/build when the
   shell or packaging is touched.
5. Open a PR `feature/<short-name>` → `develop` and squash-merge it.
6. Open a PR `develop` → `main` and squash-merge it once `develop` is ready to
   release.

## Hotfix

1. Branch from `main`: `git checkout -b hotfix/<short-name> main`.
2. Fix, test and document the change.
3. PR `hotfix/<short-name>` → `main` with squash and merge.
4. PR `hotfix/<short-name>` → `develop` (or merge `main` back into `develop`)
   so `develop` again contains everything that `main` has.

## Invariant

At any time, before a release PR is opened:

```bash
git merge-base --is-ancestor main develop   # exit 0 means develop contains main
git rev-list --left-right --count main...develop
```

The first command must succeed and the second must show `0` commits on the
`main` side. If it does not, update `develop` from `main` before proceeding.
