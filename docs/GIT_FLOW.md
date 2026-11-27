# Git flow

This repository uses `develop` as the integration branch and `main` as the
release branch. Work is done on short-lived feature branches created from
`develop`; `main` is updated only through a pull request from `develop`.

## Current state

After the documentation release:

- `main`, `origin/main`, `develop` and `origin/develop` are resynced to the same
  release commit.
- Every promotion PR creates a new commit object on `main` (both squash and
  GitHub's rebase merge do this), so `develop` must be resynced from `main` as
  the last step of every release. There is no PR merge method available here
  that fast-forwards `main` while respecting the protected-branch rules.
- `stash@{0}` on `feature/resizable-panels-and-row-order` is local work and is
  not part of this flow. Do not drop it.

## After a release

Because the release PR creates a new SHA on `main`, run this immediately after
the merge, while `develop` has no unmerged feature commits:

```bash
git checkout develop
git fetch origin
git reset --hard origin/main
git push --force-with-lease origin develop
```

This rewrites `develop`. Do not run it if there is work on `develop` that has
not already been released; open its PR first.

## Branch rules

| Branch | Role | Direct pushes |
| --- | --- | --- |
| `main` | Released code; protected | No — pull request only |
| `develop` | Integration of completed features | Yes, via merged PR |
| `feature/*` | One change each, created from `develop` | Yes, while working |
| `hotfix/*` | Urgent fix created from `main` | Yes, while working |

The remote rejects direct pushes to `main` and rejects merge commits there.
Never use **Create a merge commit**. Close PRs with **Squash and merge** (the
rebase option also creates a new SHA, so it does not avoid the resync). The
initial promotion of the loop work bypassed both rules; that was an exception
and should not be repeated.

## Standard change

1. Align `develop` with `main` using the resync commands above.
2. Create a branch from it: `git checkout -b feature/<short-name> develop`.
3. Implement the change with its tests and documentation.
4. Run the checks listed in [VALIDATION.md](VALIDATION.md): `node --check`,
   `npm test`, the browser harnesses and the Electron smoke/build when the
   shell or packaging is touched.
5. Open a PR `feature/<short-name>` → `develop` and squash-merge it.
6. Open a PR `develop` → `main` and squash-merge it once `develop` is ready to
   release.
7. Resync `develop` from `main` as shown above.

## Hotfix

1. Branch from `main`: `git checkout -b hotfix/<short-name> main`.
2. Fix, test and document the change.
3. PR `hotfix/<short-name>` → `main` with squash and merge.
4. PR `hotfix/<short-name>` → `develop` with squash and merge so the fix is
   integrated.
5. Resync `develop` from `main` as shown above.

## Invariant

At any time, before a release PR is opened:

```bash
git merge-base --is-ancestor main develop   # exit 0 means develop contains main
git rev-list --left-right --count main...develop
```

The first command must succeed and the second must show `0` commits on the
`main` side. After a successful release and resync, the two branches point to
the same commit. If it does not, update `develop` from `main` before proceeding.
