# Agent Workflow

Do not run tests after every simple fix. For small, low-risk edits such as copy,
spacing, or narrowly scoped visual tweaks, a quick source check is enough unless
the user asks for tests. Run focused tests and typecheck for medium or large
edits, backend changes, schema changes, shared component changes, or anything
with meaningful regression risk.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
