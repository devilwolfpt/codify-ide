import { useState, useRef, useEffect } from "react";
import {
	ArrowLeft,
	History,
	MessageSquarePlus,
	MoreVertical,
	Plus,
	ArrowUp,
	X,
	FileText,
	Square,
	FileCode,
	Terminal,
	CheckCircle2,
	FolderOpen,
	Loader2,
	ChevronRight,
	Cloud,
	Laptop2,
} from "lucide-react";
import type { ChatMessage } from "../types";
import type { ConfigSettings } from "./SettingsPanel";
import { AgentLogo } from "./Logo";
import { CustomSelect } from "./CustomSelect";
import { SettingsPanel } from "./SettingsPanel";

interface AgentPanelProps {
	messages: ChatMessage[];
	isThinking: boolean;
	onSend: (
		text: string,
		planMode: boolean,
		attachedFile?: { id: string; name: string } | null,
		provider?: string,
		options?: {
			apiKeys?: { openai?: string; groq?: string; gemini?: string };
			ollamaHost?: string;
		},
	) => void;
	onStop?: () => void;
	onUploadFile?: (file: File) => Promise<{
		success: boolean;
		id?: string;
		path?: string;
		error?: string;
	}>;
	compact?: boolean;
	embedded?: boolean;
	onBack?: () => void;
	onNewChat?: () => void;
}

