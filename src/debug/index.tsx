import { performance } from "node:perf_hooks";
import { ProductStore } from "../services/product-store.js";

const TOTAL_EXECUTIONS = 1_000;

function measureMany(label: string, operation: (iteration: number) => void): void {
  const timerLabel = `${label} x ${TOTAL_EXECUTIONS}`;

  console.time(timerLabel);
  const start = performance.now();

  for (let iteration = 0; iteration < TOTAL_EXECUTIONS; iteration += 1) {
    operation(iteration);
  }

  const elapsed = performance.now() - start;
  console.timeEnd(timerLabel);
  console.log(`Promedio de ${label}: ${(elapsed / TOTAL_EXECUTIONS).toFixed(6)} ms`);
}

const store = new ProductStore();

console.log("Iniciando medición de ProductStore...\n");

console.time("create");
const product = store.create({
  name: "Arroz",
  sku: "ARR-1",
  price: 3_200,
  stock: 10,
  category: "Granos",
});
console.timeEnd("create");

console.time("getById");
const productById = store.getById(product.id);
console.timeEnd("getById");

console.time("getBySku");
const productBySku = store.getBySku(product.sku);
console.timeEnd("getBySku");

console.time("list");
const products = store.list({ category: "Granos" });
console.timeEnd("list");

console.time("update");
const updatedProduct = store.update(product.id, { price: 3_500 });
console.timeEnd("update");

console.time("adjustStock");
const productWithNewStock = store.adjustStock(product.id, -2);
console.timeEnd("adjustStock");

console.time("remove");
const wasRemoved = store.remove(product.id);
console.timeEnd("remove");

console.log("\nResultados disponibles para inspección:", {
  product,
  productById,
  productBySku,
  products,
  updatedProduct,
  productWithNewStock,
  wasRemoved,
});

console.log(`\nMedición masiva (${TOTAL_EXECUTIONS} ejecuciones por método)\n`);

const bulkStore = new ProductStore();

measureMany("create", (iteration) => {
  bulkStore.create({
    name: `Producto ${iteration}`,
    sku: `BULK-${iteration}`,
    price: 1_000 + iteration,
    stock: 10,
    category: iteration % 2 === 0 ? "Granos" : "Bebidas",
  });
});

const referenceProduct = bulkStore.getBySku(`BULK-${Math.floor(TOTAL_EXECUTIONS / 2)}`)!;

measureMany("getById", () => {
  bulkStore.getById(referenceProduct.id);
});

measureMany("getBySku", () => {
  bulkStore.getBySku(referenceProduct.sku);
});

measureMany("list", () => {
  bulkStore.list({ category: "Granos" });
});

measureMany("update", (iteration) => {
  bulkStore.update(referenceProduct.id, { price: 2_000 + iteration });
});

measureMany("adjustStock", () => {
  bulkStore.adjustStock(referenceProduct.id, 1);
});

const removeStore = new ProductStore();
const idsToRemove: string[] = [];

for (let iteration = 0; iteration < TOTAL_EXECUTIONS; iteration += 1) {
  const created = removeStore.create({
    name: `Producto para eliminar ${iteration}`,
    sku: `REMOVE-${iteration}`,
    price: 1_000,
  });
  idsToRemove.push(created.id);
}

measureMany("remove", (iteration) => {
  removeStore.remove(idsToRemove[iteration]!);
});

// Permite inspeccionar los resultados después de medir todas las operaciones.
debugger;
