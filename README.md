# 🌙 LunarCrush MCP SDK

[![npm version](https://badge.fury.io/js/%40jamaalbuilds%2Flunarcrush-mcp.svg)](https://badge.fury.io/js/%40jamaalbuilds%2Flunarcrush-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Lightweight, LLM-agnostic SDK for connecting any LLM to LunarCrush social crypto data via Model Context Protocol (MCP).

## 🚀 Features

- **Zero Configuration** - Just your API key and you're ready
- **100% Dynamic** - Auto-discovers tools, future-proof against changes
- **LLM Agnostic** - Raw schemas, you format for your LLM choice
- **Lightweight** - Minimal dependencies, zero maintenance needed
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

// 2. Get tools for your LLM
const tools = mcp.getToolsWithDetails();
// Raw schemas - you format for your LLM

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

// Format tools for OpenAI (you control the formatting)
const tools = mcp.getToolsWithDetails();
const functions = tools.map(tool => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.schema
}));

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

// Format tools for Anthropic (you control the formatting)
const toolsData = mcp.getToolsWithDetails();
const tools = toolsData.map(tool => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.schema
}));

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

// Get detailed tool information for better LLM understanding
const toolsData = mcp.getToolsWithDetails();

const prompt = `You are a crypto analyst with access to LunarCrush tools.

AVAILABLE TOOLS:
${toolsData.map(tool => {
  const { name, description, parameterInfo } = tool;
  return `${name}: ${description}
  Required parameters: ${parameterInfo.required.join(', ') || 'none'}
  Optional parameters: ${parameterInfo.optional.join(', ') || 'none'}
  Parameter types: ${JSON.stringify(parameterInfo.types)}
  Enum values: ${JSON.stringify(parameterInfo.enums)}`;
}).join('\n\n')}

Task: Analyze Bitcoin's current performance and social sentiment.
Choose appropriate tools with EXACT parameter formatting.

CRITICAL:
- Use arrays for array parameters: ["item1", "item2"]
- Use exact enum values from the options provided
- Follow parameter types precisely

Respond with JSON:
{
  "selected_tools": [
    {
      "name": "exact_tool_name",
      "arguments": {exact_arguments_with_proper_types},
      "reasoning": "why you chose this tool"
    }
  ]
}`;

const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
const result = await model.generateContent(prompt);

// Parse and execute chosen tools
const response = JSON.parse(result.response.text());
for (const choice of response.selected_tools) {
  const toolResult = await mcp.callTool(choice.name, choice.arguments);
  console.log(`${choice.name} result:`, toolResult);
}
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
const tools = mcp.getTools();              // Get basic tools with schemas
const detailedTools = mcp.getToolsWithDetails();  // Get enhanced tool info for LLMs
const tool = mcp.getTool('Topic');         // Get specific tool schema
await mcp.refreshTools();                  // Refresh tool list (if MCP updates)
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

## 📝 Enhanced Tool Information

The `getToolsWithDetails()` method provides LLM-friendly tool information:

```typescript
const toolsData = mcp.getToolsWithDetails();
console.log(toolsData[0]);
/*
{
  name: "Topic_Time_Series",
  description: "Get historical time series metrics...",
  schema: {
    type: "object",
    properties: { ... },
    required: ["topic"]
  },
  parameterInfo: {
    required: ["topic"],
    optional: ["metrics", "interval"],
    types: {
      topic: "string",
      metrics: "array",
      interval: "enum"
    },
    enums: {
      interval: ["1d", "1w", "1m", "3m", "6m", "1y", "all"]
    }
  }
}
*/
```

This enhanced information helps LLMs understand:
- Which parameters are required vs optional
- Exact parameter types (string, array, enum, etc.)
- Valid enum values for better accuracy

## 🔒 Error Handling

The SDK passes through all MCP server errors with detailed validation messages:

```typescript
try {
  const result = await mcp.callTool('Topic_Time_Series', {
    topic: 'bitcoin',
    metrics: 'price,volume',  // ❌ Should be array: ['price', 'volume']
    interval: 'day'           // ❌ Should be '1d', not 'day'
  });
} catch (error) {
  console.error('MCP validation error:', error.message);
  // Error shows exactly what's wrong with parameters
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

## 🎯 Design Philosophy

This SDK is intentionally minimal and LLM-agnostic:

- **No LLM-specific formatting** - You control how to format schemas for your LLM
- **No maintenance burden** - SDK just passes through what MCP provides
- **Future-proof** - Works with any current or future LLM provider
- **Zero assumptions** - Doesn't assume we know how LLMs will evolve

## 🚀 Get Started

1. **Get LunarCrush API Key**: [lunarcrush.com/developers/api](https://lunarcrush.com/developers/api)
2. **Install the SDK**: `npm install @jamaalbuilds/lunarcrush-mcp`
3. **Format tools for your LLM**: Use examples above for your LLM provider
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
