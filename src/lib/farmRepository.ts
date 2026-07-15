import { supabase } from "@/lib/supabase";

export type FarmRecord = {
  farm_id: number;
  farm_name: string;
  location: string | null;
  created_at?: string | null;
};

export type LotRecord = {
  lot_id: number;
  farm_id: number;
  lot_name: string;
  area: number | null;
  area_unit: string | null;
  created_at?: string | null;
};

export type FarmAnalysisSummary = {
  analysis_id: number;
  analysis_name: string | null;
  sampling_date: string | null;
  report_date: string | null;
  country: string | null;
  province_state: string | null;
  latitude: number | null;
  longitude: number | null;
  crop_name: string | null;
  lot_name: string | null;
  created_at: string | null;
};

export type BodegaItem = {
  id: string;
  farm_id: number;
  product_name: string;
  product_key: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type UserFarmDashboard = {
  farmCount: number;
  lotCount: number;
  reportCount: number;
  calendarCount: number;
  bodegaCount: number;
  farms: FarmRecord[];
};

/** Normalize name/location so equal geography merges match reliably. */
export function normalizeFarmKeyPart(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export function farmIdentityKey(
  farmName: string,
  location: string | null | undefined
): string {
  return `${normalizeFarmKeyPart(farmName)}||${normalizeFarmKeyPart(location)}`;
}

export async function mergeDuplicateFarms(userId: string): Promise<number> {
  // Prefer DB function (handles analysis_lots FKs under RLS safely).
  const { data: rpcMerged, error: rpcError } = await supabase.rpc(
    "merge_duplicate_farms_for_user",
    { p_user_id: userId }
  );
  if (!rpcError && typeof rpcMerged === "number") {
    return rpcMerged;
  }

  // Fallback for environments where the RPC is not deployed yet.
  if (rpcError && !/could not find|does not exist|PGRST202/i.test(rpcError.message)) {
    console.warn("merge_duplicate_farms_for_user:", rpcError.message);
  }

  const { data: farms, error } = await supabase
    .from("farms")
    .select("farm_id, farm_name, location, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!farms?.length) return 0;

  const groups = new Map<string, FarmRecord[]>();
  for (const farm of farms as FarmRecord[]) {
    const key = farmIdentityKey(farm.farm_name, farm.location);
    const list = groups.get(key) || [];
    list.push(farm);
    groups.set(key, list);
  }

  let merged = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keeper = group[0];
    const duplicates = group.slice(1);

    for (const dup of duplicates) {
      await absorbFarmInto(keeper.farm_id, dup.farm_id);
      const { error: deleteError } = await supabase
        .from("farms")
        .delete()
        .eq("farm_id", dup.farm_id)
        .eq("user_id", userId);
      if (deleteError) throw new Error(deleteError.message);
      merged += 1;
    }
  }
  return merged;
}

async function absorbFarmInto(keeperId: number, donorId: number) {
  const { data: keeperLots, error: keeperLotError } = await supabase
    .from("lots")
    .select("lot_id, lot_name")
    .eq("farm_id", keeperId);
  if (keeperLotError) throw new Error(keeperLotError.message);

  const { data: donorLots, error: donorLotError } = await supabase
    .from("lots")
    .select("lot_id, lot_name")
    .eq("farm_id", donorId);
  if (donorLotError) throw new Error(donorLotError.message);

  const keeperByName = new Map(
    (keeperLots || []).map((lot) => [
      normalizeFarmKeyPart(lot.lot_name),
      lot.lot_id as number,
    ])
  );

  for (const lot of donorLots || []) {
    const key = normalizeFarmKeyPart(lot.lot_name);
    const existingId = keeperByName.get(key);
    if (existingId) {
      await reassignLotReferences(lot.lot_id as number, existingId);
      const { error: delLotError } = await supabase
        .from("lots")
        .delete()
        .eq("lot_id", lot.lot_id);
      if (delLotError) throw new Error(delLotError.message);
    } else {
      const { error: moveLotError } = await supabase
        .from("lots")
        .update({ farm_id: keeperId })
        .eq("lot_id", lot.lot_id);
      if (moveLotError) throw new Error(moveLotError.message);
      keeperByName.set(key, lot.lot_id as number);
    }
  }

  const { error: analysisError } = await supabase
    .from("analyses")
    .update({ farm_id: keeperId })
    .eq("farm_id", donorId);
  if (analysisError) throw new Error(analysisError.message);

  // Bodega rows move with farm_id FK; if table exists, remount to keeper.
  const { error: bodegaError } = await supabase
    .from("farm_bodega_items")
    .update({ farm_id: keeperId })
    .eq("farm_id", donorId);
  if (bodegaError && !/does not exist|Could not find/i.test(bodegaError.message)) {
    throw new Error(bodegaError.message);
  }
}

async function reassignLotReferences(fromLotId: number, toLotId: number) {
  if (fromLotId === toLotId) return;

  const { error: analysesError } = await supabase
    .from("analyses")
    .update({ lot_id: toLotId })
    .eq("lot_id", fromLotId);
  if (analysesError) throw new Error(analysesError.message);

  const { data: links, error: linksError } = await supabase
    .from("analysis_lots")
    .select("analysis_id, is_primary")
    .eq("lot_id", fromLotId);
  if (linksError) throw new Error(linksError.message);

  for (const link of links || []) {
    const { data: already, error: checkError } = await supabase
      .from("analysis_lots")
      .select("analysis_id")
      .eq("analysis_id", link.analysis_id)
      .eq("lot_id", toLotId)
      .maybeSingle();
    if (checkError) throw new Error(checkError.message);

    if (!already) {
      const { error: insertError } = await supabase.from("analysis_lots").insert({
        analysis_id: link.analysis_id,
        lot_id: toLotId,
        // Keep a single primary per analysis (unique index).
        is_primary: false,
      });
      if (
        insertError &&
        !/duplicate|unique|already exists/i.test(insertError.message)
      ) {
        throw new Error(insertError.message);
      }
    }
  }

  // Clear every analysis_lots row for the donor lot before deleting it.
  const { error: delLinksError } = await supabase
    .from("analysis_lots")
    .delete()
    .eq("lot_id", fromLotId);
  if (delLinksError) throw new Error(delLinksError.message);
}

export async function listUserFarms(userId: string): Promise<FarmRecord[]> {
  try {
    await mergeDuplicateFarms(userId);
  } catch (mergeError) {
    // Still show farms if a merge hits a constraint; next open can retry.
    console.warn("mergeDuplicateFarms:", mergeError);
  }
  const { data, error } = await supabase
    .from("farms")
    .select("farm_id, farm_name, location, created_at")
    .eq("user_id", userId)
    .order("farm_name");
  if (error) throw new Error(error.message);
  return (data || []) as FarmRecord[];
}

export async function listFarmLots(farmId: number): Promise<LotRecord[]> {
  const { data, error } = await supabase
    .from("lots")
    .select("lot_id, farm_id, lot_name, area, area_unit, created_at")
    .eq("farm_id", farmId)
    .order("lot_name");
  if (error) throw new Error(error.message);
  return (data || []) as LotRecord[];
}

export async function createFarm(args: {
  userId: string;
  farmName: string;
  location?: string;
}): Promise<FarmRecord> {
  const farmName = args.farmName.trim();
  if (!farmName) throw new Error("Farm name is required");
  const location = args.location?.trim() || null;

  const { data: existing, error: lookupError } = await supabase
    .from("farms")
    .select("farm_id, farm_name, location, created_at")
    .eq("user_id", args.userId);
  if (lookupError) throw new Error(lookupError.message);

  const match = existing?.find(
    (farm) =>
      farmIdentityKey(farm.farm_name, farm.location) ===
      farmIdentityKey(farmName, location)
  );
  if (match) return match as FarmRecord;

  const { data, error } = await supabase
    .from("farms")
    .insert({
      user_id: args.userId,
      farm_name: farmName,
      location,
    })
    .select("farm_id, farm_name, location, created_at")
    .single();
  if (error) throw new Error(error.message);
  const after = await listUserFarms(args.userId);
  return (
    after.find(
      (f) =>
        farmIdentityKey(f.farm_name, f.location) ===
        farmIdentityKey(farmName, location)
    ) || (data as FarmRecord)
  );
}

export async function updateFarmLocation(args: {
  farmId: number;
  userId: string;
  location: string;
}): Promise<void> {
  const { error } = await supabase
    .from("farms")
    .update({ location: args.location.trim() || null })
    .eq("farm_id", args.farmId);
  if (error) throw new Error(error.message);
  try {
    await mergeDuplicateFarms(args.userId);
  } catch (mergeError) {
    console.warn("mergeDuplicateFarms after location update:", mergeError);
  }
}

export async function createLot(args: {
  farmId: number;
  lotName: string;
  area?: number | null;
  areaUnit?: string | null;
}): Promise<LotRecord> {
  const lotName = args.lotName.trim();
  if (!lotName) throw new Error("Lot name is required");

  const { data: existing, error: lookupError } = await supabase
    .from("lots")
    .select("lot_id, farm_id, lot_name, area, area_unit, created_at")
    .eq("farm_id", args.farmId);
  if (lookupError) throw new Error(lookupError.message);

  const match = existing?.find(
    (lot) =>
      normalizeFarmKeyPart(lot.lot_name) === normalizeFarmKeyPart(lotName)
  );
  if (match) return match as LotRecord;

  const { data, error } = await supabase
    .from("lots")
    .insert({
      farm_id: args.farmId,
      lot_name: lotName,
      area: args.area ?? null,
      area_unit: args.areaUnit?.trim() || null,
    })
    .select("lot_id, farm_id, lot_name, area, area_unit, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as LotRecord;
}

export async function listFarmAnalyses(
  userId: string,
  farmId: number,
  limit = 20
): Promise<FarmAnalysisSummary[]> {
  const { data, error } = await supabase
    .from("analyses")
    .select(
      `
      analysis_id,
      analysis_name,
      sampling_date,
      report_date,
      country,
      province_state,
      latitude,
      longitude,
      created_at,
      crops ( crop_name ),
      lots!analyses_lot_id_fkey ( lot_name )
    `
    )
    .eq("user_id", userId)
    .eq("farm_id", farmId)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const crop = row.crops as { crop_name?: string } | null;
    const lot = row.lots as { lot_name?: string } | null;
    return {
      analysis_id: row.analysis_id as number,
      analysis_name: (row.analysis_name as string | null) || null,
      sampling_date: (row.sampling_date as string | null) || null,
      report_date: (row.report_date as string | null) || null,
      country: (row.country as string | null) || null,
      province_state: (row.province_state as string | null) || null,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
      crop_name: crop?.crop_name || null,
      lot_name: lot?.lot_name || null,
      created_at: (row.created_at as string | null) || null,
    };
  });
}

function mapBodegaRow(row: Record<string, unknown>): BodegaItem {
  return {
    id: String(row.id),
    farm_id: Number(row.farm_id),
    product_name: String(row.product_name),
    product_key: (row.product_key as string | null) || null,
    quantity: Number(row.quantity) || 0,
    unit: String(row.unit || "kg"),
    notes: (row.notes as string | null) || null,
    created_at: (row.created_at as string | null) || null,
    updated_at: (row.updated_at as string | null) || null,
  };
}

const BODEGA_SELECT =
  "id, farm_id, product_name, product_key, quantity, unit, notes, created_at, updated_at";

export async function listBodegaItems(
  userId: string,
  farmId: number
): Promise<BodegaItem[]> {
  const { data, error } = await supabase
    .from("farm_bodega_items")
    .select(BODEGA_SELECT)
    .eq("user_id", userId)
    .eq("farm_id", farmId)
    .order("product_name");
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapBodegaRow(row as Record<string, unknown>));
}

