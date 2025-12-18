"use client";

import { useMemo, useState } from "react";
import type { SupportedResourceType } from "@ufbfung/fhir-types";

const RESOURCE_TYPES: SupportedResourceType[] = [
  "Patient",
  "Observation",
  "Condition",
  "AllergyIntolerance",
  "Practitioner",
];

type HttpMethod = "POST" | "GET" | "PUT" | "DELETE";

const EXAMPLES: Record<SupportedResourceType, unknown> = {
  Patient: { resourceType: "Patient", name: [{ family: "Doe", given: ["Jane"] }] },
  Practitioner: { resourceType: "Practitioner", name: [{ family: "Smith", given: ["Sam"] }] },
  Condition: { resourceType: "Condition", clinicalStatus: { text: "active" }, code: { text: "Hypertension" } },
  AllergyIntolerance: { resourceType: "AllergyIntolerance", clinicalStatus: { text: "active" }, code: { text: "Peanuts" } },
  Observation: {
    resourceType: "Observation",
    status: "final",
    code: { text: "Heart rate" },
    valueQuantity: { value: 72, unit: "beats/min" },
  },
};

function pretty(x: unknown) {
  return JSON.stringify(x, null, 2);
}

function buildUrl(baseUrl: string, resourceType: string, id: string, qs: string) {
  const root = baseUrl.replace(/\/+$/, "");
  const path = id ? `${root}/fhir/${resourceType}/${id}` : `${root}/fhir/${resourceType}`;
  const query = qs.trim().replace(/^\?/, "");
  return query ? `${path}?${query}` : path;
}

export default function Home() {
  const [baseUrl, setBaseUrl] = useState("");
  const [method, setMethod] = useState<HttpMethod>("POST");
  const [resourceType, setResourceType] = useState<SupportedResourceType>("Practitioner");
  const [id, setId] = useState("");
  const [qs, setQs] = useState("_count=10");
  const [body, setBody] = useState(pretty(EXAMPLES.Practitioner));
  const [result, setResult] = useState<{ status: number; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const url = useMemo(() => {
    const effectiveId = method === "POST" ? "" : id;
    const effectiveQs = method === "GET" && !effectiveId ? qs : "";
    return buildUrl(baseUrl || "", resourceType, effectiveId, effectiveQs);
  }, [baseUrl, resourceType, id, qs, method]);

  function setExample(rt: SupportedResourceType) {
    setResourceType(rt);
    setBody(pretty(EXAMPLES[rt]));
    setId("");
    setResult(null);
  }

  async function run() {
    setBusy(true);
    setResult(null);

    try {
      const headers: Record<string, string> = { Accept: "application/fhir+json" };
      const hasBody = method === "POST" || method === "PUT";
      if (hasBody) headers["Content-Type"] = "application/fhir+json";

      const res = await fetch(url, {
        method,
        headers,
        body: hasBody ? body : undefined,
      });

      const text = await res.text();
      setResult({ status: res.status, text: text || "" });

      if (method === "POST" && res.ok) {
        try {
          const json = JSON.parse(text) as { id?: string };
          if (json?.id) setId(json.id);
        } catch {
          // ignore
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setResult({ status: 0, text: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Public FHIR Server</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Minimal Next.js + Neon + <code className="rounded bg-white px-1">application/fhir+json</code> endpoints,
          constrained to <code className="rounded bg-white px-1">@ufbfung/fhir-types</code>.
        </p>

        <div className="mt-8 grid gap-4 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-600">Base URL</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="(blank = same origin)"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-600">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                <option>POST</option>
                <option>GET</option>
                <option>PUT</option>
                <option>DELETE</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-600">Resource Type</label>
              <select
                value={resourceType}
                onChange={(e) => setExample(e.target.value as SupportedResourceType)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-600">ID (for GET/PUT/DELETE)</label>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="Leave blank for POST, or for GET search"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-600">Query string (GET search only)</label>
              <input
                value={qs}
                onChange={(e) => setQs(e.target.value)}
                placeholder="_count=10"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-600">Request URL</label>
            <div className="mt-1 break-all rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
              {url}
            </div>
          </div>

          {(method === "POST" || method === "PUT") && (
            <div className="grid gap-2">
              <label className="text-xs font-medium text-zinc-600">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-zinc-200"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBody(pretty(EXAMPLES[resourceType]))}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs hover:bg-zinc-50"
                >
                  Reset example
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={run}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy ? "Running..." : "Send request"}
            </button>

            <a
              className="text-sm text-zinc-600 underline underline-offset-2"
              href="/fhir/metadata"
              target="_blank"
              rel="noreferrer"
            >
              CapabilityStatement
            </a>

            <a
              className="text-sm text-zinc-600 underline underline-offset-2"
              href="/health"
              target="_blank"
              rel="noreferrer"
            >
              Health
            </a>
          </div>

          {result && (
            <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-xs font-medium text-zinc-700">
                Response status: <span className="font-mono">{result.status}</span>
              </div>
              <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-zinc-800">
                {result.text}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
