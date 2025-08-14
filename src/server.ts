import { ChangelogParser } from './parser.ts';
import { ChangelogDiffUtils, TitleUtils } from './utils.ts';
import { cacheManager } from './cache.ts';
import type { ApiResult, RepositoryList, Repository, VersionInfo } from './types.ts';

interface Config {
  port: number;
  repos: string[];
  reposBasePath: string;
  withDates: boolean;
}

export class ChangelogServer {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    const port = parseInt(process.env.PORT || '3000', 10);
    const reposString = process.env.REPOS || '';
    const repos = reposString
      .split(',')
      .map(repo => repo.trim())
      .filter(repo => repo.length > 0);
    
    const reposBasePath = process.env.REPOS_BASE_PATH || '.';
    const withDates = process.env.WITH_DATES?.toLowerCase() === 'true';

    if (repos.length === 0) {
      console.warn('Warning: No repositories configured in REPOS environment variable');
    }

    return { port, repos, reposBasePath, withDates };
  }

  private createResponse<T>(data: T): ApiResult<T> {
    return { success: true, data };
  }

  private createErrorResponse(error: string, code?: string): ApiResult<never> {
    return { success: false, error, code };
  }

  private async handleGetRepos(): Promise<Response> {
    try {
      const validRepos = this.config.repos.filter(repo => 
        ChangelogParser.validateRepository(repo, this.config.reposBasePath)
      );

      const result: RepositoryList = { repositories: validRepos };
      return new Response(JSON.stringify(this.createResponse(result)), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorResponse = this.createErrorResponse(
        `Failed to list repositories: ${(error as Error).message}`,
        'LIST_REPOS_ERROR'
      );
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleGetRepo(repoName: string): Promise<Response> {
    try {
      if (!this.config.repos.includes(repoName)) {
        const errorResponse = this.createErrorResponse(
          `Repository '${repoName}' not found in configuration`,
          'REPO_NOT_CONFIGURED'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!ChangelogParser.validateRepository(repoName, this.config.reposBasePath)) {
        const errorResponse = this.createErrorResponse(
          `Repository '${repoName}' does not have a valid CHANGELOG.md`,
          'CHANGELOG_NOT_FOUND'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const parser = new ChangelogParser(repoName, this.config.reposBasePath);
      const repository = parser.parseChangelog();

      return new Response(JSON.stringify(this.createResponse(repository)), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorResponse = this.createErrorResponse(
        `Failed to parse changelog for repository '${repoName}': ${(error as Error).message}`,
        'PARSE_ERROR'
      );
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleGetVersion(repoName: string, versionName: string): Promise<Response> {
    try {
      if (!this.config.repos.includes(repoName)) {
        const errorResponse = this.createErrorResponse(
          `Repository '${repoName}' not found in configuration`,
          'REPO_NOT_CONFIGURED'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const parser = new ChangelogParser(repoName, this.config.reposBasePath);
      const repository = parser.parseChangelog();

      const version = repository.versions.find(v => v.version === versionName);
      if (!version) {
        const errorResponse = this.createErrorResponse(
          `Version '${versionName}' not found in repository '${repoName}'`,
          'VERSION_NOT_FOUND'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const versionInfo: VersionInfo = {
        version: version.version,
        date: version.date,
        changes: version.changes,
      };

      return new Response(JSON.stringify(this.createResponse(versionInfo)), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorResponse = this.createErrorResponse(
        `Failed to get version '${versionName}' for repository '${repoName}': ${(error as Error).message}`,
        'GET_VERSION_ERROR'
      );
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleGetLatestVersion(repoName: string): Promise<Response> {
    try {
      if (!this.config.repos.includes(repoName)) {
        const errorResponse = this.createErrorResponse(
          `Repository '${repoName}' not found in configuration`,
          'REPO_NOT_CONFIGURED'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const parser = new ChangelogParser(repoName, this.config.reposBasePath);
      const repository = parser.parseChangelog();

      if (repository.versions.length === 0) {
        const errorResponse = this.createErrorResponse(
          `No versions found in repository '${repoName}'`,
          'NO_VERSIONS_FOUND'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Versions are already sorted in reverse chronological order from the parser
      const latestVersion = repository.versions[0]!;
      const versionInfo: VersionInfo = {
        version: latestVersion.version,
        date: latestVersion.date,
        changes: latestVersion.changes,
      };

      return new Response(JSON.stringify(this.createResponse(versionInfo)), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorResponse = this.createErrorResponse(
        `Failed to get latest version for repository '${repoName}': ${(error as Error).message}`,
        'GET_LATEST_ERROR'
      );
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleGetSince(repoName: string, sinceVersion: string | null, customTitle?: string): Promise<Response> {
    try {
      if (!this.config.repos.includes(repoName)) {
        const errorResponse = this.createErrorResponse(
          `Repository '${repoName}' not found in configuration`,
          'REPO_NOT_CONFIGURED'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!ChangelogParser.validateRepository(repoName, this.config.reposBasePath)) {
        const errorResponse = this.createErrorResponse(
          `Repository '${repoName}' does not have a valid CHANGELOG.md`,
          'CHANGELOG_NOT_FOUND'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const parser = new ChangelogParser(repoName, this.config.reposBasePath);
      const repository = parser.parseChangelog();

      // Only validate version exists if one was provided
      if (sinceVersion && sinceVersion.trim() !== '') {
        const baseVersionExists = ChangelogDiffUtils.findVersionInRepository(repository, sinceVersion);
        if (!baseVersionExists) {
          const errorResponse = this.createErrorResponse(
            `Base version '${sinceVersion}' not found in repository '${repoName}'`,
            'VERSION_NOT_FOUND'
          );
          return new Response(JSON.stringify(errorResponse), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      const diff = await ChangelogDiffUtils.createSinceDiff(repository, sinceVersion, customTitle, this.config.withDates);

      return new Response(diff.content, {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    } catch (error) {
      const errorResponse = this.createErrorResponse(
        `Failed to generate diff since '${sinceVersion}' for repository '${repoName}': ${(error as Error).message}`,
        'SINCE_DIFF_ERROR'
      );
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleGetDiff(repoName: string, version1: string, version2: string): Promise<Response> {
    try {
      if (!this.config.repos.includes(repoName)) {
        const errorResponse = this.createErrorResponse(
          `Repository '${repoName}' not found in configuration`,
          'REPO_NOT_CONFIGURED'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!ChangelogParser.validateRepository(repoName, this.config.reposBasePath)) {
        const errorResponse = this.createErrorResponse(
          `Repository '${repoName}' does not have a valid CHANGELOG.md`,
          'CHANGELOG_NOT_FOUND'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (version1 === version2) {
        const errorResponse = this.createErrorResponse(
          'Cannot generate diff between identical versions',
          'IDENTICAL_VERSIONS'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const parser = new ChangelogParser(repoName, this.config.reposBasePath);
      const repository = parser.parseChangelog();

      const version1Exists = ChangelogDiffUtils.findVersionInRepository(repository, version1);
      const version2Exists = ChangelogDiffUtils.findVersionInRepository(repository, version2);

      if (!version1Exists) {
        const errorResponse = this.createErrorResponse(
          `Version '${version1}' not found in repository '${repoName}'`,
          'VERSION_NOT_FOUND'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!version2Exists) {
        const errorResponse = this.createErrorResponse(
          `Version '${version2}' not found in repository '${repoName}'`,
          'VERSION_NOT_FOUND'
        );
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const diff = await ChangelogDiffUtils.createRangeDiff(repository, version1, version2, this.config.withDates);

      return new Response(diff.content, {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    } catch (error) {
      const errorResponse = this.createErrorResponse(
        `Failed to generate diff between '${version1}' and '${version2}' for repository '${repoName}': ${(error as Error).message}`,
        'RANGE_DIFF_ERROR'
      );
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleHealthCheck(): Promise<Response> {
    const cacheStats = await cacheManager.getStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      repos: this.config.repos.length,
      validRepos: this.config.repos.filter(repo => 
        ChangelogParser.validateRepository(repo, this.config.reposBasePath)
      ).length,
      cache: cacheStats
    };

    return new Response(JSON.stringify(this.createResponse(health)), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (method !== 'GET') {
      const errorResponse = this.createErrorResponse(
        `Method ${method} not allowed`,
        'METHOD_NOT_ALLOWED'
      );
      return new Response(JSON.stringify(errorResponse), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let response: Response;

    // Route handling
    if (path === '/health') {
      response = await this.handleHealthCheck();
    } else if (path === '/repos') {
      response = await this.handleGetRepos();
    } else if (path.startsWith('/repos/')) {
      const pathParts = path.split('/').filter(Boolean);
      if (pathParts.length === 2) {
        // GET /repos/:repo
        const repoName = pathParts[1]!;
        response = await this.handleGetRepo(repoName);
      } else if (pathParts.length === 3) {
        const repoName = pathParts[1]!;
        const identifier = pathParts[2]!;
        
        if (identifier === 'latest') {
          // GET /repos/:repo/latest
          response = await this.handleGetLatestVersion(repoName);
        } else if (identifier === 'since') {
          // GET /repos/:repo/since (no version - entire changelog)
          const titleParam = url.searchParams.get('title');
          response = await this.handleGetSince(repoName, null, titleParam || undefined);
        } else {
          // GET /repos/:repo/:version
          response = await this.handleGetVersion(repoName, identifier);
        }
      } else if (pathParts.length === 4) {
        const repoName = pathParts[1]!;
        const operation = pathParts[2]!;
        const versionParam = pathParts[3]!;
        
        if (operation === 'since') {
          // GET /repos/:repo/since/:version
          const titleParam = url.searchParams.get('title');
          response = await this.handleGetSince(repoName, versionParam, titleParam || undefined);
        } else {
          const errorResponse = this.createErrorResponse(
            'Invalid API path',
            'INVALID_PATH'
          );
          response = new Response(JSON.stringify(errorResponse), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else if (pathParts.length === 5) {
        const repoName = pathParts[1]!;
        const operation = pathParts[2]!;
        const version1 = pathParts[3]!;
        const version2 = pathParts[4]!;
        
        if (operation === 'diff') {
          // GET /repos/:repo/diff/:version1/:version2
          response = await this.handleGetDiff(repoName, version1, version2);
        } else {
          const errorResponse = this.createErrorResponse(
            'Invalid API path',
            'INVALID_PATH'
          );
          response = new Response(JSON.stringify(errorResponse), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else {
        const errorResponse = this.createErrorResponse(
          'Invalid API path',
          'INVALID_PATH'
        );
        response = new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      const errorResponse = this.createErrorResponse(
        'API endpoint not found',
        'ENDPOINT_NOT_FOUND'
      );
      response = new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add CORS headers to all responses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  start(): void {
    const server = Bun.serve({
      port: this.config.port,
      fetch: (request) => this.handleRequest(request),
    });

    console.log(`🚀 Changelogger API server running on http://localhost:${server.port}`);
    console.log(`📚 Serving ${this.config.repos.length} configured repositories:`);
    
    for (const repo of this.config.repos) {
      const isValid = ChangelogParser.validateRepository(repo, this.config.reposBasePath);
      const status = isValid ? '✅' : '❌';
      console.log(`   ${status} ${repo}`);
    }
    
    console.log(`\n📋 API Endpoints:`);
    console.log(`   GET /health - Health check`);
    console.log(`   GET /repos - List all repositories`);
    console.log(`   GET /repos/:repo - Get full changelog for a repository`);
    console.log(`   GET /repos/:repo/latest - Get latest version info`);
    console.log(`   GET /repos/:repo/:version - Get specific version details`);
    console.log(`   GET /repos/:repo/since - Get complete changelog as markdown`);
    console.log(`   GET /repos/:repo/since/:version - Get markdown diff since version`);
    console.log(`   GET /repos/:repo/diff/:version1/:version2 - Get markdown diff between versions`);
  }
}

// Start the server only if this file is being run directly
if (import.meta.main) {
  const server = new ChangelogServer();
  server.start();
}