/** Load bodega across all user farms (for cost optimizer stock preference). */
export async function listAllBodegaItems(userId: string): Promise<BodegaItem[]> {
  const { data, error } = await supabase
    .from("farm_bodega_items")
    .select(BODEGA_SELECT)
    .eq("user_id", userId)
    .order("product_name");
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapBodegaRow(row as Record<string, unknown>));
}

export async function upsertBodegaItem(args: {
  userId: string;
  farmId: number;
  productName: string;
  productKey?: string | null;
  quantity: number;
  unit?: string;
  notes?: string;
  id?: string;
}): Promise<BodegaItem> {
  const productName = args.productName.trim();
  if (!productName) throw new Error("Product name is required");
  const payload = {
    user_id: args.userId,
    farm_id: args.farmId,
    product_name: productName,
    product_key: args.productKey?.trim() || null,
    quantity: Number.isFinite(args.quantity) ? args.quantity : 0,
    unit: (args.unit || "kg").trim() || "kg",
    notes: args.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (args.id) {
    const { data, error } = await supabase
      .from("farm_bodega_items")
      .update(payload)
      .eq("id", args.id)
      .eq("user_id", args.userId)
      .select(BODEGA_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return mapBodegaRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("farm_bodega_items")
    .insert(payload)
    .select(BODEGA_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapBodegaRow(data as Record<string, unknown>);
}

export async function deleteBodegaItem(
  userId: string,
  itemId: string
): Promise<void> {
  const { error } = await supabase
    .from("farm_bodega_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function getUserFarmDashboard(
  userId: string,
  calendarCountForFarms: (farmNames: string[]) => number
): Promise<UserFarmDashboard> {
  const farms = await listUserFarms(userId);
  const farmIds = farms.map((f) => f.farm_id);

  let lotCount = 0;
  let reportCount = 0;
  let bodegaCount = 0;

  if (farmIds.length > 0) {
    const [lotsRes, reportsRes, bodegaRes] = await Promise.all([
      supabase
        .from("lots")
        .select("lot_id", { count: "exact", head: true })
        .in("farm_id", farmIds),
      supabase
        .from("analyses")
        .select("analysis_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("farm_id", farmIds)
        .or("is_deleted.is.null,is_deleted.eq.false"),
      supabase
        .from("farm_bodega_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("farm_id", farmIds),
    ]);
    lotCount = lotsRes.count || 0;
    reportCount = reportsRes.count || 0;
    bodegaCount = bodegaRes.count || 0;
  }

  return {
    farmCount: farms.length,
    lotCount,
    reportCount,
    calendarCount: calendarCountForFarms(farms.map((f) => f.farm_name)),
    bodegaCount,
    farms,
  };
}
