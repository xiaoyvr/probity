# pi demo project

Scratch project for exercising the Probity pi extension end to end.

```bash
# build the extension first, from the repo root
npm run build

# then run pi from this directory with the extension loaded
cd test/pi-demo
pi -e "$(git rev-parse --show-toplevel)/dist/pi-extension.js"
```

The config here (`probity.config.ts`) forbids the string `TODO` in any write or edit.

## Test the `write` path

- `/probity on` -> `Probity: on`
- ask it to create a **new** file containing `TODO` -> blocked with
  `Probity: No TODOs in this project`
- ask it to create a new file without `TODO` -> allowed
- `/probity off` -> the `TODO` write is allowed again

## Test the `edit` path

`sample.md` exists so the agent has something to edit (pi uses the `edit` tool for an
existing file, not `write`).

- with Probity on, ask it to add a line containing `TODO` to `sample.md` -> blocked
- ask it to add a line without `TODO` to `sample.md` -> allowed

## TODO

- [ ] Add more demo scenarios
- [ ] Document the trace log

## Missing config

Run pi from a directory with no `probity.config.*` and `/probity on` reports the existing
"not found" error and stays off.
