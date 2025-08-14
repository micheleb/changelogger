# Changelogger

A simple API server built with Bun that serves changelog data from repositories with Keep a Changelog formatted CHANGELOG.md files.

## Features

- 🚀 Fast API server built with Bun
- 📋 Parses Keep a Changelog format
- 🔄 Dynamic repository configuration via environment variables
- 📚 RESTful JSON API for accessing changelog data
- ✅ Health checks and error handling
- 🌐 CORS enabled for web applications

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed on your system
- Repository folders with `CHANGELOG.md` files in Keep a Changelog format

### Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd changelogger
```

2. Install dependencies:
```bash
bun install
```

3. Create your environment configuration:
```bash
cp .env.example .env
```

4. Edit `.env` to configure your repositories:
```bash
PORT=3000
REPOS=my-project,another-project,third-project
# Optional: REPOS_BASE_PATH=/path/to/repos
```

5. Start the server:
```bash
# Development mode (with hot reload)
bun run dev

# Production mode
bun run start
```

## API Documentation

Base URL: `http://localhost:3000`

### Endpoints

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "repos": 3,
    "validRepos": 2
  }
}
```

#### `GET /repos`
Get list of all configured repositories.

**Response:**
```json
{
  "success": true,
  "data": {
    "repositories": ["my-project", "another-project"]
  }
}
```

#### `GET /repos/:repo`
Get full changelog for a specific repository.

**Parameters:**
- `repo` (string): Repository name

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "my-project",
    "path": "./my-project",
    "unreleased": {
      "added": [
        {"description": "New feature coming soon"}
      ]
    },
    "versions": [
      {
        "version": "1.0.0",
        "date": "2024-01-01",
        "changes": {
          "added": [
            {"description": "Initial release"}
          ],
          "fixed": [
            {"description": "Critical bug fix"}
          ]
        }
      }
    ]
  }
}
```

#### `GET /repos/:repo/latest`
Get the latest version information for a repository.

**Parameters:**
- `repo` (string): Repository name

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "date": "2024-01-01",
    "changes": {
      "added": [
        {"description": "Initial release"}
      ]
    }
  }
}
```

#### `GET /repos/:repo/:version`
Get specific version details for a repository.

**Parameters:**
- `repo` (string): Repository name
- `version` (string): Version identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "date": "2024-01-01",
    "changes": {
      "added": [
        {"description": "Initial release"}
      ]
    }
  }
}
```

#### `GET /repos/:repo/since`
Get the complete changelog in markdown format for a repository.

**Parameters:**
- `repo` (string): Repository name

**Query Parameters:**
- `title` (string, optional): Custom title for the markdown output (max 128 chars, sanitized)

**Response:**
```markdown
# Complete Changelog

## Added
- [2.1.0] Real-time notifications
- [2.1.0] Export functionality for reports
- [2.0.0] Complete UI redesign
- [2.0.0] Multi-language support
- [1.0.0] Initial release
- [1.0.0] Core functionality
```

**Content-Type:** `text/markdown; charset=utf-8`

#### `GET /repos/:repo/since/:version`
Get changelog differences in markdown format for all versions newer than the specified version.

**Parameters:**
- `repo` (string): Repository name
- `version` (string): Base version to compare against

**Query Parameters:**
- `title` (string, optional): Custom title for the markdown output (max 128 chars, sanitized)

**Response:**
```markdown
# New updates!

## Added
- [2.1.0] Real-time notifications
- [2.1.0] Export functionality for reports
- [2.0.0] Complete UI redesign
- [2.0.0] Multi-language support

## Changed
- [2.0.0] Database schema migration
- [2.0.0] API response format changes

## Fixed
- [2.1.0] Memory leak in data processing
- [2.1.0] UI responsiveness issues

## Removed
- [2.0.0] Legacy authentication system
- [2.0.0] Deprecated endpoints
```

**Content-Type:** `text/markdown; charset=utf-8`

**Example with custom title:**
```
GET /repos/my-project/since/1.0.0?title=What's%20new%20in%20v2!
```

**Response:**
```markdown
# What's new in v2!

## Added
- [2.1.0] Real-time notifications
- [2.0.0] Complete UI redesign
```

#### `GET /repos/:repo/diff/:version1/:version2`
Get changelog differences in markdown format between two specific versions (inclusive).

**Parameters:**
- `repo` (string): Repository name
- `version1` (string): First version
- `version2` (string): Second version

**Note:** Version order doesn't matter - the API will automatically determine the correct range.

