import {
  createInferenceProvider,
  createSignalsProvider,
  type InferenceProvider,
  type PublicSignalsProvider
} from "@intentvault/providers";
import {
  workflowResponseSchema,
  type InvestigationRequest,
  type WorkflowResponse
} from "@intentvault/schemas";

export async function runInvestigateTokenWorkflow(
  input: InvestigationRequest,
  dependencies: {
    inferenceProvider?: InferenceProvider;
    signalsProvider?: PublicSignalsProvider;
    requestId?: string;
  } = {}
) {
  const signalsProvider = dependencies.signalsProvider ?? createSignalsProvider();
  const inferenceProvider =
    dependencies.inferenceProvider ?? createInferenceProvider();
  const requestId = dependencies.requestId ?? `iv-${crypto.randomUUID()}`;
  const evidence = await signalsProvider.fetchSignals(input);
  const decision = await inferenceProvider.createDecision({
    input,
    evidence,
    requestId
  });

  return workflowResponseSchema.parse({
    requestId,
    input,
    evidence,
    decision,
    runtime: {
      signalsProvider: signalsProvider.name,
      inferenceProvider: inferenceProvider.name,
      generatedAt: new Date().toISOString()
    }
  }) satisfies WorkflowResponse;
}

