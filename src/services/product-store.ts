import { randomUUID } from "node:crypto";

/**
 * Contrato del almacén de productos.
 * El comportamiento lo definen los tests de tests/practica-productos.
 * Implementen los métodos. No cambien las firmas ni los códigos de ProductError.
 */

export type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProductInput = {
  name: string;
  sku: string;
  price: number;
  stock?: number;
  category?: string | null;
};

export type UpdateProductInput = {
  name?: string;
  sku?: string;
  price?: number;
  stock?: number;
  category?: string | null;
  active?: boolean;
};

export type ListProductsQuery = {
  search?: string;
  category?: string;
  active?: boolean;
  minPrice?: number;
  maxPrice?: number;
};

export type ProductErrorCode = "VALIDATION" | "NOT_FOUND" | "DUPLICATE_SKU" | "INSUFFICIENT_STOCK";

export class ProductError extends Error {
  readonly code: ProductErrorCode;

  constructor(code: ProductErrorCode, message: string) {
    super(message);
    this.name = "ProductError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function copyProduct(product: Product): Product {
  return {
    ...product,
    createdAt: new Date(product.createdAt),
    updatedAt: new Date(product.updatedAt),
  };
}

function validationError(message: string): never {
  throw new ProductError("VALIDATION", message);
}

export class ProductStore {
  private products: Product[] = [];

  create(input: CreateProductInput): Product {
    if (typeof input?.name !== "string") {
      validationError("El nombre es obligatorio");
    }

    const name = input.name.trim();
    if (name.length === 0 || name.length > 80) {
      validationError("El nombre debe tener entre 1 y 80 caracteres");
    }

    if (typeof input.sku !== "string") {
      validationError("El SKU es obligatorio");
    }

    const sku = input.sku.trim().toUpperCase();
    const validSku = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
    if (sku.length < 2 || sku.length > 32 || !validSku.test(sku)) {
      validationError("El SKU no tiene un formato válido");
    }

    if (typeof input.price !== "number" || !Number.isFinite(input.price) || input.price < 0) {
      validationError("El precio debe ser un número mayor o igual a cero");
    }

    const stock = input.stock ?? 0;
    if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0) {
      validationError("El stock debe ser un entero mayor o igual a cero");
    }

    if (input.category !== undefined && input.category !== null && typeof input.category !== "string") {
      validationError("La categoría debe ser texto");
    }

    if (this.products.some((product) => product.sku === sku)) {
      throw new ProductError("DUPLICATE_SKU", "Ya existe un producto con ese SKU");
    }

    const category = input.category?.trim() || null;
    const now = new Date();
    const product: Product = {
      id: randomUUID(),
      name,
      sku,
      price: input.price,
      stock,
      category,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    this.products.push(product);
    return copyProduct(product);
  }

  getById(id: string): Product | null {
    const product = this.products.find((item) => item.id === id);
    return product ? copyProduct(product) : null;
  }

  getBySku(sku: string): Product | null {
    if (typeof sku !== "string") return null;

    const normalizedSku = sku.trim().toUpperCase();
    const product = this.products.find((item) => item.sku === normalizedSku);
    return product ? copyProduct(product) : null;
  }

  list(query?: ListProductsQuery): Product[] {
    const filters = query ?? {};

    if (filters.search !== undefined && typeof filters.search !== "string") {
      validationError("La búsqueda debe ser texto");
    }
    if (filters.category !== undefined && typeof filters.category !== "string") {
      validationError("La categoría debe ser texto");
    }
    if (filters.active !== undefined && typeof filters.active !== "boolean") {
      validationError("El estado debe ser verdadero o falso");
    }

    for (const price of [filters.minPrice, filters.maxPrice]) {
      if (price !== undefined && (typeof price !== "number" || !Number.isFinite(price) || price < 0)) {
        validationError("El rango de precio no es válido");
      }
    }

    if (
      filters.minPrice !== undefined &&
      filters.maxPrice !== undefined &&
      filters.minPrice > filters.maxPrice
    ) {
      validationError("El precio mínimo no puede superar el máximo");
    }

    const search = filters.search?.trim().toLowerCase();
    const category = filters.category?.trim();

    return this.products
      .filter((product) => {
        if (search && !product.name.toLowerCase().includes(search)) return false;
        if (
          category &&
          product.category?.localeCompare(category, "es", { sensitivity: "base" }) !== 0
        ) {
          return false;
        }
        if (filters.active !== undefined && product.active !== filters.active) return false;
        if (filters.minPrice !== undefined && product.price < filters.minPrice) return false;
        if (filters.maxPrice !== undefined && product.price > filters.maxPrice) return false;
        return true;
      })
      .sort((first, second) => {
        const byName = first.name.localeCompare(second.name, "es", { sensitivity: "base" });
        return byName || first.sku.localeCompare(second.sku, "es");
      })
      .map(copyProduct);
  }

