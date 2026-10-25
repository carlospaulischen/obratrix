import { writeFile } from "node:fs/promises";
import { baselinePath, openDatabase, schemaCatalogQuery, type CatalogObject } from "./schema-catalog";

const sql = await openDatabase();

try {
  const objects = await sql.unsafe(schemaCatalogQuery) as CatalogObject[];
  await writeFile(baselinePath, `${JSON.stringify(objects, null, 2)}\n`);
  console.log(`Baseline do schema public salvo com ${objects.length} objetos.`);
} finally {
  await sql.end();
}
