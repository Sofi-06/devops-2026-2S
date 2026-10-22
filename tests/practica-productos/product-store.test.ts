/**
 * Práctica: almacén de productos, dirigido por tests.
 *
 * La nota va de 1 a 5. En el PR se lee en el resumen del Action "Práctica productos":
 *   npm run test:productos
 *   nota = 1 + (tests que pasan / 8)
 *   0 pasan = 1.0, 8 = 2.0, 16 = 3.0, 24 = 4.0, 32 = 5.0
 *
 * Implementen `src/services/product-store.ts`.
 * No modifiquen este archivo.
 *
 * Alcance: memoria, síncrono, sin base de datos.
 * Cada `new ProductStore()` empieza vacío y no comparte datos con otras instancias.
 *
 * Producto
 * - id: UUID v4
 * - name: texto recortado, de 1 a 80 caracteres. Los espacios internos se conservan.
 * - sku: recortado y en mayúsculas, de 2 a 32 caracteres.
 *   Patrón: /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/
 * - price: número finito >= 0. El 0 es válido. Los decimales se conservan.
 * - stock: entero >= 0. Si se omite al crear, queda en 0.
 * - category: texto recortado, o null si se omite o queda en blanco.
 * - active: true al crear.
 * - createdAt y updatedAt: objetos Date. Al crear, las dos son "ahora".
 *   Un cambio real mueve solo updatedAt.
 *
 * Errores: lancen ProductError con `code` y un message no vacío.
 * - VALIDATION: datos de entrada inválidos, incluido un tipo equivocado.
 * - DUPLICATE_SKU: el sku ya pertenece a otro producto.
 * - NOT_FOUND: update o adjustStock sobre un id que no existe.
 * - INSUFFICIENT_STOCK: el ajuste dejaría el stock por debajo de 0.
 *
 * getById, getBySku y remove no lanzan NOT_FOUND.
 * La lectura devuelve null y remove devuelve false cuando no hay producto.
 *
 * create, update, adjustStock y las lecturas devuelven copias, fechas incluidas.
 * Mutar el input o el objeto devuelto no cambia lo guardado.
 *
 * list ordena por nombre con locale "es" y sensitivity "base"
 * (no distingue mayúsculas ni tildes) y, si empatan, por sku.
 * Los filtros se combinan con AND:
 * - search: subcadena del nombre, sin distinguir mayúsculas. En blanco, no filtra.
 * - category: igualdad sin distinguir mayúsculas, ya recortada. En blanco, no filtra.
 * - active: si se omite, entran activos e inactivos.
 * - minPrice y maxPrice: inclusivos, finitos y >= 0. Si minPrice > maxPrice, VALIDATION.
 *
 * update solo toca campos distintos de undefined.
 * Un parche vacío devuelve el producto y no cambia updatedAt.
 * Repetir el sku del mismo producto no es duplicado.
 * Si la operación es inválida, el producto queda como estaba.
 *
 * adjustStock suma un entero distinto de cero. El stock puede quedar en 0.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProductError,
  ProductStore,
  type CreateProductInput,
  type ProductErrorCode,
} from "../../src/services/product-store.js";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const T0 = "2026-10-21T15:00:00.000Z";
const T1 = "2026-10-21T16:30:00.000Z";
const T2 = "2026-10-21T18:00:00.000Z";

function freeze(iso: string): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

function input(overrides: Partial<CreateProductInput> = {}): CreateProductInput {
  return {
    name: "Arroz",
    sku: "ARR-1",
    price: 3200,
    ...overrides,
  };
}

function expectProductError(run: () => void, code: ProductErrorCode): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(ProductError);
  expect((caught as ProductError).code).toBe(code);
  expect((caught as ProductError).message.length).toBeGreaterThan(0);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("al crear un producto", () => {
  it("asigna id, valores por defecto y la fecha actual", () => {
    freeze(T0);
    const store = new ProductStore();

    const product = store.create({ name: "Arroz", sku: "ARR-1", price: 3200 });

    expect(product).toEqual({
      id: expect.stringMatching(UUID_V4),
      name: "Arroz",
      sku: "ARR-1",
      price: 3200,
      stock: 0,
      category: null,
      active: true,
      createdAt: new Date(T0),
      updatedAt: new Date(T0),
    });
  });

  it("conserva el stock indicado y un precio decimal", () => {
    const store = new ProductStore();

    const product = store.create({
      name: "Agua",
      sku: "AGU-1",
      price: 10.5,
      stock: 6,
      category: "Bebidas",
    });

    expect(product.price).toBe(10.5);
    expect(product.stock).toBe(6);
    expect(product.category).toBe("Bebidas");
  });

  it("normaliza nombre, sku y categoría", () => {
    const store = new ProductStore();

    const blankCategory = store.create({
      name: "  Arroz  ",
      sku: "  arr-1  ",
      price: 3200,
      category: "   ",
    });
    const detailed = store.create({
      name: "Cafe  molido",
      sku: "caf-1",
      price: 10,
      category: "  Bebidas  ",
    });

    expect(blankCategory).toMatchObject({ name: "Arroz", sku: "ARR-1", category: null });
    expect(detailed).toMatchObject({
      name: "Cafe  molido",
      sku: "CAF-1",
      category: "Bebidas",
    });
  });

  it("rechaza un nombre vacío y no pierde lo ya guardado", () => {
    const store = new ProductStore();
    store.create(input());

    expectProductError(
      () => store.create({ name: "   ", sku: "OTR-1", price: 1 }),
      "VALIDATION",
    );
    expectProductError(
      () => store.create({ name: undefined as unknown as string, sku: "OTR-2", price: 1 }),
      "VALIDATION",
    );

    expect(store.list()).toHaveLength(1);
  });

  it("acepta 80 caracteres en el nombre y rechaza 81", () => {
    const store = new ProductStore();

    const accepted = store.create(input({ name: "a".repeat(80), sku: "NOM-80" }));
    expect(accepted.name).toHaveLength(80);

    expectProductError(
      () => store.create(input({ name: "a".repeat(81), sku: "NOM-81" })),
      "VALIDATION",
    );
    expect(store.list()).toHaveLength(1);
  });

  it("rechaza un precio ausente o negativo, y acepta cero", () => {
    const store = new ProductStore();

    expectProductError(
      () => store.create({ name: "Arroz", sku: "ARR-1", price: undefined as unknown as number }),
      "VALIDATION",
    );
    expectProductError(() => store.create(input({ sku: "ARR-2", price: -1 })), "VALIDATION");

    const free = store.create(input({ sku: "CER-1", price: 0 }));
    expect(free.price).toBe(0);
    expect(store.getBySku("CER-1")?.price).toBe(0);
    expect(store.list()).toHaveLength(1);
  });

  it("rechaza un precio NaN o infinito", () => {
    const store = new ProductStore();
    store.create(input());

    expectProductError(
      () => store.create(input({ sku: "ARR-2", price: Number.NaN })),
      "VALIDATION",
    );
    expectProductError(
      () => store.create(input({ sku: "ARR-3", price: Number.POSITIVE_INFINITY })),
      "VALIDATION",
    );
    expectProductError(
      () => store.create(input({ sku: "ARR-4", price: Number.NEGATIVE_INFINITY })),
      "VALIDATION",
    );

    expect(store.list()).toHaveLength(1);
  });

  it("rechaza un stock negativo o fraccionario", () => {
    const store = new ProductStore();
    store.create(input({ stock: 2 }));

    expectProductError(() => store.create(input({ sku: "ARR-2", stock: -1 })), "VALIDATION");
    expectProductError(() => store.create(input({ sku: "ARR-3", stock: 1.5 })), "VALIDATION");

    expect(store.list()).toHaveLength(1);
    expect(store.getBySku("ARR-1")?.stock).toBe(2);
  });

  it("rechaza un sku vacío o con formato inválido", () => {
    const store = new ProductStore();
    store.create(input());

    for (const sku of ["", "   ", "A", "CAF--1", "CAF-", "-CAF", "CAF_1", "A".repeat(33)]) {
      expectProductError(() => store.create(input({ name: "Otro", sku })), "VALIDATION");
    }

    const boundary = store.create(input({ name: "Largo", sku: "A".repeat(32) }));
    expect(boundary.sku).toBe("A".repeat(32));
    expect(store.list()).toHaveLength(2);
  });

  it("rechaza un sku duplicado aunque cambie el uso de mayúsculas", () => {
    const store = new ProductStore();
    const first = store.create(input({ name: "Arroz", sku: "arr-1", price: 10 }));

    expectProductError(
      () => store.create(input({ name: "Otro", sku: " ARR-1 ", price: 12 })),
      "DUPLICATE_SKU",
    );

    expect(store.list()).toHaveLength(1);
    expect(store.getBySku("arr-1")).toEqual(first);
  });

  it("no comparte datos entre instancias", () => {
    const first = new ProductStore();
    const second = new ProductStore();
    const arroz = first.create(input({ sku: "ARR-1" }));
    const frijol = first.create(input({ name: "Frijol", sku: "FRI-1" }));

    expect(arroz.id).not.toBe(frijol.id);
    expect(arroz.id).toMatch(UUID_V4);
    expect(frijol.id).toMatch(UUID_V4);
    expect(first.list()).toHaveLength(2);
    expect(second.list()).toEqual([]);
    expect(second.getById(arroz.id)).toBeNull();
    expect(second.getBySku("ARR-1")).toBeNull();
  });

  it("devuelve copias y no conserva el objeto de entrada", () => {
    freeze(T0);
    const store = new ProductStore();
    const payload = input({ price: 10, stock: 4, category: "Granos" });
    const created = store.create(payload);

    payload.name = "Hack";
    payload.stock = 0;
    payload.category = "X";
    created.name = "Hack";
    created.stock = 1;
    created.price = 0;
    created.createdAt.setFullYear(1999);
    created.updatedAt.setFullYear(1999);

    const stored = store.getById(created.id);
    expect(stored).toEqual({
      id: created.id,
      name: "Arroz",
      sku: "ARR-1",
      price: 10,
      stock: 4,
      category: "Granos",
      active: true,
      createdAt: new Date(T0),
      updatedAt: new Date(T0),
    });
    expect(stored).not.toBe(created);

    stored!.name = "Otro";
    stored!.createdAt.setFullYear(1990);
    const listed = store.list();
    listed.pop();
    const again = store.list();
    again[0]!.name = "Hack";
    again[0]!.updatedAt.setFullYear(1991);

    expect(store.list()).toHaveLength(1);
    expect(store.getById(created.id)?.name).toBe("Arroz");
    expect(store.getById(created.id)?.createdAt).toEqual(new Date(T0));
  });
});

describe("al consultar el almacén", () => {
  it("getById devuelve el producto o null", () => {
    const store = new ProductStore();
    const created = store.create(input({ stock: 2, category: "Granos" }));

    expect(store.getById(created.id)).toEqual(created);
    expect(store.getById("no-existe")).toBeNull();
    expect(store.getById("")).toBeNull();
  });

  it("getBySku normaliza la búsqueda y devuelve null si no existe", () => {
    const store = new ProductStore();
    const created = store.create(input({ sku: "arr-1" }));

    expect(store.getBySku("  ARR-1  ")).toEqual(created);
    expect(store.getBySku("no-existe")).toBeNull();
    expect(store.getBySku("   ")).toBeNull();
  });

  it("list ordena por nombre en español y, si empatan, por sku", () => {
    const store = new ProductStore();
    store.create(input({ name: "banana", sku: "BAN-2" }));
    store.create(input({ name: "Árbol", sku: "ARB-1" }));
    store.create(input({ name: "Banana", sku: "BAN-1" }));
    store.create(input({ name: "arroz", sku: "ARR-1" }));

    expect(store.list().map((product) => product.sku)).toEqual([
      "ARB-1",
      "ARR-1",
      "BAN-1",
      "BAN-2",
    ]);
  });

  it("list filtra por búsqueda, categoría y activo", () => {
    const store = new ProductStore();
    store.create(input({ name: "Cafe molido", sku: "CAF-1", price: 100, category: "Bebidas" }));
    const inactive = store.create(
      input({ name: "Cafe en grano", sku: "CAF-2", price: 200, category: "Bebidas" }),
    );
    store.update(inactive.id, { active: false });
    store.create(input({ name: "Te verde", sku: "TE-1", price: 150, category: "Bebidas" }));
    store.create(input({ name: "Cafe soluble", sku: "CAF-3", price: 50, category: "Despensa" }));

    expect(store.list()).toHaveLength(4);
    expect(store.list({ active: false }).map((product) => product.sku)).toEqual(["CAF-2"]);
    expect(
      store
        .list({ search: "CAFE", category: " bebidas ", active: true })
        .map((product) => product.sku),
    ).toEqual(["CAF-1"]);
  });

  it("un filtro de texto en blanco no descarta productos", () => {
    const store = new ProductStore();
    store.create(input({ category: "Granos" }));
    store.create(input({ name: "Frijol", sku: "FRI-1", category: "Legumbres" }));

    expect(store.list({ search: "   ", category: "   " })).toHaveLength(2);
  });

  it("list incluye los extremos del rango de precio", () => {
    const store = new ProductStore();
    store.create(input({ name: "Arroz", sku: "ARR-1", price: 100 }));
    store.create(input({ name: "Maiz", sku: "MAI-1", price: 400 }));
    store.create(input({ name: "Frijol", sku: "FRI-1", price: 250 }));

    expect(store.list({ minPrice: 100, maxPrice: 250 }).map((product) => product.sku)).toEqual([
      "ARR-1",
      "FRI-1",
    ]);
  });

  it("list rechaza un rango de precio inválido", () => {
    const store = new ProductStore();
    store.create(input());

    expectProductError(() => store.list({ minPrice: 20, maxPrice: 10 }), "VALIDATION");
    expectProductError(() => store.list({ minPrice: -1 }), "VALIDATION");
    expectProductError(() => store.list({ maxPrice: Number.NaN }), "VALIDATION");
    expectProductError(() => store.list({ maxPrice: Number.POSITIVE_INFINITY }), "VALIDATION");

    expect(store.list()).toHaveLength(1);
  });
});

describe("al actualizar un producto", () => {
  it("cambia solo lo enviado y renueva updatedAt", () => {
    freeze(T0);
    const store = new ProductStore();
    const created = store.create(
      input({ name: "Arroz", sku: "ARR-1", price: 3200, stock: 4, category: "Granos" }),
    );

    freeze(T1);
    const updated = store.update(created.id, { price: 3500 });

    expect(updated).toEqual({
      ...created,
      price: 3500,
      updatedAt: new Date(T1),
    });
    expect(store.getById(created.id)).toEqual(updated);
  });

  it("acepta el mismo sku en otra combinación de mayúsculas", () => {
    freeze(T0);
    const store = new ProductStore();
    const created = store.create(input({ sku: "ARR-1" }));

    freeze(T1);
    const updated = store.update(created.id, { sku: " arr-1 " });

    expect(updated.sku).toBe("ARR-1");
    expect(updated.updatedAt).toEqual(new Date(T1));
    expect(updated.createdAt).toEqual(created.createdAt);
    expect(store.getBySku("ARR-1")?.id).toBe(created.id);
  });

  it("rechaza el sku de otro producto y no deja cambios a medias", () => {
    freeze(T0);
    const store = new ProductStore();
    const arroz = store.create(input({ name: "Arroz", sku: "ARR-1", price: 10, stock: 3 }));
    store.create(input({ name: "Frijol", sku: "FRI-1", price: 8 }));

    freeze(T1);
    expectProductError(() => store.update(arroz.id, { sku: "fri-1", price: 99 }), "DUPLICATE_SKU");

    expect(store.getById(arroz.id)).toEqual(arroz);
    expect(store.getBySku("FRI-1")?.name).toBe("Frijol");
  });

  it("lanza NOT_FOUND si el id no existe", () => {
    const store = new ProductStore();
    store.create(input());

    expectProductError(
      () => store.update("00000000-0000-4000-8000-000000000000", { name: "Frijol" }),
      "NOT_FOUND",
    );
    expect(store.list()).toHaveLength(1);
  });

  it("rechaza datos inválidos y no modifica el producto", () => {
    freeze(T0);
    const store = new ProductStore();
    const created = store.create(input({ price: 10, stock: 3 }));

    freeze(T1);
    expectProductError(() => store.update(created.id, { name: "   ", price: -5 }), "VALIDATION");

    expect(store.getById(created.id)).toEqual(created);
  });

  it("puede desactivar el producto y dejar la categoría vacía", () => {
    freeze(T0);
    const store = new ProductStore();
    const created = store.create(input({ category: "Granos" }));

    freeze(T1);
    const updated = store.update(created.id, { active: false, category: "   " });

    expect(updated.active).toBe(false);
    expect(updated.category).toBeNull();
    expect(updated.updatedAt).toEqual(new Date(T1));
    expect(store.list({ active: false }).map((product) => product.id)).toEqual([created.id]);
    expect(store.list({ active: true })).toEqual([]);
  });

  it("un update sin campos no cambia updatedAt", () => {
    freeze(T0);
    const store = new ProductStore();
    const created = store.create(input());

    freeze(T1);
    expect(store.update(created.id, {})).toEqual(created);
    expect(store.getById(created.id)?.updatedAt).toEqual(new Date(T0));
  });
});

describe("al eliminar un producto", () => {
  it("borra solo ese producto y devuelve false si no existe", () => {
    const store = new ProductStore();
    const arroz = store.create(input({ name: "Arroz", sku: "ARR-1" }));
    const frijol = store.create(input({ name: "Frijol", sku: "FRI-1" }));

    expect(store.remove(arroz.id)).toBe(true);
    expect(store.getById(arroz.id)).toBeNull();
    expect(store.getBySku("ARR-1")).toBeNull();
    expect(store.list().map((product) => product.sku)).toEqual(["FRI-1"]);
    expect(store.remove(arroz.id)).toBe(false);
    expect(store.remove("no-existe")).toBe(false);
    expect(store.getById(frijol.id)?.sku).toBe("FRI-1");
  });

  it("permite reutilizar el sku con otro id", () => {
    const store = new ProductStore();
    const first = store.create(input({ sku: "ARR-1" }));
    store.remove(first.id);

    const second = store.create(input({ sku: "arr-1", name: "Arroz nuevo" }));

    expect(second.id).not.toBe(first.id);
    expect(second.sku).toBe("ARR-1");
    expect(store.getBySku("ARR-1")?.id).toBe(second.id);
    expect(store.list()).toHaveLength(1);
  });
});

describe("al ajustar el stock", () => {
  it("suma y resta, y puede dejar el stock en cero", () => {
    freeze(T0);
    const store = new ProductStore();
    const created = store.create(input({ stock: 5, price: 10 }));

    freeze(T1);
    const added = store.adjustStock(created.id, 2);
    expect(added.stock).toBe(7);
    expect(added.price).toBe(10);
    expect(added.createdAt).toEqual(created.createdAt);
    expect(added.updatedAt).toEqual(new Date(T1));

    freeze(T2);
    const emptied = store.adjustStock(created.id, -7);
    expect(emptied.stock).toBe(0);
    expect(emptied.updatedAt).toEqual(new Date(T2));
    expect(store.getById(created.id)?.stock).toBe(0);
  });

  it("rechaza un resultado negativo y no cambia el producto", () => {
    freeze(T0);
    const store = new ProductStore();
    const created = store.create(input({ stock: 5 }));

    freeze(T1);
    expectProductError(() => store.adjustStock(created.id, -6), "INSUFFICIENT_STOCK");
    expect(store.getById(created.id)).toEqual(created);
  });

  it("rechaza un delta que no sea un entero distinto de cero", () => {
    freeze(T0);
    const store = new ProductStore();
    const created = store.create(input({ stock: 5 }));

    freeze(T1);
    expectProductError(() => store.adjustStock(created.id, 0), "VALIDATION");
    expectProductError(() => store.adjustStock(created.id, 1.5), "VALIDATION");
    expectProductError(() => store.adjustStock(created.id, Number.NaN), "VALIDATION");
    expect(store.getById(created.id)).toEqual(created);
  });

  it("lanza NOT_FOUND si el id no existe", () => {
    const store = new ProductStore();

    expectProductError(() => store.adjustStock("no-existe", 1), "NOT_FOUND");
  });
});
