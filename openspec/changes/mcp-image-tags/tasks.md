# Tasks

- [x] 1.1 Add `scripts/publish_mcp.py` that writes the immutable commit tag, checks the published `latest` revision and moves the aliases only for an equal or descendant commit.
- [x] 1.2 Cover the decision and the git ancestry check with `tests/test_publish_mcp.py`.
- [x] 1.3 Use full history and the publisher in `.github/workflows/mcp.yml`, and verify the pull of the published tags.
- [x] 1.4 Record the publication contract in the Cloud MCP spec and drop the backlog item.
- [x] 2.1 Run the Python tests, documentation checks, strict OpenSpec validation and actionlint; verify the guard against the published registry before merge.
- [x] 2.2 Observe the next `main` run publish the commit tag and move `latest`/`0.1.0`, or report why it did not.
