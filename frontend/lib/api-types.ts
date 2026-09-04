export type ResultSchema = Record<string, string>;
export type SourcePerson = { id: string; name: string; title: string; company: string; location: string; skills: string[]; phone_available: boolean };
export type SourceSearchResponse = { query: string; source: "live" | "fixtures"; reason: string; people: SourcePerson[] };
export type ScreenJobResponse = { id: number; result_schema: ResultSchema };
