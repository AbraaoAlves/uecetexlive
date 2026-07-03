declare module "@retorquere/bibtex-parser" {
  export interface BibCreator {
    lastName?: string;
    firstName?: string;
    name?: string;
  }
  export interface BibEntryRaw {
    type: string;
    key: string;
    fields: Record<string, unknown>;
  }
  export interface BibParseResult {
    entries: BibEntryRaw[];
    errors: unknown[];
  }
  export function parse(input: string): BibParseResult;
}
