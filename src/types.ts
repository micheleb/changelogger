export interface ChangelogEntry {
  description: string;
}

export interface VersionChanges {
  added?: ChangelogEntry[];
  changed?: ChangelogEntry[];
  deprecated?: ChangelogEntry[];
  removed?: ChangelogEntry[];
  fixed?: ChangelogEntry[];
  security?: ChangelogEntry[];
}

export interface Version {
  version: string;
  date?: string;
  changes: VersionChanges;
}

export interface Repository {
  name: string;
  path: string;
  versions: Version[];
  unreleased?: VersionChanges;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RepositoryList {
  repositories: string[];
}

export interface VersionInfo {
  version: string;
  date?: string;
  changes: VersionChanges;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResult<T> = SuccessResponse<T> | ErrorResponse;

export interface ChangelogEntryWithVersion {
  description: string;
  version: string;
  date?: string;
}

export interface VersionChangesWithVersion {
  added?: ChangelogEntryWithVersion[];
  changed?: ChangelogEntryWithVersion[];
  deprecated?: ChangelogEntryWithVersion[];
  removed?: ChangelogEntryWithVersion[];
  fixed?: ChangelogEntryWithVersion[];
  security?: ChangelogEntryWithVersion[];
}

export interface MarkdownDiff {
  content: string;
  title: string;
  isEmpty: boolean;
  fromVersion?: string;
  toVersion?: string;
}