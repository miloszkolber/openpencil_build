# Monotonic MCP image tags

## Why

The MCP image workflow pushed `latest` and `0.1.0` from every run on `main` without checking what the registry already held. A build that finished after a newer one, or a rerun of an older commit, could move both aliases backwards; the backlog recorded the observed incident.

The Cloud MCP capability owns the bridge's published image identity.

## What Changes

- Always publish the immutable `sha-<commit>` tag and verify its revision label.
- Move `latest` and `0.1.0` only when no alias is published, or when the candidate commit equals or descends from the published revision.
- Report why aliases did not move, keep their digests, and fail the run when a published tag does not carry the expected commit.
- Check out full history in the workflow so ancestry is decidable, and add the publisher and its tests to the workflow paths.

## Out of scope

- Publishing from a pull request or any ref other than `main`.
- Deployment or service restarts. The host keeps its current image until an operator deploys.

## Status

Implemented. Verified by unit tests, the workflow after merge, and the published tags.