  update(id: string, patch: UpdateProductInput): Product {
    const index = this.products.findIndex((product) => product.id === id);
    if (index === -1) {
      throw new ProductError("NOT_FOUND", "El producto no existe");
    }

    const current = this.products[index]!;
    const updated = { ...current };
    let hasChanges = false;

    if (patch.name !== undefined) {
      if (typeof patch.name !== "string") validationError("El nombre debe ser texto");

      const name = patch.name.trim();
      if (name.length === 0 || name.length > 80) {
        validationError("El nombre debe tener entre 1 y 80 caracteres");
      }
      updated.name = name;
      hasChanges = true;
    }

    if (patch.sku !== undefined) {
      if (typeof patch.sku !== "string") validationError("El SKU debe ser texto");

      const sku = patch.sku.trim().toUpperCase();
      const validSku = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
      if (sku.length < 2 || sku.length > 32 || !validSku.test(sku)) {
        validationError("El SKU no tiene un formato válido");
      }
      if (this.products.some((product) => product.id !== id && product.sku === sku)) {
        throw new ProductError("DUPLICATE_SKU", "Ya existe un producto con ese SKU");
      }
      updated.sku = sku;
      hasChanges = true;
    }

    if (patch.price !== undefined) {
      if (typeof patch.price !== "number" || !Number.isFinite(patch.price) || patch.price < 0) {
        validationError("El precio debe ser un número mayor o igual a cero");
      }
      updated.price = patch.price;
      hasChanges = true;
    }

    if (patch.stock !== undefined) {
      if (typeof patch.stock !== "number" || !Number.isInteger(patch.stock) || patch.stock < 0) {
        validationError("El stock debe ser un entero mayor o igual a cero");
      }
      updated.stock = patch.stock;
      hasChanges = true;
    }

    if (patch.category !== undefined) {
      if (patch.category !== null && typeof patch.category !== "string") {
        validationError("La categoría debe ser texto");
      }
      updated.category = patch.category?.trim() || null;
      hasChanges = true;
    }

    if (patch.active !== undefined) {
      if (typeof patch.active !== "boolean") {
        validationError("El estado debe ser verdadero o falso");
      }
      updated.active = patch.active;
      hasChanges = true;
    }

    if (!hasChanges) return copyProduct(current);

    updated.updatedAt = new Date();
    this.products[index] = updated;
    return copyProduct(updated);
  }

  remove(id: string): boolean {
    const index = this.products.findIndex((product) => product.id === id);
    if (index === -1) return false;

    this.products.splice(index, 1);
    return true;
  }

  adjustStock(id: string, delta: number): Product {
    const index = this.products.findIndex((product) => product.id === id);
    if (index === -1) {
      throw new ProductError("NOT_FOUND", "El producto no existe");
    }

    if (typeof delta !== "number" || !Number.isInteger(delta) || delta === 0) {
      validationError("El ajuste de stock debe ser un entero distinto de cero");
    }

    const current = this.products[index]!;
    const newStock = current.stock + delta;
    if (newStock < 0) {
      throw new ProductError("INSUFFICIENT_STOCK", "No hay suficiente stock para realizar el ajuste");
    }

    const updated: Product = {
      ...current,
      stock: newStock,
      updatedAt: new Date(),
    };
    this.products[index] = updated;
    return copyProduct(updated);
  }
}
