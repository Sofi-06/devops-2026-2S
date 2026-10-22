import fs from "node:fs";

const EXPECTED_TESTS = 32;
const reportPath = process.argv[2] ?? "productos-results.json";

function readReport(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const report = readReport(reportPath);
const passed = Number(report?.numPassedTests ?? 0);
const total = Number(report?.numTotalTests ?? 0);
const suiteReady = total === EXPECTED_TESTS;
const nota = suiteReady ? Math.min(5, 1 + passed / 8) : 1;

const lines = [
  "### Práctica de productos",
  "",
  "| Tests que pasan | Nota (1 a 5) |",
  "| --- | --- |",
  `| ${passed} / ${EXPECTED_TESTS} | ${nota.toFixed(3)} |`,
  "",
  "Fórmula: `1 + (tests que pasan / 8)`.",
  "",
];

if (!report) {
  lines.push("La suite no generó resultados. La nota queda en 1.000.");
} else if (!suiteReady) {
  lines.push(
    `La suite reportó ${total} tests y la rúbrica exige ${EXPECTED_TESTS}. Esta corrida no se califica.`,
  );
} else if (passed < EXPECTED_TESTS) {
  lines.push("El job queda en rojo hasta que pasen los 32. La nota parcial es la de la tabla.");
} else {
  lines.push("Pasaron los 32 tests. Nota: 5.000.");
}

lines.push(
  "",
  "Si el PR modifica `tests/practica-productos/product-store.test.ts`, esta nota no cuenta.",
);

const summary = lines.join("\n");
console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

if (!suiteReady || passed < EXPECTED_TESTS) {
  process.exitCode = 1;
}
