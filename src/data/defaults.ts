import type {
	FileNode,
	ChatMessage,
	SecretEntry,
	DbTable,
	SessionEntry,
	MemoryEntry,
	TaskEntry,
} from "../types";

export const DEFAULT_FILES: FileNode[] = [
	{
		id: "root",
		name: "projeto",
		type: "folder",
		children: [
			{
				id: "src",
				name: "src",
				type: "folder",
				children: [
					{
						id: "main-ts",
						name: "main.ts",
						type: "file",
						language: "typescript",
						content: `// Codify Agent Entry
import { Agent } from './agent'

const agent = new Agent({
  name: 'Codify',
  proactive: true,
  persistence: true,
})

agent.on('intent', (intent) => {
  if (intent === 'build') {
    agent.modules.construction.activate()
  }
})

agent.connect(process.env.SERVER_URL ?? 'localhost:25565')
  .catch((err) => agent.reconnectInfinite(err))

console.log('🤖 Agent iniciado...')
`,
					},
					{
						id: "agent-ts",
						name: "agent.ts",
						type: "file",
						language: "typescript",
						content: `export class Agent {
  modules = { construction: { activate: () => {} } }

  constructor(private config: Record<string, unknown>) {}

  on(_event: string, _handler: (v: string) => void) {}

  async connect(_url: string) {
    await new Promise((r) => setTimeout(r, 100))
  }

  reconnectInfinite(_err: unknown) {
    console.log('Reconectando com super-memória...')
  }
}
`,
					},
				],
			},
			{
				id: "readme",
				name: "README.md",
				type: "file",
				language: "markdown",
				content: `# Codify IDE

IDE completo com Agent IA, editor Monaco, terminal e gestão de secrets.

## Funcionalidades

- **IA Proativa** — cérebro central que age, não só responde
- **Persistência** — reconexão infinita (ECONNRESET)
- **Editor** — syntax highlighting, tabs, split view
`,
			},
			{
				id: "package-json",
				name: "package.json",
				type: "file",
				language: "json",
				content: `{
  "name": "codify-agent",
  "version": "2.0.0",
  "scripts": {
    "dev": "tsx src/main.ts",
    "build": "tsc"
  }
}
`,
			},
		],
	},
];

export const WELCOME_MESSAGES: ChatMessage[] = [];

export const DEFAULT_SECRETS: SecretEntry[] = [
	{ id: "1", key: "OPENAI_API_KEY", value: "", env: "all" },
	{ id: "2", key: "GROQ_API_KEY", value: "", env: "all" },
	{ id: "3", key: "SERVER_URL", value: "localhost:25565", env: "dev" },
	{ id: "4", key: "GEMINI_API_KEY", value: "", env: "all" },
];

export const DEFAULT_TABLES: DbTable[] = [
	{
		id: "users",
		name: "users",
		columns: ["id", "username", "role", "last_seen"],
		rows: [
			{
				id: "1",
				username: "crafty_admin",
				role: "admin",
				last_seen: "2026-05-17",
			},
			{
				id: "2",
				username: "bot_agent",
				role: "agent",
				last_seen: "2026-05-17",
			},
		],
	},
	{
		id: "checkpoints",
		name: "checkpoints",
		columns: ["id", "label", "created_at"],
		rows: [{ id: "1", label: "v2-super-memory", created_at: "2026-01-15" }],
	},
];

export const DEFAULT_SESSIONS: SessionEntry[] = [
	{
		id: "1",
		name: "Servidor Principal",
		createdAt: Date.now() - 86400000,
		active: true,
	},
	{
		id: "2",
		name: "Teste Local",
		createdAt: Date.now() - 3600000,
		active: false,
	},
];

export const DEFAULT_MEMORIES: MemoryEntry[] = [
	{
		id: "1",
		title: "Preferências de construção",
		content:
			"Usar madeira de carvalho para estruturas. Altura máxima 64 blocos.",
		tags: ["build", "prefs"],
		updatedAt: Date.now() - 86400000 * 30,
	},
	{
		id: "2",
		title: "Servidor favorito",
		content: "play.codify.net — reconectar automaticamente em ECONNRESET",
		tags: ["server", "network"],
		updatedAt: Date.now() - 86400000 * 7,
	},
];

export const DEFAULT_TASKS: TaskEntry[] = [
	{
		id: "1",
		title: "Reconexão com super-memória",
		status: "running",
		duration: "1 min",
		createdAt: Date.now() - 60000,
	},
	{
		id: "2",
		title: "Checkpoint v2-super-memory",
		status: "done",
		duration: "4 meses",
		createdAt: Date.now() - 86400000 * 120,
	},
];
