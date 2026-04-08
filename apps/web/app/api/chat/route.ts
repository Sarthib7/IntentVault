import { ZodError } from "zod";
import {
  generalChatRequestSchema,
  generalChatResponseSchema
} from "@intentvault/schemas";
import { createChatProvider } from "@intentvault/providers";

export async function POST(request: Request) {
  let payload;
  try {
    payload = generalChatRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Invalid chat payload", issues: error.issues },
        { status: 400 }
      );
    }
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const provider = createChatProvider();
    const result = await provider.reply({
      message: payload.message,
      sessionId: payload.sessionId || undefined,
      model: payload.model || undefined,
      mode: payload.mode
    });

    return Response.json(
      generalChatResponseSchema.parse({
        reply: result.message,
        runtime: {
          providerName: provider.name,
          generatedAt: new Date().toISOString(),
          model: result.model
        }
      })
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown chat failure";
    return Response.json({ error: message }, { status: 500 });
  }
}
