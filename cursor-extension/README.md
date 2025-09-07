# Claude Flow Cursor Extension

Integrates the Claude Flow CLI and tools into Cursor/VS Code.

## Features

- Status bar entry to access Claude Flow
- Commands:
  - "Claude Flow: Hello" shows a greeting
  - "Claude Flow: Run CLI" opens a terminal and runs `claude-flow --help`
- Settings:
  - `claudeFlow.cliPath` (default `/workspace/bin/claude-flow`)
  - `claudeFlow.env` (object of env vars)

## Development

- Install dependencies:

```bash
npm install
```

- Build:

```bash
npm run compile
```

- Run Extension:

Use the "Run Extension" launch in Cursor/VS Code or press F5 when this folder is opened as a workspace.

## Packaging

```bash
npm run package
```

This produces a `.vsix` you can install in Cursor/VS Code.