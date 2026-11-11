# Backlog

| Item | Evidence | Next step |
| --- | --- | --- |
| MCP image publication order | Concurrent queued builds published `latest` out of commit order. An older commit became `latest` after a newer commit had already published. | Design and test a monotonic promotion guard before relying on the mutable tag for deployment. |
