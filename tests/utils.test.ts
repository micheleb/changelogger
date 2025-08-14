import { describe, it, expect } from 'bun:test'
import { TitleUtils, VersionUtils, ChangelogDiffUtils } from '../src/utils.ts'
import type { Repository, Version } from '../src/types.ts'

describe('TitleUtils', () => {
  describe('sanitizeTitle', () => {
    it('should return empty string for null/undefined input', () => {
      expect(TitleUtils.sanitizeTitle('')).toBe('')
      expect(TitleUtils.sanitizeTitle(null as any)).toBe('')
      expect(TitleUtils.sanitizeTitle(undefined as any)).toBe('')
    })

    it('should remove markdown special characters', () => {
      const input = '**Bold** _italic_ `code` ~strike~ [link] {brace} (paren)'
      const expected = 'Bold italic code strike link brace paren'
      expect(TitleUtils.sanitizeTitle(input)).toBe(expected)
    })

    it('should remove HTML-like brackets', () => {
      const input = '<script>alert("xss")</script>'
      const expected = 'scriptalert"xss"/script'
      expect(TitleUtils.sanitizeTitle(input)).toBe(expected)
    })

    it('should normalize whitespace', () => {
      const input = '  Multiple   spaces\t\nand\r\nnewlines  '
      const expected = 'Multiple spaces and newlines'
      expect(TitleUtils.sanitizeTitle(input)).toBe(expected)
    })

    it('should limit to 128 characters', () => {
      const longInput = 'A'.repeat(150)
      const result = TitleUtils.sanitizeTitle(longInput)
      expect(result.length).toBe(128)
      expect(result).toBe('A'.repeat(128))
    })

    it('should handle mixed issues correctly', () => {
      const input = '  **My#  Super*  Long   Title**   with special chars   '
      const expected = 'My Super Long Title with special chars'
      expect(TitleUtils.sanitizeTitle(input)).toBe(expected)
    })

    it('should return empty string when only special characters provided', () => {
      const input = '###***```~~~'
      expect(TitleUtils.sanitizeTitle(input)).toBe('')
    })
  })
})

describe('VersionUtils', () => {
  describe('parseVersion', () => {
    it('should parse valid semantic versions', () => {
      expect(VersionUtils.parseVersion('1.0.0')).toEqual({ major: 1, minor: 0, patch: 0 })
      expect(VersionUtils.parseVersion('2.5.10')).toEqual({ major: 2, minor: 5, patch: 10 })
      expect(VersionUtils.parseVersion('0.1.0')).toEqual({ major: 0, minor: 1, patch: 0 })
    })

    it('should parse versions with pre-release and build metadata', () => {
      expect(VersionUtils.parseVersion('1.0.0-alpha.1')).toEqual({ major: 1, minor: 0, patch: 0 })
      expect(VersionUtils.parseVersion('1.0.0+build.123')).toEqual({ major: 1, minor: 0, patch: 0 })
      expect(VersionUtils.parseVersion('1.0.0-beta.1+build.123')).toEqual({ major: 1, minor: 0, patch: 0 })
    })

    it('should return null for invalid versions', () => {
      expect(VersionUtils.parseVersion('1.0')).toBeNull()
      expect(VersionUtils.parseVersion('v1.0.0')).toBeNull()
      expect(VersionUtils.parseVersion('1.0.0.0')).toBeNull()
      expect(VersionUtils.parseVersion('invalid')).toBeNull()
    })
  })

  describe('compareVersions', () => {
    it('should compare versions correctly', () => {
      expect(VersionUtils.compareVersions('1.0.0', '1.0.0')).toBe(0)
      expect(VersionUtils.compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0)
      expect(VersionUtils.compareVersions('1.0.0', '1.0.1')).toBeLessThan(0)
      expect(VersionUtils.compareVersions('1.1.0', '1.0.9')).toBeGreaterThan(0)
      expect(VersionUtils.compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0)
    })

    it('should fallback to string comparison for invalid versions', () => {
      expect(VersionUtils.compareVersions('invalid1', 'invalid2')).toBeLessThan(0)
      expect(VersionUtils.compareVersions('v1.0.0', 'v2.0.0')).toBeLessThan(0)
    })
  })

  describe('isVersionNewer', () => {
    it('should correctly identify newer versions', () => {
      expect(VersionUtils.isVersionNewer('1.0.1', '1.0.0')).toBe(true)
      expect(VersionUtils.isVersionNewer('1.1.0', '1.0.9')).toBe(true)
      expect(VersionUtils.isVersionNewer('2.0.0', '1.9.9')).toBe(true)
      expect(VersionUtils.isVersionNewer('1.0.0', '1.0.1')).toBe(false)
      expect(VersionUtils.isVersionNewer('1.0.0', '1.0.0')).toBe(false)
    })
  })

  describe('isVersionInRange', () => {
    it('should correctly identify versions in range', () => {
      expect(VersionUtils.isVersionInRange('1.1.0', '1.0.0', '2.0.0')).toBe(true)
      expect(VersionUtils.isVersionInRange('1.0.0', '1.0.0', '2.0.0')).toBe(true)
      expect(VersionUtils.isVersionInRange('2.0.0', '1.0.0', '2.0.0')).toBe(true)
      expect(VersionUtils.isVersionInRange('0.9.0', '1.0.0', '2.0.0')).toBe(false)
      expect(VersionUtils.isVersionInRange('2.1.0', '1.0.0', '2.0.0')).toBe(false)
    })

    it('should handle reversed range parameters', () => {
      expect(VersionUtils.isVersionInRange('1.5.0', '2.0.0', '1.0.0')).toBe(true)
      expect(VersionUtils.isVersionInRange('1.5.0', '1.0.0', '2.0.0')).toBe(true)
    })
  })
})

