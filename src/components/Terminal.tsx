import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import {
	ChevronDown,
	ChevronRight,
	Plus,
	X,
	Terminal as TerminalIcon,
	AlertCircle,
	Trash2,
	PanelRight,
	MoreHorizontal,
	AlertTriangle,
	Bot,
	FileCode,
} from "lucide-react";
import "xterm/css/xterm.css";

type ShellType = "powershell" | "cmd" | "bash" | "wsl";

interface TerminalTab {
	id: string;
	title: string;
	shell: ShellType;
}

// Subcomponent for the actual XTerm instance
function XTermInstance({
	tab,
	isActive,
}: {
	tab: TerminalTab;
	isActive: boolean;
}) {
	const terminalRef = useRef<HTMLDivElement>(null);
	const xtermRef = useRef<XTerm | null>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);

	useEffect(() => {
		if (!terminalRef.current) return;

		const fitAddon = new FitAddon();
		fitAddonRef.current = fitAddon;
		const xterm = new XTerm({
			cursorBlink: true,
			fontFamily: 'Consolas, "Courier New", monospace',
			fontSize: 14,
			theme: {
				background: "#151515",
				foreground: "#cccccc",
				cursor: "#ffffff",
			},
		});

		xterm.loadAddon(fitAddon);
		xterm.open(terminalRef.current);
		fitAddon.fit();
		xtermRef.current = xterm;

		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const ws = new WebSocket(
			`${protocol}//${window.location.host}/api/terminal?shell=${tab.shell}`,
		);
		wsRef.current = ws;

		ws.onmessage = (event) => xterm.write(event.data);

		ws.onopen = () => {
			const pending = (window as any).__pendingTerminalCommand;
			if (pending) {
				// Send a small delay to make sure shell is ready
				setTimeout(() => {
					if (ws.readyState === WebSocket.OPEN) {
						ws.send(pending + "\r\n");
						delete (window as any).__pendingTerminalCommand;
					}
				}, 300);
			}
		};

		xterm.onData((data) => {
			if (ws.readyState === WebSocket.OPEN) ws.send(data);
		});

		const handleResize = () => fitAddon.fit();
		window.addEventListener("resize", handleResize);

		const handleCommand = (e: CustomEvent) => {
			if (isActive && ws.readyState === WebSocket.OPEN) {
				ws.send(e.detail + "\r\n");
			}
		};
		window.addEventListener("terminal-cmd" as any, handleCommand);

		const handleClearEvent = (e: CustomEvent<{ tabId: string }>) => {
			if (e.detail?.tabId === tab.id && xtermRef.current) {
				xtermRef.current.clear();
			}
		};
		window.addEventListener("xterm-clear-active" as any, handleClearEvent);

		setTimeout(() => fitAddon.fit(), 100);

		return () => {
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("terminal-cmd" as any, handleCommand);
			window.removeEventListener("xterm-clear-active" as any, handleClearEvent);
			xterm.dispose();
			ws.close();
		};
	}, []);

	// Refit when becoming active
	useEffect(() => {
		if (isActive && fitAddonRef.current) {
			setTimeout(() => fitAddonRef.current?.fit(), 50);
		}
	}, [isActive]);

	return (
		<div
			ref={terminalRef}
			style={{
				width: "100%",
				height: "100%",
				display: isActive ? "block" : "none",
				padding: "0 8px",
			}}
		/>
	);
}

type MainPane = "problems" | "output" | "debug" | "terminal" | "ports";

interface ProblemItem {
	id: string;
	type: "error" | "warning";
	line: number;
	col: number;
	message: string;
	code: string;
	rule: string;
	source: string;
	beforeCode?: string;
	afterCode?: string;
}

interface FileProblems {
	filePath: string;
	fileName: string;
	folderPath: string;
	problems: ProblemItem[];
}

