import { routeAgentRequest, type Schedule } from "agents";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { createWorkersAI } from "workers-ai-provider"; // added for Workers AI
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
// import { env } from "cloudflare:workers";
import { env } from "cloudflare:workers"; // added back for Workers AI binding

// use Cloudflare Workers AI model instead of OpenAI
const workersai = createWorkersAI({ binding: env.AI }); // new
const model = workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast"); // new

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    const userMessage =
      this.messages[this.messages.length - 1]?.parts?.[0]?.text?.toLowerCase() || "";
  
    // Only expose scheduling tools when user intent matches
    const taskKeywords = ["remind", "schedule", "task", "cancel", "reminder"];
    const intentDetected = taskKeywords.some((kw) => userMessage.includes(kw));
  
    // Collect all tools (as before)
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };
  
    // Dynamically control what the model sees
    const visibleTools = intentDetected ? allTools : {};
  
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const cleanedMessages = cleanupMessages(this.messages);
  
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: visibleTools,
          executions
        });
  
        const result = streamText({
          system: `
          You are a conversational assistant that can also manage reminders.
  
          Talk naturally to the user and only use tools if the user clearly asks to
          schedule, list, or cancel a reminder. Do not check for scheduled tasks
          unless explicitly requested.
          `,
          messages: convertToModelMessages(processedMessages),
          model,
          tools: visibleTools, // <— only show tools when intentDetected = true
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof visibleTools
          >,
          stopWhen: stepCountIs(10)
        });
  
        writer.merge(result.toUIMessageStream());
      }
    });
  
    return createUIMessageStreamResponse({ stream });
  }
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    // kept to satisfy frontend health check, always true for Workers AI
    if (url.pathname === "/check-open-ai-key") {
      return Response.json({
        success: true
      });
    }

    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
