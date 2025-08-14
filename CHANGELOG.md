# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-08-14

### Added
- Initial release of Changelogger API server
- RESTful API for changelog data with markdown diff outputs
- Keep a Changelog format parsing functionality
- Custom titles with sanitization (max 128 chars)
- Optional SQLite caching with file mtime invalidation
- Comprehensive test suite (62 tests, 188 assertions)
- Health check endpoint with cache statistics
- Repository listing and management endpoints
- Version-specific changelog retrieval
- Markdown diff generation between versions
- Support for date parsing in changelog entries
- Git repository pull automation script
- CORS support and error handling
- Full TypeScript coverage

