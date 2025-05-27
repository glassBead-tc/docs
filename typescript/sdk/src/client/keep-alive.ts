import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import type { SmitheryUrlOptions } from "../shared/config.js"

/**
 * Configuration options for the keep-alive mechanism
 */
export interface KeepAliveOptions {
	/** Interval between keep-alive pings in milliseconds (default: 30000) */
	interval?: number
	/** Maximum number of consecutive failed pings before giving up (default: 3) */
	maxFailures?: number
	/** Whether to enable debug logging (default: false) */
	debug?: boolean
	/** Custom keep-alive strategy to use (default: auto-detect) */
	strategy?: "ping" | "resource" | "hidden-tool" | "auto"
	/** Whether to force enable keep-alive even if not detected as Smithery (default: false) */
	force?: boolean
}

/**
 * Keep-alive strategies available
 */
type KeepAliveStrategy = "ping" | "resource" | "hidden-tool" | "disabled"

/**
 * Internal state for managing keep-alive
 */
interface KeepAliveState {
	isActive: boolean
	intervalId?: NodeJS.Timeout
	strategy: KeepAliveStrategy
	failureCount: number
	lastPingTime?: number
	options: Required<KeepAliveOptions>
}

/**
 * Detects if the client is connecting to a Smithery-hosted server
 */
function isSmitheryEnvironment(baseUrl: string, options?: SmitheryUrlOptions): boolean {
	try {
		const url = new URL(baseUrl)
		// Check for Smithery domains
		const smitheryDomains = [
			'smithery.ai',
			'smithery.com',
			'api.smithery.ai',
			'server.smithery.ai',
			'registry.smithery.ai'
		]
		
		// Check if hostname matches or is a subdomain of Smithery domains
		const hostname = url.hostname.toLowerCase()
		const isSmitheryDomain = smitheryDomains.some(domain => 
			hostname === domain || hostname.endsWith(`.${domain}`)
		)
		
		// Also check for Smithery-specific parameters
		const hasSmitheryParams = Boolean(options?.apiKey || options?.profile)
		
		return isSmitheryDomain || hasSmitheryParams
	} catch {
		return false
	}
}

/**
 * Determines the best keep-alive strategy for the client
 */
async function detectKeepAliveStrategy(client: Client): Promise<KeepAliveStrategy> {
	try {
		// First, try to list tools to see if a hidden ping tool exists
		const toolsResult = await client.listTools()
		const hasHiddenPingTool = toolsResult.tools.some((tool: Tool) => 
			tool.name === "__smithery_ping" || tool.name === "__keep_alive"
		)
		
		if (hasHiddenPingTool) {
			return "hidden-tool"
		}
		
		// Try to list resources to see if we can use resource polling
		try {
			const resourcesResult = await client.listResources()
			if (resourcesResult.resources.length > 0) {
				return "resource"
			}
		} catch {
			// Resource listing failed, continue to next strategy
		}
		
		// Fall back to protocol-level ping if available
		// Note: This would need to be implemented at the transport level
		return "ping"
		
	} catch {
		return "disabled"
	}
}

/**
 * Executes a keep-alive ping using the specified strategy
 */
async function executeKeepAlivePing(
	client: Client,
	strategy: KeepAliveStrategy,
	debug: boolean
): Promise<boolean> {
	try {
		switch (strategy) {
			case "hidden-tool":
				// Try to call the hidden ping tool
				try {
					await client.callTool({
						name: "__smithery_ping",
						arguments: { timestamp: Date.now() }
					})
					if (debug) console.log("[KeepAlive] Hidden tool ping successful")
					return true
				} catch {
					// Try alternative name
					await client.callTool({
						name: "__keep_alive",
						arguments: { timestamp: Date.now() }
					})
					if (debug) console.log("[KeepAlive] Hidden tool ping successful (alt name)")
					return true
				}
				
			case "resource":
				// Poll a lightweight resource
				const resourcesResult = await client.listResources()
				if (resourcesResult.resources.length > 0) {
					// Try to read the first resource (should be lightweight)
					await client.readResource({ uri: resourcesResult.resources[0].uri })
					if (debug) console.log("[KeepAlive] Resource polling successful")
					return true
				}
				break
				
			case "ping":
				// This would require transport-level ping support
				// For now, fall back to tool listing
				await client.listTools()
				if (debug) console.log("[KeepAlive] Protocol ping successful")
				return true
				
			default:
				return false
		}
	} catch (error) {
		if (debug) {
			console.warn(`[KeepAlive] Ping failed with strategy ${strategy}:`, error)
		}
		return false
	}
	
	return false
}

/**
 * Starts the keep-alive mechanism for a client
 */
