# Smithery Typescript SDK

The SDK provides files for you to easily setup Smithery-compatible MCP servers and clients.

## Installation

```bash
npm install @smithery/sdk @modelcontextprotocol/sdk
```

## Usage

### Spawning a Server

Here's a minimal example of how to use the SDK to spawn an MCP server.

```typescript
import { createStatelessServer } from '@smithery/sdk/server/stateless.js'
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Create your MCP server function
function createMcpServer({ config }) {
  // Create and return a server instance
  // https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#core-concepts
  const mcpServer = new McpServer({
    name: "My App",
    version: "1.0.0"
  })

  // ...
  
  return mcpServer.server
}

// Create the stateless server using your MCP server function.
createStatelessServer(createMcpServer)
  .app
  .listen(process.env.PORT || 3000)
```

This example:
1. Creates a stateless server that handles MCP requests
2. Defines a function to create MCP server instances for each session
3. Starts the Express server on the specified port. You must listen on the PORT env var if provided for the deployment to work on Smithery.

#### Stateful Server
Most API integrations are stateless.

However, if your MCP server needs to persist state between calls (i.e., remembering previous interactions in a single chat conversation), you can use the `createStatefulServer` function instead.

### Creating a Client

Here's how to create a client to connect to Smithery-hosted MCP servers with automatic keep-alive:

```typescript
import { createSmitheryClient } from '@smithery/sdk/client/transport.js'

// Create a client with automatic keep-alive enabled
const client = await createSmitheryClient(
  { name: "my-client", version: "1.0.0" },
  "https://api.smithery.ai/mcp/fetch",
  { apiKey: process.env.SMITHERY_API_KEY }
)

// Use the client normally
const tools = await client.listTools()
console.log("Available tools:", tools.tools.map(t => t.name))

// Keep-alive runs automatically in the background
// Check status if needed
console.log("Keep-alive status:", client.keepAlive.getStatus())
```

This example:
1. Creates a client with automatic keep-alive for Smithery servers
2. Automatically detects Smithery environment and starts keep-alive pings
3. Provides manual control via `client.keepAlive.start()`, `stop()`, and `getStatus()`

#### Advanced Keep-Alive Configuration

For custom keep-alive behavior:

```typescript
import { withKeepAlive } from '@smithery/sdk/client/keep-alive.js'
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { createTransport } from '@smithery/sdk/client/transport.js'

const client = new Client({ name: "my-client", version: "1.0.0" })
const transport = createTransport("https://api.smithery.ai/mcp/server")

const enhancedClient = withKeepAlive(client, baseUrl, urlOptions, {
  interval: 20000,        // Ping every 20 seconds
  maxFailures: 5,         // Allow 5 consecutive failures
  debug: true,            // Enable debug logging
  strategy: "hidden-tool" // Prefer hidden tool strategy
})

await enhancedClient.connect(transport)
```