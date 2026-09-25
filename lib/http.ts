import { ZodError } from "zod";
/** Read bounded request bodies before parsing to reject oversized or chunked payloads. */
export async function boundedRequest(
  request: Request,
  maxBytes: number,
): Promise<Request> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes)
    throw new Error("Request body is too large.");
  if (!request.body) return request;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Request body is too large.");
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: buffer,
  });
}

/** Postgres errors carry a five-character SQLSTATE; their text must not reach clients. */
function databaseCode(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : null;
}

function status(message: string) {
  if (message.includes("UNAUTHORIZED")) return 401;
  if (message.includes("FORBIDDEN")) return 403;
  if (message.includes("CONFLICT")) return 409;
  if (/not found/i.test(message)) return 404;
  if (message.startsWith("Too many requests")) return 429;
  return 400;
}

export function failure(error: unknown) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join(".");
    return Response.json(
      { error: `Invalid ${field || "request"}: ${issue?.message ?? "check the input"}` },
      { status: 400 },
    );
  }
  const code = databaseCode(error);
  if (code) {
    console.error("[db]", code, error);
    const [message, status] =
      code === "23505"
        ? ["CONFLICT: That already exists.", 409]
        : code.startsWith("23")
          ? ["Invalid reference or value.", 400]
          : ["Something went wrong. Try again.", 500];
    return Response.json({ error: message }, { status });
  }
  const message = error instanceof Error ? error.message : "Request failed";
  return Response.json({ error: message }, { status: status(message) });
}
