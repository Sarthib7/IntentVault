import { ZodError } from "zod";
import {
  investigationRequestSchema,
  type WorkflowResponse
} from "@intentvault/schemas";
import { runInvestigateTokenWorkflow } from "@intentvault/workflows";

export async function POST(request: Request) {
  try {
    const payload = investigationRequestSchema.parse(await request.json());
    const response: WorkflowResponse = await runInvestigateTokenWorkflow(
      payload
    );

    return Response.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        {
          error: "Invalid investigation payload",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown workflow failure";

    return Response.json(
      {
        error: message
      },
      { status: 500 }
    );
  }
}

