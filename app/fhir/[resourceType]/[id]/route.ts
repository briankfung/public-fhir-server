import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readResource, upsertResource, deleteResource, fhirError } from "@/lib/fhirRepo";

async function getParams(context: { params: unknown }) {
  const p = context?.params as unknown;
  if (p && typeof p === "object" && "then" in (p as Record<string, unknown>)) {
    return (await (p as Promise<Record<string, string>>)) ?? {};
  }
  return (p as Record<string, string>) ?? {};
}

export async function GET(_req: NextRequest, context: { params: unknown }) {
  try {
    const { resourceType, id } = await getParams(context);
    if (!resourceType || !id) throw fhirError("invalid", "Missing route params", 400);

    const resource = await readResource(resourceType, id);
    return NextResponse.json(resource, {
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

export async function PUT(req: NextRequest, context: { params: unknown }) {
  try {
    const { resourceType, id } = await getParams(context);
    if (!resourceType || !id) throw fhirError("invalid", "Missing route params", 400);

    const body: unknown = await req.json();
    const updated = await upsertResource(resourceType, id, body);

    return NextResponse.json(updated, {
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

export async function DELETE(_req: NextRequest, context: { params: unknown }) {
  try {
    const { resourceType, id } = await getParams(context);
    if (!resourceType || !id) throw fhirError("invalid", "Missing route params", 400);

    await deleteResource(resourceType, id);
    return new NextResponse(null, { status: 204 });
  } catch (e: unknown) {
    const err = e as { httpStatus?: number; outcome?: unknown; message?: string };
    return NextResponse.json(err.outcome ?? fhirError("exception", err.message ?? "Error").outcome, {
      status: err.httpStatus ?? 400,
      headers: { "Content-Type": "application/fhir+json" },
    });
  }
}
