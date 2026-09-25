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

export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  return Response.json(
    { error: message },
    {
      status: message.includes("UNAUTHORIZED")
        ? 401
        : message.includes("FORBIDDEN")
          ? 403
          : message.includes("CONFLICT")
            ? 409
            : 400,
    },
  );
}
