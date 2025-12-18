import { randomUUID } from "crypto";
import { sql } from "@/lib/db";
import type {
  SupportedResource,
  SupportedResourceType,
} from "@ufbfung/fhir-types";
import {
  isSupportedResource,
  isSupportedResourceType,
} from "@ufbfung/fhir-types";

type OperationOutcomeIssueSeverity = "fatal" | "error" | "warning" | "information";

type OperationOutcome = {
  resourceType: "OperationOutcome";
  issue: Array<{
    severity: OperationOutcomeIssueSeverity;
    code: string;
    diagnostics?: string;
  }>;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function fhirError(code: string, diagnostics: string, httpStatus = 400) {
  const err = new Error(diagnostics) as Error & {
    httpStatus?: number;
    outcome?: OperationOutcome;
  };
  err.httpStatus = httpStatus;
  err.outcome = {
    resourceType: "OperationOutcome",
    issue: [{ severity: "error", code, diagnostics }],
  };
  return err;
}

function assertSupportedResourceType(resourceType: unknown): SupportedResourceType {
  if (!isSupportedResourceType(resourceType)) {
    throw fhirError(
      "not-supported",
      `Unsupported resourceType: '${String(resourceType)}'`,
      400
    );
  }
  return resourceType;
}

function assertSupportedResource(
  resourceType: SupportedResourceType,
  body: unknown
): SupportedResource {
  if (!isSupportedResource(body)) {
    throw fhirError("invalid", "Body must be a supported FHIR resource JSON object", 400);
  }
  if (body.resourceType !== resourceType) {
    throw fhirError(
      "invalid",
      `resourceType mismatch: expected '${resourceType}', got '${body.resourceType}'`,
      400
    );
  }
  return body;
}

function assertId(id: unknown): string {
  if (typeof id !== "string" || !id) {
    throw fhirError("invalid", "Missing id", 400);
  }
  return id;
}

type Row = Record<string, unknown>;

// function getString(row: Row, key: string): string | null {
//   const v = row[key];
//   return typeof v === "string" ? v : null;
// }

function getNumber(row: Row, key: string): number | null {
  const v = row[key];
  return typeof v === "number" ? v : null;
}

function getResource(row: Row): unknown {
  return row["resource"];
}

export async function createResource(resourceTypeRaw: unknown, bodyRaw: unknown) {
  const resourceType = assertSupportedResourceType(resourceTypeRaw);
  const body = assertSupportedResource(resourceType, bodyRaw);

  const id = body.id ?? randomUUID();

  const existing = await sql`
    select id from fhir_resources
    where resource_type = ${resourceType} and id = ${id}
    limit 1
  `;
  if (Array.isArray(existing) && existing.length > 0) {
    throw fhirError("conflict", `${resourceType}/${id} already exists`, 409);
  }

  const versionId = 1;
  const lastUpdated = nowIso();

  const resource: SupportedResource = {
    ...body,
    id,
    meta: { ...(body.meta ?? {}), versionId: String(versionId), lastUpdated },
  };

  await sql`
    insert into fhir_resources (resource_type, id, version_id, last_updated, resource)
    values (${resourceType}, ${id}, ${versionId}, ${lastUpdated}, ${resource}::jsonb)
  `;

  return resource;
}

export async function readResource(resourceTypeRaw: unknown, idRaw: unknown) {
  const resourceType = assertSupportedResourceType(resourceTypeRaw);
  const id = assertId(idRaw);

  const rows = await sql`
    select resource from fhir_resources
    where resource_type = ${resourceType} and id = ${id}
    limit 1
  `;

  if (!Array.isArray(rows) || rows.length === 0) {
    throw fhirError("not-found", `${resourceType}/${id} not found`, 404);
  }

  const resource = getResource(rows[0] as Row);
  if (!isSupportedResource(resource)) {
    throw fhirError("exception", "Stored resource is not a supported resource shape", 500);
  }
  return resource;
}

export async function upsertResource(
  resourceTypeRaw: unknown,
  idRaw: unknown,
  bodyRaw: unknown
) {
  const resourceType = assertSupportedResourceType(resourceTypeRaw);
  const id = assertId(idRaw);
  const body = assertSupportedResource(resourceType, bodyRaw);

  const cur = await sql`
    select version_id from fhir_resources
    where resource_type = ${resourceType} and id = ${id}
    limit 1
  `;

  const currentVersion =
    Array.isArray(cur) && cur.length > 0 ? getNumber(cur[0] as Row, "version_id") : null;

  const nextVersion = (currentVersion ?? 0) + 1;
  const lastUpdated = nowIso();

  const resource: SupportedResource = {
    ...body,
    id,
    meta: { ...(body.meta ?? {}), versionId: String(nextVersion), lastUpdated },
  };

  await sql`
    insert into fhir_resources (resource_type, id, version_id, last_updated, resource)
    values (${resourceType}, ${id}, ${nextVersion}, ${lastUpdated}, ${resource}::jsonb)
    on conflict (resource_type, id)
    do update set
      version_id = excluded.version_id,
      last_updated = excluded.last_updated,
      resource = excluded.resource
  `;

  return resource;
}

export async function deleteResource(resourceTypeRaw: unknown, idRaw: unknown) {
  const resourceType = assertSupportedResourceType(resourceTypeRaw);
  const id = assertId(idRaw);

  const res = await sql`
    with del as (
      delete from fhir_resources
      where resource_type = ${resourceType} and id = ${id}
      returning 1
    )
    select count(*)::int as count from del
  `;

  const count =
    Array.isArray(res) && res.length > 0 ? getNumber(res[0] as Row, "count") : 0;

  if (!count) {
    throw fhirError("not-found", `${resourceType}/${id} not found`, 404);
  }
}

function asSafeFilters(query: Record<string, string>) {
  return Object.entries(query)
    .filter(([k]) => k !== "_count")
    .filter(([k]) => /^[A-Za-z0-9_.-]+$/.test(k));
}

export async function searchResources(resourceTypeRaw: unknown, query: Record<string, string>) {
  const resourceType = assertSupportedResourceType(resourceTypeRaw);

  const count = query["_count"]
    ? Math.max(1, Math.min(100, Number.parseInt(query["_count"], 10) || 10))
    : 10;

  const filters = asSafeFilters(query);

  let whereSql = sql`where resource_type = ${resourceType}`;
  for (const [k, v] of filters) {
    whereSql = sql`${whereSql} and (resource->>${k}) ilike ${"%" + v + "%"}`;
  }

  const rows = await sql`
    select resource from fhir_resources
    ${whereSql}
    order by last_updated desc
    limit ${count}
  `;

  const out: SupportedResource[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const resource = getResource(row as Row);
      if (isSupportedResource(resource)) out.push(resource);
    }
  }
  return out;
}
