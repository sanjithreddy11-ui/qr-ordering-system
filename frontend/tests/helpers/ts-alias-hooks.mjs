// Node resolve hook so the app's real TypeScript sources can be imported
// by tests unchanged:
//   - "@/..."        -> src/... (the tsconfig path alias)
//   - extensionless  -> .ts / .tsx / /index.ts (bundler-style imports)
//   - the QZ Tray client is swapped for an in-memory fake, because the real
//     one needs a browser and a physical printer. Everything else in the
//     print path (kot.ts, printer-store.ts, receiptLayout.ts) is the real code.
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const MOCK_QZ = pathToFileURL(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "mock-qzClient.mjs")
).href;

function tryFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/printer/qzClient" || specifier === "./qzClient") {
    return { url: MOCK_QZ, shortCircuit: true };
  }

  let base = null;
  if (specifier.startsWith("@/")) {
    base = path.join(SRC, specifier.slice(2));
  } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const parentPath = fileURLToPath(context.parentURL);
    if (parentPath.startsWith(SRC)) base = path.resolve(path.dirname(parentPath), specifier);
  }

  if (base) {
    const file = tryFile(base);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

// src/types/*.ts contain only interfaces/type aliases. Some app files import
// them WITHOUT the `type` keyword (e.g. `import { Order } from "@/types/order"`),
// which Node's type-stripper can't erase. Give those modules runtime-empty
// exports with the same names so the imports link; nothing ever reads them.
export async function load(url, context, nextLoad) {
  if (url.startsWith("file:")) {
    const file = fileURLToPath(url);
    if (file.startsWith(path.join(SRC, "types") + path.sep)) {
      const names = [...readFileSync(file, "utf8").matchAll(/export\s+(?:interface|type)\s+(\w+)/g)].map((m) => m[1]);
      const source = names.map((n) => `export const ${n} = undefined;`).join("\n") + "\nexport {};\n";
      return { format: "module", source, shortCircuit: true };
    }
  }
  return nextLoad(url, context);
}