async function startKeepAlive(client: Client, state: KeepAliveState): Promise<void> {
	if (state.isActive) {
		return // Already active
	}
	
	// Auto-detect strategy if needed
	if (state.strategy === "disabled") {
		state.strategy = await detectKeepAliveStrategy(client)
		if (state.options.debug) {
			console.log(`[KeepAlive] Detected strategy: ${state.strategy}`)
		}
	}
	
	if (state.strategy === "disabled") {
		if (state.options.debug) {
			console.log("[KeepAlive] No suitable strategy found, disabling")
		}
		return
	}
	
	state.isActive = true
	state.failureCount = 0
	
	const pingInterval = async () => {
		if (!state.isActive) {
			return
		}
		
		const success = await executeKeepAlivePing(client, state.strategy, state.options.debug)
		
		if (success) {
			state.failureCount = 0
			state.lastPingTime = Date.now()
		} else {
			state.failureCount++
			if (state.options.debug) {
				console.warn(`[KeepAlive] Ping failed (${state.failureCount}/${state.options.maxFailures})`)
			}
			
			if (state.failureCount >= state.options.maxFailures) {
				if (state.options.debug) {
					console.error("[KeepAlive] Too many failures, disabling keep-alive")
				}
				stopKeepAlive(state)
				return
			}
		}
		
		// Schedule next ping
		if (state.isActive) {
			state.intervalId = setTimeout(pingInterval, state.options.interval)
		}
	}
	
	// Start the first ping after a short delay
	state.intervalId = setTimeout(pingInterval, 1000)
	
	if (state.options.debug) {
		console.log(`[KeepAlive] Started with strategy: ${state.strategy}, interval: ${state.options.interval}ms`)
	}
}

/**
 * Stops the keep-alive mechanism
 */
function stopKeepAlive(state: KeepAliveState): void {
	state.isActive = false
	if (state.intervalId) {
		clearTimeout(state.intervalId)
		state.intervalId = undefined
	}
	
	if (state.options.debug) {
		console.log("[KeepAlive] Stopped")
	}
}

/**
 * Creates a keep-alive enabled client wrapper
 * This is the main function that wraps an existing MCP client with keep-alive functionality
 */
export function withKeepAlive(
	client: Client,
	baseUrl: string,
	urlOptions?: SmitheryUrlOptions,
	keepAliveOptions?: KeepAliveOptions
): Client & { keepAlive: { start(): Promise<void>; stop(): void; getStatus(): any } } {
	// Set default options
	const options: Required<KeepAliveOptions> = {
		interval: keepAliveOptions?.interval ?? 30000, // 30 seconds
		maxFailures: keepAliveOptions?.maxFailures ?? 3,
		debug: keepAliveOptions?.debug ?? false,
		strategy: keepAliveOptions?.strategy ?? "auto",
		force: keepAliveOptions?.force ?? false
	}
	
	// Check if we should enable keep-alive
	const shouldEnable = options.force || isSmitheryEnvironment(baseUrl, urlOptions)
	
	if (!shouldEnable) {
		if (options.debug) {
			console.log("[KeepAlive] Not a Smithery environment, keep-alive disabled")
		}
		// Return the original client with disabled keep-alive methods
		return Object.assign(client, {
			keepAlive: {
				start: async () => {},
				stop: () => {},
				getStatus: () => ({ enabled: false, reason: "not smithery environment" })
			}
		})
	}
	
	// Initialize keep-alive state
	const state: KeepAliveState = {
		isActive: false,
		strategy: options.strategy === "auto" ? "disabled" : options.strategy as KeepAliveStrategy,
		failureCount: 0,
		options
	}
	
	// Auto-start keep-alive after connection (with a small delay)
	const originalConnect = client.connect.bind(client)
	client.connect = async (transport: any) => {
		const result = await originalConnect(transport)
		// Start keep-alive after successful connection
		setTimeout(async () => {
			await startKeepAlive(client, state)
		}, 2000) // 2 second delay to ensure connection is fully established
		return result
	}
	
	// Add keep-alive control methods
	const enhancedClient = Object.assign(client, {
		keepAlive: {
			/**
			 * Manually start keep-alive (useful if auto-start failed)
			 */
			start: async () => {
				await startKeepAlive(client, state)
			},
			
			/**
			 * Stop keep-alive
			 */
			stop: () => {
				stopKeepAlive(state)
			},
			
			/**
			 * Get current keep-alive status
			 */
			getStatus: () => ({
				enabled: shouldEnable,
				active: state.isActive,
				strategy: state.strategy,
				failureCount: state.failureCount,
				lastPingTime: state.lastPingTime,
				nextPingIn: state.intervalId && state.isActive 
					? Math.max(0, (state.lastPingTime || 0) + options.interval - Date.now())
					: null,
				options: {
					interval: options.interval,
					maxFailures: options.maxFailures,
					strategy: options.strategy
				}
			})
		}
	})
	
	if (options.debug) {
		console.log("[KeepAlive] Enhanced client created, auto-start enabled")
	}
	
	return enhancedClient
}

/**
 * Convenience function to create a keep-alive enabled client from scratch
 */
export async function createKeepAliveClient(
	clientOptions: { name: string; version: string },
	transport: any,
	baseUrl: string,
	urlOptions?: SmitheryUrlOptions,
	keepAliveOptions?: KeepAliveOptions
): Promise<Client & { keepAlive: { start(): Promise<void>; stop(): void; getStatus(): any } }> {
	const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")
	
	const client = new Client(clientOptions)
	const enhancedClient = withKeepAlive(client, baseUrl, urlOptions, keepAliveOptions)
	
	await enhancedClient.connect(transport)
	
	return enhancedClient
} 