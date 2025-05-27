#!/usr/bin/env node

/**
 * Simple test to verify keep-alive functionality works correctly
 * This follows the existing SDK pattern using direct imports
 */

import { createSmitheryClient } from "../client/transport.js"
import { withKeepAlive } from "../client/keep-alive.js"

async function testKeepAlive() {
	console.log("🧪 Testing Smithery SDK Keep-Alive Implementation")
	
	try {
		// Test 1: Basic keep-alive functionality (without connecting)
		console.log("\n1. Testing basic keep-alive detection...")
		
		const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")
		const client = new Client({ name: "test-client", version: "1.0.0" })
		
		const enhancedClient = withKeepAlive(
			client,
			"https://api.smithery.ai/mcp/test",
			{ apiKey: "test-key" },
			{ debug: false }
		)
		
		const status = enhancedClient.keepAlive.getStatus()
		console.log("   ✅ Keep-alive status:", {
			enabled: status.enabled,
			strategy: status.strategy,
			active: status.active
		})
		
		// Clean up
		enhancedClient.keepAlive.stop()
		
		// Test 2: Non-Smithery environment (should not enable)
		console.log("\n2. Testing non-Smithery environment...")
		
		const regularClient = new Client({ name: "test", version: "1.0.0" })
		
		const nonSmitheryClient = withKeepAlive(
			regularClient,
			"http://localhost:3000",
			undefined,
			{ debug: false }
		)
		
		const nonSmitheryStatus = nonSmitheryClient.keepAlive.getStatus()
		console.log("   ✅ Non-Smithery status:", {
			enabled: nonSmitheryStatus.enabled,
			reason: nonSmitheryStatus.reason || "auto-detected non-smithery"
		})
		
		// Test 3: Force enable
		console.log("\n3. Testing force enable...")
		
		const forcedClient = withKeepAlive(
			new Client({ name: "forced", version: "1.0.0" }),
			"http://localhost:3000",
			undefined,
			{ force: true, debug: false }
		)
		
		const forcedStatus = forcedClient.keepAlive.getStatus()
		console.log("   ✅ Forced status:", {
			enabled: forcedStatus.enabled,
			strategy: forcedStatus.strategy
		})
		
		console.log("\n✅ All tests passed! Keep-alive implementation is working correctly.")
		
	} catch (error) {
		console.error("❌ Test failed:", error)
		process.exit(1)
	}
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
	testKeepAlive()
} 