function ArtifactCodeCard({
	code,
	lang,
	streaming,
	title,
}: {
	code: string;
	lang: string;
	streaming?: boolean;
	title?: string;
}) {
	const [copied, setCopied] = useState(false);
	const [expanded, setExpanded] = useState(false);

	const handleOpen = () => {
		navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const linesCount = code ? code.split("\n").length : 0;

	return (
		<div
			className={`agent-artifact-card-wrapper ${streaming ? "streaming" : ""}`}
		>
			<div className="agent-artifact-card">
				<div className="artifact-icon-wrap">
					<FileCode size={20} className="artifact-icon-svg" />
				</div>
				<div className="artifact-info">
					<span className="artifact-title">
						{title ||
							`Snippet ${lang ? lang.toUpperCase() : "DE CÓDIGO"}`}
					</span>
					<span className="artifact-subtitle">
						Código · {lang || "Texto"} ·{" "}
						{streaming ? (
							<span style={{ color: "#60a5fa" }}>
								A gerar linha {linesCount}...
							</span>
						) : (
							`${linesCount} linhas`
						)}
					</span>
				</div>
				<button
					className="artifact-action-btn"
					onClick={() => setExpanded(!expanded)}
				>
					{expanded ? "Ocultar" : "Ver"}
				</button>
				<button
					className="artifact-action-btn primary"
					onClick={handleOpen}
				>
					{copied ? "Copiado!" : "Copiar"}
				</button>
			</div>
			{(expanded || streaming) && (
				<div className="agent-artifact-code-preview">
					<pre
						className="agent-code-block"
						style={{
							margin: 0,
							borderTopLeftRadius: 0,
							borderTopRightRadius: 0,
							borderTop: "none",
						}}
					>
						<code>{code}</code>
					</pre>
				</div>
			)}
		</div>
	);
}

// Extract <create_file> blocks and return them as ArtifactCodeCards + cleaned text
function extractFileCards(
	content: string,
	streaming: boolean,
): { cards: React.ReactNode[]; cleanedText: string } {
	const cards: React.ReactNode[] = [];
	const closedRegex =
		/<create_file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/create_file>/g;
	let cleaned = content;
	let match;
	let idx = 0;

	// Extract completed (closed) create_file blocks first
	while ((match = closedRegex.exec(content)) !== null) {
		const filePath = match[1];
		const fileCode = match[2].replace(/^\n/, "").replace(/\n$/, "");
		const ext = filePath.split(".").pop()?.toLowerCase() || "txt";
		const title = filePath.split("/").pop() || filePath;
		cards.push(
			<ArtifactCodeCard
				key={`file-card-${idx++}`}
				code={fileCode}
				lang={ext}
				title={title}
			/>,
		);
	}

	// Check for a streaming (unclosed) create_file block
	if (streaming) {
		const openMatch =
			/<create_file\s+path=["']([^"']+)["']\s*>([\s\S]*)$/.exec(content);
		if (openMatch && !closedRegex.test(content)) {
			const filePath = openMatch[1];
			const fileCode = openMatch[2];
			const ext = filePath.split(".").pop()?.toLowerCase() || "txt";
			const title = filePath.split("/").pop() || filePath;
			cards.push(
				<ArtifactCodeCard
					key={`file-card-streaming-${idx}`}
					code={fileCode}
					lang={ext}
					title={title}
					streaming={true}
				/>,
			);
		}
	}

	// Strip all XML operations from the displayed text
	cleaned = content
		.replace(/<create_file[\s\S]*?<\/create_file>/g, "")
		.replace(/<create_file[^>]*>[\s\S]*$/, "") // strip unclosed
		.replace(/<create_folder[^>]*\/>/g, "")
		.replace(/<execute_command[^>]*\/>/g, "")
		.trim();

	return { cards, cleanedText: cleaned };
}

// Detect if assistant message is still just a status / loading line (not real content yet)
function isOnlyStatusText(content: string): boolean {
	const stripped = content.replace(/\*([^*]+)\*/g, "$1").trim();
	return (
		stripped === "Inicializando a Neuria..." ||
		stripped === "Neuria a formular resposta..." ||
		stripped.startsWith("A carregar o modelo Neuria AI") ||
		stripped.length === 0
	);
}

function renderMarkdown(text: string, shouldGlow: boolean = false) {
	const lines = text.split("\n");
	const elements: React.ReactNode[] = [];
	let inCodeBlock = false;
	let codeBlockLines: string[] = [];
	let codeBlockLang = "";

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.startsWith("```")) {
			if (inCodeBlock) {
				// Close current code block
				const code = codeBlockLines.join("\n");
				elements.push(
					<ArtifactCodeCard
						key={`code-${i}`}
						code={code}
						lang={codeBlockLang}
					/>,
				);
				inCodeBlock = false;
				codeBlockLines = [];
				codeBlockLang = "";
			} else {
				// Open new code block
				inCodeBlock = true;
				codeBlockLang = line.slice(3).trim();
			}
		} else if (inCodeBlock) {
			codeBlockLines.push(line);
		} else {
			// Normal paragraph line
			if (!line.trim()) {
				elements.push(<br key={`br-${i}`} />);
			} else {
				const isStatusText =
					line.includes("Inicializando a Neuria...") ||
					line.includes("A carregar o modelo Neuria AI...") ||
					line.includes("Neuria a formular resposta...") ||
					line.includes("Resposta interrompida pelo utilizador.");

				const html = line
					.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
					.replace(/`([^`]+)`/g, "<code>$1</code>")
					.replace(/\*(.+?)\*/g, "<em>$1</em>");

				elements.push(
					<p
						key={`p-${i}`}
						className={
							isStatusText && shouldGlow ? "neuria-glow-text" : ""
						}
						style={
							isStatusText && shouldGlow
								? { marginBottom: 4 }
								: undefined
						}
						dangerouslySetInnerHTML={{ __html: html }}
					/>,
				);
			}
		}
	}

	// Handle case where code block is still open (streaming)
	if (inCodeBlock && codeBlockLines.length > 0) {
		const code = codeBlockLines.join("\n");
		elements.push(
			<ArtifactCodeCard
				key="code-streaming"
				code={code}
				lang={codeBlockLang}
				streaming={true}
			/>,
		);
	}

	return elements;
}

function AgentOperationsList({
	operations,
}: {
	operations: NonNullable<ChatMessage["operations"]>;
}) {
	const [expanded, setExpanded] = useState(true);

	if (operations.length === 0) return null;

	const isAllDone = operations.every((o) => o.status === "done");

	return (
		<div className="agent-operations-container">
			<div
				className="agent-operations-header"
				onClick={() => setExpanded(!expanded)}
			>
				<span>
					{isAllDone
						? "Operações concluídas"
						: "A executar operações"}
				</span>
				<ChevronRight
					size={16}
					className={`chevron ${expanded ? "expanded" : ""}`}
				/>
			</div>

			{expanded && (
				<div className="agent-operations-list">
					{operations.map((op, idx) => {
						const isLast = idx === operations.length - 1;
						return (
							<div key={op.id} className="agent-operation-item">
								<div className="agent-operation-icon-col">
									{op.type === "file" && (
										<FileCode
											size={16}
											className="op-icon file"
										/>
									)}
									{op.type === "folder" && (
										<FolderOpen
											size={16}
											className="op-icon folder"
										/>
									)}
									{op.type === "command" && (
										<Terminal
											size={16}
											className="op-icon cmd"
										/>
									)}
									{!isLast && <div className="op-line" />}
								</div>
								<div className="agent-operation-content">
									<span className="op-title">{op.path}</span>
									<div className="op-status">
										{op.status === "done" ? (
											<span className="status-done">
												<CheckCircle2 size={14} />{" "}
												Concluído
											</span>
										) : (
											<span className="status-pending">
												<Loader2
													size={14}
													className="spin"
												/>{" "}
												A executar
											</span>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

export function AgentPanel({
	messages,
	isThinking,
	onSend,
	onStop,
	onUploadFile,
	compact,
	embedded,
	onBack,
	onNewChat,
}: AgentPanelProps) {
	const [input, setInput] = useState("");
	const [planMode, setPlanMode] = useState(false);
	const [provider, setProvider] = useState("auto");
	const [showSettings, setShowSettings] = useState(false);
	const [settings, setSettings] = useState<ConfigSettings>({
		ollamaModels: [] as string[],
		ollamaMode: "local" as const,
		ollamaHost: "http://127.0.0.1:11434",
		apiKeys: {},
		systemPrompt: "",
		customInstructions: "",
	});
	const [attachedFile, setAttachedFile] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [isDraggingOver, setIsDraggingOver] = useState(false);
	const [isFocused, setIsFocused] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [messages, isThinking]);

	useEffect(() => {
		let cancelled = false;

		async function detectOllamaModelsForSelector() {
			try {
				const res = await fetch("/api/ollama/models");
				if (!res.ok) return;
				const data = await res.json();

				const models: string[] = Array.isArray(data)
					? data
					: Array.isArray(data?.models)
						? data.models
						: [];

				if (cancelled || models.length === 0) return;

				setSettings((prev: ConfigSettings) => ({
					...prev,
					ollamaModels: Array.from(
						new Set([...prev.ollamaModels, ...models]),
					),
				}));
			} catch {
				// Ignore when Ollama is not installed/running.
			}
		}

		detectOllamaModelsForSelector();

		return () => {
			cancelled = true;
		};
	}, []);

	const installedOllamaOptions = Array.from(new Set(settings.ollamaModels))
		.filter(Boolean)
		.map((model) => ({
			group: "Installed (Ollama)",
			value: `ollama:${model}`,
			label: model,
			icon: <Laptop2 size={13} />,
		}));

	const modelOptions: any[] = [
		{
			value: "auto",
			label: "Auto",
			checked: provider === "auto",
		},
		{
			value: "chatgpt-4o",
			label: "ChatGPT 4o",
			icon: <Cloud size={13} />,
		},
		{
			value: "groq",
			label: "Groq",
			icon: <Cloud size={13} />,
		},
		{
			value: "gemini-3.1-pro",
			label: "Gemini 3.1 Pro",
			icon: <Cloud size={13} />,
		},
		{
			value: "neuria-ai",
			label: "Neuria AI",
			icon: <Laptop2 size={13} />,
		},
		{
			group: "Other Models",
			value: "claude-haiku-4.5",
			label: "Claude Haiku 4.5",
			status: "warning" as const,
		},
		{
			group: "Other Models",
			value: "claude-opus-4.7",
			label: "Claude Opus 4.7",
			status: "warning" as const,
		},
		{
			group: "Other Models",
			value: "gemini-2.5-pro",
			label: "Gemini 2.5 Pro",
			status: "warning" as const,
		},
		{
			group: "Other Models",
			value: "gpt-5-mini",
			label: "GPT-5 mini",
			status: "warning" as const,
		},
		{
			group: "Other Models",
			value: "raptor-mini",
			label: "Raptor mini (Preview)",
			status: "warning" as const,
		},
		...installedOllamaOptions,
	];

	const handleSend = () => {
		if (!input.trim() && !attachedFile) return;
		onSend(input.trim(), planMode, attachedFile, provider, {
			apiKeys: settings.apiKeys as any,
			ollamaHost: settings.ollamaHost,
		});
		setInput("");
		setAttachedFile(null);
	};

	const processOSFile = async (file: File) => {
		if (!onUploadFile) return;
		setIsUploading(true);
		const res = await onUploadFile(file);
		if (res.success && res.id && res.path) {
			setAttachedFile({
				id: res.id,
				name: res.path.split("/").pop() || file.name,
			});
		} else {
			console.error("Falha no upload do ficheiro:", res.error);
		}
		setIsUploading(false);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDraggingOver(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDraggingOver(false);
	};

	const handleDrop = async (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDraggingOver(false);

		// OS Files
		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			const file = e.dataTransfer.files[0];
			await processOSFile(file);
			return;
		}

		// IDE Virtual Files
		const fileId = e.dataTransfer.getData("codify-file-id");
		const fileName = e.dataTransfer.getData("codify-file-name");

		if (fileId && fileName) {
			setAttachedFile({ id: fileId, name: fileName });
		}
	};

	const handlePaste = async (
		e: React.ClipboardEvent<HTMLTextAreaElement>,
	) => {
		if (e.clipboardData.files && e.clipboardData.files.length > 0) {
			e.preventDefault();
			const file = e.clipboardData.files[0];
			await processOSFile(file);
		}
	};

	return (
		<>
			<div
				className={`agent-panel ${compact ? "compact" : ""} ${embedded ? "embedded" : ""}`}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				style={{ position: "relative" }}
			>
				{isDraggingOver && (
					<div className="agent-drag-overlay">
						<div className="agent-drag-overlay-content">
							<FileText size={48} className="agent-drag-icon" />
							<h3
								style={{
									fontSize: "18px",
									fontWeight: 600,
									color: "var(--accent)",
									margin: 0,
								}}
							>
								Anexar ficheiro para a Neuria AI
							</h3>
							<p
								style={{
									fontSize: "13px",
									color: "var(--text-muted)",
									margin: 0,
								}}
							>
								Solte o ficheiro aqui para referenciá-lo
								automaticamente
							</p>
						</div>
					</div>
				)}
				<header className="agent-header">
					{compact && onBack && (
						<button
							type="button"
							className="icon-btn"
							onClick={onBack}
							aria-label="Voltar"
						>
							<ArrowLeft size={20} />
						</button>
					)}
					{compact && (
						<button
							type="button"
							className="icon-btn"
							aria-label="Histórico"
						>
							<History size={20} />
						</button>
					)}
					<div className="agent-title">
						<AgentLogo size={compact ? 24 : 28} />
						<span>Agent</span>
					</div>
					<div className="agent-header-actions">
						{onNewChat && (
							<button
								type="button"
								className="icon-btn"
								aria-label="Nova conversa"
								onClick={onNewChat}
							>
								<MessageSquarePlus size={20} />
							</button>
						)}
						<button
							type="button"
							className="icon-btn"
							aria-label="Menu"
						>
							<MoreVertical size={20} />
						</button>
					</div>
				</header>

				<div className="agent-messages" ref={scrollRef}>
					{messages.length === 0 ? (
						<div className="agent-empty-state">
							<div className="empty-state-content">
								<AgentLogo size={180} variant="filled" />
								<h1>Olá, como posso ser útil hoje?</h1>
								<p>
									Pergunta-me sobre código, ficheiros ou
									tarefas.
								</p>
							</div>
						</div>
					) : (
						<>
							{messages.map((msg, index) => {
								const isLast = index === messages.length - 1;
								const isActiveThinking = isLast && isThinking;

								if (msg.role === "assistant") {
									const { cards, cleanedText } =
										extractFileCards(
											msg.content,
											isActiveThinking,
										);
									const showSkeleton =
										isActiveThinking &&
										isOnlyStatusText(cleanedText);

									return (
										<div
											key={msg.id}
											className="agent-msg assistant"
											style={{
												marginBottom:
													isLast && isThinking
														? "4px"
														: undefined,
											}}
										>
											<div className="agent-msg-content">
												{/* Operations: only folders and commands */}
												{msg.operations &&
													msg.operations.filter(
														(o) =>
															o.type !== "file",
													).length > 0 && (
														<AgentOperationsList
															operations={msg.operations.filter(
																(o) =>
																	o.type !==
																	"file",
															)}
														/>
													)}
												{renderMarkdown(
													cleanedText,
													isActiveThinking,
												)}
												{cards}
											</div>
											{/* Skeleton: only when no real content yet */}
											{showSkeleton && (
												<div
													className="agent-thinking-glow-container"
													style={{ paddingTop: 0 }}
												>
													<div className="agent-thinking-glow-avatar">
														<div className="agent-thinking-glow-avatar-inner" />
													</div>
													<div className="agent-thinking-glow-bubble">
														<div className="agent-thinking-glow-line size-lg" />
														<div className="agent-thinking-glow-line size-md" />
														<div className="agent-thinking-glow-line size-sm" />
													</div>
												</div>
											)}
										</div>
									);
								}

								return (
									<div
										key={msg.id}
										className="agent-msg user"
									>
										<p>{msg.content}</p>
									</div>
								);
							})}
							{/* Global skeleton: only when AI hasn't started at all yet */}
							{isThinking &&
								messages.length > 0 &&
								messages[messages.length - 1].role ===
									"user" && (
									<div
										className="agent-thinking-glow-container"
										style={{ paddingTop: 0 }}
									>
										<div className="agent-thinking-glow-avatar">
											<div className="agent-thinking-glow-avatar-inner" />
										</div>
										<div className="agent-thinking-glow-bubble">
											<div className="agent-thinking-glow-line size-lg" />
											<div className="agent-thinking-glow-line size-md" />
											<div className="agent-thinking-glow-line size-sm" />
										</div>
									</div>
								)}
						</>
					)}{" "}
				</div>

				<div className="agent-input-area">
					{" "}
					{isUploading && (
						<div className="agent-attached-file uploading">
							<Loader2
								size={14}
								className="spin"
								style={{
									color: "var(--accent)",
									flexShrink: 0,
								}}
							/>
							<span>A carregar ficheiro...</span>
						</div>
					)}
					{attachedFile && !isUploading && (
						<div className="agent-attached-file">
							<FileText
								size={14}
								style={{
									color: "var(--accent)",
									flexShrink: 0,
								}}
							/>
							<span>{attachedFile.name}</span>
							<button
								type="button"
								className="agent-attached-file-remove"
								onClick={() => setAttachedFile(null)}
								title="Remover anexo"
							>
								<X size={14} />
							</button>
						</div>
					)}
					<div
						className={`agent-input-card ${isFocused ? "focused" : ""}`}
					>
						<textarea
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onFocus={() => setIsFocused(true)}
							onBlur={() => setIsFocused(false)}
							onPaste={handlePaste}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									handleSend();
								}
							}}
							placeholder="Make, test, iterate..."
							rows={2}
						/>
						<div className="agent-input-toolbar">
							<div
								className="toolbar-left-group"
								style={{
									display: "flex",
									alignItems: "center",
									gap: "12px",
								}}
							>
								<input
									type="file"
									ref={fileInputRef}
									style={{ display: "none" }}
									onChange={(e) => {
										if (
											e.target.files &&
											e.target.files.length > 0
										) {
											processOSFile(e.target.files[0]);
											e.target.value = ""; // reset input
										}
									}}
								/>
								<button
									type="button"
									className="input-tool-btn"
									aria-label="Anexar"
									onClick={() =>
										fileInputRef.current?.click()
									}
								>
									<Plus size={18} />
								</button>
								<label className="plan-toggle-pill">
									<input
										type="checkbox"
										checked={planMode}
										onChange={(e) =>
											setPlanMode(e.target.checked)
										}
									/>
									<span className="checkbox-custom" />
									<span>Plan</span>
								</label>
							</div>

							<div
								className="toolbar-right-group"
								style={{
									display: "flex",
									alignItems: "center",
									gap: "10px",
								}}
							>
								<CustomSelect
									value={provider}
									onChange={setProvider}
									options={modelOptions}
									onOpenSettings={() => setShowSettings(true)}
								/>

								{isThinking ? (
									<button
										type="button"
										className="stop-btn-pill"
										onClick={onStop}
										aria-label="Parar resposta"
									>
										<Square size={12} fill="currentColor" />
									</button>
								) : (
									<button
										type="button"
										className="send-btn-pill"
										onClick={handleSend}
										disabled={!input.trim()}
										aria-label="Enviar"
									>
										<ArrowUp size={16} />
									</button>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			<SettingsPanel
				open={showSettings}
				onClose={() => setShowSettings(false)}
				settings={settings}
				onSave={(s) => setSettings(s)}
			/>
		</>
	);
}
