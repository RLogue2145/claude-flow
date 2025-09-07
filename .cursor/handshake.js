#!/usr/bin/env node
/**
 * Cursor GitHub Handshake for Background Agents
 * This handles the local authorization handshake with Cursor
 */

import { printSuccess, printError, printInfo } from '../src/cli/utils.js';

class CursorHandshake {
  constructor() {
    this.cursorApiUrl = 'https://api.cursor.sh/v1';
    this.githubToken = process.env.GITHUB_TOKEN;
    this.repository = process.env.GITHUB_REPOSITORY || 'ruvnet/claude-code-flow';
  }

  async performHandshake() {
    try {
      printInfo('🤝 Performing Cursor GitHub handshake...');

      // Verify GitHub token
      if (!this.githubToken) {
        printError('❌ GITHUB_TOKEN environment variable not set');
        return false;
      }

      // Test GitHub API access
      const githubResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!githubResponse.ok) {
        printError('❌ GitHub API access failed');
        return false;
      }

      const githubUser = await githubResponse.json();
      printInfo(`✅ GitHub authenticated as: ${githubUser.login}`);

      // Test repository access
      const repoResponse = await fetch(`https://api.github.com/repos/${this.repository}`, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!repoResponse.ok) {
        printError(`❌ Repository access failed: ${this.repository}`);
        return false;
      }

      const repo = await repoResponse.json();
      printInfo(`✅ Repository access confirmed: ${repo.full_name}`);

      // Perform Cursor handshake
      const handshakeResponse = await fetch(`${this.cursorApiUrl}/agents/handshake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.githubToken}`
        },
        body: JSON.stringify({
          repository: this.repository,
          permissions: {
            actions: 'write',
            contents: 'read',
            metadata: 'read',
            pull_requests: 'write',
            issues: 'write'
          },
          webhook_events: ['push', 'pull_request', 'issues', 'workflow_run']
        })
      });

      if (handshakeResponse.ok) {
        const result = await handshakeResponse.json();
        printSuccess('✅ Cursor handshake successful');
        printInfo(`🎯 Background agents enabled for: ${this.repository}`);
        return true;
      } else {
        printError('❌ Cursor handshake failed');
        return false;
      }

    } catch (error) {
      printError(`❌ Handshake error: ${error.message}`);
      return false;
    }
  }
}

// Run handshake if called directly
if (import.meta.main) {
  const handshake = new CursorHandshake();
  handshake.performHandshake().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export default CursorHandshake;
