/** Public origin used as the OAuth issuer; must match what clients reach over HTTPS. */
export function publicOrigin(request: Request) {
  return (process.env.SPACIE_ORIGIN ?? new URL(request.url).origin).replace(/\/$/, "");
}

export const SCOPE = "spacie";
export const mcpResource = (origin: string) => `${origin}/api/mcp`;
export const resourceMetadataUrl = (origin: string) =>
  `${origin}/.well-known/oauth-protected-resource/api/mcp`;

/** RFC 9728 protected resource metadata for the MCP endpoint. */
export function protectedResource(origin: string) {
  return {
    resource: mcpResource(origin),
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Spacie",
  };
}

/** RFC 8414 authorization server metadata. */
export function authorizationServer(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    scopes_supported: [SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    authorization_response_iss_parameter_supported: true,
  };
}

/** Sent with every 401 from the MCP endpoint so clients can discover how to authorize. */
export const wwwAuthenticate = (origin: string) =>
  `Bearer resource_metadata="${resourceMetadataUrl(origin)}", scope="${SCOPE}"`;
