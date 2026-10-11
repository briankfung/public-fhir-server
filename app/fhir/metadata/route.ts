import { NextResponse } from "next/server";
import { SUPPORTED_RESOURCE_TYPES } from "@briankfung/fhir-types";

export async function GET() {
  const rest = [
    {
      mode: "server",
      resource: SUPPORTED_RESOURCE_TYPES.map((t) => ({
        type: t,
        interaction: [
          { code: "read" },
          { code: "create" },
          { code: "update" },
          { code: "delete" },
          { code: "search-type" }
        ],
      })),
    },
  ];

  return NextResponse.json(
    {
      resourceType: "CapabilityStatement",
      status: "active",
      date: new Date().toISOString(),
      kind: "instance",
      fhirVersion: "4.0.1",
      format: ["json"],
      rest,
    },
    { status: 200, headers: { "Content-Type": "application/fhir+json" } }
  );
}
