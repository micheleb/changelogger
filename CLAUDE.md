# Changelogger

A Bun-based API server that serves changelog data from Keep a Changelog formatted repositories.

## Project Structure

```
changelogger/
├── src/
│   ├── server.ts       # Main API server with routing
│   ├── parser.ts       # CHANGELOG.md parsing logic  
│   ├── utils.ts        # Version comparison and diff utilities
│   ├── cache.ts        # SQLite caching layer
│   └── types.ts        # TypeScript interfaces
├── tests/
│   ├── server.test.ts  # API endpoint integration tests
│   ├── utils.test.ts   # Unit tests for utilities
│   └── cache.test.ts   # Cache functionality tests
├── .env.example        # Configuration template
└── README.md          # Complete documentation
```

## Key Features

- **RESTful API** for changelog data with markdown diff outputs
- **Keep a Changelog** format parsing
- **Custom titles** with sanitization (max 128 chars)
- **Optional SQLite caching** with file mtime invalidation
- **Comprehensive test suite** (62 tests, 188 assertions)

## API Endpoints

- `GET /health` - Health check with cache statistics
- `GET /repos` - List configured repositories  
- `GET /repos/:repo` - Full changelog JSON
- `GET /repos/:repo/latest` - Latest version info
- `GET /repos/:repo/:version` - Specific version details
- `GET /repos/:repo/since` - Complete changelog as markdown
- `GET /repos/:repo/since/:version` - Changes since version (markdown)
- `GET /repos/:repo/diff/:v1/:v2` - Changes between versions (markdown)

## Environment Configuration

```bash
# Basic setup
PORT=3000
REPOS=repo1,repo2,repo3
REPOS_BASE_PATH=./

# Optional SQLite caching (significant performance boost)
SQLITE_CACHE=false                 # Enable/disable caching
SQLITE_CACHE_DB_PATH=./cache.db    # Database file path  
SQLITE_CACHE_TTL_HOURS=168         # 7 days default TTL
```

## Commands

```bash
# Development
bun run dev           # Hot reload server
bun run start         # Production server
bun run typecheck     # Type checking

# Testing
bun test             # Run all tests
bun test --watch     # Watch mode

# Build
bun run build        # Build for production
```

## Performance

- **No cache:** ~10-30ms response time
- **Cache miss:** ~12-35ms (small overhead)  
- **Cache hit:** ~2-3ms (80% improvement)

Cache uses file modification time for automatic invalidation and stores structured data (not final markdown) to keep titles dynamic.

## Architecture Notes

- **Parser:** Extracts versions, dates, and categorized changes from CHANGELOG.md
- **Utils:** Version comparison, filtering, and markdown generation with caching layer
- **Server:** Bun HTTP server with CORS, error handling, and route management  
- **Cache:** SQLite-based with mtime invalidation and TTL cleanup
- **Types:** Full TypeScript coverage for all data structures

## Testing Strategy

- **Unit tests:** Version utils, title sanitization, changelog parsing
- **Integration tests:** All API endpoints with various scenarios
- **Cache tests:** Enabled/disabled modes, invalidation, error handling
- **Error handling:** 404s, validation, malformed data, graceful fallbacks