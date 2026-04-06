import { ZodError } from "zod";
import {
  investigationRequestSchema,
  type WorkflowResponse
} from "@intentvault/schemas";
import {
  createSignalsProvider,
  createInferenceProvider
} from "@intentvault/providers";

/**
 * Streaming investigation endpoint.
 * Sends Server-Sent Events so the UI can show each workflow step as it happens.
 *
 * Event types:
 *   step   – { step: string; status: "running" | "done" | "error"; detail?: string }
 *   result – full WorkflowResponse JSON
 *   error  – { error: string }
 */
export async function POST(request: Request) {
  let payload;
  try {
    payload = investigationRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Invalid investigation payload", issues: error.issues },
        { status: 400 }
      );
    }
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      const requestId = `iv-${crypto.randomUUID()}`;

      try {
        // Step 1: Initialize
        send("step", {
          step: "Initializing investigation",
          status: "running",
          detail: `Request ${requestId.slice(0, 12)}...`
        });
        await delay(300);
        send("step", { step: "Initializing investigation", status: "done" });

        // Step 2: Fetch public signals
        const signalsProvider = createSignalsProvider();
        send("step", {
          step: "Fetching public signals",
          status: "running",
          detail: `Provider: ${signalsProvider.name} · Querying "${payload.tokenQuery}"`
        });

        const evidence = await signalsProvider.fetchSignals(payload);

        send("step", {
          step: "Fetching public signals",
          status: "done",
          detail: `Found ${evidence.token.name ?? evidence.token.symbol ?? payload.tokenQuery} · ${evidence.sources.map((s) => s.provider).join(", ")} · ${evidence.sources[0]?.latencyMs ?? 0}ms`
        });

        // Step 3: Normalize evidence
        send("step", {
          step: "Normalizing evidence bundle",
          status: "running",
          detail: `${evidence.risk.factors.length} risk factors · Score ${evidence.risk.score}/100`
        });
        await delay(400);
        send("step", {
          step: "Normalizing evidence bundle",
          status: "done",
          detail: `Risk level: ${evidence.risk.level}`
        });

        // Step 4: Private inference
        const inferenceProvider = createInferenceProvider();
        const isLiveInference = inferenceProvider.name.includes("solrouter");

        send("step", {
          step: "Running private inference",
          status: "running",
          detail: isLiveInference
            ? `SolRouter encrypted inference · Model: ${(inferenceProvider as any).model ?? "default"}`
            : "Mock inference (set SOLROUTER_API_KEY for live SolRouter)"
        });

        const decision = await inferenceProvider.createDecision({
          input: payload,
          evidence,
          requestId
        });

        send("step", {
          step: "Running private inference",
          status: "done",
          detail: `Provider: ${inferenceProvider.name} · Overall risk: ${decision.overallRisk}`
        });

        // Step 5: Assemble response
        send("step", {
          step: "Assembling decision card",
          status: "running"
        });
        await delay(250);

        const response: WorkflowResponse = {
          requestId,
          input: payload,
          evidence,
          decision,
          runtime: {
            signalsProvider: signalsProvider.name,
            inferenceProvider: inferenceProvider.name,
            generatedAt: new Date().toISOString()
          }
        };

        send("step", { step: "Assembling decision card", status: "done" });

        // Final result
        send("result", response);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown workflow failure";
        send("step", {
          step: "Investigation failed",
          status: "error",
          detail: message
        });
        send("error", { error: message });
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