describe('ChangelogDiffUtils', () => {
  const mockRepository: Repository = {
    name: 'test-repo',
    path: './non-existent-repo',
    versions: [
      {
        version: '2.1.0',
        date: '2024-01-15',
        changes: {
          added: [{ description: 'Real-time notifications' }],
          fixed: [{ description: 'Memory leak fix' }]
        }
      },
      {
        version: '2.0.0', 
        date: '2023-12-01',
        changes: {
          added: [{ description: 'UI redesign' }],
          changed: [{ description: 'API changes' }],
          removed: [{ description: 'Legacy system' }]
        }
      },
      {
        version: '1.0.0',
        date: '2023-10-01', 
        changes: {
          added: [{ description: 'Initial release' }]
        }
      }
    ]
  }

  describe('filterVersionsSince', () => {
    it('should filter versions newer than specified version', () => {
      const result = ChangelogDiffUtils.filterVersionsSince(mockRepository, '1.0.0')
      expect(result).toHaveLength(2)
      expect(result.map(v => v.version)).toEqual(['2.1.0', '2.0.0'])
    })

    it('should return empty array when no newer versions exist', () => {
      const result = ChangelogDiffUtils.filterVersionsSince(mockRepository, '2.1.0')
      expect(result).toHaveLength(0)
    })

    it('should return all versions when no version is specified (null)', () => {
      const result = ChangelogDiffUtils.filterVersionsSince(mockRepository, null)
      expect(result).toHaveLength(3)
      expect(result.map(v => v.version)).toEqual(['2.1.0', '2.0.0', '1.0.0'])
    })

    it('should return all versions when empty string is specified', () => {
      const result = ChangelogDiffUtils.filterVersionsSince(mockRepository, '')
      expect(result).toHaveLength(3)
      expect(result.map(v => v.version)).toEqual(['2.1.0', '2.0.0', '1.0.0'])
    })

    it('should return all versions when whitespace-only string is specified', () => {
      const result = ChangelogDiffUtils.filterVersionsSince(mockRepository, '   ')
      expect(result).toHaveLength(3)
      expect(result.map(v => v.version)).toEqual(['2.1.0', '2.0.0', '1.0.0'])
    })
  })

  describe('filterVersionsBetween', () => {
    it('should filter versions between specified versions', () => {
      const result = ChangelogDiffUtils.filterVersionsBetween(mockRepository, '1.0.0', '2.0.0')
      expect(result).toHaveLength(2)
      expect(result.map(v => v.version)).toEqual(['2.0.0', '1.0.0'])
    })

    it('should handle reversed version parameters', () => {
      const result = ChangelogDiffUtils.filterVersionsBetween(mockRepository, '2.0.0', '1.0.0')
      expect(result).toHaveLength(2)
      expect(result.map(v => v.version)).toEqual(['2.0.0', '1.0.0'])
    })
  })

  describe('combineChangesWithVersions', () => {
    it('should combine changes from multiple versions with version prefixes', () => {
      const versions = mockRepository.versions.slice(0, 2) // 2.1.0 and 2.0.0
      const result = ChangelogDiffUtils.combineChangesWithVersions(versions)
      
      expect(result.added).toHaveLength(2)
      expect(result.added).toEqual([
        { description: 'Real-time notifications', version: '2.1.0', date: '2024-01-15' },
        { description: 'UI redesign', version: '2.0.0', date: '2023-12-01' }
      ])
      
      expect(result.fixed).toHaveLength(1)
      expect(result.fixed).toEqual([
        { description: 'Memory leak fix', version: '2.1.0', date: '2024-01-15' }
      ])
      
      expect(result.changed).toHaveLength(1)
      expect(result.changed).toEqual([
        { description: 'API changes', version: '2.0.0', date: '2023-12-01' }
      ])
    })
  })

  describe('createSinceDiff', () => {
    it('should create diff with default title', async () => {
      const result = await ChangelogDiffUtils.createSinceDiff(mockRepository, '1.0.0')
      expect(result.title).toBe('New updates!')
      expect(result.content).toContain('# New updates!')
      expect(result.content).toContain('- [2.1.0] Real-time notifications')
      expect(result.content).toContain('- [2.0.0] UI redesign')
    })

    it('should create diff with custom title', async () => {
      const result = await ChangelogDiffUtils.createSinceDiff(mockRepository, '1.0.0', 'My Custom Title')
      expect(result.title).toBe('My Custom Title')
      expect(result.content).toContain('# My Custom Title')
    })

    it('should sanitize custom title', async () => {
      const result = await ChangelogDiffUtils.createSinceDiff(mockRepository, '1.0.0', '**Dangerous** _Title_')
      expect(result.title).toBe('Dangerous Title')
      expect(result.content).toContain('# Dangerous Title')
    })

    it('should fallback to default title when sanitized title is empty', async () => {
      const result = await ChangelogDiffUtils.createSinceDiff(mockRepository, '1.0.0', '***###')
      expect(result.title).toBe('New updates!')
      expect(result.content).toContain('# New updates!')
    })

    it('should create complete changelog diff when no version specified', async () => {
      const result = await ChangelogDiffUtils.createSinceDiff(mockRepository, null)
      expect(result.title).toBe('Complete Changelog')
      expect(result.content).toContain('# Complete Changelog')
      expect(result.content).toContain('- [2.1.0] Real-time notifications')
      expect(result.content).toContain('- [2.0.0] UI redesign')
      expect(result.content).toContain('- [1.0.0] Initial release')
    })

    it('should use custom title even for complete changelog', async () => {
      const result = await ChangelogDiffUtils.createSinceDiff(mockRepository, '', 'All Changes Ever')
      expect(result.title).toBe('All Changes Ever')
      expect(result.content).toContain('# All Changes Ever')
      expect(result.content).toContain('- [2.1.0] Real-time notifications')
      expect(result.content).toContain('- [1.0.0] Initial release')
    })

    it('should handle whitespace-only version as complete changelog', async () => {
      const result = await ChangelogDiffUtils.createSinceDiff(mockRepository, '   ')
      expect(result.title).toBe('Complete Changelog')
      expect(result.content).toContain('# Complete Changelog')
      expect(result.content).toContain('- [2.1.0] Real-time notifications')
      expect(result.content).toContain('- [1.0.0] Initial release')
    })
  })

  describe('createRangeDiff', () => {
    it('should create range diff with proper title', async () => {
      const result = await ChangelogDiffUtils.createRangeDiff(mockRepository, '1.0.0', '2.0.0')
      expect(result.title).toBe('Changelog Diff: test-repo (1.0.0 to 2.0.0)')
      expect(result.fromVersion).toBe('1.0.0')
      expect(result.toVersion).toBe('2.0.0')
      expect(result.content).toContain('# Changelog Diff: test-repo (1.0.0 to 2.0.0)')
    })

    it('should handle reversed version order', async () => {
      const result = await ChangelogDiffUtils.createRangeDiff(mockRepository, '2.0.0', '1.0.0')
      expect(result.title).toBe('Changelog Diff: test-repo (1.0.0 to 2.0.0)')
      expect(result.fromVersion).toBe('1.0.0')
      expect(result.toVersion).toBe('2.0.0')
    })
  })

  describe('findVersionInRepository', () => {
    it('should find existing versions', () => {
      const result = ChangelogDiffUtils.findVersionInRepository(mockRepository, '2.0.0')
      expect(result).toBeTruthy()
      expect(result?.version).toBe('2.0.0')
    })

    it('should return null for non-existing versions', () => {
      const result = ChangelogDiffUtils.findVersionInRepository(mockRepository, '3.0.0')
      expect(result).toBeNull()
    })
  })
})