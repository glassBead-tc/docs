#!/usr/bin/env node

/**
 * Example: Using Keep-Alive with Smithery SDK
 * 
 * This example demonstrates how to use the automatic keep-alive functionality
 * with Smithery-hosted MCP servers.
 */

import { createSmitheryClient } from "../client/transport.js"
import { withKeepAlive } from "../client/keep-alive.js"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { createTransport } from "../client/transport.js"

async function basicExample() {
	console.log("=== Basic Keep-Alive Example ===")
	
	try {
		// Create a client with automatic keep-alive enabled
		// This will auto-detect Smithery environment and start keep-alive
		const client = await createSmitheryClient(
			{ name: "keep-alive-example", version: "1.0.0" },
			"https://api.smithery.ai/mcp/fetch",
			{ apiKey: process.env.SMITHERY_API_KEY }
		)
		
		// Check keep-alive status
		console.log("Keep-alive status:", client.keepAlive.getStatus())
		
		// Use the client normally
		const tools = await client.listTools()
		console.log("Available tools:", tools.tools.map(t => t.name))
		
		// Keep-alive runs automatically in the background
		// Wait a bit to see keep-alive pings in action
		console.log("Waiting 35 seconds to observe keep-alive pings...")
		await new Promise(resolve => setTimeout(resolve, 35000))
		
		console.log("Keep-alive status after 35s:", client.keepAlive.getStatus())
		
		// Stop keep-alive when done
		client.keepAlive.stop()
		console.log("Keep-alive stopped")
		
	} catch (error) {
		console.error("Error in basic example:", error)
	}
}

async function advancedExample() {
	console.log("\n=== Advanced Keep-Alive Example ===")
	
	try {
		// Create client with custom keep-alive configuration
		const client = await createSmitheryClient(
			{ name: "advanced-keep-alive-example", version: "1.0.0" },
			"https://api.smithery.ai/mcp/exa",
			{ apiKey: process.env.SMITHERY_API_KEY },
			{
				interval: 20000,        // Ping every 20 seconds
				maxFailures: 5,         // Allow 5 consecutive failures
				debug: true,            // Enable debug logging
				strategy: "hidden-tool" // Prefer hidden tool strategy
			}
		)
		
		console.log("Advanced client created with custom keep-alive settings")
		
		// Monitor keep-alive status
		const statusMonitor = setInterval(() => {
			const status = client.keepAlive.getStatus()
			console.log(`[Monitor] Active: ${status.active}, Strategy: ${status.strategy}, Failures: ${status.failureCount}`)
		}, 10000)
		
		// Use the client for various operations
		const tools = await client.listTools()
		console.log("Tools:", tools.tools.length)
		
		// Test some tool calls to keep the connection active
		if (tools.tools.length > 0) {
			try {
				const result = await client.callTool({
					name: tools.tools[0].name,
					arguments: { query: "test keep-alive" }
				})
				console.log("Tool call successful")
			} catch (error) {
				console.log("Tool call failed (expected if no proper args)")
			}
		}
		
		// Wait and observe
		console.log("Observing keep-alive behavior for 60 seconds...")
		await new Promise(resolve => setTimeout(resolve, 60000))
		
		clearInterval(statusMonitor)
		client.keepAlive.stop()
		console.log("Advanced example completed")
		
	} catch (error) {
		console.error("Error in advanced example:", error)
	}
}

async function manualKeepAliveExample() {
	console.log("\n=== Manual Keep-Alive Example ===")
	
	try {
		// Create a regular client first
		const client = new Client({ name: "manual-example", version: "1.0.0" })
		const transport = createTransport("https://server.smithery.ai/mcp/memory")
		
		// Manually add keep-alive functionality
		const enhancedClient = withKeepAlive(
			client,
			"https://server.smithery.ai/mcp/memory",
			{ profile: "default" },
			{ debug: true, force: true } // Force enable even if not auto-detected
		)
		
		// Connect manually
		await enhancedClient.connect(transport)
		
		console.log("Manual keep-alive setup complete")
		console.log("Status:", enhancedClient.keepAlive.getStatus())
		
		// Manually control keep-alive
		await enhancedClient.keepAlive.start()
		console.log("Keep-alive manually started")
		
		// Use the client
		const resources = await enhancedClient.listResources()
		console.log("Resources:", resources.resources.length)
		
		// Stop and restart keep-alive
		enhancedClient.keepAlive.stop()
		console.log("Keep-alive stopped")
		
		await new Promise(resolve => setTimeout(resolve, 5000))
		
		await enhancedClient.keepAlive.start()
		console.log("Keep-alive restarted")
		
		// Final status check
		console.log("Final status:", enhancedClient.keepAlive.getStatus())
		
		enhancedClient.keepAlive.stop()
		
	} catch (error) {
		console.error("Error in manual example:", error)
	}
}

async function nonSmitheryExample() {
	console.log("\n=== Non-Smithery Environment Example ===")
	
	try {
		// This should not enable keep-alive automatically
		const client = new Client({ name: "non-smithery", version: "1.0.0" })
		
		const enhancedClient = withKeepAlive(
			client,
			"http://localhost:3000",
			undefined,
			{ debug: true } // Will show why keep-alive is disabled
		)
		
		console.log("Non-Smithery client status:", enhancedClient.keepAlive.getStatus())
		
		// Can still force enable if needed
		const forcedClient = withKeepAlive(
			new Client({ name: "forced", version: "1.0.0" }),
			"http://localhost:3000",
			undefined,
			{ force: true, debug: true }
		)
		
		console.log("Forced keep-alive status:", forcedClient.keepAlive.getStatus())
		
	} catch (error) {
		console.error("Error in non-Smithery example:", error)
	}
}

async function main() {
	console.log("🚀 Smithery SDK Keep-Alive Examples\n")
	
	if (!process.env.SMITHERY_API_KEY) {
		console.warn("⚠️  SMITHERY_API_KEY not set. Some examples may fail.")
	}
	
	try {
		await basicExample()
		await advancedExample()
		await manualKeepAliveExample()
		await nonSmitheryExample()
		
		console.log("\n✅ All examples completed!")
		
	} catch (error) {
		console.error("❌ Error running examples:", error)
		process.exit(1)
	}
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main()
} 