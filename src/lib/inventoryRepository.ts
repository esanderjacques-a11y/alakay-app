import { supabase } from "@/lib/supabase";
import {
  listBodegaItems,
  upsertBodegaItem,
  type BodegaItem,
} from "@/lib/farmRepository";
import { pushNotification } from "@/lib/planningStore";

export type InventoryProduct = {
  id: string;
  name: string;
  product_key: string | null;
  default_unit: string;
  min_stock: number;
  unit_cost: number | null;
  notes: string | null;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type InventoryBatch = {
  id: string;
  product_id: string;
  farm_id: number;
  lot_code: string | null;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  expires_on: string | null;
  received_at: string;
};

export type InventoryMovementType =
  | "receive"
  | "use"
  | "adjust"
  | "transfer_out"
  | "transfer_in";

export type InventoryMovement = {
  id: string;
  product_id: string;
  farm_id: number;
  batch_id: string | null;
  movement_type: InventoryMovementType;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  related_farm_id: number | null;
  note: string | null;
  created_at: string;
};

export type LowStockItem = {
  product: InventoryProduct;
  farmId: number;
  quantity: number;
  unit: string;
};

function mapProduct(row: Record<string, unknown>): InventoryProduct {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    product_key: (row.product_key as string | null) || null,
    default_unit: String(row.default_unit || "kg"),
    min_stock: Number(row.min_stock || 0),
    unit_cost:
      row.unit_cost == null || row.unit_cost === ""
        ? null
        : Number(row.unit_cost),
    notes: (row.notes as string | null) || null,
    active: row.active !== false,
    created_at: (row.created_at as string | null) || null,
    updated_at: (row.updated_at as string | null) || null,
  };
}

function mapBatch(row: Record<string, unknown>): InventoryBatch {
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    farm_id: Number(row.farm_id),
    lot_code: (row.lot_code as string | null) || null,
    quantity: Number(row.quantity || 0),
    unit: String(row.unit || "kg"),
    unit_cost:
      row.unit_cost == null || row.unit_cost === ""
        ? null
        : Number(row.unit_cost),
    expires_on: row.expires_on ? String(row.expires_on).slice(0, 10) : null,
    received_at: String(row.received_at || new Date().toISOString()),
  };
}

function mapMovement(row: Record<string, unknown>): InventoryMovement {
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    farm_id: Number(row.farm_id),
    batch_id: (row.batch_id as string | null) || null,
    movement_type: row.movement_type as InventoryMovementType,
    quantity: Number(row.quantity || 0),
    unit: String(row.unit || "kg"),
    unit_cost:
      row.unit_cost == null || row.unit_cost === ""
        ? null
        : Number(row.unit_cost),
    related_farm_id:
      row.related_farm_id == null ? null : Number(row.related_farm_id),
    note: (row.note as string | null) || null,
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

async function syncBodegaBalance(args: {
  userId: string;
  farmId: number;
  product: InventoryProduct;
  delta: number;
  unit: string;
}) {
  const items = await listBodegaItems(args.userId, args.farmId);
  const match =
    items.find(
      (item) =>
        (args.product.product_key &&
          item.product_key === args.product.product_key) ||
        item.product_name.trim().toLocaleLowerCase() ===
          args.product.name.trim().toLocaleLowerCase()
    ) || null;
  const nextQty = Math.max(0, (match?.quantity || 0) + args.delta);
  await upsertBodegaItem({
    userId: args.userId,
    farmId: args.farmId,
    productName: args.product.name,
    productKey: args.product.product_key,
    quantity: nextQty,
    unit: args.unit || args.product.default_unit,
    notes: match?.notes || undefined,
    id: match?.id,
  });
  return nextQty;
}

async function maybeLowStockNotify(args: {
  product: InventoryProduct;
  farmId: number;
  quantity: number;
}) {
  if (args.quantity > args.product.min_stock) return;
  pushNotification({
    title: `Low stock: ${args.product.name}`,
    body: `On hand ${args.quantity} ${args.product.default_unit} (min ${args.product.min_stock}).`,
    kind: "inventory",
    hrefStep: "farms",
    relatedId: args.product.id,
  });
}

export async function listProducts(userId: string): Promise<InventoryProduct[]> {
  const { data, error } = await supabase
    .from("inventory_products")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapProduct(row as Record<string, unknown>));
}

