# Setup

Install probity as a dev dependency, then wire it into your agent's hook system. Each vendor's section below shows the config to add.

```
npm install -D @nizos/probity
```

For non-Node projects (C++, PHP, Python, etc.), install globally with `npm install -g @nizos/probity` instead.

## Claude Code

### Recommended: install via plugin

Two commands wire probity into Claude Code's hook system, no manual config edit:

```
/plugin marketplace add nizos/probity
/plugin install probity@probity
```

The plugin ships the `PreToolUse` hook with the matcher `Bash|Write|Edit|NotebookEdit`, which covers commands and file modifications.

### Manual install

If you'd rather wire the hook yourself, add a `PreToolUse` entry to `.claude/settings.json` (project) or `~/.claude/settings.json` (user-global):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Write|Edit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "npx @nizos/probity --agent claude-code"
          }
        ]
      }
    ]
  }
}
```

The matcher controls which tools fire the hook. `Bash|Write|Edit|NotebookEdit` covers commands and file modifications.

Further reading: [Claude Code's hooks documentation](https://code.claude.com/docs/en/hooks).

## OpenAI Codex

Codex hooks are enabled by default. Add a `PreToolUse` hook in `~/.codex/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^(Bash|apply_patch|Edit|Write)$",
        "hooks": [
          {
            "type": "command",
            "command": "npx @nizos/probity --agent codex"
          }
        ]
      }
    ]
  }
}
```

Codex's matcher is a regex. `^(Bash|apply_patch|Edit|Write)$` covers shell commands and file modifications (Codex sends file writes as `apply_patch`; `Edit`/`Write` are matcher synonyms documented by Codex).

Further reading: [Codex's hooks documentation](https://developers.openai.com/codex/hooks).

## GitHub Copilot CLI

GitHub Copilot CLI reads hooks from `.github/hooks/probity.json` in your project root. The cloud agent also reads it from your repo's default branch.

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "type": "command",
        "bash": "npx @nizos/probity --agent github-copilot",
        "powershell": "npx @nizos/probity --agent github-copilot"
      }
    ]
  }
}
```

Note the use of `bash` and `powershell` in this example, select the shell option available for your environment.

Every tool call fires the hook; probity's rules pass through non-write actions. Probity accepts Copilot's `bash`, `create`, and `edit` tool payloads.

Further reading: [GitHub Copilot's hooks reference](https://docs.github.com/en/copilot/reference/hooks-configuration).

## pi

pi integrates through an extension rather than a shell hook. Build Probity from a checkout, then
either install the local package or load the extension for a single session:

```bash
npm run build

# install the package (reads the `pi` manifest in package.json)
pi install /path/to/probity

# or load it for one session, without installing
pi -e /path/to/probity/dist/pi-extension.js
```

The extension is off until you turn it on. Inside a pi session:

- `/probity on` — discover `probity.config.{ts,mts,js,mjs}` from the working directory and start
  enforcing. If no config is found, Probity reports the error and stays off.
- `/probity off` — stop enforcing.
- `/probity` — report the current state.

While enabled, pi's `write`, `edit`, and `bash` tool calls are evaluated before they run. A rule
violation blocks the call and returns the reason to the agent, exactly like the other vendors.
AI-validated rules use the current pi session's model and authentication, so no separate key is
needed. State is per session and starts off; a new session or `/reload` resets it.

Further reading: [pi's extensions documentation](https://github.com/earendil-works/pi).

## CLI

The `probity` bin is what each vendor's hook command invokes. You can also run it directly — for testing rule changes, scripting CI checks, or pointing at a config that lives outside the repo.

```bash
npx @nizos/probity --agent <vendor> < hook-payload.json
```

The bin reads a hook payload from stdin (capped at 10 MiB) and writes the vendor's response JSON to stdout.

### Options

- `--agent <vendor>` — Required. One of `claude-code`, `codex`, or `github-copilot`.
- `--config <path>` — Override the auto-discovered config file. See [Configuration](configuration.md#overriding-the-file-location).
- `--debug <path>` — Log each invocation's payload and response to `<path>` as JSONL for debugging.
- `--version` — Print the package version.
- `--help` — Print usage and exit.

Tip: tail the latest `--debug` entry live with `watch -n 1 -c 'tail -n 1 <path> | jq -C'`.
