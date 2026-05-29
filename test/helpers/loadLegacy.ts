import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

// ============================================================
// loadLegacy — kör legacy-källfiler (module:"none", globala
// funktioner utan export) i en isolerad vm-context och returnerar
// contexten. Top-level `function foo(){}` blir egenskaper på
// context-objektet (script-scope-semantik = samma som i browsern).
//
// Så vi testar EXAKT den transpilerade källan appen levererar,
// utan att duplicera logiken och utan att röra module:"none".
// ============================================================

const HERE = dirname(fileURLToPath(import.meta.url));
const LEGACY_ROOT = resolve(HERE, "../../src/legacy");

export function loadLegacy(
  files: string[],
  sandbox: Record<string, unknown> = {},
): Record<string, any> {
  const ctx: Record<string, unknown> = { console, ...sandbox };
  vm.createContext(ctx);
  for (const file of files) {
    const src = readFileSync(resolve(LEGACY_ROOT, file), "utf8");
    const { outputText } = ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES2022,
        alwaysStrict: false,
      },
      fileName: file,
    });
    vm.runInContext(outputText, ctx, { filename: file });
  }
  return ctx as Record<string, any>;
}
