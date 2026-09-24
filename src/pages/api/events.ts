import type { APIRoute } from "astro";
import { bus, type SelectionChangeEvent } from "../../lib/events";

export const GET: APIRoute = () => {
  let onSelectionChange: (change: SelectionChangeEvent) => void;
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(": connected\n\n");
      heartbeat = setInterval(() => controller.enqueue(": ping\n\n"), 30_000);
      onSelectionChange = (change) => {
        controller.enqueue(`data: ${JSON.stringify(change)}\n\n`);
      };
      bus.on("selection", onSelectionChange);
    },
    cancel() {
      clearInterval(heartbeat);
      bus.off("selection", onSelectionChange);
    },
  });

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
};
