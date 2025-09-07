#!/usr/bin/env node
/**
 * Cursor Background Agent Manager
 * Manages background agents for Cursor IDE integration
 */

import { printSuccess, printError, printWarning, printInfo } from '../utils.js';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, access, constants } from 'fs/promises';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

class CursorBackgroundAgent extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.workspace = options.workspace || process.cwd();
    this.port = options.port || 3001;
    this.logLevel = options.logLevel || 'info';
    this.autoStart = options.autoStart || false;
    this.pidFile = join(this.workspace, '.cursor', 'background-agent.pid');
    this.logFile = join(this.workspace, '.cursor', 'background-agent.log');
    this.configFile = join(this.workspace, '.cursor', 'config.json');
    
    this.process = null;
    this.isRunning = false;
    this.restartCount = 0;
    this.maxRestarts = 5;
    
    // GitHub integration
    this.githubAPI = null;
    this.githubConnected = false;
    
    // Memory management
    this.memoryStore = new Map();
    this.memoryFile = join(this.workspace, '.cursor', 'memory.json');
    
    // Event handlers
    this.setupEventHandlers();
  }

  /**
   * Start the background agent
   */
  async start() {
    try {
      printInfo('🤖 Starting Cursor background agent...');

      // Check if already running
      if (await this.isRunning()) {
        printWarning('⚠️  Background agent is already running');
        return true;
      }

      // Initialize components
      await this.initializeComponents();

      // Start the main process
      await this.startMainProcess();

      // Start monitoring
      this.startMonitoring();

      printSuccess('✅ Cursor background agent started successfully');
      this.emit('started');
      return true;
    } catch (error) {
      printError(`❌ Failed to start background agent: ${error.message}`);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Stop the background agent
   */
  async stop() {
    try {
      printInfo('🛑 Stopping Cursor background agent...');

      if (this.process) {
        this.process.kill('SIGTERM');
        await this.waitForProcessExit();
      }

      // Clean up PID file
      try {
        await access(this.pidFile, constants.F_OK);
        await execAsync(`rm ${this.pidFile}`);
      } catch {
        // PID file doesn't exist, that's fine
      }

      this.isRunning = false;
      printSuccess('✅ Cursor background agent stopped');
      this.emit('stopped');
      return true;
    } catch (error) {
      printError(`❌ Failed to stop background agent: ${error.message}`);
      return false;
    }
  }

  /**
   * Restart the background agent
   */
  async restart() {
    printInfo('🔄 Restarting Cursor background agent...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    return await this.start();
  }

  /**
   * Get agent status
   */
  async getStatus() {
    const status = {
      isRunning: this.isRunning,
      pid: this.process ? this.process.pid : null,
      port: this.port,
      restartCount: this.restartCount,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      githubConnected: this.githubConnected,
      memoryEntries: this.memoryStore.size,
    };

    return status;
  }

  /**
   * Initialize components
   */
  async initializeComponents() {
    // Initialize GitHub integration
    await this.initializeGitHubIntegration();

    // Initialize memory management
    await this.initializeMemoryManagement();

    // Load configuration
    await this.loadConfiguration();
  }

  /**
   * Initialize GitHub integration
   */
  async initializeGitHubIntegration() {
    try {
      const { GitHubAPIClient } = await import('./github/github-api.js');
      this.githubAPI = new GitHubAPIClient();
      
      const connected = await this.githubAPI.authenticate();
      this.githubConnected = connected;
      
      if (connected) {
        printInfo('✅ GitHub integration initialized');
      } else {
        printWarning('⚠️  GitHub integration failed to connect');
      }
    } catch (error) {
      printWarning(`⚠️  GitHub integration error: ${error.message}`);
    }
  }

  /**
   * Initialize memory management
   */
  async initializeMemoryManagement() {
    try {
      // Load existing memory
      await this.loadMemory();
      printInfo('✅ Memory management initialized');
    } catch (error) {
      printWarning(`⚠️  Memory management error: ${error.message}`);
    }
  }

  /**
   * Load configuration
   */
  async loadConfiguration() {
    try {
      const configContent = await readFile(this.configFile, 'utf8');
      const config = JSON.parse(configContent);
      
      // Update settings from config
      if (config.backgroundAgent) {
        this.port = config.backgroundAgent.port || this.port;
        this.logLevel = config.backgroundAgent.logLevel || this.logLevel;
      }
      
      printInfo('✅ Configuration loaded');
    } catch (error) {
      printWarning(`⚠️  Configuration load error: ${error.message}`);
    }
  }

  /**
   * Start main process
   */
  async startMainProcess() {
    return new Promise((resolve, reject) => {
      // Start the background agent process
      const agentScript = `
        const { EventEmitter } = require('events');
        const http = require('http');
        
        class BackgroundAgentProcess extends EventEmitter {
          constructor(port) {
            super();
            this.port = port;
            this.server = null;
          }
          
          start() {
            this.server = http.createServer((req, res) => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                status: 'running', 
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
              }));
            });
            
            this.server.listen(this.port, () => {
              console.log(\`Background agent running on port \${this.port}\`);
              this.emit('started');
            });
          }
          
          stop() {
            if (this.server) {
              this.server.close(() => {
                this.emit('stopped');
              });
            }
          }
        }
        
        const agent = new BackgroundAgentProcess(${this.port});
        agent.start();
        
        process.on('SIGTERM', () => agent.stop());
        process.on('SIGINT', () => agent.stop());
      `;

      this.process = spawn('node', ['-e', agentScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
      });

      this.process.on('error', (error) => {
        printError(`❌ Process error: ${error.message}`);
        reject(error);
      });

      this.process.on('exit', (code, signal) => {
        printInfo(`🔄 Process exited with code ${code}, signal ${signal}`);
        this.isRunning = false;
        this.emit('exited', { code, signal });
      });

      this.process.stdout.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          printInfo(`📝 ${message}`);
          this.log(message);
        }
      });

      this.process.stderr.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          printWarning(`⚠️  ${message}`);
          this.log(`ERROR: ${message}`);
        }
      });

      // Wait for process to start
      setTimeout(() => {
        this.isRunning = true;
        this.startTime = Date.now();
        
        // Save PID
        this.savePID();
        
        resolve();
      }, 1000);
    });
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000);

    // Memory cleanup every 5 minutes
    this.memoryCleanupInterval = setInterval(async () => {
      await this.performMemoryCleanup();
    }, 300000);

    // GitHub sync every 10 minutes
    this.githubSyncInterval = setInterval(async () => {
      await this.performGitHubSync();
    }, 600000);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
    }
    if (this.githubSyncInterval) {
      clearInterval(this.githubSyncInterval);
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    try {
      // Check if process is still running
      if (!this.isRunning || !this.process) {
        printWarning('⚠️  Background agent process not running');
        await this.handleProcessFailure();
        return;
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
        printWarning('⚠️  High memory usage detected');
        await this.performMemoryCleanup();
      }

      // Check GitHub connection
      if (this.githubAPI && !this.githubConnected) {
        printWarning('⚠️  GitHub connection lost, attempting to reconnect...');
        await this.initializeGitHubIntegration();
      }

      this.log('Health check passed');
    } catch (error) {
      printError(`❌ Health check failed: ${error.message}`);
      this.log(`ERROR: Health check failed - ${error.message}`);
    }
  }

  /**
   * Perform memory cleanup
   */
  async performMemoryCleanup() {
    try {
      // Clean up old memory entries
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      for (const [key, entry] of this.memoryStore.entries()) {
        if (now - entry.timestamp > maxAge) {
          this.memoryStore.delete(key);
        }
      }

      // Save memory to disk
      await this.saveMemory();

      this.log('Memory cleanup completed');
    } catch (error) {
      printError(`❌ Memory cleanup failed: ${error.message}`);
    }
  }

  /**
   * Perform GitHub sync for swarm coordination
   */
  async performGitHubSync() {
    try {
      if (!this.githubAPI || !this.githubConnected) {
        return;
      }

      // Sync GitHub data for swarm context
      const repos = await this.githubAPI.listRepositories({ perPage: 10 });
      if (repos.success) {
        // Store in swarm memory format
        await this.memoryManager.store({
          id: 'github:repositories',
          agentId: 'cursor-background-agent',
          type: 'github-sync',
          content: JSON.stringify(repos.data),
          namespace: 'swarm-coordination',
          timestamp: new Date(),
          metadata: {
            source: 'github-api',
            syncType: 'repository-list',
            swarmContext: true,
          },
        });
        this.log('GitHub sync completed for swarm coordination');
      }
    } catch (error) {
      printError(`❌ GitHub sync failed: ${error.message}`);
    }
  }

  /**
   * Handle process failure
   */
  async handleProcessFailure() {
    this.restartCount++;
    
    if (this.restartCount <= this.maxRestarts) {
      printWarning(`⚠️  Process failed, restarting (${this.restartCount}/${this.maxRestarts})...`);
      await this.restart();
    } else {
      printError('❌ Max restart attempts exceeded, giving up');
      this.emit('failed');
    }
  }

  /**
   * Wait for process exit
   */
  async waitForProcessExit(timeout = 5000) {
    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        printWarning('⚠️  Process exit timeout, forcing kill');
        this.process.kill('SIGKILL');
        resolve();
      }, timeout);

      this.process.on('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /**
   * Check if running
   */
  async isRunning() {
    if (!this.process) return false;
    
    try {
      // Check if process is still alive
      process.kill(this.process.pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save PID
   */
  async savePID() {
    try {
      await writeFile(this.pidFile, this.process.pid.toString());
    } catch (error) {
      printWarning(`⚠️  Failed to save PID: ${error.message}`);
    }
  }

  /**
   * Load memory
   */
  async loadMemory() {
    try {
      const memoryContent = await readFile(this.memoryFile, 'utf8');
      const memoryData = JSON.parse(memoryContent);
      
      for (const [key, value] of Object.entries(memoryData)) {
        this.memoryStore.set(key, value);
      }
    } catch {
      // Memory file doesn't exist or is invalid, start fresh
    }
  }

  /**
   * Save memory
   */
  async saveMemory() {
    try {
      const memoryData = Object.fromEntries(this.memoryStore);
      await writeFile(this.memoryFile, JSON.stringify(memoryData, null, 2));
    } catch (error) {
      printWarning(`⚠️  Failed to save memory: ${error.message}`);
    }
  }

  /**
   * Log message
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    // Write to log file
    writeFile(this.logFile, logEntry, { flag: 'a' }).catch(() => {
      // Ignore log write errors
    });
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('started', () => {
      this.log('Background agent started');
    });

    this.on('stopped', () => {
      this.log('Background agent stopped');
      this.stopMonitoring();
    });

    this.on('error', (error) => {
      this.log(`ERROR: ${error.message}`);
    });

    this.on('failed', () => {
      this.log('Background agent failed permanently');
      this.stopMonitoring();
    });
  }

  /**
   * Cleanup on exit
   */
  async cleanup() {
    this.stopMonitoring();
    await this.saveMemory();
    await this.stop();
  }
}

// CLI interface
export async function cursorBackgroundAgentCommand(args, flags) {
  const options = {
    workspace: flags.workspace || process.cwd(),
    port: parseInt(flags.port) || 3001,
    logLevel: flags['log-level'] || 'info',
    autoStart: flags['auto-start'] || false,
  };

  const agent = new CursorBackgroundAgent(options);

  // Handle process signals
  process.on('SIGINT', async () => {
    printInfo('\n🛑 Received SIGINT, shutting down...');
    await agent.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    printInfo('\n🛑 Received SIGTERM, shutting down...');
    await agent.cleanup();
    process.exit(0);
  });

  try {
    if (args[0] === 'start') {
      await agent.start();
      
      if (flags.daemon) {
        printInfo('🔄 Running as daemon, press Ctrl+C to stop');
        // Keep the process running
        process.stdin.resume();
      }
    } else if (args[0] === 'stop') {
      await agent.stop();
    } else if (args[0] === 'restart') {
      await agent.restart();
    } else if (args[0] === 'status') {
      const status = await agent.getStatus();
      console.log('\n📊 Background Agent Status:');
      console.log(`  Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
      console.log(`  PID: ${status.pid || 'N/A'}`);
      console.log(`  Port: ${status.port}`);
      console.log(`  Restart Count: ${status.restartCount}`);
      console.log(`  Uptime: ${Math.floor(status.uptime / 1000)}s`);
      console.log(`  GitHub Connected: ${status.githubConnected ? '✅ Yes' : '❌ No'}`);
      console.log(`  Memory Entries: ${status.memoryEntries}`);
    } else {
      printError('❌ Unknown command. Use: start, stop, restart, or status');
    }
  } catch (error) {
    printError(`❌ Command failed: ${error.message}`);
  }
}

// Allow direct execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  const flags = {};
  
  // Parse flags
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const flagName = arg.substring(2);
      const nextArg = args[i + 1];
      
      if (nextArg && !nextArg.startsWith('--')) {
        flags[flagName] = nextArg;
        i++; // Skip the next argument
      } else {
        flags[flagName] = true;
      }
    }
  }
  
  await cursorBackgroundAgentCommand(args, flags);
}
