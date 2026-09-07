/**
 * Type declarations for the two plain-ESM law harnesses.
 *
 * They are .mjs because they run under bare `node` from npm scripts, with no
 * build step. Their vitest wrappers used to reach them behind a type-checker
 * suppression; declaring the surface here removes the need for one and makes
 * the shape the wrappers assert against a checked one rather than a
 * hand-written duplicate.
 */
declare module '*/fabrication-laws.mjs' {
  export interface LawViolation {
    file: string;
    line: number;
    detail: string;
  }

  export interface LawResult {
    id: string;
    title: string;
    violations: LawViolation[];
  }

  export interface LawRun {
    fileCount: number;
    laws: LawResult[];
    total: number;
  }

  export function runFabricationLaws(options?: { planted?: boolean }): LawRun;
}

declare module '*/mobile-source-laws.mjs' {
  export interface LawViolation {
    file: string;
    line: number;
    detail: string;
  }

  export interface LawResult {
    id: string;
    title: string;
    violations: LawViolation[];
  }

  export interface LawRun {
    fileCount: number;
    laws: LawResult[];
    total: number;
  }

  export function runMobileSourceLaws(options?: { planted?: boolean }): LawRun;
  export function lintSource(file: string, source: string): LawResult[];
}