export async function upsertProduct(args: {
  userId: string;
  id?: string;
  name: string;
  productKey?: string | null;
  defaultUnit?: string;
  minStock?: number;
  unitCost?: number | null;
  notes?: string | null;
  active?: boolean;
}): Promise<InventoryProduct> {
  const payload = {
    id: args.id,
    user_id: args.userId,
    name: args.name.trim(),
    product_key: args.productKey || null,
    default_unit: args.defaultUnit || "kg",
    min_stock: args.minStock ?? 0,
    unit_cost: args.unitCost ?? null,
    notes: args.notes || null,
    active: args.active ?? true,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("inventory_products")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapProduct(data as Record<string, unknown>);
}

export async function listBatches(
  userId: string,
  farmId: number,
  productId?: string
): Promise<InventoryBatch[]> {
  let query = supabase
    .from("inventory_batches")
    .select("*")
    .eq("user_id", userId)
    .eq("farm_id", farmId)
    .order("received_at", { ascending: false });
  if (productId) query = query.eq("product_id", productId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapBatch(row as Record<string, unknown>));
}

export async function listMovements(
  userId: string,
  farmId: number
): Promise<InventoryMovement[]> {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*")
    .eq("user_id", userId)
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapMovement(row as Record<string, unknown>));
}

async function insertMovement(args: {
  userId: string;
  productId: string;
  farmId: number;
  batchId?: string | null;
  type: InventoryMovementType;
  quantity: number;
  unit: string;
  unitCost?: number | null;
  relatedFarmId?: number | null;
  note?: string | null;
}): Promise<InventoryMovement> {
  const { data, error } = await supabase
    .from("inventory_movements")
    .insert({
      user_id: args.userId,
      product_id: args.productId,
      farm_id: args.farmId,
      batch_id: args.batchId || null,
      movement_type: args.type,
      quantity: args.quantity,
      unit: args.unit,
      unit_cost: args.unitCost ?? null,
      related_farm_id: args.relatedFarmId ?? null,
      note: args.note || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapMovement(data as Record<string, unknown>);
}

export async function receiveStock(args: {
  userId: string;
  productId: string;
  farmId: number;
  quantity: number;
  unit?: string;
  unitCost?: number | null;
  lotCode?: string | null;
  expiresOn?: string | null;
  note?: string | null;
}): Promise<{ batch: InventoryBatch; movement: InventoryMovement }> {
  const products = await listProducts(args.userId);
  const product = products.find((p) => p.id === args.productId);
  if (!product) throw new Error("Product not found");
  const unit = args.unit || product.default_unit;
  const { data, error } = await supabase
    .from("inventory_batches")
    .insert({
      user_id: args.userId,
      product_id: args.productId,
      farm_id: args.farmId,
      lot_code: args.lotCode || null,
      quantity: args.quantity,
      unit,
      unit_cost: args.unitCost ?? product.unit_cost,
      expires_on: args.expiresOn || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const batch = mapBatch(data as Record<string, unknown>);
  const movement = await insertMovement({
    userId: args.userId,
    productId: args.productId,
    farmId: args.farmId,
    batchId: batch.id,
    type: "receive",
    quantity: args.quantity,
    unit,
    unitCost: args.unitCost ?? product.unit_cost,
    note: args.note,
  });
  const qty = await syncBodegaBalance({
    userId: args.userId,
    farmId: args.farmId,
    product,
    delta: args.quantity,
    unit,
  });
  await maybeLowStockNotify({ product, farmId: args.farmId, quantity: qty });
  if (args.unitCost != null) {
    await upsertProduct({
      userId: args.userId,
      id: product.id,
      name: product.name,
      productKey: product.product_key,
      defaultUnit: product.default_unit,
      minStock: product.min_stock,
      unitCost: args.unitCost,
      notes: product.notes,
    });
  }
  return { batch, movement };
}

export async function useStock(args: {
  userId: string;
  productId: string;
  farmId: number;
  quantity: number;
  unit?: string;
  batchId?: string | null;
  note?: string | null;
}): Promise<InventoryMovement> {
  const products = await listProducts(args.userId);
  const product = products.find((p) => p.id === args.productId);
  if (!product) throw new Error("Product not found");
  const unit = args.unit || product.default_unit;
  if (args.batchId) {
    const { data: batchRow, error } = await supabase
      .from("inventory_batches")
      .select("*")
      .eq("user_id", args.userId)
      .eq("id", args.batchId)
      .single();
    if (error) throw new Error(error.message);
    const batch = mapBatch(batchRow as Record<string, unknown>);
    const next = Math.max(0, batch.quantity - args.quantity);
    const { error: updError } = await supabase
      .from("inventory_batches")
      .update({ quantity: next, updated_at: new Date().toISOString() })
      .eq("id", args.batchId)
      .eq("user_id", args.userId);
    if (updError) throw new Error(updError.message);
  }
  const movement = await insertMovement({
    userId: args.userId,
    productId: args.productId,
    farmId: args.farmId,
    batchId: args.batchId,
    type: "use",
    quantity: args.quantity,
    unit,
    note: args.note,
  });
  const qty = await syncBodegaBalance({
    userId: args.userId,
    farmId: args.farmId,
    product,
    delta: -args.quantity,
    unit,
  });
  await maybeLowStockNotify({ product, farmId: args.farmId, quantity: qty });
  return movement;
}

export async function adjustStock(args: {
  userId: string;
  productId: string;
  farmId: number;
  quantityDelta: number;
  unit?: string;
  note?: string | null;
}): Promise<InventoryMovement> {
  const products = await listProducts(args.userId);
  const product = products.find((p) => p.id === args.productId);
  if (!product) throw new Error("Product not found");
  const unit = args.unit || product.default_unit;
  const movement = await insertMovement({
    userId: args.userId,
    productId: args.productId,
    farmId: args.farmId,
    type: "adjust",
    quantity: args.quantityDelta,
    unit,
    note: args.note,
  });
  const qty = await syncBodegaBalance({
    userId: args.userId,
    farmId: args.farmId,
    product,
    delta: args.quantityDelta,
    unit,
  });
  await maybeLowStockNotify({ product, farmId: args.farmId, quantity: qty });
  return movement;
}

export async function transferStock(args: {
  userId: string;
  fromFarmId: number;
  toFarmId: number;
  productId: string;
  quantity: number;
  unit?: string;
  note?: string | null;
}): Promise<{ out: InventoryMovement; in: InventoryMovement }> {
  const products = await listProducts(args.userId);
  const product = products.find((p) => p.id === args.productId);
  if (!product) throw new Error("Product not found");
  const unit = args.unit || product.default_unit;
  const out = await insertMovement({
    userId: args.userId,
    productId: args.productId,
    farmId: args.fromFarmId,
    type: "transfer_out",
    quantity: args.quantity,
    unit,
    relatedFarmId: args.toFarmId,
    note: args.note,
  });
  const inn = await insertMovement({
    userId: args.userId,
    productId: args.productId,
    farmId: args.toFarmId,
    type: "transfer_in",
    quantity: args.quantity,
    unit,
    relatedFarmId: args.fromFarmId,
    note: args.note,
  });
  await syncBodegaBalance({
    userId: args.userId,
    farmId: args.fromFarmId,
    product,
    delta: -args.quantity,
    unit,
  });
  await syncBodegaBalance({
    userId: args.userId,
    farmId: args.toFarmId,
    product,
    delta: args.quantity,
    unit,
  });
  return { out, in: inn };
}

export async function listLowStock(
  userId: string,
  farmId?: number
): Promise<LowStockItem[]> {
  const products = await listProducts(userId);
  const items: BodegaItem[] = farmId
    ? await listBodegaItems(userId, farmId)
    : await (
        await import("@/lib/farmRepository")
      ).listAllBodegaItems(userId);
  const low: LowStockItem[] = [];
  for (const product of products) {
    const matches = items.filter(
      (item) =>
        (product.product_key && item.product_key === product.product_key) ||
        item.product_name.trim().toLocaleLowerCase() ===
          product.name.trim().toLocaleLowerCase()
    );
    for (const match of matches) {
      if (match.quantity <= product.min_stock) {
        low.push({
          product,
          farmId: match.farm_id,
          quantity: match.quantity,
          unit: match.unit,
        });
      }
    }
  }
  return low;
}

export async function farmStockValuation(
  userId: string,
  farmId: number
): Promise<number> {
  const [products, items] = await Promise.all([
    listProducts(userId),
    listBodegaItems(userId, farmId),
  ]);
  let total = 0;
  for (const item of items) {
    const product = products.find(
      (p) =>
        (p.product_key && p.product_key === item.product_key) ||
        p.name.trim().toLocaleLowerCase() ===
          item.product_name.trim().toLocaleLowerCase()
    );
    const cost = product?.unit_cost ?? 0;
    total += item.quantity * cost;
  }
  return total;
}

export async function getStockProductKeys(
  userId: string,
  farmId?: number
): Promise<string[]> {
  const items = farmId
    ? await listBodegaItems(userId, farmId)
    : await (
        await import("@/lib/farmRepository")
      ).listAllBodegaItems(userId);
  return items
    .filter((item) => item.quantity > 0)
    .map((item) => item.product_key)
    .filter((key): key is string => Boolean(key));
}

/** Consume stock when applying a fertilizer cost scenario (optional). */
export async function consumeStockForProducts(args: {
  userId: string;
  farmId: number;
  lines: Array<{ productKey?: string | null; productName?: string; quantity: number; unit?: string }>;
}): Promise<void> {
  const products = await listProducts(args.userId);
  for (const line of args.lines) {
    if (!line.quantity || line.quantity <= 0) continue;
    const product = products.find(
      (p) =>
        (line.productKey && p.product_key === line.productKey) ||
        (line.productName &&
          p.name.trim().toLocaleLowerCase() ===
            line.productName.trim().toLocaleLowerCase())
    );
    if (!product) continue;
    await useStock({
      userId: args.userId,
      productId: product.id,
      farmId: args.farmId,
      quantity: line.quantity,
      unit: line.unit || product.default_unit,
      note: "Consumed from fertilizer cost plan apply",
    });
  }
}
