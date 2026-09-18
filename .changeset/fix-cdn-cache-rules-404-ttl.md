---
---

Fix the CDN immutable-pins Cache Rule caching a transient 404 for a year when a pinned URL is hit at an edge node before its redirect has propagated. 404 responses on that rule now get a 0s edge TTL instead of inheriting the 1-year default.
