import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

/**
 * LunarCrush MCP SDK - Lightweight wrapper for connecting LLMs to LunarCrush data
 * 
 * Features:
 * - Zero hardcoding - 100% dynamic tool discovery
 * - LLM agnostic - works with OpenAI, Anthropic, Google, etc.  
 * - Future-proof - automatically adapts to MCP server changes
 * - Minimal footprint - thin layer over MCP protocol
 */

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPToolResult {
  content?: Array<{ text?: string; type?: string; [key: string]: any }>;
  isError?: boolean;
  [key: string]: any;
}

export interface MCPCallOptions {
  timeout?: number;
  retries?: number;
}

export class LunarCrushMCP {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private apiKey: string;
  private connected = false;
  private tools: MCPTool[] = [];

  constructor(apiKey: string) {
    if (!apiKey?.trim()) {
      throw new Error('LunarCrush API key is required. Get one at https://lunarcrush.com/developers/api');
    }
    this.apiKey = apiKey.trim();
  }

  /**
   * Connect to LunarCrush MCP server and discover available tools
   */
  async connect(): Promise<void> {
    try {
      // Create transport
      this.transport = new SSEClientTransport(
        new URL(`https://lunarcrush.ai/sse?key=${this.apiKey}`)
      );

      // Create client  
      this.client = new Client(
        { name: 'lunarcrush-mcp-sdk', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );

      // Connect
      await this.client.connect(this.transport);
      
      // Discover tools dynamically
      await this.refreshTools();
      
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to LunarCrush MCP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh tool list from MCP server (handles dynamic changes)
   */
  async refreshTools(): Promise<MCPTool[]> {
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }
    
    try {
      const { tools } = await this.client.listTools();
      this.tools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));
      
      return this.tools;
    } catch (error) {
      throw new Error(`Failed to refresh tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all available tools with their schemas (for LLM function calling)
   */
  getTools(): MCPTool[] {
    this.ensureConnected();
    return [...this.tools]; // Return copy to prevent mutation
  }

  /**
   * Get specific tool schema by name
   */
  getTool(name: string): MCPTool | null {
    this.ensureConnected();
    return this.tools.find(tool => tool.name === name) || null;
  }

  /**
   * Get tools formatted for OpenAI function calling
   */
  getOpenAIFunctions(): Array<{
    name: string;
    description: string;
    parameters: any;
  }> {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description || `Call ${tool.name} tool`,
      parameters: tool.inputSchema || { type: 'object', properties: {} }
    }));
  }

  /**
   * Get tools formatted for Anthropic function calling  
   */
  getAnthropicTools(): Array<{
    name: string;
    description: string;
    input_schema: any;
  }> {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description || `Call ${tool.name} tool`,
      input_schema: tool.inputSchema || { type: 'object', properties: {} }
    }));
  }

  /**
   * Call a tool by name with arguments
   */
  async callTool(name: string, args: Record<string, any> = {}, options: MCPCallOptions = {}): Promise<MCPToolResult> {
    this.ensureConnected();

    // Validate tool exists
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found. Available tools: ${this.tools.map(t => t.name).join(', ')}`);
    }

    try {
      const result = await this.client!.callTool({
        name,
        arguments: args
      });

      return result as MCPToolResult;
    } catch (error) {
      // Pass through MCP server errors directly (they have proper validation)
      throw error;
    }
  }

  /**
   * Execute function call from LLM (works with any LLM provider)
   */
  async executeFunction(functionName: string, functionArgs: string | Record<string, any>): Promise<MCPToolResult> {
    // Parse args if string (common from LLM responses)
    const args = typeof functionArgs === 'string' ? JSON.parse(functionArgs) : functionArgs;
    return this.callTool(functionName, args);
  }

  /**
   * Batch call multiple tools (useful for complex analysis)
   */
  async callTools(calls: Array<{ name: string; args?: Record<string, any> }>): Promise<Array<{
    tool: string;
    result?: MCPToolResult;
    error?: string;
  }>> {
    this.ensureConnected();

    const results = await Promise.allSettled(
      calls.map(async call => ({
        tool: call.name,
        result: await this.callTool(call.name, call.args || {})
      }))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          tool: calls[index].name,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });
  }

  /**
   * Check if connected to MCP server
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Get connection status and tool count
   */
  getStatus(): {
    connected: boolean;
    toolCount: number;
    tools: string[];
  } {
    return {
      connected: this.connected,
      toolCount: this.tools.length,
      tools: this.tools.map(t => t.name)
    };
  }

  /**
   * Disconnect from MCP server and cleanup
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        // Ignore cleanup errors
      }
      this.client = null;
    }
    
    this.transport = null;
    this.connected = false;
    this.tools = [];
  }

  private ensureConnected(): void {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to LunarCrush MCP. Call connect() first.');
    }
  }
}

// Default export for convenience
export default LunarCrushMCP;
