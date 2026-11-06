# Repository workflow

- Keep the repository host-neutral: no absolute host paths, deployment hostnames or environment-specific values in prose, examples or labels. Use repo-relative paths and role names. Host specifics belong to the local deployment documentation.
- The upstream project owns OpenPencil behavior. This repository owns the build recipe, resolved release inputs, dependency-refresh policy, checks and GHCR publication.
- Read [README.md](README.md), [openspec/README.md](openspec/README.md) and the affected capability spec before changing build or publication behavior.
- Keep the daily release check tied to upstream mainline releases, including prereleases, and build from the resolved release commit's source archive. Scheduled runs skip a release that is already published; do not substitute a default-branch snapshot or an npm package.
- Keep the dependency refresh explicit: `bun update` stays within the release's declared ranges, base images are resolved to linux/amd64 digests, and Dependabot covers base tags and Actions. A dependency change that breaks the unit tests or smoke stack must fail the build.
- Keep the runtime distroless and non-root: no shell, package manager or extra OS tools. `latest` is the newest mainline build; there is no separate prerelease channel.
- Keep the deployment stack and configuration reference current in `deploy/` and `cloud/configuration.md` when image settings change.
- Keep the MCP bridge in `mcp/` a live-room peer, not a desktop-app shim: it must join the Cloud relay, seed an empty room from the stored revision, and keep the headless graph and Yjs room in step.
- Keep the Cloud token and MCP token separate; never log either, and keep the bridge runnable with a read-only root and a writable data volume.
- Publish only a checked candidate from `main`. Pull requests build without registry credentials. Publication never authorizes deployment or a service restart.
- Keep secrets and registry credentials out of source, build arguments, labels, logs and artifacts.
- Update specs and READMEs with behavior changes, not afterward. Use a scoped change under `openspec/changes/` for nontrivial behavior; small corrections may use a reviewed diff.
- Run `python3 -m unittest discover -s tests`, `bun scripts/check-docs.mjs`, the pinned OpenSpec validator and actionlint before merging. Record what was executed and what remains unverified.
- Never weaken a check, move `latest` backwards or force a publication to claim progress.
