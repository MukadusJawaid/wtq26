/**
 * Command-line batch runner: reads a folder of bill images plus the two CSV
 * templates and writes completed output/level1.csv and output/level2.csv.
 *
 *   npm run generate -- --bills test/bills --templates test/csv --out output
 *   npm run generate -- --resume        # reuse finished bills from a failed run
 */
import path from "node:path";
import { parseArgs } from "node:util";
import { modelConfig } from "../src/lib/ai";
import { inspectBatch, runBatch, type BatchEvent } from "../src/lib/batch/run";

const { values } = parseArgs({
  options: {
    bills: { type: "string", default: "test/bills" },
    templates: { type: "string", default: "test/csv" },
    out: { type: "string", default: "output" },
    concurrency: { type: "string", default: "3" },
    resume: { type: "boolean", default: false },
  },
});

function log(event: BatchEvent) {
  switch (event.type) {
    case "bill":
      if (event.status === "start") console.log(`Processing ${event.id}`);
      if (event.status === "answered") console.log(`  done ${event.id}`);
      if (event.status === "failed") console.error(`  FAILED ${event.id}: ${event.message}`);
      break;
    case "warn":
      console.warn(`  ${event.id}: ${event.message}`);
      break;
    case "done":
      console.log(`Wrote ${event.rows1} rows to level1.csv and ${event.rows2} rows to level2.csv`);
      break;
  }
}

async function main() {
  const { name, provider } = modelConfig();
  console.log(`Model: ${name} (${provider})`);

  const paths = {
    billsDir: path.resolve(values.bills!),
    templatesDir: path.resolve(values.templates!),
    outDir: path.resolve(values.out!),
  };

  // Fail early and clearly if the inputs are not in place.
  const info = await inspectBatch(paths);
  if (!info.ready) {
    const list = info.missing.map((m) => `  ${m}`).join("\n");
    throw new Error(
      `Cannot start. Missing:\n${list}\nPut the bill images in ${values.bills} and the two CSV templates in ${values.templates}.`,
    );
  }
  console.log(`${info.bills} bills, ${info.questions} questions per bill, ${info.rows2} answers to write`);

  const { failed } = await runBatch({
    paths,
    concurrency: Number(values.concurrency) || 3,
    resume: values.resume,
    onEvent: log,
  });

  if (failed.length) {
    console.error(`\n${failed.length} bill(s) failed: ${failed.join(", ")}\nRe-run with --resume to retry only those.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