**Response:**
```markdown
# Changelog Diff: my-project (1.5.2 to 2.1.0)

## Added
- [2.1.0] Real-time notifications
- [2.1.0] Export functionality for reports
- [2.0.0] Complete UI redesign
- [2.0.0] Multi-language support

## Changed
- [2.0.0] Database schema migration
- [2.0.0] API response format changes

## Fixed
- [2.1.0] Memory leak in data processing
- [2.1.0] UI responsiveness issues

## Removed
- [2.0.0] Legacy authentication system
- [2.0.0] Deprecated endpoints

## Security
- [1.5.2] Updated authentication tokens
- [1.5.2] Enhanced input validation
```

**Content-Type:** `text/markdown; charset=utf-8`

### Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `REPO_NOT_CONFIGURED`: Repository not found in configuration
- `CHANGELOG_NOT_FOUND`: CHANGELOG.md file not found or invalid
- `VERSION_NOT_FOUND`: Requested version doesn't exist
- `PARSE_ERROR`: Error parsing changelog file
- `METHOD_NOT_ALLOWED`: Invalid HTTP method
- `ENDPOINT_NOT_FOUND`: Invalid API endpoint
- `IDENTICAL_VERSIONS`: Cannot generate diff between identical versions
- `SINCE_DIFF_ERROR`: Error generating diff since specified version
- `RANGE_DIFF_ERROR`: Error generating diff between version range

## Keep a Changelog Format

This server expects CHANGELOG.md files to follow the [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

## [Unreleased]

### Added
- New feature for next release

### Changed
- Updated existing functionality

## [1.0.0] - 2024-01-01

### Added
- Initial release
- Core functionality

### Fixed
- Bug fixes
```

Supported change types:
- `Added`: New features
- `Changed`: Changes in existing functionality
- `Deprecated`: Soon-to-be removed features
- `Removed`: Now removed features
- `Fixed`: Bug fixes
- `Security`: Vulnerability fixes

## Development

### Scripts

```bash
# Start development server with hot reload
bun run dev

# Start production server
bun run start

# Build the application
bun run build

# Type checking
bun run typecheck

# Run tests
bun test

# Run tests in watch mode
bun test --watch
```

### Project Structure

```
changelogger/
├── src/
│   ├── server.ts    # Main server and API routes
│   ├── parser.ts    # Changelog parsing logic
│   └── types.ts     # TypeScript type definitions
├── package.json     # Project configuration
├── tsconfig.json    # TypeScript configuration
├── .env.example     # Environment template
└── README.md        # This file
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `REPOS`: Comma-separated list of repository folder names
- `REPOS_BASE_PATH`: Base path for repositories (default: current directory)
- `SQLITE_CACHE`: Enable/disable SQLite caching (default: false)
- `SQLITE_CACHE_DB_PATH`: Path to SQLite cache database (default: ./cache.db)
- `SQLITE_CACHE_TTL_HOURS`: Cache TTL in hours (default: 168 = 7 days)

### Adding New Repositories

1. Ensure the repository has a `CHANGELOG.md` file in Keep a Changelog format
2. Add the repository folder name to the `REPOS` environment variable
3. Restart the server

The server will automatically validate and serve the new repository's changelog data.

## Performance & Caching

### SQLite Caching

The server includes optional SQLite caching to significantly improve performance for repeated requests:

```bash
# Enable caching in .env
SQLITE_CACHE=true
SQLITE_CACHE_DB_PATH=./cache.db
SQLITE_CACHE_TTL_HOURS=168  # 7 days
```

**Performance Benefits:**
- **Cache Hit:** ~2-3ms response time (80% improvement)
- **Cache Miss:** ~12-35ms (small overhead for caching)
- **Cache Disabled:** ~10-30ms (no change from default)

**How It Works:**
- Caches parsed changelog data, not the final markdown (titles remain dynamic)
- Uses file modification time for automatic cache invalidation
- Separate cache entries for different version ranges
- Automatic cleanup of expired entries (default: 7 days)

**Cache Information:**
The `/health` endpoint includes cache statistics when enabled:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "cache": {
      "enabled": true,
      "entries": 25,
      "size": "64.2 KB"
    }
  }
}
```

**When to Enable Caching:**
- ✅ High request volume (>50 req/min)
- ✅ Large changelogs (100+ versions)
- ✅ Multiple repositories
- ❌ Development/single-user scenarios
- ❌ Minimal changelog files

## License

MIT
