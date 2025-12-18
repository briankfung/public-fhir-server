"use client";

import { useMemo, useState } from "react";
import type { SupportedResourceType } from "@ufbfung/fhir-types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RESOURCE_TYPES: SupportedResourceType[] = [
  "Patient",
  "Observation",
  "Condition",
  "AllergyIntolerance",
  "Practitioner",
];

type HttpMethod = "POST" | "GET" | "PUT" | "DELETE";
const METHODS: HttpMethod[] = ["POST", "GET", "PUT", "DELETE"];

const EXAMPLES: Record<SupportedResourceType, unknown> = {
  Patient: { resourceType: "Patient", name: [{ family: "Doe", given: ["Jane"] }] },
  Practitioner: { resourceType: "Practitioner", name: [{ family: "Smith", given: ["Sam"] }] },
  Condition: {
    resourceType: "Condition",
    clinicalStatus: { text: "active" },
    code: { text: "Hypertension" },
  },
  AllergyIntolerance: {
    resourceType: "AllergyIntolerance",
    clinicalStatus: { text: "active" },
    code: { text: "Peanuts" },
  },
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
  const path = id
    ? `${root}/fhir/${resourceType}/${id}`
    : `${root}/fhir/${resourceType}`;
  const query = qs.trim().replace(/^\?/, "");
  return query ? `${path}?${query}` : path;
}

function statusIntent(status: number) {
  if (status >= 200 && status < 300) return "success";
  if (status >= 400 && status < 500) return "warning";
  if (status >= 500) return "destructive";
  return "secondary";
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
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
  const [activeTab, setActiveTab] = useState<"request" | "response">("request");

  const url = useMemo(() => {
    const effectiveId = method === "POST" ? "" : id;
    const effectiveQs = method === "GET" && !effectiveId ? qs : "";
    return buildUrl(baseUrl || "", resourceType, effectiveId, effectiveQs);
  }, [baseUrl, resourceType, id, qs, method]);

  const showBody = method === "POST" || method === "PUT";
  const isSearch = method === "GET" && !id;

  function setExample(rt: SupportedResourceType) {
    setResourceType(rt);
    setBody(pretty(EXAMPLES[rt]));
    setId("");
    setResult(null);
    setActiveTab("request");
  }

  async function run() {
    setBusy(true);
    setResult(null);

    try {
      const headers: Record<string, string> = {
        Accept: "application/fhir+json",
      };

      if (showBody) headers["Content-Type"] = "application/fhir+json";

      const res = await fetch(url, {
        method,
        headers,
        body: showBody ? body : undefined,
      });

      const text = await res.text();
      setResult({ status: res.status, text: text || "" });
      setActiveTab("response");

      // Auto fill id after successful POST
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
      setActiveTab("response");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Public FHIR Server</h1>
          <p className="text-sm text-muted-foreground">
            Test{" "}
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              application/fhir+json
            </span>{" "}
            endpoints constrained to{" "}
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              @ufbfung/fhir-types
            </span>
            .
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button asChild variant="secondary" size="sm">
              <a href="/fhir/metadata" target="_blank" rel="noreferrer">
                CapabilityStatement
              </a>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <a href="/health" target="_blank" rel="noreferrer">
                Health
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          {/* Left: Controls */}
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="text-base">Request Builder</CardTitle>
              <CardDescription>
                Pick method + resourceType, optionally provide id or query params, then send.
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="(blank = same origin)"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Method</Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as HttpMethod)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Resource Type</Label>
                  <Select value={resourceType} onValueChange={(v) => setExample(v as SupportedResourceType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select resourceType" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid gap-2">
                <Label htmlFor="id">ID (GET/PUT/DELETE)</Label>
                <Input
                  id="id"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder={method === "POST" ? "Ignored for POST" : "e.g. 123 or a UUID"}
                  disabled={method === "POST"}
                />
                <p className="text-xs text-muted-foreground">
                  Tip: after a successful POST, the created resource id will auto-fill here.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="qs">Query string (GET search only)</Label>
                <Input
                  id="qs"
                  value={qs}
                  onChange={(e) => setQs(e.target.value)}
                  placeholder="_count=10"
                  disabled={!isSearch}
                />
                <p className="text-xs text-muted-foreground">
                  Only used for GET searches (when no id is provided).
                </p>
              </div>

              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-muted-foreground">Request URL</div>
                    <div className="mt-1 break-all font-mono text-xs">{url}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => copyToClipboard(url)}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              {showBody && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="body">Body</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setBody(pretty(EXAMPLES[resourceType]))}
                    >
                      Reset example
                    </Button>
                  </div>
                  <Textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    className="font-mono text-xs"
                  />
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button type="button" onClick={run} disabled={busy}>
                  {busy ? "Sending..." : "Send request"}
                </Button>

                {result && (
                  <Badge variant={statusIntent(result.status) as "default" | "secondary" | "destructive" | "outline"}>
                    Status: {result.status}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: Request/Response */}
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="text-base">Inspector</CardTitle>
              <CardDescription>
                Review the request details and the server response.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "request" | "response")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="request">Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>

                <TabsContent value="request" className="mt-4 space-y-3">
                  <div className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{method}</Badge>
                      <Badge variant="secondary">{resourceType}</Badge>
                      {id ? <Badge variant="outline">id: {id}</Badge> : <Badge variant="outline">no id</Badge>}
                      {isSearch ? <Badge variant="outline">search</Badge> : <Badge variant="outline">instance</Badge>}
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground">URL</div>
                    <pre className="mt-1 max-h-[140px] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs">
                      {url}
                    </pre>

                    {showBody && (
                      <>
                        <div className="mt-3 text-xs text-muted-foreground">Body</div>
                        <pre className="mt-1 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs">
                          {body}
                        </pre>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="response" className="mt-4 space-y-3">
                  {!result ? (
                    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                      No response yet. Send a request to see output here.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={statusIntent(result.status) as "default" | "secondary" | "destructive" | "outline"}
                          >
                            HTTP {result.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {result.status >= 200 && result.status < 300
                              ? "Success"
                              : result.status >= 400 && result.status < 500
                              ? "Client error"
                              : result.status >= 500
                              ? "Server error"
                              : "Unknown"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => copyToClipboard(result.text)}
                          >
                            Copy response
                          </Button>
                        </div>
                      </div>

                      <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-4 font-mono text-xs">
                        {result.text || ""}
                      </pre>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-xs text-muted-foreground">
          <span className="font-medium">Tip:</span> For GET search, leave ID blank and use query string
          (e.g. <span className="font-mono">_count=10</span>). For instance reads/updates, provide an ID.
        </div>
      </div>
    </div>
  );
}
