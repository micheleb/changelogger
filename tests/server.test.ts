import { describe, it, expect, beforeAll } from 'bun:test'
import type { ApiResult, RepositoryList } from '../src/types.ts'

// Set environment variables for testing
process.env.REPOS = 'test-repo'
process.env.PORT = '3000'

// Helper function to simulate request handling
async function simulateRequest(method: string, path: string, searchParams: Record<string, string> = {}): Promise<Response> {
  const url = new URL(`http://localhost:3000${path}`)
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const request = new Request(url.toString(), { method })
  
  // Import and create server instance
  const { ChangelogServer } = await import('../src/server.ts')
  const server = new ChangelogServer()
  
  // Call the handleRequest method directly
  return server.handleRequest(request)
}

describe('API Endpoints Integration Tests', () => {
  beforeAll(async () => {
    // Ensure test-repo exists with CHANGELOG.md
    const fs = await import('fs')
    
    if (!fs.existsSync('./test-repo/CHANGELOG.md')) {
      throw new Error('test-repo/CHANGELOG.md not found. Run setup first.')
    }
  })

  describe('GET /repos/:repo/since', () => {
    it('should return complete changelog with default title', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/since')
      
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
      
      const content = await response.text()
      expect(content).toContain('# Complete Changelog')
      expect(content).toContain('## Added')
      expect(content).toContain('- [2.1.0]')
      expect(content).toContain('- [2.0.0]')
      expect(content).toContain('- [1.0.0]')
    })

    it('should return complete changelog with custom title', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/since', {
        title: 'Full History'
      })
      
      expect(response.status).toBe(200)
      
      const content = await response.text()
      expect(content).toContain('# Full History')
      expect(content).toContain('- [2.1.0]')
      expect(content).toContain('- [1.0.0]')
    })

    it('should return 404 for non-existent repository', async () => {
      const response = await simulateRequest('GET', '/repos/non-existent/since')
      
      expect(response.status).toBe(404)
      expect(response.headers.get('content-type')).toBe('application/json')
      
      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.code).toBe('REPO_NOT_CONFIGURED')
    })
  })

  describe('GET /repos/:repo/since/:version', () => {
    it('should return markdown diff with default title', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/since/1.0.0')
      
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
      
      const content = await response.text()
      expect(content).toContain('# New updates!')
      expect(content).toContain('## Added')
      expect(content).toContain('- [2.1.0]')
      expect(content).toContain('- [2.0.0]')
    })

    it('should return markdown diff with custom title', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/since/1.0.0', {
        title: 'My Custom Updates'
      })
      
      expect(response.status).toBe(200)
      
      const content = await response.text()
      expect(content).toContain('# My Custom Updates')
      expect(content).toContain('## Added')
    })

    it('should sanitize custom title', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/since/1.0.0', {
        title: '**Dangerous** <script>Title</script>'
      })
      
      expect(response.status).toBe(200)
      
      const content = await response.text()
      expect(content).toContain('# Dangerous scriptTitle/script')
      expect(content).not.toContain('**')
      expect(content).not.toContain('<script>')
    })

    it('should fallback to default title when sanitized title is empty', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/since/1.0.0', {
        title: '***###```'
      })
      
      expect(response.status).toBe(200)
      
      const content = await response.text()
      expect(content).toContain('# New updates!')
    })

    it('should return empty diff when no newer versions exist', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/since/2.1.0')
      
      expect(response.status).toBe(204)
      
      const content = await response.text()
      expect(content).toBe('')
    })

    it('should return 404 for non-existent repository', async () => {
      const response = await simulateRequest('GET', '/repos/non-existent/since/1.0.0')
      
      expect(response.status).toBe(404)
      expect(response.headers.get('content-type')).toBe('application/json')
      
      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.code).toBe('REPO_NOT_CONFIGURED')
    })

    it('should return 204 when non-existent version is higher than all available versions', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/since/99.0.0')
      
      expect(response.status).toBe(204)
      
      const content = await response.text()
      expect(content).toBe('')
    })

    it('should return updates from next available version when requested version does not exist', async () => {
      // Request since 1.5.1 (doesn't exist), should get updates from 1.5.2, 2.0.0, 2.1.0
      const response = await simulateRequest('GET', '/repos/test-repo/since/1.5.1')
      
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
      
      const content = await response.text()
      expect(content).toContain('# New updates!')
      expect(content).toContain('- [1.5.2]') // Should include 1.5.2
      expect(content).toContain('- [2.0.0]') // Should include 2.0.0  
      expect(content).toContain('- [2.1.0]') // Should include 2.1.0
      expect(content).not.toContain('- [1.0.0]') // Should NOT include 1.0.0
    })
  })

  describe('GET /repos/:repo/diff/:version1/:version2', () => {
    it('should return markdown diff between two versions', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/diff/1.0.0/2.0.0')
      
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
      
      const content = await response.text()
      expect(content).toContain('# Changelog Diff: test-repo (1.0.0 to 2.0.0)')
      expect(content).toContain('## Added')
      expect(content).toContain('- [2.0.0]')
      expect(content).toContain('- [1.0.0]')
    })

    it('should handle reversed version order', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/diff/2.0.0/1.0.0')
      
      expect(response.status).toBe(200)
      
      const content = await response.text()
      expect(content).toContain('# Changelog Diff: test-repo (1.0.0 to 2.0.0)')
    })

    it('should return 400 for identical versions', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/diff/1.0.0/1.0.0')
      
      expect(response.status).toBe(400)
      expect(response.headers.get('content-type')).toBe('application/json')
      
      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.code).toBe('IDENTICAL_VERSIONS')
    })

    it('should return 404 for non-existent first version', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/diff/99.0.0/2.0.0')
      
      expect(response.status).toBe(404)
      
      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.code).toBe('VERSION_NOT_FOUND')
      expect(json.error).toContain('99.0.0')
    })

    it('should return 404 for non-existent second version', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/diff/1.0.0/99.0.0')
      
      expect(response.status).toBe(404)
      
      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.code).toBe('VERSION_NOT_FOUND')
      expect(json.error).toContain('99.0.0')
    })

    it('should return 404 for non-existent repository', async () => {
      const response = await simulateRequest('GET', '/repos/non-existent/diff/1.0.0/2.0.0')
      
      expect(response.status).toBe(404)
      
      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.code).toBe('REPO_NOT_CONFIGURED')
    })
  })

  describe('HTTP Method and CORS handling', () => {
    it('should handle OPTIONS requests for CORS', async () => {
      const response = await simulateRequest('OPTIONS', '/repos/test-repo/since/1.0.0')
      
      expect(response.status).toBe(200)
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')
    })

    it('should reject non-GET methods with 405', async () => {
      const response = await simulateRequest('POST', '/repos/test-repo/since/1.0.0')
      
      expect(response.status).toBe(405)
      
      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.code).toBe('METHOD_NOT_ALLOWED')
    })
  })

  describe('Error handling', () => {
    it('should return 404 for invalid API paths', async () => {
      const response = await simulateRequest('GET', '/repos/test-repo/invalid/path')
      
      expect(response.status).toBe(404)
      
      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.code).toBe('INVALID_PATH')
    })

    it('should return 404 for unknown endpoints', async () => {
      const response = await simulateRequest('GET', '/unknown')
      
      expect(response.status).toBe(404)
      
      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.code).toBe('ENDPOINT_NOT_FOUND')
    })
  })
})