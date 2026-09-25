# ADR-0011: Reconstruct pi edit content with pi's own tool pipeline via a host-resolved import

- **Status:** Accepted
- **Date:** 2026-09-25
- **Source commits:** ea2024f

## Context

pi integrates with Probity through an in-process extension rather than a shell hook. Enforcement runs in the extension's `tool_call` handler, which fires before pi executes a tool. Probity's canonical file-change action carries the full post-change content (`write { path, content }`), because rules read `action.content` and compare it against the pre-change file.

pi's `write` tool supplies that content directly, but its `edit` tool carries a diff: `{ path, edits: [{ oldText, newText }] }`. At the `tool_call` boundary the file on disk still holds the pre-edit content, so the post-edit content does not exist anywhere yet. It has to be reconstructed from the diff and the current file, exactly as the Claude Code and Copilot adapters already do through `apply-edit.ts`.

The reconstruction rules are non-trivial and pi already implements them: match each `oldText` against the original content, reject missing, duplicate, and overlapping targets, normalize line endings, preserve a BOM, and fall back to fuzzy matching (trailing whitespace, Unicode quotes, dashes, and spaces). Mirroring that in Probity would duplicate pi's logic and, because exact matching is a strict subset of pi's fuzzy matching, would fail closed on edits pi would have accepted.

Reusing pi's implementation means calling `createEditToolDefinition`, the only public entry to its edit logic (`applyEditsToNormalizedContent` is not exported and the package `exports` map has no wildcard subpath, so a deep import is blocked). Its `execute` writes through pluggable `operations`, so a `writeFile` that captures the content instead of writing yields the reconstruction with no side effect.

The question is how Probity reaches `createEditToolDefinition` without taking a package dependency. pi loads every extension with jiti and maps `@earendil-works/pi-coding-agent` to its own instance, through `alias` in the unbundled Node build and `virtualModules` in the bundled build, with an explicit code comment that extensions are meant to import it. A dynamic `import()` was tried first, to keep the specifier out of the build, but jiti rewrites dynamic imports only in transformed CommonJS modules: in an ESM file (Probity's `dist` is ESM under `"type": "module"`) the dynamic `import()` is left to native Node, which cannot resolve the bare specifier. A static import, by contrast, is rewritten by jiti in both modes.

## Decision

Call pi's `createEditToolDefinition` through a **static** import of `@earendil-works/pi-coding-agent` in one module, `src/vendors/pi/pi-edit.ts`, and declare the minimal types for that import in a local ambient module declaration, `src/vendors/pi/pi-coding-agent.d.ts`.

Because the runtime import is static, pi's loader rewrites it to pi's own instance when the extension runs. Because the type is local, `tsc` resolves the import for the build without the package installed, and no `dependencies`, `devDependencies`, or `peerDependencies` entry is added. Unit tests replace `pi-edit.ts` with a stub through module mocking, so the static import never resolves outside pi.

The wrapper captures the post-edit content by passing `writeFile` an operation that stores `content` and returns, and propagates pi's own errors (missing, duplicate, overlapping edits) so the `tool_call` handler fails closed.

## Consequences

Probity reproduces pi's exact edit semantics, including fuzzy matching, BOM handling, line endings, and pi's own error messages, without duplicating the algorithm and without shipping or installing pi's package. There is no dependency to keep in sync and no added install footprint.

The cost is a deliberate, isolated coupling. Probity calls a public pi API in a way pi does not document for this purpose, a tool definition used as a content calculator, and hand-maintains a small ambient type for its signature. That type can drift from pi's real one, though the surface is a single function. The reconstruction path is exercised by a real pi session and by an out-of-band probe, not by unit tests, which mock the wrapper. If pi changes `createEditToolDefinition`'s operation contract, the extension breaks at runtime rather than at compile time.

## Considered alternatives

**Dynamic `import()` of the package.** Motivated by keeping the specifier out of the build, but rejected after testing: jiti rewrites dynamic imports only in transformed CommonJS modules, and Probity's ESM `dist` files fall through to native Node, which cannot resolve `@earendil-works/pi-coding-agent`.

**Static import with a dev dependency plus optional peer.** The documented extension pattern with compile-time type safety, at the cost of roughly a 23 MB dev and CI install for a single helper call, and a hard package dependency for a pi-only path.

**Mirror the reconstruction against `apply-edit.ts`.** No coupling to pi's API and consistent with the other adapters, but duplicates pi's matching rules and fails closed on edits pi would have applied.

**Deep-import the private reconstruction helper.** Blocked: the function is not exported and the package `exports` map has no wildcard subpath.
