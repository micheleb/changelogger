import type { Repository, Version, VersionChanges, VersionChangesWithVersion, ChangelogEntryWithVersion, MarkdownDiff } from './types.ts';
import { cacheManager } from './cache.ts';

export class VersionUtils {
  static parseVersion(version: string): { major: number; minor: number; patch: number; } | null {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-.*)?(?:\+.*)?$/);
    if (!match) return null;
    
    return {
      major: parseInt(match[1]!, 10),
      minor: parseInt(match[2]!, 10),
      patch: parseInt(match[3]!, 10),
    };
  }

  static compareVersions(version1: string, version2: string): number {
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);
    
    if (!v1 || !v2) {
      return version1.localeCompare(version2);
    }

    if (v1.major !== v2.major) return v1.major - v2.major;
    if (v1.minor !== v2.minor) return v1.minor - v2.minor;
    return v1.patch - v2.patch;
  }

  static isVersionNewer(version: string, baseVersion: string): boolean {
    return this.compareVersions(version, baseVersion) > 0;
  }

  static isVersionInRange(version: string, startVersion: string, endVersion: string): boolean {
    const compareToStart = this.compareVersions(version, startVersion);
    const compareToEnd = this.compareVersions(version, endVersion);
    
    const minVersion = this.compareVersions(startVersion, endVersion) <= 0 ? startVersion : endVersion;
    const maxVersion = this.compareVersions(startVersion, endVersion) <= 0 ? endVersion : startVersion;
    
    const compareToMin = this.compareVersions(version, minVersion);
    const compareToMax = this.compareVersions(version, maxVersion);
    
    return compareToMin >= 0 && compareToMax <= 0;
  }
}