const PROBLEMS_DATA: FileProblems[] = [
	{
		filePath: "src/App.tsx",
		fileName: "App.tsx",
		folderPath: "src",
		problems: [
			{
				id: "p1",
				type: "warning",
				line: 23,
				col: 14,
				message: "'useState' is defined but never used.",
				code: "const [activeFile, setActiveFile] = useState(null);",
				rule: "eslint(no-unused-vars)",
				source: "useState",
				beforeCode: "import { Sidebar } from './components/Sidebar';",
				afterCode: "import { CodeEditor } from './components/CodeEditor';"
			}
		]
	},
	{
		filePath: "src/components/Terminal.tsx",
		fileName: "Terminal.tsx",
		folderPath: "src/components",
		problems: [
			{
				id: "p2",
				type: "error",
				line: 112,
				col: 5,
				message: "Type 'string' is not assignable to type 'number'.",
				code: "const tabCount: number = tabs.length.toString();",
				rule: "ts(2322)",
				source: "tabs.length.toString()",
				beforeCode: "const [tabs, setTabs] = useState<TerminalTab[]>([]);",
				afterCode: "const [activeTabId, setActiveTabId] = useState('');"
			}
		]
	},
	{
		filePath: "src/components/BottomBar.tsx",
		fileName: "BottomBar.tsx",
		folderPath: "src/components",
		problems: [
			{
				id: "p3",
				type: "error",
				line: 45,
				col: 12,
				message: "Cannot find name 'icon'. Did you mean 'TerminalIcon'?",
				code: "return <div className=\"icon-wrapper\">{icon}</div>;",
				rule: "ts(2552)",
				source: "icon",
				beforeCode: "export function BottomBar({ activePane }) {",
				afterCode: "}"
			}
		]
	}
];

