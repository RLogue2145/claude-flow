import * as vscode from 'vscode';
import { spawn } from 'child_process';

function createStatusBarItem(context: vscode.ExtensionContext): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.text = '$(rocket) Claude Flow';
  item.command = 'claudeFlow.hello';
  item.tooltip = 'Claude Flow';
  item.show();
  context.subscriptions.push(item);
  return item;
}

export function activate(context: vscode.ExtensionContext) {
  const statusItem = createStatusBarItem(context);

  const helloCmd = vscode.commands.registerCommand('claudeFlow.hello', () => {
    vscode.window.showInformationMessage('Claude Flow extension activated!');
  });

  const runCLICmd = vscode.commands.registerCommand('claudeFlow.runCLI', async () => {
    const config = vscode.workspace.getConfiguration();
    const cliPath = config.get<string>('claudeFlow.cliPath') || 'claude-flow';
    const defaultArgs = config.get<string[]>('claudeFlow.defaultArgs') || ['--help'];
    const envConfig = config.get<Record<string, string>>('claudeFlow.env') || {};

    const terminal = vscode.window.createTerminal({
      name: 'Claude Flow',
      env: envConfig,
    });
    const args = defaultArgs.join(' ');
    terminal.sendText(`${cliPath} ${args}`);
    terminal.show();
  });

  const showWebviewCmd = vscode.commands.registerCommand('claudeFlow.showWebview', async () => {
    const panel = vscode.window.createWebviewPanel(
      'claudeFlowWebview',
      'Claude Flow',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Claude Flow</title>
        <style>
          body { font-family: sans-serif; padding: 16px; }
          button { padding: 8px 12px; }
          .log { margin-top: 12px; color: #666; }
        </style>
      </head>
      <body>
        <h2>Claude Flow</h2>
        <button id="ping">Ping Extension</button>
        <div class="log" id="log"></div>
        <script>
          const vscode = acquireVsCodeApi();
          document.getElementById('ping').addEventListener('click', () => {
            vscode.postMessage({ type: 'ping', timestamp: Date.now() });
          });
          window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg?.type === 'pong') {
              document.getElementById('log').textContent = 'Received: ' + JSON.stringify(msg);
            }
          });
        </script>
      </body>
      </html>
    `;

    panel.webview.onDidReceiveMessage((message) => {
      if (message?.type === 'ping') {
        panel.webview.postMessage({ type: 'pong', at: new Date().toISOString() });
      }
    }, undefined, context.subscriptions);
  });

  const runLocalScriptCmd = vscode.commands.registerCommand('claudeFlow.runLocalScript', async () => {
    const config = vscode.workspace.getConfiguration();
    const scriptPath = config.get<string>('claudeFlow.localScript');
    const envConfig = config.get<Record<string, string>>('claudeFlow.env') || {};

    if (!scriptPath) {
      vscode.window.showErrorMessage('claudeFlow.localScript is not configured.');
      return;
    }

    const terminal = vscode.window.createTerminal({ name: 'Claude Flow - Local Script', env: envConfig });
    terminal.sendText(`${scriptPath}`);
    terminal.show();
  });

  context.subscriptions.push(helloCmd, runCLICmd, showWebviewCmd, runLocalScriptCmd, statusItem);
}

export function deactivate() {}

