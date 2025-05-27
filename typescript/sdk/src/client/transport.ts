import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { createSmitheryUrl, type SmitheryUrlOptions } from "../shared/config.js"
import { withKeepAlive, type KeepAliveOptions } from "./keep-alive.js"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"

/**
 * Creates a transport to connect to the Smithery server
 * @param baseUrl The URL of the Smithery server (without trailing slash or protocol)
 * @param options Optional configuration object
 * @returns Transport
 */
export function createTransport(baseUrl: string, options?: SmitheryUrlOptions) {
	return new StreamableHTTPClientTransport(createSmitheryUrl(baseUrl, options))
}

/**
 * Creates a keep-alive enabled client for Smithery servers
 * This is the recommended way to create clients for Smithery-hosted MCP servers
 * @param clientOptions Client configuration (name and version)
 * @param baseUrl The URL of the Smithery server (without trailing slash or protocol)
 * @param urlOptions Optional Smithery URL configuration
 * @param keepAliveOptions Optional keep-alive configuration
 * @returns Enhanced client with automatic keep-alive functionality
 */
export async function createSmitheryClient(
	clientOptions: { name: string; version: string },
	baseUrl: string,
	urlOptions?: SmitheryUrlOptions,
	keepAliveOptions?: KeepAliveOptions
): Promise<Client & { keepAlive: { start(): Promise<void>; stop(): void; getStatus(): any } }> {
	const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")
	
	const client = new Client(clientOptions)
	const transport = createTransport(baseUrl, urlOptions)
	
	// Enhance client with keep-alive functionality
	const enhancedClient = withKeepAlive(client, baseUrl, urlOptions, keepAliveOptions)
	
	// Connect to the server
	await enhancedClient.connect(transport)
	
	return enhancedClient
}
