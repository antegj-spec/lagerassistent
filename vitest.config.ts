import { defineConfig } from "vitest/config";

// Enhetstester för ren beräkningslogik (lib/calc.ts m.fl.).
// Kör i node-miljö — testmålen har inga DOM-beroenden.
// Legacy-koden är module:"none" (globala funktioner, inga exports);
// test/helpers/loadLegacy.ts transpilerar + kör dem i en vm-context
// och exponerar funktionerna, så vi testar exakt den kod appen kör.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