export function Terminal() {
	const [activePane, setActivePane] = useState<MainPane>("terminal");
	const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
	const [tabs, setTabs] = useState<TerminalTab[]>([
		{ id: "1", title: "Windows PowerShell", shell: "powershell" },
	]);
	const [activeTabId, setActiveTabId] = useState("1");
	const [menuOpen, setMenuOpen] = useState(false);
	const [filterText, setFilterText] = useState("");
	const [filterType, setFilterType] = useState<"all" | "errors" | "warnings">("all");
	const [hoveredProbId, setHoveredProbId] = useState<string | null>(null);

	const toggleFileCollapse = (filePath: string) => {
		setCollapsedFiles((prev) => ({ ...prev, [filePath]: !prev[filePath] }));
	};

	const sendToAgent = (filePath: string, prob: ProblemItem) => {
		const text = `Por favor, corrige o seguinte erro no ficheiro \`${filePath}\` na linha ${prob.line}, coluna ${prob.col}:
Mensagem: ${prob.message}
Código a corrigir:
\`\`\`tsx
${prob.code}
\`\`\`
Identificador da regra: ${prob.rule}`;

		window.dispatchEvent(new CustomEvent("send-to-agent", { detail: { text } }));
	};

	const addTab = (shell: ShellType, title: string) => {
		const newId = Date.now().toString();
		setTabs((prev) => [...prev, { id: newId, shell, title }]);
		setActiveTabId(newId);
		setMenuOpen(false);
	};

	const closeTabById = (id: string) => {
		setTabs((prev) => {
			const newTabs = prev.filter((t) => t.id !== id);
			if (newTabs.length > 0 && activeTabId === id) {
				setActiveTabId(newTabs[newTabs.length - 1].id);
			}
			return newTabs;
		});
	};

	const closeTab = (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		closeTabById(id);
	};

	useEffect(() => {
		const handleNewTab = () => {
			addTab("powershell", "Windows PowerShell");
		};
		const handleCloseTab = (e: Event) => {
			const customEvent = e as CustomEvent<{ id?: string }>;
			const targetId = customEvent.detail?.id || activeTabId;
			if (targetId) closeTabById(targetId);
		};
		const handleClear = () => {
			window.dispatchEvent(new CustomEvent("xterm-clear-active", { detail: { tabId: activeTabId } }));
		};

		window.addEventListener("terminal-new-tab", handleNewTab);
		window.addEventListener("terminal-close-tab", handleCloseTab);
		window.addEventListener("terminal-clear", handleClear);

		return () => {
			window.removeEventListener("terminal-new-tab", handleNewTab);
			window.removeEventListener("terminal-close-tab", handleCloseTab);
			window.removeEventListener("terminal-clear", handleClear);
		};
	}, [activeTabId, tabs]);

	const SHELL_OPTIONS = [
		{
			id: "powershell",
			label: "Windows PowerShell",
			shell: "powershell",
			shortcut: "Ctrl+Shift+1",
		},
		{
			id: "cmd",
			label: "Prompt de comando",
			shell: "cmd",
			shortcut: "Ctrl+Shift+2",
		},
		{
			id: "wsl",
			label: "Ubuntu (WSL)",
			shell: "wsl",
			shortcut: "Ctrl+Shift+3",
		},
		{
			id: "bash",
			label: "Git Bash",
			shell: "bash",
			shortcut: "Ctrl+Shift+5",
		},
	];

	const navItems: { id: MainPane; label: string; badge?: number }[] = [
		{ id: "problems", label: "Problems", badge: 3 },
		{ id: "output", label: "Output" },
		{ id: "debug", label: "Debug Console" },
		{ id: "terminal", label: "Terminal" },
		{ id: "ports", label: "Ports" },
	];

	const renderFileIcon = (fileName: string) => {
		if (fileName.endsWith(".tsx")) {
			return <FileCode size={14} color="#0078d7" />;
		}
		if (fileName.endsWith(".ts")) {
			return <FileCode size={14} color="#3178c6" />;
		}
		if (fileName.endsWith(".css")) {
			return <FileCode size={14} color="#e39738" />;
		}
		return <FileCode size={14} color="#888" />;
	};

	const renderSourceCode = (problem: ProblemItem) => {
		const { code, source, type, line, beforeCode, afterCode } = problem;
		const index = code.indexOf(source);
		const underlineColor = type === "error" ? "#ef4444" : "#eab308";
		const sourceColor = type === "error" ? "#f87171" : "#fde047";
		
		const renderLine = (lNum: number, content: string | undefined, isTarget: boolean) => {
			if (content === undefined) return null;
			return (
				<div 
					key={lNum}
					style={{ 
						display: "flex", 
						alignItems: "stretch", 
						background: isTarget ? "rgba(255, 255, 255, 0.03)" : "transparent",
						padding: "2px 0"
					}}
				>
					{/* Line Number Column */}
					<div style={{ 
						width: "35px", 
						minWidth: "35px", 
						color: isTarget ? "#aaa" : "#555", 
						textAlign: "right",
						paddingRight: "10px",
						borderRight: "1px solid rgba(255, 255, 255, 0.08)",
						userSelect: "none"
					}}>
						{lNum}
					</div>
					{/* Code Column */}
					<div style={{ paddingLeft: "10px", whiteSpace: "pre", color: isTarget ? "#ccc" : "#777" }}>
						{isTarget && index !== -1 ? (
							<>
								<span>{code.substring(0, index)}</span>
								<span style={{ 
									color: sourceColor, 
									textDecoration: `underline wavy ${underlineColor}`, 
									fontWeight: 500 
								}}>
									{source}
								</span>
								<span>{code.substring(index + source.length)}</span>
							</>
						) : (
							<span>{content}</span>
						)}
					</div>
				</div>
			);
		};

		return (
			<div
				style={{
					fontFamily: 'Consolas, "Fira Code", monospace',
					fontSize: "11px",
					color: "#888",
					background: "#0c0c0e",
					border: "1px solid rgba(255, 255, 255, 0.04)",
					borderRadius: "6px",
					padding: "6px 0",
					marginTop: "6px",
					display: "flex",
					flexDirection: "column",
					overflowX: "auto",
					boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)"
				}}
			>
				{renderLine(line - 1, beforeCode, false)}
				{renderLine(line, code, true)}
				{renderLine(line + 1, afterCode, false)}
			</div>
		);
	};

	const renderProblems = () => {
		const filteredProblems = PROBLEMS_DATA.map((file) => {
			const problems = file.problems.filter((prob) => {
				if (filterType === "errors" && prob.type !== "error") return false;
				if (filterType === "warnings" && prob.type !== "warning") return false;
				if (filterText) {
					const query = filterText.toLowerCase();
					return (
						prob.message.toLowerCase().includes(query) ||
						prob.rule.toLowerCase().includes(query) ||
						file.fileName.toLowerCase().includes(query) ||
						prob.code.toLowerCase().includes(query)
					);
				}
				return true;
			});
			return { ...file, problems };
		}).filter((file) => file.problems.length > 0);

		return (
			<div
				style={{
					padding: "16px",
					color: "#ccc",
					overflowY: "auto",
					height: "100%",
					display: "flex",
					flexDirection: "column",
				}}
			>
				{/* Search & Filter Header */}
				<div style={{ display: "flex", gap: "8px", marginBottom: "16px", alignItems: "center" }}>
					<input
						type="text"
						placeholder="Filter problems (e.g. App.tsx, useState...)"
						value={filterText}
						onChange={(e) => setFilterText(e.target.value)}
						style={{
							flex: 1,
							background: "#0d0d0f",
							border: "1px solid rgba(255,255,255,0.08)",
							borderRadius: "4px",
							padding: "5px 10px",
							color: "#fff",
							fontSize: "11px",
							outline: "none",
							transition: "border-color 0.2s",
						}}
						onFocus={(e) => e.currentTarget.style.borderColor = "rgba(0,120,212,0.6)"}
						onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
					/>
					<div style={{ display: "flex", background: "rgba(0,0,0,0.25)", borderRadius: "4px", padding: "2px" }}>
						<button
							onClick={() => setFilterType("all")}
							style={{
								background: filterType === "all" ? "rgba(255,255,255,0.08)" : "transparent",
								border: "none",
								color: filterType === "all" ? "#fff" : "#888",
								fontSize: "10px",
								padding: "3px 8px",
								borderRadius: "3px",
								cursor: "pointer",
								transition: "all 0.15s ease"
							}}
						>
							All
						</button>
						<button
							onClick={() => setFilterType("errors")}
							style={{
								background: filterType === "errors" ? "rgba(239, 68, 68, 0.15)" : "transparent",
								border: "none",
								color: filterType === "errors" ? "#f87171" : "#888",
								fontSize: "10px",
								padding: "3px 8px",
								borderRadius: "3px",
								cursor: "pointer",
								transition: "all 0.15s ease"
							}}
						>
							Errors
						</button>
						<button
							onClick={() => setFilterType("warnings")}
							style={{
								background: filterType === "warnings" ? "rgba(234, 179, 8, 0.15)" : "transparent",
								border: "none",
								color: filterType === "warnings" ? "#fde047" : "#888",
								fontSize: "10px",
								padding: "3px 8px",
								borderRadius: "3px",
								cursor: "pointer",
								transition: "all 0.15s ease"
							}}
						>
							Warnings
						</button>
					</div>
				</div>

				{/* Problems List */}
				{filteredProblems.length === 0 ? (
					<div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "#666", fontSize: "12px", padding: "40px 0" }}>
						No problems found matching filters.
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
						{filteredProblems.map((file) => {
							const isCollapsed = collapsedFiles[file.filePath];
							const errorsCount = file.problems.filter((p) => p.type === "error").length;
							const warningsCount = file.problems.filter((p) => p.type === "warning").length;
							return (
								<div key={file.filePath} style={{ display: "flex", flexDirection: "column" }}>
									{/* File Header Row */}
									<div
										onClick={() => toggleFileCollapse(file.filePath)}
										style={{
											display: "flex",
											alignItems: "center",
											gap: "6px",
											padding: "6px 8px",
											cursor: "pointer",
											borderRadius: "4px",
											userSelect: "none",
											background: "rgba(255, 255, 255, 0.02)",
											transition: "background 0.15s ease",
										}}
										onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)")}
										onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
									>
										{isCollapsed ? (
											<ChevronRight size={14} color="#888" />
										) : (
											<ChevronDown size={14} color="#888" />
										)}
										{renderFileIcon(file.fileName)}
										<span style={{ color: "#fff", fontSize: "12px", fontWeight: 600 }}>
											{file.fileName}
										</span>
										<span style={{ color: "#888", fontSize: "11px" }}>
											{file.folderPath}
										</span>
										<div style={{ flex: 1 }} />
										
										{/* Badge count of problems in this file */}
										<div style={{ display: "flex", gap: "6px" }}>
											{errorsCount > 0 && (
												<span style={{
													background: "rgba(239, 68, 68, 0.15)",
													color: "#f87171",
													fontSize: "10px",
													fontWeight: "bold",
													padding: "1px 5px",
													borderRadius: "4px"
												}}>
													{errorsCount}
												</span>
											)}
											{warningsCount > 0 && (
												<span style={{
													background: "rgba(234, 179, 8, 0.15)",
													color: "#fde047",
													fontSize: "10px",
													fontWeight: "bold",
													padding: "1px 5px",
													borderRadius: "4px"
												}}>
													{warningsCount}
												</span>
											)}
										</div>
									</div>

									{/* File Problems List */}
									{!isCollapsed && (
										<div style={{ display: "flex", flexDirection: "column", marginTop: "2px" }}>
											{file.problems.map((prob) => {
												const isHovered = hoveredProbId === prob.id;
												return (
													<div
														key={prob.id}
														onMouseEnter={() => setHoveredProbId(prob.id)}
														onMouseLeave={() => setHoveredProbId(null)}
														style={{
															display: "flex",
															flexDirection: "column",
															padding: "6px 8px 8px 28px",
															borderRadius: "4px",
															background: isHovered ? "rgba(255, 255, 255, 0.015)" : "transparent",
															transition: "background 0.15s ease",
															position: "relative"
														}}
													>
														<div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
															{prob.type === "error" ? (
																<AlertCircle size={12} color="#f87171" style={{ marginTop: "2px" }} />
															) : (
																<AlertTriangle size={12} color="#eab308" style={{ marginTop: "2px" }} />
															)}
															<span style={{
																color: "#888",
																fontSize: "11px",
																fontFamily: "monospace",
																minWidth: "45px"
															}}>
																[{prob.line}, {prob.col}]
															</span>
															<span style={{ color: "#ccc", fontSize: "12px", flex: 1, wordBreak: "break-all" }}>
																{prob.message}
															</span>
															
															{isHovered ? (
																<div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "8px" }}>
																	<span 
																		style={{ 
																			color: "#0078d4", 
																			fontSize: "10px", 
																			cursor: "pointer", 
																			textDecoration: "underline",
																			fontWeight: 500
																		}}
																	>
																		Go to file
																	</span>
																	<div
																		onClick={() => sendToAgent(file.filePath, prob)}
																		style={{
																			display: "flex",
																			alignItems: "center",
																			gap: "4px",
																			color: "#3b82f6",
																			fontSize: "10px",
																			cursor: "pointer",
																			padding: "2px 6px",
																			borderRadius: "4px",
																			background: "rgba(59, 130, 246, 0.1)",
																			border: "1px solid rgba(59, 130, 246, 0.2)",
																			fontWeight: 500,
																			transition: "all 0.15s ease",
																			userSelect: "none"
																		}}
																		onMouseEnter={(e) => {
																			e.currentTarget.style.background = "rgba(59, 130, 246, 0.2)";
																			e.currentTarget.style.color = "#60a5fa";
																		}}
																		onMouseLeave={(e) => {
																			e.currentTarget.style.background = "rgba(59, 130, 246, 0.1)";
																			e.currentTarget.style.color = "#3b82f6";
																		}}
																	>
																		<Bot size={11} />
																		Send to Agent
																	</div>
																</div>
															) : null}
															
															<span style={{ color: "#666", fontSize: "10px", fontFamily: "monospace" }}>
																[{prob.rule}]
															</span>
														</div>

														{/* Render source code preview */}
														<div style={{ paddingLeft: "20px", marginTop: "2px" }}>
															{renderSourceCode(prob)}
														</div>
													</div>
												);
											})}
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>
		);
	};

	const renderEmpty = (label: string) => (
		<div
			style={{
				padding: "24px",
				color: "#666",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: "13px",
			}}
		>
			{label} vazia.
		</div>
	);

	return (
		<div
			className="terminal-panel"
			style={{
				background: "#151515",
				display: "flex",
				flexDirection: "column",
				height: "100%",
				overflow: "hidden",
				fontFamily:
					'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
			}}
		>
			{/* Top Nav Bar (Windows 11 fluent style) */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					background: "#1e1e1e",
					borderBottom: "1px solid rgba(255,255,255,0.05)",
					padding: "0 8px",
					userSelect: "none",
					height: "38px",
				}}
			>
				{/* Left Tabs */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						height: "100%",
					}}
				>
					{navItems.map((item) => (
						<div
							key={item.id}
							onClick={() => setActivePane(item.id)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: "6px",
								height: "100%",
								padding: "0 12px",
								cursor: "pointer",
								color: activePane === item.id ? "#fff" : "#888",
								position: "relative",
								fontSize: "11px",
								textTransform: "uppercase",
								letterSpacing: "0.5px",
								fontWeight: activePane === item.id ? 600 : 500,
								transition: "all 0.2s ease",
							}}
							onMouseEnter={(e) => {
								if (activePane !== item.id)
									e.currentTarget.style.color = "#ccc";
							}}
							onMouseLeave={(e) => {
								if (activePane !== item.id)
									e.currentTarget.style.color = "#888";
							}}
						>
							{item.label}
							{item.badge !== undefined && (
								<div
									style={{
										background:
											activePane === item.id
												? "#0078d4"
												: "rgba(255,255,255,0.1)",
										color:
											activePane === item.id
												? "#fff"
												: "#aaa",
										fontSize: "10px",
										fontWeight: "bold",
										padding: "2px 6px",
										borderRadius: "10px",
										lineHeight: 1,
									}}
								>
									{item.badge}
								</div>
							)}
							{activePane === item.id && (
								<div
									style={{
										position: "absolute",
										bottom: 0,
										left: "12px",
										right: "12px",
										height: "2px",
										background: "#0078d4",
										borderRadius: "2px 2px 0 0",
									}}
								/>
							)}
						</div>
					))}
				</div>
			</div>

			{/* Terminal Secondary Bar (only visible when Terminal is active) */}
			{activePane === "terminal" && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						background: "#161616",
						borderBottom: "1px solid rgba(255,255,255,0.05)",
						padding: "0 12px",
						userSelect: "none",
						gap: "2px",
						height: "32px",
						position: "relative"
					}}
				>
					{/* Left Tabs Container */}
					<div style={{ display: "flex", alignItems: "flex-end", height: "100%", gap: "2px" }} data-context-type="terminal-tabs">
						{tabs.map((tab) => (
							<div
								key={tab.id}
								onClick={() => setActiveTabId(tab.id)}
								data-context-type="terminal-tab"
								data-tab-id={tab.id}
								data-tab-title={tab.title}
								style={{
									display: "flex",
									alignItems: "center",
									gap: "8px",
									background:
										activeTabId === tab.id
											? "#151515"
											: "transparent",
									padding: "0 12px",
									height: "28px",
									borderRadius: "4px 4px 0 0",
									cursor: "pointer",
									color: activeTabId === tab.id ? "#fff" : "#888",
									border: "1px solid",
									borderColor:
										activeTabId === tab.id
											? "rgba(255,255,255,0.05)"
											: "transparent",
									borderBottom: "none",
									transition: "all 0.15s ease",
									fontSize: "11px",
									position: "relative",
									top: "1px",
									zIndex: activeTabId === tab.id ? 2 : 1,
								}}
								onMouseEnter={(e) => {
									if (activeTabId !== tab.id)
										e.currentTarget.style.background =
											"rgba(255,255,255,0.03)";
								}}
								onMouseLeave={(e) => {
									if (activeTabId !== tab.id)
										e.currentTarget.style.background =
											"transparent";
								}}
							>
								<TerminalIcon
									size={12}
									color={tab.shell === "cmd" ? "#eee" : "#0078d7"}
								/>
								<span
									style={{
										maxWidth: "120px",
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{tab.title}
								</span>
								<div
									onClick={(e) => closeTab(e, tab.id)}
									style={{
										padding: "2px",
										borderRadius: "4px",
										display: "flex",
										alignItems: "center",
										opacity: activeTabId === tab.id ? 0.7 : 0.4,
									}}
									onMouseEnter={(e) =>
										(e.currentTarget.style.background =
											"rgba(255,255,255,0.15)")
									}
									onMouseLeave={(e) =>
										(e.currentTarget.style.background =
											"transparent")
									}
								>
									<X size={10} />
								</div>
							</div>
						))}
					</div>

					{/* Right Actions Container */}
					<div style={{ display: "flex", alignItems: "center", gap: "4px", height: "100%" }}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "6px",
								marginRight: "12px",
								color: "#eab308",
								fontSize: "12px",
								cursor: "pointer",
							}}
						>
							<TerminalIcon size={14} />
							esbuild
							<AlertTriangle size={14} />
						</div>

						<div
							style={{
								display: "flex",
								alignItems: "center",
								background: "rgba(0,0,0,0.2)",
								borderRadius: "6px",
								padding: "2px",
								gap: "2px",
							}}
						>
							<div
								style={{
									padding: "4px",
									borderRadius: "4px",
									cursor: "pointer",
									color: "#ccc",
									transition: "background 0.2s",
								}}
								onMouseEnter={(e) =>
									(e.currentTarget.style.background =
										"rgba(255,255,255,0.1)")
								}
								onMouseLeave={(e) =>
									(e.currentTarget.style.background =
										"transparent")
								}
								onClick={() => addTab("powershell", "Windows PowerShell")}
							>
								<Plus size={14} />
							</div>
							<div
								style={{
									padding: "4px",
									borderRadius: "4px",
									cursor: "pointer",
									color: "#ccc",
									transition: "background 0.2s",
								}}
								onMouseEnter={(e) =>
									(e.currentTarget.style.background =
										"rgba(255,255,255,0.1)")
								}
								onMouseLeave={(e) =>
									(e.currentTarget.style.background =
										"transparent")
								}
								onClick={() => setMenuOpen(!menuOpen)}
							>
								<ChevronDown size={14} />
							</div>
						</div>

						<div
							style={{
								padding: "4px 6px",
								borderRadius: "6px",
								cursor: "pointer",
								color: "#aaa",
								marginLeft: "4px",
								transition: "all 0.2s",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background =
									"rgba(255,255,255,0.1)";
								e.currentTarget.style.color = "#fff";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = "transparent";
								e.currentTarget.style.color = "#aaa";
							}}
						>
							<PanelRight size={14} />
						</div>
						<div
							style={{
								padding: "4px 6px",
								borderRadius: "6px",
								cursor: "pointer",
								color: "#aaa",
								transition: "all 0.2s",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background =
									"rgba(255,255,255,0.1)";
								e.currentTarget.style.color = "#fff";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = "transparent";
								e.currentTarget.style.color = "#aaa";
							}}
							onClick={(e) => closeTab(e, activeTabId)}
						>
							<Trash2 size={14} />
						</div>
						<div
							style={{
								padding: "4px 6px",
								borderRadius: "6px",
								cursor: "pointer",
								color: "#aaa",
								transition: "all 0.2s",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background =
									"rgba(255,255,255,0.1)";
								e.currentTarget.style.color = "#fff";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = "transparent";
								e.currentTarget.style.color = "#aaa";
							}}
						>
							<MoreHorizontal size={14} />
						</div>
					</div>

					{/* Dropdown Popover */}
					{menuOpen && (
						<div
							style={{
								position: "absolute",
								top: "34px",
								right: "72px",
								background: "#1e1e1e",
								border: "1px solid rgba(255, 255, 255, 0.08)",
								borderRadius: "6px",
								boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
								padding: "4px",
								zIndex: 100,
								minWidth: "155px",
							}}
						>
							{SHELL_OPTIONS.map((opt) => (
								<div
									key={opt.id}
									onClick={() => addTab(opt.shell as ShellType, opt.label)}
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										padding: "6px 12px",
										borderRadius: "4px",
										cursor: "pointer",
										color: "#ccc",
										fontSize: "11px",
										transition: "all 0.1s ease"
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
										e.currentTarget.style.color = "#fff";
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = "transparent";
										e.currentTarget.style.color = "#ccc";
									}}
								>
									<span>{opt.label}</span>
									<span style={{ opacity: 0.5, fontSize: '9px', marginLeft: '8px' }}>{opt.shortcut}</span>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Main Viewport */}
			<div
				style={{
					flex: 1,
					padding:
						activePane === "terminal" ? "8px 4px 80px" : "0 0 80px",
					overflow: "hidden",
					position: "relative",
				}}
				data-context-type="terminal-workspace"
			>
				{activePane === "problems" && renderProblems()}
				{activePane === "output" && renderEmpty("Output")}
				{activePane === "debug" && renderEmpty("Debug Console")}
				{activePane === "ports" && renderEmpty("Ports")}

				{activePane === "terminal" &&
					(tabs.length === 0 ? (
						<div
							style={{
								display: "flex",
								height: "100%",
								alignItems: "center",
								justifyContent: "center",
								color: "#666",
								fontSize: "13px",
							}}
						>
							No active terminal sessions.
						</div>
					) : (
						tabs.map((tab) => (
							<XTermInstance
								key={tab.id}
								tab={tab}
								isActive={activeTabId === tab.id}
							/>
						))
					))}
			</div>
		</div>
	);
}
