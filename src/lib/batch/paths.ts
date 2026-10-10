import path from "node:path";

/** Default locations, relative to where the app/CLI is started. */
export type BatchPaths = {
  billsDir: string;
  templatesDir: string;
  outDir: string;
};

export function defaultPaths(): BatchPaths {
  const root = process.cwd();
  return {
    billsDir: path.join(root, "test", "bills"),
    templatesDir: path.join(root, "test", "csv"),
    outDir: path.join(root, "output"),
  };
}

export const OUTPUT_FILES = ["level1.csv", "level2.csv"] as const;
export type OutputFile = (typeof OUTPUT_FILES)[number];
export const isOutputFile = (name: string): name is OutputFile =>
  (OUTPUT_FILES as readonly string[]).includes(name);
