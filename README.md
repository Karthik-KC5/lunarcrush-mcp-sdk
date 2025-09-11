# 🌙 LunarCrush MCP SDK

[![npm version](https://badge.fury.io/js/%40jamaalbuilds%2Flunarcrush-mcp.svg)](https://badge.fury.io/js/%40jamaalbuilds%2Flunarcrush-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Lightweight SDK for connecting LLMs to LunarCrush social crypto data via Model Context Protocol (MCP).

## 🚀 Features

- **Zero Configuration** - Just your API key and you're ready
- **100% Dynamic** - Auto-discovers tools, future-proof against changes
- **LLM Agnostic** - Works with OpenAI, Anthropic, Google, any LLM provider
- **Lightweight** - Minimal dependencies, won't bloat your project
- **TypeScript Ready** - Full type safety and IntelliSense support

## 📦 Installation

```bash
npm install @jamaalbuilds/lunarcrush-mcp @modelcontextprotocol/sdk
```

## 🔑 Quick Start

```typescript
import LunarCrushMCP from '@jamaalbuilds/lunarcrush-mcp';

// 1. Connect (one time setup)
const mcp = new LunarCrushMCP('your-api-key');
await mcp.connect();

// 2. Let your LLM discover tools
const tools = mcp.getTools();
// LLM can now see all available tools and their schemas

// 3. LLM calls tools through SDK
const result = await mcp.callTool('Topic', { topic: 'bitcoin' });

// 4. Clean up when done
await mcp.disconnect();
```

## 🤖 LLM Integration Examples

### OpenAI Function Calling

```typescript
import OpenAI from 'openai';
import LunarCrushMCP from '@jamaalbuilds/lunarcrush-mcp';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const mcp = new LunarCrushMCP(process.env.LUNARCRUSH_API_KEY);
await mcp.connect();

// Get function definitions for OpenAI
const functions = mcp.getOpenAIFunctions();

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is Bitcoin trending at?' }],
  functions,
  function_call: 'auto'
});

// Execute function call
if (response.choices[0].message.function_call) {
  const { name, arguments: args } = response.choices[0].message.function_call;
  const result = await mcp.executeFunction(name, args);
  console.log('Bitcoin data:', result);
}
```

### Anthropic Tool Use

```typescript
import Anthropic from '@anthropic-ai/sdk';
import LunarCrushMCP from '@jamaalbuilds/lunarcrush-mcp';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const mcp = new LunarCrushMCP(process.env.LUNARCRUSH_API_KEY);
await mcp.connect();

// Get tool definitions for Anthropic
const tools = mcp.getAnthropicTools();

const response = await anthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'Analyze Bitcoin social sentiment' }],
  tools
});

// Execute tool calls
for (const content of response.content) {
  if (content.type === 'tool_use') {
    const result = await mcp.callTool(content.name, content.input);
    console.log('Analysis result:', result);
  }
}
```

### Google Gemini Integration

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import LunarCrushMCP from '@jamaalbuilds/lunarcrush-mcp';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const mcp = new LunarCrushMCP(process.env.LUNARCRUSH_API_KEY);
await mcp.connect();

// Create prompt with available tools
const tools = mcp.getTools();
const toolList = tools.map(t => `${t.name}: ${t.description}`).join('\n');

const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
const prompt = `
You have access to these LunarCrush tools:
${toolList}

Analyze Bitcoin's market performance and social sentiment.
Choose the best tools and provide their exact arguments.
`;

const result = await model.generateContent(prompt);
// Parse LLM response and execute chosen tools
```

## 📋 Available Methods

### Connection Management
```typescript
const mcp = new LunarCrushMCP(apiKey);
await mcp.connect();              // Connect to MCP server
await mcp.disconnect();           // Clean disconnect
const status = mcp.getStatus();   // Get connection status
```

### Tool Discovery
```typescript
const tools = mcp.getTools();           // Get all tools with schemas
const tool = mcp.getTool('Topic');      // Get specific tool schema
await mcp.refreshTools();               // Refresh tool list (if MCP updates)
```

### LLM Integration
```typescript
const openAIFunctions = mcp.getOpenAIFunctions();    // OpenAI format
const anthropicTools = mcp.getAnthropicTools();      // Anthropic format
```

### Tool Execution
```typescript
// Single tool call
const result = await mcp.callTool('Topic', { topic: 'bitcoin' });

// Execute LLM function call
const result = await mcp.executeFunction(name, args);

// Batch multiple tool calls
const results = await mcp.callTools([
  { name: 'Topic', args: { topic: 'bitcoin' } },
  { name: 'Cryptocurrencies', args: { sort: 'galaxy_score', limit: 10 } }
]);
```

## 🛠 Available Tools

The SDK dynamically discovers all available tools from the LunarCrush MCP server. Common tools include:

- **Topic** - Get detailed crypto/stock data and social metrics
- **Cryptocurrencies** - List and sort cryptocurrencies by various metrics
- **Topic_Time_Series** - Historical data and trends
- **Topic_Posts** - Recent social posts and engagement
- **Search** - Search across all topics and social data
- **Creator** - Social media creator analysis
- **And more...** (auto-discovered)

## 🔒 Error Handling

The SDK passes through all MCP server errors with proper validation messages:

```typescript
try {
  const result = await mcp.callTool('Topic_Time_Series', {
    topic: 'bitcoin',
    metrics: 'price,volume',  // ❌ Should be array
    interval: 'day'           // ❌ Should be '1d', '1w', etc.
  });
} catch (error) {
  console.error('MCP validation error:', error.message);
  // Error will show exactly what's wrong with parameters
}
```

## 📝 TypeScript Support

Full TypeScript support with proper types:

```typescript
import LunarCrushMCP, { MCPTool, MCPToolResult } from '@jamaalbuilds/lunarcrush-mcp';

const mcp: LunarCrushMCP = new LunarCrushMCP(apiKey);
const tools: MCPTool[] = mcp.getTools();
const result: MCPToolResult = await mcp.callTool('Topic', { topic: 'bitcoin' });
```

## 🚀 Get Started

1. **Get LunarCrush API Key**: [lunarcrush.com/developers/api](https://lunarcrush.com/developers/api)
2. **Install the SDK**: `npm install @jamaalbuilds/lunarcrush-mcp`
3. **Connect your LLM**: Use examples above for your LLM provider
4. **Start analyzing**: Your LLM now has access to real-time crypto social data!

## 📖 Documentation

- [LunarCrush API Docs](https://lunarcrush.com/developers/api)
- [Model Context Protocol](https://modelcontextprotocol.io)

## 💬 Support

- [GitHub Issues](https://github.com/danilobatson/lunarcrush-mcp-sdk/issues)
- [Portfolio](https://danilobatson.github.io/)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built by [Danilo Jamaal](https://danilobatson.github.io/) for the LunarCrush community**
