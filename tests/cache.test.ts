import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test'
import { unlinkSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { CacheManager } from '../src/cache.ts'
import type { VersionChangesWithVersion } from '../src/types.ts'

describe('CacheManager', () => {
  let cacheManager: CacheManager
  let testRepoPath: string
  let testCacheDbPath: string

  beforeAll(() => {
    // Setup test environment
    testRepoPath = './test-cache-repo'
    testCacheDbPath = './test-cache.db'
    
    // Set environment variables for testing
    process.env.SQLITE_CACHE = 'true'
    process.env.SQLITE_CACHE_DB_PATH = testCacheDbPath
    process.env.SQLITE_CACHE_TTL_HOURS = '1' // 1 hour for testing
    
    // Create test repository directory
    mkdirSync(testRepoPath, { recursive: true })
    
    // Create test CHANGELOG.md
    const testChangelog = `# Changelog

## [2.0.0] - 2024-01-01

### Added
- New feature A
- New feature B

### Changed
- Updated feature C

## [1.0.0] - 2023-01-01

### Added
- Initial release
`
    writeFileSync(join(testRepoPath, 'CHANGELOG.md'), testChangelog)
  })

  beforeEach(() => {
    // Clean up cache database before each test
    try {
      unlinkSync(testCacheDbPath)
    } catch {
      // File doesn't exist, ignore
    }
    
    // Create fresh cache manager
    cacheManager = new CacheManager()
  })

  afterAll(() => {
    // Cleanup test files
    try {
      unlinkSync(testCacheDbPath)
      unlinkSync(join(testRepoPath, 'CHANGELOG.md'))
      // Note: rmdir doesn't work in some test environments, leave directory
    } catch {
      // Ignore cleanup errors
    }
    
    // Reset environment
    delete process.env.SQLITE_CACHE
    delete process.env.SQLITE_CACHE_DB_PATH
    delete process.env.SQLITE_CACHE_TTL_HOURS
  })

  describe('Cache enabled operations', () => {
    it('should cache and retrieve data correctly', async () => {
      const testData: VersionChangesWithVersion = {
        added: [
          { description: 'New feature A', version: '2.0.0' },
          { description: 'Initial release', version: '1.0.0' }
        ]
      }

      // Set data in cache
      await cacheManager.set('test-repo', testRepoPath, 'since', '1.0.0', testData)

      // Retrieve data from cache
      const retrieved = await cacheManager.get('test-repo', testRepoPath, 'since', '1.0.0')

      expect(retrieved).not.toBeNull()
      expect(retrieved?.added).toHaveLength(2)
      expect(retrieved?.added?.[0]?.description).toBe('New feature A')
      expect(retrieved?.added?.[1]?.description).toBe('Initial release')
    })

    it('should return null for cache miss', async () => {
      const result = await cacheManager.get('test-repo', testRepoPath, 'since', 'nonexistent')
      expect(result).toBeNull()
    })

    it('should invalidate cache when file modification time changes', async () => {
      const testData: VersionChangesWithVersion = {
        added: [{ description: 'Test entry', version: '1.0.0' }]
      }

      // Cache data
      await cacheManager.set('test-repo', testRepoPath, 'since', '1.0.0', testData)

      // Verify cached
      let retrieved = await cacheManager.get('test-repo', testRepoPath, 'since', '1.0.0')
      expect(retrieved).not.toBeNull()

      // Wait a moment and modify the file (to change mtime)
      await new Promise(resolve => setTimeout(resolve, 10))
      const updatedChangelog = `# Changelog

## [2.1.0] - 2024-02-01

### Added
- Brand new feature

## [2.0.0] - 2024-01-01

### Added
- New feature A
- New feature B
`
      writeFileSync(join(testRepoPath, 'CHANGELOG.md'), updatedChangelog)

      // Should return null now (cache invalidated due to mtime change)
      retrieved = await cacheManager.get('test-repo', testRepoPath, 'since', '1.0.0')
      expect(retrieved).toBeNull()
    })

    it('should handle repository invalidation', async () => {
      const testData: VersionChangesWithVersion = {
        added: [{ description: 'Test entry', version: '1.0.0' }]
      }

      // Cache multiple entries for the same repo
      await cacheManager.set('test-repo', testRepoPath, 'since', '1.0.0', testData)
      await cacheManager.set('test-repo', testRepoPath, 'diff', '1.0.0_2.0.0', testData)

      // Verify both are cached
      expect(await cacheManager.get('test-repo', testRepoPath, 'since', '1.0.0')).not.toBeNull()
      expect(await cacheManager.get('test-repo', testRepoPath, 'diff', '1.0.0_2.0.0')).not.toBeNull()

      // Invalidate entire repository
      await cacheManager.invalidateRepo('test-repo')

      // Both should now return null
      expect(await cacheManager.get('test-repo', testRepoPath, 'since', '1.0.0')).toBeNull()
      expect(await cacheManager.get('test-repo', testRepoPath, 'diff', '1.0.0_2.0.0')).toBeNull()
    })

    it('should return cache statistics', async () => {
      const testData: VersionChangesWithVersion = {
        added: [{ description: 'Test entry', version: '1.0.0' }]
      }

      // Initially empty cache
      let stats = await cacheManager.getStats()
      expect(stats.enabled).toBe(true)
      expect(stats.entries).toBe(0)

      // Add some entries
      await cacheManager.set('test-repo', testRepoPath, 'since', '1.0.0', testData)
      await cacheManager.set('test-repo', testRepoPath, 'diff', '1.0.0_2.0.0', testData)

      stats = await cacheManager.getStats()
      expect(stats.enabled).toBe(true)
      expect(stats.entries).toBe(2)
      expect(stats.size).toMatch(/\d+(\.\d+)?\s+(B|KB|MB|GB)/)
    })
  })

  describe('Cache disabled operations', () => {
    let disabledCacheManager: CacheManager

    beforeEach(() => {
      // Temporarily disable cache
      process.env.SQLITE_CACHE = 'false'
      disabledCacheManager = new CacheManager()
    })

    afterEach(() => {
      // Re-enable cache for other tests
      process.env.SQLITE_CACHE = 'true'
    })

    it('should return null for all operations when cache is disabled', async () => {
      const testData: VersionChangesWithVersion = {
        added: [{ description: 'Test entry', version: '1.0.0' }]
      }

      // Set operation should not crash
      await disabledCacheManager.set('test-repo', testRepoPath, 'since', '1.0.0', testData)

      // Get should return null
      const result = await disabledCacheManager.get('test-repo', testRepoPath, 'since', '1.0.0')
      expect(result).toBeNull()

      // Stats should show disabled
      const stats = await disabledCacheManager.getStats()
      expect(stats.enabled).toBe(false)
      expect(stats.entries).toBe(0)
    })
  })

  describe('Error handling', () => {
    it('should handle missing changelog file gracefully', async () => {
      const nonExistentPath = './non-existent-repo'
      
      const testData: VersionChangesWithVersion = {
        added: [{ description: 'Test entry', version: '1.0.0' }]
      }

      // Should not crash when path doesn't exist
      await cacheManager.set('test-repo', nonExistentPath, 'since', '1.0.0', testData)
      
      const result = await cacheManager.get('test-repo', nonExistentPath, 'since', '1.0.0')
      expect(result).toBeNull()
    })

    it('should handle cleanup of expired entries', async () => {
      // This test would require manipulating timestamps or waiting for TTL
      // For now, just verify cleanup doesn't crash
      await cacheManager.cleanup()
      
      const stats = await cacheManager.getStats()
      expect(stats.enabled).toBe(true)
    })
  })
})