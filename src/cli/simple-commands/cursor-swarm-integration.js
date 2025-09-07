#!/usr/bin/env node
/**
 * Cursor Swarm Integration for Background Agents
 * Integrates Cursor IDE with claude-flow's hive mind and swarm intelligence
 */

import { printSuccess, printError, printWarning, printInfo } from '../utils.js';
import { EventEmitter } from 'events';
import { join } from 'path';

class CursorSwarmIntegration extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.workspace = options.workspace || process.cwd();
    this.cursorConfig = {
      apiUrl: process.env.CURSOR_API_URL,
      apiKey: process.env.CURSOR_API_KEY,
      workspace: this.workspace,
    };
    
    // Swarm coordination
    this.swarmCoordinator = null;
    this.memoryManager = null;
    this.activeSwarms = new Map();
    
    // Background processes for swarm management
    this.swarmHeartbeat = null;
    this.taskProcessor = null;
    this.memorySync = null;
  }

  /**
   * Initialize Cursor integration with swarm systems
   */
  async initialize() {
    try {
      printInfo('🐝 Initializing Cursor-Swarm integration...');

      // Initialize swarm coordinator
      await this.initializeSwarmCoordinator();
      
      // Initialize memory manager for hive mind
      await this.initializeMemoryManager();
      
      // Start background swarm processes
      await this.startSwarmBackgroundProcesses();
      
      // Connect to Cursor API
      await this.connectToCursor();
      
      printSuccess('✅ Cursor-Swarm integration initialized');
      this.emit('initialized');
      return true;
    } catch (error) {
      printError(`❌ Failed to initialize Cursor-Swarm integration: ${error.message}`);
      return false;
    }
  }

  /**
   * Initialize swarm coordinator for multi-agent coordination
   */
  async initializeSwarmCoordinator() {
    try {
      // Import the actual SwarmCoordinator from claude-flow
      const { SwarmCoordinator } = await import('../../swarm/coordinator.js');
      
      this.swarmCoordinator = new SwarmCoordinator({
        maxAgents: 10,
        maxConcurrentTasks: 5,
        taskTimeout: 30 * 60 * 1000, // 30 minutes
        enableMonitoring: true,
        coordinationStrategy: 'auto',
      });

      // Set up swarm event handlers
      this.swarmCoordinator.on('swarm:started', (data) => {
        printInfo(`🐝 Swarm started: ${data.swarmId}`);
        this.emit('swarm:started', data);
      });

      this.swarmCoordinator.on('swarm:completed', (data) => {
        printInfo(`✅ Swarm completed: ${data.swarmId}`);
        this.emit('swarm:completed', data);
      });

      this.swarmCoordinator.on('agent:assigned', (data) => {
        printInfo(`🤖 Agent assigned: ${data.agentId} to task ${data.taskId}`);
        this.emit('agent:assigned', data);
      });

      printInfo('✅ Swarm coordinator initialized');
    } catch (error) {
      printWarning(`⚠️  Swarm coordinator initialization failed: ${error.message}`);
      // Fallback to basic coordination
      this.swarmCoordinator = this.createFallbackCoordinator();
    }
  }

  /**
   * Initialize memory manager for hive mind persistence
   */
  async initializeMemoryManager() {
    try {
      // Import the actual MemoryManager from claude-flow
      const { MemoryManager } = await import('../../memory/memory-manager.js');
      
      this.memoryManager = new MemoryManager({
        backend: 'sqlite',
        namespace: 'cursor-swarm',
        cacheSizeMB: 50,
        syncOnExit: true,
        maxEntries: 10000,
        ttlMinutes: 1440, // 24 hours
      });

      printInfo('✅ Memory manager initialized for hive mind');
    } catch (error) {
      printWarning(`⚠️  Memory manager initialization failed: ${error.message}`);
      // Fallback to basic memory
      this.memoryManager = this.createFallbackMemory();
    }
  }

  /**
   * Start background processes for swarm management
   */
  async startSwarmBackgroundProcesses() {
    // Swarm heartbeat - keeps agents alive and coordinated
    this.swarmHeartbeat = setInterval(async () => {
      await this.performSwarmHeartbeat();
    }, 30000); // Every 30 seconds

    // Task processor - processes queued tasks
    this.taskProcessor = setInterval(async () => {
      await this.processQueuedTasks();
    }, 5000); // Every 5 seconds

    // Memory sync - syncs with hive mind
    this.memorySync = setInterval(async () => {
      await this.syncWithHiveMind();
    }, 60000); // Every minute

    printInfo('✅ Swarm background processes started');
  }

  /**
   * Connect to Cursor API
   */
  async connectToCursor() {
    try {
      if (!this.cursorConfig.apiKey) {
        printWarning('⚠️  No Cursor API key provided');
        return false;
      }

      // Test Cursor API connection
      const response = await fetch(`${this.cursorConfig.apiUrl}/api/status`, {
        headers: {
          'Authorization': `Bearer ${this.cursorConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        printSuccess('✅ Connected to Cursor API');
        return true;
      } else {
        printWarning('⚠️  Cursor API connection failed');
        return false;
      }
    } catch (error) {
      printWarning(`⚠️  Cursor API error: ${error.message}`);
      return false;
    }
  }

  /**
   * Create a new swarm for Cursor-based task
   */
  async createSwarm(objective, options = {}) {
    try {
      printInfo(`🐝 Creating swarm for: ${objective}`);

      const swarmConfig = {
        objective: {
          id: `cursor-swarm-${Date.now()}`,
          description: objective,
          strategy: options.strategy || 'auto',
          requirements: {
            maxAgents: options.maxAgents || 3,
            maxConcurrentTasks: options.maxConcurrentTasks || 2,
            timeout: options.timeout || 30 * 60 * 1000, // 30 minutes
          },
          context: {
            workspace: this.workspace,
            cursorIntegration: true,
            backgroundAgent: true,
          },
        },
      };

      // Create swarm using coordinator
      const swarmId = await this.swarmCoordinator.createSwarm(swarmConfig.objective);
      
      // Store in active swarms
      this.activeSwarms.set(swarmId, {
        objective,
        config: swarmConfig,
        startTime: new Date(),
        status: 'active',
      });

      // Store in memory for hive mind
      await this.memoryManager.store({
        id: `swarm:${swarmId}`,
        agentId: 'cursor-swarm-integration',
        type: 'swarm-creation',
        content: JSON.stringify(swarmConfig),
        namespace: 'cursor-swarm',
        timestamp: new Date(),
        metadata: {
          objective,
          workspace: this.workspace,
          cursorIntegration: true,
        },
      });

      printSuccess(`✅ Swarm created: ${swarmId}`);
      this.emit('swarm:created', { swarmId, objective });
      
      return swarmId;
    } catch (error) {
      printError(`❌ Failed to create swarm: ${error.message}`);
      return null;
    }
  }

  /**
   * Perform swarm heartbeat to keep agents coordinated
   */
  async performSwarmHeartbeat() {
    try {
      // Check active swarms
      for (const [swarmId, swarm] of this.activeSwarms) {
        // Update swarm status
        const status = await this.swarmCoordinator.getSwarmStatus(swarmId);
        
        if (status === 'completed' || status === 'failed') {
          this.activeSwarms.delete(swarmId);
          this.emit('swarm:finished', { swarmId, status });
        }
      }

      // Sync with Cursor workspace
      await this.syncWithCursorWorkspace();
      
    } catch (error) {
      printWarning(`⚠️  Swarm heartbeat failed: ${error.message}`);
    }
  }

  /**
   * Process queued tasks for active swarms
   */
  async processQueuedTasks() {
    try {
      // Get queued tasks from coordinator
      const queuedTasks = await this.swarmCoordinator.getQueuedTasks();
      
      if (queuedTasks.length > 0) {
        printInfo(`📋 Processing ${queuedTasks.length} queued tasks`);
        
        // Process tasks in coordination with Cursor
        for (const task of queuedTasks) {
          await this.processTaskWithCursor(task);
        }
      }
    } catch (error) {
      printWarning(`⚠️  Task processing failed: ${error.message}`);
    }
  }

  /**
   * Process a task with Cursor integration
   */
  async processTaskWithCursor(task) {
    try {
      // Send task to Cursor for execution
      const response = await fetch(`${this.cursorConfig.apiUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.cursorConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: task.id,
          description: task.description,
          workspace: this.workspace,
          context: task.context,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update task status in coordinator
        await this.swarmCoordinator.updateTaskStatus(task.id, 'completed', result);
        
        printInfo(`✅ Task completed: ${task.id}`);
      }
    } catch (error) {
      printWarning(`⚠️  Task execution failed: ${error.message}`);
      await this.swarmCoordinator.updateTaskStatus(task.id, 'failed', { error: error.message });
    }
  }

  /**
   * Sync with hive mind memory
   */
  async syncWithHiveMind() {
    try {
      // Get recent memory entries
      const recentEntries = await this.memoryManager.query({
        namespace: 'cursor-swarm',
        limit: 100,
        orderBy: 'timestamp',
        order: 'desc',
      });

      // Sync with Cursor workspace
      await this.syncWithCursorWorkspace();
      
    } catch (error) {
      printWarning(`⚠️  Hive mind sync failed: ${error.message}`);
    }
  }

  /**
   * Sync with Cursor workspace
   */
  async syncWithCursorWorkspace() {
    try {
      // Get workspace state from Cursor
      const response = await fetch(`${this.cursorConfig.apiUrl}/api/workspace/state`, {
        headers: {
          'Authorization': `Bearer ${this.cursorConfig.apiKey}`,
        },
      });

      if (response.ok) {
        const workspaceState = await response.json();
        
        // Store in memory for swarm context
        await this.memoryManager.store({
          id: 'cursor:workspace-state',
          agentId: 'cursor-swarm-integration',
          type: 'workspace-sync',
          content: JSON.stringify(workspaceState),
          namespace: 'cursor-swarm',
          timestamp: new Date(),
          metadata: {
            source: 'cursor-api',
            syncType: 'workspace-state',
          },
        });
      }
    } catch (error) {
      printWarning(`⚠️  Cursor workspace sync failed: ${error.message}`);
    }
  }

  /**
   * Get swarm status and metrics
   */
  async getSwarmStatus() {
    const status = {
      activeSwarms: this.activeSwarms.size,
      coordinatorStatus: this.swarmCoordinator ? 'active' : 'inactive',
      memoryManagerStatus: this.memoryManager ? 'active' : 'inactive',
      cursorConnection: this.cursorConfig.apiKey ? 'configured' : 'not configured',
      backgroundProcesses: {
        heartbeat: !!this.swarmHeartbeat,
        taskProcessor: !!this.taskProcessor,
        memorySync: !!this.memorySync,
      },
    };

    return status;
  }

  /**
   * Create fallback coordinator for when imports fail
   */
  createFallbackCoordinator() {
    return {
      createSwarm: async (objective) => {
        const swarmId = `fallback-${Date.now()}`;
        printWarning(`⚠️  Using fallback coordinator for swarm: ${swarmId}`);
        return swarmId;
      },
      getSwarmStatus: async (swarmId) => 'active',
      getQueuedTasks: async () => [],
      updateTaskStatus: async (taskId, status, result) => {
        printInfo(`📋 Task ${taskId} status: ${status}`);
      },
    };
  }

  /**
   * Create fallback memory manager
   */
  createFallbackMemory() {
    return {
      store: async (entry) => {
        printInfo(`💾 Storing: ${entry.id}`);
      },
      query: async (options) => [],
    };
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup() {
    printInfo('🧹 Cleaning up Cursor-Swarm integration...');
    
    // Clear intervals
    if (this.swarmHeartbeat) clearInterval(this.swarmHeartbeat);
    if (this.taskProcessor) clearInterval(this.taskProcessor);
    if (this.memorySync) clearInterval(this.memorySync);
    
    // Cleanup coordinator
    if (this.swarmCoordinator && this.swarmCoordinator.cleanup) {
      await this.swarmCoordinator.cleanup();
    }
    
    // Cleanup memory manager
    if (this.memoryManager && this.memoryManager.cleanup) {
      await this.memoryManager.cleanup();
    }
    
    printSuccess('✅ Cursor-Swarm integration cleaned up');
  }
}

// CLI interface
export async function cursorSwarmIntegrationCommand(args, flags) {
  const options = {
    workspace: flags.workspace || process.cwd(),
    maxAgents: parseInt(flags['max-agents']) || 3,
    maxConcurrentTasks: parseInt(flags['max-concurrent-tasks']) || 2,
    strategy: flags.strategy || 'auto',
  };

  const integration = new CursorSwarmIntegration(options);

  // Handle process signals
  process.on('SIGINT', async () => {
    printInfo('\n🛑 Received SIGINT, shutting down...');
    await integration.cleanup();
    process.exit(0);
  });

  try {
    if (args[0] === 'init') {
      await integration.initialize();
    } else if (args[0] === 'create-swarm') {
      await integration.initialize();
      const objective = args[1] || 'Default swarm objective';
      const swarmId = await integration.createSwarm(objective, options);
      if (swarmId) {
        printSuccess(`✅ Swarm created: ${swarmId}`);
      }
    } else if (args[0] === 'status') {
      await integration.initialize();
      const status = await integration.getSwarmStatus();
      console.log('\n📊 Cursor-Swarm Integration Status:');
      console.log(`  Active Swarms: ${status.activeSwarms}`);
      console.log(`  Coordinator: ${status.coordinatorStatus}`);
      console.log(`  Memory Manager: ${status.memoryManagerStatus}`);
      console.log(`  Cursor Connection: ${status.cursorConnection}`);
      console.log(`  Background Processes: ${JSON.stringify(status.backgroundProcesses, null, 2)}`);
    } else {
      printError('❌ Unknown command. Use: init, create-swarm, or status');
    }
  } catch (error) {
    printError(`❌ Command failed: ${error.message}`);
  } finally {
    await integration.cleanup();
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
  
  await cursorSwarmIntegrationCommand(args, flags);
}
