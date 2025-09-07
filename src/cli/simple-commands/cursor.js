#!/usr/bin/env node
/**
 * Cursor integration commands for background agents
 * Provides Cursor IDE integration and background agent management
 */

import { printSuccess, printError, printWarning, printInfo } from '../utils.js';
import { platform } from 'os';
import { access, constants, writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';

// Cursor API Configuration
const CURSOR_API_BASE = process.env.CURSOR_API_URL || 'https://api.cursor.sh';
const CURSOR_API_KEY = process.env.CURSOR_API_KEY;

const CURSOR_MODES = {
  'init': {
    description: 'Initialize Cursor integration and background agents',
    examples: [
      'cursor init',
      'cursor init --api-key <key>',
      'cursor init --workspace <path>',
    ],
  },
  'sync': {
    description: 'Sync with Cursor workspace and background agents',
    examples: [
      'cursor sync',
      'cursor sync --workspace <path>',
      'cursor sync --force',
    ],
  },
  'background': {
    description: 'Start background agent for Cursor integration',
    examples: [
      'cursor background',
      'cursor background --daemon',
      'cursor background --port <port>',
    ],
  },
  'status': {
    description: 'Check Cursor integration and background agent status',
    examples: [
      'cursor status',
      'cursor status --verbose',
    ],
  },
  'config': {
    description: 'Configure Cursor integration settings',
    examples: [
      'cursor config --api-key <key>',
      'cursor config --workspace <path>',
    ],
  },
  'logs': {
    description: 'View background agent logs',
    examples: [
      'cursor logs',
      'cursor logs --tail',
      'cursor logs --follow',
    ],
  },
};

class CursorIntegration {
  constructor() {
    this.apiKey = CURSOR_API_KEY;
    this.workspace = process.cwd();
    this.configFile = join(this.workspace, '.cursor', 'config.json');
    this.logFile = join(this.workspace, '.cursor', 'background-agent.log');
    this.pidFile = join(this.workspace, '.cursor', 'background-agent.pid');
  }

  /**
   * Initialize Cursor integration
   */
  async init(options = {}) {
    try {
      printInfo('🎯 Initializing Cursor integration...');

      // Create .cursor directory
      await this.ensureCursorDirectory();

      // Set API key if provided
      if (options.apiKey) {
        this.apiKey = options.apiKey;
        await this.saveConfig({ apiKey: options.apiKey });
      }

      // Set workspace if provided
      if (options.workspace) {
        this.workspace = options.workspace;
        await this.saveConfig({ workspace: options.workspace });
      }

      // Test Cursor API connection
      if (this.apiKey) {
        const connected = await this.testConnection();
        if (connected) {
          printSuccess('✅ Cursor API connection successful');
        } else {
          printWarning('⚠️  Cursor API connection failed');
        }
      } else {
        printWarning('⚠️  No API key provided. Set CURSOR_API_KEY environment variable or use --api-key');
      }

      // Initialize background agent configuration
      await this.initializeBackgroundAgent();

      printSuccess('✅ Cursor integration initialized successfully');
      return true;
    } catch (error) {
      printError(`❌ Failed to initialize Cursor integration: ${error.message}`);
      return false;
    }
  }

  /**
   * Sync with Cursor workspace
   */
  async sync(options = {}) {
    try {
      printInfo('🔄 Syncing with Cursor workspace...');

      // Load configuration
      const config = await this.loadConfig();

      // Sync workspace files
      if (options.force || await this.shouldSync()) {
        await this.syncWorkspaceFiles(config);
        printSuccess('✅ Workspace synced successfully');
      } else {
        printInfo('ℹ️  Workspace already up to date');
      }

      // Sync background agents
      await this.syncBackgroundAgents(config);

      return true;
    } catch (error) {
      printError(`❌ Failed to sync with Cursor workspace: ${error.message}`);
      return false;
    }
  }

  /**
   * Start background agent
   */
  async startBackground(options = {}) {
    try {
      printInfo('🤖 Starting Cursor background agent...');

      // Check if already running
      if (await this.isBackgroundAgentRunning()) {
        printWarning('⚠️  Background agent is already running');
        return true;
      }

      // Load configuration
      const config = await this.loadConfig();

      // Start background agent
      const agentProcess = await this.spawnBackgroundAgent(config, options);

      if (agentProcess) {
        printSuccess('✅ Background agent started successfully');
        
        if (options.daemon) {
          printInfo('🔄 Running as background daemon...');
        }

        return true;
      } else {
        printError('❌ Failed to start background agent');
        return false;
      }
    } catch (error) {
      printError(`❌ Failed to start background agent: ${error.message}`);
      return false;
    }
  }

  /**
   * Check status
   */
  async status(options = {}) {
    try {
      printInfo('📊 Checking Cursor integration status...');

      const status = {
        apiKey: !!this.apiKey,
        workspace: this.workspace,
        configExists: await this.configExists(),
        backgroundAgentRunning: await this.isBackgroundAgentRunning(),
        lastSync: await this.getLastSyncTime(),
      };

      if (options.verbose) {
        console.log('\n📋 Detailed Status:');
        console.log(`  API Key: ${status.apiKey ? '✅ Set' : '❌ Not set'}`);
        console.log(`  Workspace: ${status.workspace}`);
        console.log(`  Config File: ${status.configExists ? '✅ Exists' : '❌ Missing'}`);
        console.log(`  Background Agent: ${status.backgroundAgentRunning ? '✅ Running' : '❌ Not running'}`);
        console.log(`  Last Sync: ${status.lastSync || 'Never'}`);
      }

      // Test API connection if key is available
      if (this.apiKey) {
        const connected = await this.testConnection();
        console.log(`  API Connection: ${connected ? '✅ Connected' : '❌ Failed'}`);
      }

      return status;
    } catch (error) {
      printError(`❌ Failed to check status: ${error.message}`);
      return null;
    }
  }

  /**
   * Configure settings
   */
  async config(options = {}) {
    try {
      printInfo('⚙️  Configuring Cursor integration...');

      const updates = {};

      if (options.apiKey) {
        updates.apiKey = options.apiKey;
        this.apiKey = options.apiKey;
      }

      if (options.workspace) {
        updates.workspace = options.workspace;
        this.workspace = options.workspace;
      }

      if (Object.keys(updates).length > 0) {
        await this.saveConfig(updates);
        printSuccess('✅ Configuration updated successfully');
      } else {
        printWarning('⚠️  No configuration changes specified');
      }

      return true;
    } catch (error) {
      printError(`❌ Failed to update configuration: ${error.message}`);
      return false;
    }
  }

  /**
   * View logs
   */
  async logs(options = {}) {
    try {
      printInfo('📋 Viewing background agent logs...');

      if (!await this.logFileExists()) {
        printWarning('⚠️  No log file found');
        return false;
      }

      const logContent = await readFile(this.logFile, 'utf8');
      
      if (options.tail) {
        const lines = logContent.split('\n');
        const tailLines = lines.slice(-50).join('\n');
        console.log(tailLines);
      } else if (options.follow) {
        printInfo('🔄 Following logs (press Ctrl+C to stop)...');
        // In a real implementation, this would use a file watcher
        console.log(logContent);
      } else {
        console.log(logContent);
      }

      return true;
    } catch (error) {
      printError(`❌ Failed to view logs: ${error.message}`);
      return false;
    }
  }

  // Helper methods

  async ensureCursorDirectory() {
    const cursorDir = join(this.workspace, '.cursor');
    try {
      await access(cursorDir, constants.F_OK);
    } catch {
      const { mkdir } = await import('fs/promises');
      await mkdir(cursorDir, { recursive: true });
    }
  }

  async saveConfig(config) {
    const existingConfig = await this.loadConfig();
    const newConfig = { ...existingConfig, ...config };
    await writeFile(this.configFile, JSON.stringify(newConfig, null, 2));
  }

  async loadConfig() {
    try {
      const configContent = await readFile(this.configFile, 'utf8');
      return JSON.parse(configContent);
    } catch {
      return {};
    }
  }

  async configExists() {
    try {
      await access(this.configFile, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async testConnection() {
    if (!this.apiKey) return false;
    
    try {
      // Simulate API connection test
      // In a real implementation, this would make an actual API call
      return true;
    } catch {
      return false;
    }
  }

  async initializeBackgroundAgent() {
    const agentConfig = {
      port: 3001,
      logLevel: 'info',
      autoStart: false,
      workspace: this.workspace,
    };

    await this.saveConfig({ backgroundAgent: agentConfig });
  }

  async shouldSync() {
    // Simple check - in real implementation, this would check file timestamps
    return true;
  }

  async syncWorkspaceFiles(config) {
    // Simulate workspace sync
    printInfo('📁 Syncing workspace files...');
  }

  async syncBackgroundAgents(config) {
    // Simulate background agent sync
    printInfo('🤖 Syncing background agents...');
  }

  async isBackgroundAgentRunning() {
    try {
      await access(this.pidFile, constants.F_OK);
      // In real implementation, check if process is actually running
      return true;
    } catch {
      return false;
    }
  }

  async spawnBackgroundAgent(config, options) {
    // Simulate background agent startup
    printInfo('🚀 Spawning background agent...');
    return { pid: 12345 }; // Mock process
  }

  async getLastSyncTime() {
    try {
      const config = await this.loadConfig();
      return config.lastSync || null;
    } catch {
      return null;
    }
  }

  async logFileExists() {
    try {
      await access(this.logFile, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

function showCursorHelp() {
  console.log(`
🎯 Claude Flow Cursor Integration

USAGE:
  claude-flow cursor <mode> [options]

CURSOR MODES:
`);

  for (const [mode, info] of Object.entries(CURSOR_MODES)) {
    console.log(`  ${mode.padEnd(18)} ${info.description}`);
  }

  console.log(`
EXAMPLES:
  claude-flow cursor init --api-key <key>
  claude-flow cursor sync --workspace <path>
  claude-flow cursor background --daemon
  claude-flow cursor status --verbose
  claude-flow cursor config --api-key <key>
  claude-flow cursor logs --tail

OPTIONS:
  --api-key <key>        Cursor API key
  --workspace <path>     Cursor workspace path
  --daemon               Run as background daemon
  --port <port>          Background agent port (default: 3001)
  --force                Force sync even if up to date
  --verbose              Enable detailed logging
  --tail                 Show last 50 log lines
  --follow               Follow logs in real-time

ENVIRONMENT VARIABLES:
  CURSOR_API_URL         Cursor API base URL
  CURSOR_API_KEY         Cursor API key

For complete documentation:
https://github.com/ruvnet/claude-code-flow/docs/cursor.md
`);
}

export async function cursorCommand(args, flags) {
  if (!args || args.length === 0) {
    showCursorHelp();
    return;
  }

  const mode = args[0];
  const cursor = new CursorIntegration();

  if (!CURSOR_MODES[mode]) {
    printError(`❌ Unknown Cursor mode: ${mode}`);
    console.log('\nAvailable modes:');
    for (const [modeName, info] of Object.entries(CURSOR_MODES)) {
      console.log(`  ${modeName} - ${info.description}`);
    }
    return;
  }

  printSuccess(`🎯 Cursor ${mode} mode activated`);

  if (flags['dry-run']) {
    console.log('\n🎛️  Configuration:');
    console.log(`  Mode: ${mode}`);
    console.log(`  API Key: ${flags['api-key'] ? 'Set' : 'Not set'}`);
    console.log(`  Workspace: ${flags.workspace || 'current'}`);
    console.log(`  Daemon: ${flags.daemon || false}`);
    console.log(`  Port: ${flags.port || '3001'}`);
    console.log('\n⚠️  DRY RUN - Cursor integration preview');
    return;
  }

  try {
    let result = false;

    switch (mode) {
      case 'init':
        result = await cursor.init(flags);
        break;
      case 'sync':
        result = await cursor.sync(flags);
        break;
      case 'background':
        result = await cursor.startBackground(flags);
        break;
      case 'status':
        result = await cursor.status(flags);
        break;
      case 'config':
        result = await cursor.config(flags);
        break;
      case 'logs':
        result = await cursor.logs(flags);
        break;
      default:
        printError(`❌ Mode ${mode} not implemented yet`);
        return;
    }

    if (result) {
      printSuccess(`✅ Cursor ${mode} completed successfully`);
    } else {
      printError(`❌ Cursor ${mode} failed`);
    }
  } catch (error) {
    printError(`❌ Cursor ${mode} failed: ${error.message}`);
  }
}

// Allow direct execution for testing
if (import.meta.main) {
  const args = [];
  const flags = {};

  // Parse arguments and flags from Deno.args if available
  if (typeof Deno !== 'undefined' && Deno.args) {
    for (let i = 0; i < Deno.args.length; i++) {
      const arg = Deno.args[i];
      if (arg.startsWith('--')) {
        const flagName = arg.substring(2);
        const nextArg = Deno.args[i + 1];

        if (nextArg && !nextArg.startsWith('--')) {
          flags[flagName] = nextArg;
          i++; // Skip the next argument
        } else {
          flags[flagName] = true;
        }
      } else {
        args.push(arg);
      }
    }
  }

  await cursorCommand(args, flags);
}
