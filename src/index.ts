import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

/**
 * LunarCrush MCP SDK - Minimal wrapper for connecting LLMs to LunarCrush data
 *
 * Design principles:
 * - Zero hardcoding - 100% dynamic tool discovery
 * - LLM agnostic - raw schemas, let developers format for their LLM
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

export class LunarCrushMCP {
	private client: Client | null = null;
	private transport: SSEClientTransport | null = null;
	private apiKey: string;
	private connected = false;
	private tools: MCPTool[] = [];

	constructor(apiKey: string) {
		if (!apiKey?.trim()) {
			throw new Error(
				'LunarCrush API key is required. Get one at https://lunarcrush.com/developers/api'
			);
		}
		this.apiKey = apiKey.trim();
	}

	/**
	 * Connect to LunarCrush MCP server and discover available tools
	 */
	async connect(): Promise<void> {
		try {
			this.transport = new SSEClientTransport(
				new URL(`https://lunarcrush.ai/sse?key=${this.apiKey}`)
			);

			this.client = new Client(
				{ name: 'lunarcrush-mcp-sdk', version: '1.0.0' },
				{ capabilities: { tools: {} } }
			);

			await this.client.connect(this.transport);
			await this.refreshTools();
			this.connected = true;
		} catch (error) {
			throw new Error(
				`Failed to connect to LunarCrush MCP: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`
			);
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
			this.tools = tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema,
			}));

			return this.tools;
		} catch (error) {
			throw new Error(
				`Failed to refresh tools: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`
			);
		}
	}

	/**
	 * Get all available tools with their complete schemas
	 * LLMs use this to understand available tools and their exact parameter requirements
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
		return this.tools.find((tool) => tool.name === name) || null;
	}

	/**
	 * Get detailed schema information for better LLM understanding
	 * Returns tools with enhanced schema details for accurate parameter formatting
	 */
	getToolsWithDetails(): Array<{
		name: string;
		description: string;
		schema: any;
		examples?: any;
		parameterInfo?: {
			required: string[];
			optional: string[];
			types: Record<string, string>;
			enums: Record<string, string[]>;
		};
	}> {
		return this.tools.map((tool) => {
			const schema = tool.inputSchema || {};
			const properties = schema.properties || {};
			const required = schema.required || [];

			// Extract parameter information for LLM clarity
			const parameterInfo = {
				required: required,
				optional: Object.keys(properties).filter(
					(key) => !required.includes(key)
				),
				types: {} as Record<string, string>,
				enums: {} as Record<string, string[]>,
			};

			// Parse parameter types and enum values
			Object.entries(properties).forEach(([key, prop]: [string, any]) => {
				if (prop.type) {
					parameterInfo.types[key] = prop.type;
				} else if (prop.anyOf) {
					// Handle complex types like enums
					const enumType = prop.anyOf.find((item: any) => item.enum);
					if (enumType) {
						parameterInfo.types[key] = 'enum';
						parameterInfo.enums[key] = enumType.enum;
					}
				}
			});

			return {
				name: tool.name,
				description: tool.description || `Call ${tool.name} tool`,
				schema: schema,
				parameterInfo,
			};
		});
	}

	/**
	 * Call a tool by name with arguments
	 */
	async callTool(
		name: string,
		args: Record<string, any> = {}
	): Promise<MCPToolResult> {
		this.ensureConnected();

		const tool = this.getTool(name);
		if (!tool) {
			throw new Error(
				`Tool '${name}' not found. Available tools: ${this.tools
					.map((t) => t.name)
					.join(', ')}`
			);
		}

		try {
			const result = await this.client!.callTool({
				name,
				arguments: args,
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
	async executeFunction(
		functionName: string,
		functionArgs: string | Record<string, any>
	): Promise<MCPToolResult> {
		const args =
			typeof functionArgs === 'string'
				? JSON.parse(functionArgs)
				: functionArgs;
		return this.callTool(functionName, args);
	}

	/**
	 * Batch call multiple tools
	 */
	async callTools(
		calls: Array<{ name: string; args?: Record<string, any> }>
	): Promise<
		Array<{
			tool: string;
			result?: MCPToolResult;
			error?: string;
		}>
	> {
		this.ensureConnected();

		const results = await Promise.allSettled(
			calls.map(async (call) => ({
				tool: call.name,
				result: await this.callTool(call.name, call.args || {}),
			}))
		);

		return results.map((result, index) => {
			if (result.status === 'fulfilled') {
				return result.value;
			} else {
				return {
					tool: calls[index].name,
					error: result.reason?.message || 'Unknown error',
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
			tools: this.tools.map((t) => t.name),
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

export default LunarCrushMCP;
