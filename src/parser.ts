import { readFileSync } from 'fs';
import { join } from 'path';
import type { Repository, Version, VersionChanges, ChangelogEntry } from './types.ts';

export class ChangelogParser {
  private repoName: string;
  private repoPath: string;
  
  constructor(repoName: string, basePath: string = '.') {
    this.repoName = repoName;
    this.repoPath = join(basePath, repoName);
  }

  parseChangelog(): Repository {
    const changelogPath = join(this.repoPath, 'CHANGELOG.md');
    
    try {
      const content = readFileSync(changelogPath, 'utf-8');
      return this.parseContent(content);
    } catch (error) {
      throw new Error(`Failed to read changelog for ${this.repoName}: ${(error as Error).message}`);
    }
  }

  private parseContent(content: string): Repository {
    const lines = content.split('\n');
    const repository: Repository = {
      name: this.repoName,
      path: this.repoPath,
      versions: []
    };

    let currentVersion: Version | null = null;
    let currentSection: keyof VersionChanges | null = null;
    let isUnreleased = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) continue;

      // Check for version headers (e.g., ## [1.0.0] - 2023-01-01 or ## [Unreleased])
      const versionMatch = trimmedLine.match(/^##\s*\[([^\]]+)\](?:\s*-\s*(.+))?/);
      if (versionMatch) {
        // Save previous version if exists
        if (currentVersion && !isUnreleased) {
          repository.versions.push(currentVersion);
        } else if (currentVersion && isUnreleased) {
          repository.unreleased = currentVersion.changes;
        }

        const versionName = versionMatch[1]!.trim();
        const dateStr = versionMatch[2]?.trim();
        
        isUnreleased = versionName.toLowerCase() === 'unreleased';
        
        currentVersion = {
          version: versionName,
          date: dateStr && dateStr !== '' ? dateStr : undefined,
          changes: {}
        };
        currentSection = null;
        continue;
      }

      // Check for section headers (### Added, ### Changed, etc.)
      const sectionMatch = trimmedLine.match(/^###\s+(.+)/);
      if (sectionMatch && currentVersion) {
        const sectionName = sectionMatch[1]!.trim().toLowerCase();
        const validSections: (keyof VersionChanges)[] = ['added', 'changed', 'deprecated', 'removed', 'fixed', 'security'];
        
        if (validSections.includes(sectionName as keyof VersionChanges)) {
          currentSection = sectionName as keyof VersionChanges;
          if (!currentVersion.changes[currentSection]) {
            currentVersion.changes[currentSection] = [];
          }
        }
        continue;
      }

      // Check for list items (- description)
      const listMatch = trimmedLine.match(/^[-*]\s+(.+)/);
      if (listMatch && currentVersion && currentSection) {
        const description = listMatch[1]!.trim();
        const entry: ChangelogEntry = { description };
        
        if (!currentVersion.changes[currentSection]) {
          currentVersion.changes[currentSection] = [];
        }
        currentVersion.changes[currentSection]!.push(entry);
      }
    }

    // Add the last version
    if (currentVersion && !isUnreleased) {
      repository.versions.push(currentVersion);
    } else if (currentVersion && isUnreleased) {
      repository.unreleased = currentVersion.changes;
    }

    return repository;
  }

  static validateRepository(repoName: string, basePath: string = '.'): boolean {
    try {
      const changelogPath = join(basePath, repoName, 'CHANGELOG.md');
      readFileSync(changelogPath, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
}