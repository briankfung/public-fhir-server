import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createResource, searchResources, fhirError } from "@/lib/fhirRepo";

function asQuery(url: string) {
  const u = new URL(url);
  const obj: Record<string, string> = {};
  u.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  return obj;
}

async function getParams(context: { params: unknown }) {
  const p = context?.params as unknown;
  if (p && typeof p === "object" && "then" in (p as Record<string, unknown>)) {
    return (await (p as Promise<Record<string, string>>)) ?? {};
  }
  return (p as Record<string, string>) ?? {};
}

export async function POST(req: NextRequest, context: { params: unknown }) {
  try {
    const { resourceType } = await getParams(context);
    if (!resourceType) throw fhirError("invalid", "Missing resourceType route param", 400);

    const body: unknown = await req.json();
    const created = await createResource(resourceType, body);

    return NextResponse.json(created, {
      status: 201,
      headers: {
        "Content-Type": "application/fhir+json",
        Location: `/fhir/${resourceType}/${created.id}`,
      },
    });
  } catch (e: unknown) {
    const err = e as { httpStatus?: number; outcome?: unknown; message?: string };
    return NextResponse.json(err.outcome ?? fhirError("exception", err.message ?? "Error").outcome, {
      status: err.httpStatus ?? 400,
      headers: { "Content-Type": "application/fhir+json" },
    });
  }
}

export async function GET(req: NextRequest, context: { params: unknown }) {
  try {
    const { resourceType } = await getParams(context);
    if (!resourceType) throw fhirError("invalid", "Missing resourceType route param", 400);

    const entries = await searchResources(resourceType, asQuery(req.url));

    const bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: entries.length,
      entry: entries.map((r) => ({
        fullUrl: `/fhir/${resourceType}/${r.id}`,
        resource: r,
      })),
    };

    return NextResponse.json(bundle, {
      status: 200,
      headers: { "Content-Type": "application/fhir+json" },
    });
  } catch (e: unknown) {
    const err = e as { httpStatus?: number; outcome?: unknown; message?: string };
    return NextResponse.json(err.outcome ?? fhirError("exception", err.message ?? "Error").outcome, {
      status: err.httpStatus ?? 400,
      headers: { "Content-Type": "application/fhir+json" },
    });
  }
}
