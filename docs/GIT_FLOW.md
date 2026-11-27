# Git flow

This repository uses `develop` as the integration branch and `main` as the
release branch. Work is done on short-lived feature branches created from
`develop`; `main` is updated only through a pull request from `develop`.

## Current state

After the documentation release:

- `main`, `origin/main`, `develop` and `origin/develop` all point to the same
  release commit.
- Release PRs (`develop` → `main`) use **Rebase and merge** (effectively a
  fast-forward here), so `main` advances to the exact commit already present on
  `develop`. This keeps `develop` containing everything that `main` has without
  rewriting history.
- `stash@{0}` on `feature/resizable-panels-and-row-order` is local work and is
  not part of this flow. Do not drop it.

The first documentation release was squash-merged, which gave `main` a new SHA
that `develop` did not contain. `develop` was resynced from `main` right after
that release:

```bash
git checkout develop
git fetch origin
git reset --hard origin/main
git push --force-with-lease origin develop
```

Use this recovery only when `develop` has no unmerged feature commits. Prefer
rebase-merging release PRs so it is not needed again.

## Branch rules

| Branch | Role | Direct pushes |
| --- | --- | --- |
| `main` | Released code; protected | No — pull request only |
| `develop` | Integration of completed features | Yes, via merged PR |
| `feature/*` | One change each, created from `develop` | Yes, while working |
| `hotfix/*` | Urgent fix created from `main` | Yes, while working |

The remote rejects direct pushes to `main` and rejects merge commits there.
Never use **Create a merge commit**. Close feature PRs with **Squash and merge**.
Close release PRs with **Rebase and merge** so the released commit is the same
object as the tip of `develop`; squashing a release PR creates a different SHA
on `main` and forces the resync shown above. The initial promotion of the loop
work bypassed both rules; that was an exception and should not be repeated.

## Standard change

1. Align `develop` with `main` as shown above.
2. Create a branch from it: `git checkout -b feature/<short-name> develop`.
3. Implement the change with its tests and documentation.
4. Run the checks listed in [VALIDATION.md](VALIDATION.md): `node --check`,
   `npm test`, the browser harnesses and the Electron smoke/build when the
   shell or packaging is touched.
5. Open a PR `feature/<short-name>` → `develop` and squash-merge it.
6. Open a PR `develop` → `main` and rebase-merge it once `develop` is ready to
   release.

## Hotfix

1. Branch from `main`: `git checkout -b hotfix/<short-name> main`.
2. Fix, test and document the change.
3. PR `hotfix/<short-name>` → `main` with rebase and merge.
4. PR `hotfix/<short-name>` → `develop` with rebase and merge (or fast-forward)
   so `develop` again contains everything that `main` has. If the hotfix was
   squash-merged on `main`, resync `develop` from `main` as shown above.

## Invariant

At any time, before a release PR is opened:

```bash
git merge-base --is-ancestor main develop   # exit 0 means develop contains main
git rev-list --left-right --count main...develop
```

The first command must succeed and the second must show `0` commits on the
`main` side. After a successful release the two branches should point to the
same commit. If it does not, update `develop` from `main` before proceeding.