export class TitleUtils {
  static sanitizeTitle(title: string): string {
    if (!title || typeof title !== 'string') {
      return '';
    }
    
    // Remove any markdown special characters and potentially harmful content
    const sanitized = title
      .replace(/[#*_`~\[\](){}]/g, '') // Remove markdown formatting characters
      .replace(/[<>]/g, '') // Remove HTML-like brackets
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Limit to 128 characters
    return sanitized.length > 128 ? sanitized.substring(0, 128).trim() : sanitized;
  }
}

export class DateUtils {
  static formatShortDate(dateString?: string): string {
    if (!dateString) {
      return '';
    }
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      
      const month = monthNames[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      
      return `${month} ${day}, ${year}`;
    } catch (error) {
      return '';
    }
  }
}

export class ChangelogDiffUtils {
  static filterVersionsSince(repository: Repository, sinceVersion: string | null): Version[] {
    // If no version specified, return all versions (entire changelog)
    if (!sinceVersion || sinceVersion.trim() === '') {
      return repository.versions;
    }
    
    return repository.versions.filter(version => 
      VersionUtils.isVersionNewer(version.version, sinceVersion)
    );
  }

  static filterVersionsBetween(repository: Repository, version1: string, version2: string): Version[] {
    return repository.versions.filter(version => 
      VersionUtils.isVersionInRange(version.version, version1, version2)
    );
  }

  static combineChangesWithVersions(versions: Version[]): VersionChangesWithVersion {
    const combined: VersionChangesWithVersion = {};

    const sections: (keyof VersionChanges)[] = ['added', 'changed', 'deprecated', 'removed', 'fixed', 'security'];
    
    for (const section of sections) {
      const entries: ChangelogEntryWithVersion[] = [];
      
      for (const version of versions) {
        const sectionChanges = version.changes[section];
        if (sectionChanges) {
          for (const entry of sectionChanges) {
            entries.push({
              description: entry.description,
              version: version.version,
              date: version.date
            });
          }
        }
      }
      
      if (entries.length > 0) {
        combined[section] = entries;
      }
    }

    return combined;
  }

  static formatMarkdownDiff(
    repoName: string,
    changes: VersionChangesWithVersion,
    title: string,
    withDates: boolean = false
  ): MarkdownDiff {
    const lines: string[] = [];
    lines.push(`# ${title}`);
    lines.push('');

    const sections: { key: keyof VersionChangesWithVersion; title: string }[] = [
      { key: 'added', title: 'Added' },
      { key: 'changed', title: 'Changed' },
      { key: 'deprecated', title: 'Deprecated' },
      { key: 'removed', title: 'Removed' },
      { key: 'fixed', title: 'Fixed' },
      { key: 'security', title: 'Security' }
    ];

    let hasContent = false;

    for (const section of sections) {
      const sectionChanges = changes[section.key];
      if (sectionChanges && sectionChanges.length > 0) {
        hasContent = true;
        lines.push(`## ${section.title}`);
        lines.push('');
        
        for (const entry of sectionChanges) {
          let entryLine = `- [${entry.version}]`;
          
          if (withDates && entry.date) {
            const formattedDate = DateUtils.formatShortDate(entry.date);
            if (formattedDate) {
              entryLine += ` (${formattedDate})`;
            }
          }
          
          entryLine += ` ${entry.description}`;
          lines.push(entryLine);
        }
        lines.push('');
      }
    }

    if (!hasContent) {
      lines.push('No changes found in the specified version range.');
      lines.push('');
    }

    return {
      content: lines.join('\n'),
      title
    };
  }

  static async createSinceDiff(repository: Repository, sinceVersion: string | null, customTitle?: string, withDates: boolean = false): Promise<MarkdownDiff> {
    const cacheKey = sinceVersion || 'complete';
    const operation = 'since';
    
    // Try to get cached data
    let combinedChanges = await cacheManager.get(repository.name, repository.path, operation, cacheKey);
    
    if (!combinedChanges) {
      // Cache miss - compute and cache the result
      const filteredVersions = this.filterVersionsSince(repository, sinceVersion);
      combinedChanges = this.combineChangesWithVersions(filteredVersions);
      
      // Cache the computed changes (without title, as that can vary)
      await cacheManager.set(repository.name, repository.path, operation, cacheKey, combinedChanges);
    }
    
    let title = 'New updates!';
    if (customTitle) {
      const sanitizedTitle = TitleUtils.sanitizeTitle(customTitle);
      if (sanitizedTitle) {
        title = sanitizedTitle;
      }
    }
    
    // If no version was specified (entire changelog), update title to reflect that
    if (!sinceVersion || sinceVersion.trim() === '') {
      if (!customTitle) {
        title = 'Complete Changelog';
      }
    }
    
    return this.formatMarkdownDiff(repository.name, combinedChanges, title, withDates);
  }

  static async createRangeDiff(repository: Repository, version1: string, version2: string, withDates: boolean = false): Promise<MarkdownDiff> {
    const minVersion = VersionUtils.compareVersions(version1, version2) <= 0 ? version1 : version2;
    const maxVersion = VersionUtils.compareVersions(version1, version2) <= 0 ? version2 : version1;
    const cacheKey = `${minVersion}_${maxVersion}`;
    const operation = 'diff';
    
    // Try to get cached data
    let combinedChanges = await cacheManager.get(repository.name, repository.path, operation, cacheKey);
    
    if (!combinedChanges) {
      // Cache miss - compute and cache the result
      const filteredVersions = this.filterVersionsBetween(repository, version1, version2);
      combinedChanges = this.combineChangesWithVersions(filteredVersions);
      
      // Cache the computed changes
      await cacheManager.set(repository.name, repository.path, operation, cacheKey, combinedChanges);
    }
    
    const title = `Changelog Diff: ${repository.name} (${minVersion} to ${maxVersion})`;
    
    return {
      ...this.formatMarkdownDiff(repository.name, combinedChanges, title, withDates),
      fromVersion: minVersion,
      toVersion: maxVersion
    };
  }

  static findVersionInRepository(repository: Repository, versionName: string): Version | null {
    return repository.versions.find(v => v.version === versionName) || null;
  }
}