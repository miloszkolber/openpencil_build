# Evidence

- Built upstream `v0.17.0-beta.4` from its resolved release commit with refreshed dependencies and digest-resolved bases. The build used the release's Rust 1.98.1 even though the Rust bootstrap image defaulted to 1.100.0. The HTML engine WebAssembly module was built from source.
- Cloud unit tests passed 251 cases. The candidate started in the isolated PostgreSQL and SeaweedFS smoke stack and passed the health, readiness and welcome checks.
- A fresh `v0.17.0-beta.2` release archive also built with this recipe, passed 213 Cloud unit tests and passed the isolated smoke stack.
- The final image ran as UID 65532 and did not contain `/bin/sh`, Cargo or the native compiler at the checked paths.
- Python, documentation, OpenSpec and actionlint checks were run separately. The image was not published or deployed by this change. MCP compatibility with this Cloud release remains unverified.
