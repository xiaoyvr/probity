# pi demo project

Scratch project for exercising the Probity pi extension end to end.

```bash
# build the extension first, from the repo root
npm run build

# then run pi from this directory with the extension loaded
cd test/pi-demo
pi -e "$(git rev-parse --show-toplevel)/dist/pi-extension.js"
```

In pi:

- `/probity on` -> `Probity: on`
- ask it to create a file containing `TODO` -> blocked with `Probity: No TODOs in this project`
- ask it to create a clean file -> allowed
- `/probity off` -> the `TODO` write is allowed again

Run pi from a directory with no `probity.config.*` and `/probity on` reports the existing
"not found" error and stays off.
