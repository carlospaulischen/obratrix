import { readFile } from "node:fs/promises";
import { baselinePath, openDatabase, schemaCatalogQuery, type CatalogObject } from "./schema-catalog";

const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as CatalogObject[];
const previous = new Set(baseline.map(({ catalog, name }) => `${catalog}:${name}`));
const sql = await openDatabase();

try {
  const current = await sql.unsafe(schemaCatalogQuery) as CatalogObject[];
  const created = current.filter(({ catalog, name }) => !previous.has(`${catalog}:${name}`));
  const invalid = created.filter(({ name }) => !name.split("(")[0]!.startsWith("obx_"));

  if (invalid.length > 0) {
    console.error("Objetos novos sem prefixo obx_ no schema public:");
    for (const object of invalid) {
      console.error(`  ${object.catalog}: ${object.name}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Prefixo obx_ OK: ${created.length} objetos public novos; todos com prefixo obx_.`);
  }
} finally {
  await sql.end();
}
