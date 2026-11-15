# Build the upstream HTML engine

## Why

Newer releases require a Rust-built WebAssembly HTML engine that is not included in their source archives. The current Cloud image builder lacks Cargo and fails before image smoke testing.

## What Changes

Provide a digest-resolved, build-only Rust toolchain for releases requiring it. Honor the release's toolchain declaration and build its WebAssembly from the resolved source. Preserve dependency refresh, tests, smoke checks and the distroless runtime. The Cloud image capability is affected.

## Status

Implementation and verification in progress. Publication does not authorize deployment.
