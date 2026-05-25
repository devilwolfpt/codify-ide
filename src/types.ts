export type NavView =
	| "home"
	| "agent"
	| "history"
	| "memory"
	| "sessions"
	| "secrets"
	| "database"
	| "auth"
	| "extensions";

export type BottomPanel =
	| "play"
	| "preview"
	| "agent"
	| "web"
	| "terminal"
	| "problems"
	| "split";

export interface FileNode {
	id: string;
	name: string;
	type: "file" | "folder";
	children?: FileNode[];
	content?: string;
	language?: string;
}

export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
	operations?: {
		id: string;
		type: "file" | "folder" | "command";
		path: string;
		status: "pending" | "done";
	}[];
}

export interface SecretEntry {
	id: string;
	key: string;
	value: string;
	env: "dev" | "prod" | "all";
}

export interface DbTable {
	id: string;
	name: string;
	columns: string[];
	rows: Record<string, string>[];
}

export interface SessionEntry {
	id: string;
	name: string;
	createdAt: number;
	active: boolean;
}

export interface MemoryEntry {
	id: string;
	title: string;
	content: string;
	tags: string[];
	updatedAt: number;
}

export interface TaskEntry {
	id: string;
	title: string;
	status: "running" | "done" | "failed";
	duration: string;
	createdAt: number;
}

export interface ChatHistoryEntry {
	id: string;
	timestamp: number;
	messages: ChatMessage[];
	title: string;
}
