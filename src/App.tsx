import {
	useState,
	useEffect,
	useCallback,
	useMemo,
	useLayoutEffect,
} from "react";
import "./App.css";
import "./styles/settings.css";
import type { NavView, BottomPanel, ChatHistoryEntry } from "./types";
import { useFileSystem } from "./hooks/useFileSystem";
import { useAgent } from "./hooks/useAgent";
import { usePersisted } from "./hooks/usePersisted";
import { Sidebar } from "./components/Sidebar";
import { TopMenuBar } from "./components/TopMenuBar";
import { BottomBar } from "./components/BottomBar";
import { CodeEditor } from "./components/CodeEditor";
import { ExplorerPane } from "./components/ExplorerPane";
import { AgentPanel } from "./components/AgentPanel";
import { Terminal } from "./components/Terminal";
import { BrowserPreview } from "./components/BrowserPreview";
import { HomePanel } from "./components/panels/HomePanel";
import { HistoryPanel } from "./components/panels/HistoryPanel";
import { MemoryPanel } from "./components/panels/MemoryPanel";
import { SessionsPanel } from "./components/panels/SessionsPanel";
import { SecretsPanel } from "./components/panels/SecretsPanel";
import { DatabasePanel } from "./components/panels/DatabasePanel";
import { AuthPanel } from "./components/panels/AuthPanel";
import { ExtensionsPanel } from "./components/panels/ExtensionsPanel";
import {
	FilePlus,
	FolderPlus,
	Trash2,
	Copy,
	FolderOpen,
	RefreshCw,
	Eye,
	Bot,
	Settings,
	Terminal as TerminalIcon,
	Code,
	Layout,
	XCircle,
	Plus,
	ChevronRight,
} from "lucide-react";
import {
	DEFAULT_SECRETS,
	DEFAULT_TABLES,
	DEFAULT_SESSIONS,
	DEFAULT_MEMORIES,
	DEFAULT_TASKS,
} from "./data/defaults";

function useIsMobile() {
	const [mobile, setMobile] = useState(() =>
		typeof window !== "undefined" ? window.innerWidth < 768 : false,
	);
	useEffect(() => {
		const onResize = () => setMobile(window.innerWidth < 768);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);
	return mobile;
}

export default function App() {
	const isMobile = useIsMobile();
	const [navView, setNavView] = useState<NavView>(() =>
		typeof window !== "undefined" && window.innerWidth < 768
			? "home"
			: "agent",
	);
	const [bottomPanel, setBottomPanel] = useState<BottomPanel>("agent");
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [explorerOpen, setExplorerOpen] = useState(true);
	const [searchOpen, setSearchOpen] = useState(false);
	const [editorOpen, setEditorOpen] = useState(false);
	const [sidebarWidth, setSidebarWidth] = usePersisted(
		"codify-sidebar-width",
		220,
	);
	const [primaryPercent, setPrimaryPercent] = usePersisted(
		"codify-primary-percent",
		42,
	);
	const [explorerWidth, setExplorerWidth] = usePersisted(
		"codify-explorer-width",
		220,
	);
	const [_carouselOpen, _setCarouselOpen] = useState(
		() => typeof window !== "undefined" && window.innerWidth < 768,
	);

	const fs = useFileSystem();

	const [secrets, setSecrets] = usePersisted(
		"codify-secrets",
		DEFAULT_SECRETS,
	);
	const [chatHistory, setChatHistory] = usePersisted<ChatHistoryEntry[]>(
		"codify-chat-history",
		[],
	);

	// Ensure all DEFAULT_SECRETS keys are present (migration: adds GROQ_API_KEY if missing)
	useEffect(() => {
		const hasAll = DEFAULT_SECRETS.every((def) =>
			secrets.some((s) => s.key === def.key),
		);
		if (!hasAll) {
			const merged = [...secrets];
			for (const def of DEFAULT_SECRETS) {
				if (!merged.some((s) => s.key === def.key)) {
					merged.push({ ...def });
				}
			}
			setSecrets(merged);
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps
	const [tables, setTables] = usePersisted("codify-db", DEFAULT_TABLES);
	const [sessions, setSessions] = usePersisted(
		"codify-sessions",
		DEFAULT_SESSIONS,
	);
	const [memories, setMemories] = usePersisted(
		"codify-memories",
		DEFAULT_MEMORIES,
	);
	const [tasks] = usePersisted("codify-tasks", DEFAULT_TASKS);

	const handleFileOperation = useCallback(
		(
			type: "file" | "folder" | "command",
			path: string,
			content?: string,
		) => {
			if (type === "file" || type === "folder") {
				fs.syncFileSystemNode(type, path, content);
			}
		},
		[fs],
	);

	const { messages, isThinking, sendMessage, stopResponse, setMessages } =
		useAgent(handleFileOperation, fs.activeFile?.name, secrets);

	const startNewChat = useCallback(() => {
		if (messages.length > 0) {
			const historyItem = {
				id: `hist-${Date.now()}`,
				timestamp: Date.now(),
				messages: [...messages],
				title:
					messages[0].content.slice(0, 40) +
					(messages[0].content.length > 40 ? "..." : ""),
			};
			setChatHistory((prev) => [historyItem, ...prev]);
			setMessages([]);
		}
	}, [messages, setChatHistory, setMessages]);

	// Move old chat to history and clear it when the app starts
	useEffect(() => {
		startNewChat();
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const handleSend = useCallback(
		(
			text: string,
			planMode: boolean,
			attachedFile?: { id: string; name: string } | null,
			provider?: string,
			options?: {
				apiKeys?: { openai?: string; groq?: string; gemini?: string };
				ollamaHost?: string;
			},
		) => {
			const finalText = attachedFile
				? `[Ficheiro: ${attachedFile.name}]\n${text}`
				: text;
			sendMessage(finalText, planMode, provider, options);
		},
		[sendMessage],
	);

	useEffect(() => {
		const handleSendToAgent = (e: Event) => {
			const customEvent = e as CustomEvent<{ text: string }>;
			if (customEvent.detail?.text) {
				setBottomPanel("agent");
				setNavView("agent");
				sendMessage(customEvent.detail.text, false);
			}
		};
		window.addEventListener("send-to-agent", handleSendToAgent);
		return () =>
			window.removeEventListener("send-to-agent", handleSendToAgent);
	}, [sendMessage, setBottomPanel, setNavView]);

	// Close editor panel when all tabs are closed
	useEffect(() => {
		if (fs.openTabs.length === 0 && editorOpen) {
			setEditorOpen(false);
		}
	}, [fs.openTabs, editorOpen]);

	const [contextMenu, setContextMenu] = useState<{
		visible: boolean;
		x: number;
		y: number;
		items: (
			| {
					label: string;
					icon?: React.ReactNode;
					onClick?: () => void;
					shortcut?: string;
					divider?: false;
					disabled?: boolean;
					color?: string;
					category?: string;
					submenu?: {
						label: string;
						onClick: () => void;
						icon?: React.ReactNode;
					}[];
			  }
			| {
					divider: true;
					label?: never;
					icon?: never;
					onClick?: never;
					shortcut?: never;
					disabled?: never;
					color?: never;
					category?: never;
					submenu?: never;
			  }
		)[];
	}>({ visible: false, x: 0, y: 0, items: [] });

	useLayoutEffect(() => {
		if (contextMenu.visible) {
			const menuEl = document.getElementById("custom-context-menu");
			if (menuEl) {
				const height = menuEl.offsetHeight;
				const width = menuEl.offsetWidth;
				let adjustedX = contextMenu.x;
				let adjustedY = contextMenu.y;

				// Check horizontal overflow
				if (contextMenu.x + width > window.innerWidth) {
					adjustedX = window.innerWidth - width - 8;
				}
				// Check vertical overflow
				if (contextMenu.y + height > window.innerHeight) {
					adjustedY = window.innerHeight - height - 8;
				}

				adjustedX = Math.max(8, adjustedX);
				adjustedY = Math.max(8, adjustedY);

				const xDiff = Math.abs(adjustedX - contextMenu.x);
				const yDiff = Math.abs(adjustedY - contextMenu.y);
				if (xDiff > 1 || yDiff > 1) {
					setContextMenu((prev) => ({
						...prev,
						x: adjustedX,
						y: adjustedY,
					}));
				}
			}
		}
	}, [contextMenu.visible, contextMenu.x, contextMenu.y]);

	useEffect(() => {
		const handleCloseMenu = () => {
			setContextMenu((prev) =>
				prev.visible ? { ...prev, visible: false } : prev,
			);
		};

		const handleContextMenu = (e: MouseEvent) => {
			let target = e.target as HTMLElement | null;
			let contextType = null;
			let contextData: Record<string, string> = {};

			while (target && target !== document.body) {
				if (target.dataset.contextType) {
					contextType = target.dataset.contextType;
					for (const key in target.dataset) {
						contextData[key] = target.dataset[key] || "";
					}
					break;
				}
				target = target.parentElement;
			}

			e.preventDefault();
			e.stopPropagation();

			const items: typeof contextMenu.items = [];

			if (contextType === "file-node") {
				const nodeId = contextData.nodeId;
				const nodeName = contextData.nodeName;
				const nodeType = contextData.nodeType;

				if (nodeType === "folder") {
					items.push(
						{
							category: "CREATE",
							label: "New File...",
							icon: <FilePlus size={14} />,
							onClick: () => {
								const name = prompt("Nome do novo ficheiro:");
								if (name) fs.createFile(nodeId, name);
							},
						},
						{
							category: "CREATE",
							label: "New Folder...",
							icon: <FolderPlus size={14} />,
							onClick: () => {
								const name = prompt("Nome da nova pasta:");
								if (name) fs.createFolder(nodeId, name);
							},
						},
						{ divider: true },
					);
				} else {
					items.push(
						{
							category: "FILE ACTIONS",
							label: "Open File",
							icon: <FolderOpen size={14} />,
							onClick: () => fs.openFile(nodeId),
						},
						{
							category: "FILE ACTIONS",
							label: "Duplicate File",
							icon: <Copy size={14} />,
							onClick: () => {
								const fileNode = fs.flatFiles.find(
									(f) => f.id === nodeId,
								)?.node;
								if (fileNode && fileNode.type === "file") {
									const ext = nodeName.split(".").pop() ?? "";
									const baseName = nodeName.substring(
										0,
										nodeName.lastIndexOf("."),
									);
									const duplicateName = `${baseName}_copy.${ext}`;
									fs.createFile("root", duplicateName);
									const content = fileNode.content || "";
									setTimeout(() => {
										const dupItem = fs.flatFiles.find((f) =>
											f.path.endsWith(duplicateName),
										);
										if (dupItem)
											fs.updateContent(
												dupItem.id,
												content,
											);
									}, 400);
								}
							},
						},
						{ divider: true },
					);
				}

				items.push(
					{
						category: "REFACTOR / ORGANIZE",
						label: "Rename...",
						icon: <Code size={14} />,
						onClick: () => {
							const newName = prompt(
								"Novo nome para o item:",
								nodeName,
							);
							if (newName && newName !== nodeName) {
								const originalNode = fs.flatFiles.find(
									(f) => f.id === nodeId,
								)?.node;
								if (originalNode) {
									if (originalNode.type === "file") {
										const content =
											originalNode.content || "";
										fs.createFile("root", newName);
										setTimeout(() => {
											const newItem = fs.flatFiles.find(
												(f) => f.path.endsWith(newName),
											);
											if (newItem)
												fs.updateContent(
													newItem.id,
													content,
												);
										}, 400);
										fs.deleteFile(nodeId);
									} else {
										fs.createFolder("root", newName);
										fs.deleteFile(nodeId);
									}
								}
							}
						},
					},
					{
						category: "SYSTEM",
						label: "Copy Name",
						icon: <Copy size={14} />,
						onClick: () => navigator.clipboard.writeText(nodeName),
					},
					{
						category: "SYSTEM",
						label: "Delete",
						icon: <Trash2 size={14} />,
						color: "#ef4444",
						onClick: () => {
							if (
								confirm(
									`Tem a certeza que deseja apagar ${nodeName}?`,
								)
							) {
								fs.deleteFile(nodeId);
							}
						},
					},
				);
			} else if (contextType === "file-tree-body") {
				items.push(
					{
						category: "CREATE",
						label: "New File at Root...",
						icon: <FilePlus size={14} />,
						onClick: () => {
							const name = prompt(
								"Nome do novo ficheiro na raiz:",
							);
							if (name) fs.createFile("root", name);
						},
					},
					{
						category: "CREATE",
						label: "New Folder at Root...",
						icon: <FolderPlus size={14} />,
						onClick: () => {
							const name = prompt("Nome da nova pasta na raiz:");
							if (name) fs.createFolder("root", name);
						},
					},
					{ divider: true },
					{
						category: "WORKSPACE",
						label: "Open Folder Dialog...",
						icon: <FolderOpen size={14} />,
						onClick: () => fs.openFolderDialog(),
					},
				);
			} else if (contextType === "editor") {
				items.push(
					{
						label: "Go to Definition",
						shortcut: "F12",
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("editor-goto-definition"),
							),
					},
					{
						label: "Go to References",
						shortcut: "Shift+F12",
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("editor-goto-references"),
							),
					},
					{
						label: "Peek",
						submenu: [
							{
								label: "Peek Definition",
								onClick: () =>
									window.dispatchEvent(
										new CustomEvent(
											"editor-peek-definition",
										),
									),
							},
							{
								label: "Peek References",
								onClick: () =>
									window.dispatchEvent(
										new CustomEvent(
											"editor-peek-references",
										),
									),
							},
						],
					},
					{ divider: true },
					{
						label: "Find All References",
						shortcut: "Shift+Alt+F12",
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("editor-find-references"),
							),
					},
					{
						label: "Rename Symbol",
						shortcut: "F2",
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("editor-rename-symbol"),
							),
					},
					{
						label: "Change All Occurrences",
						shortcut: "Ctrl+F2",
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("editor-change-occurrences"),
							),
					},
					{
						label: "Format Document",
						shortcut: "Shift+Alt+F",
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("editor-format"),
							),
					},
					{
						label: "Advanced Options",
						submenu: [
							{
								label: "Go to Type Definition",
								onClick: () =>
									window.dispatchEvent(
										new CustomEvent(
											"editor-goto-type-definition",
										),
									),
							},
							{
								label: "Go to Source Definition",
								onClick: () =>
									window.dispatchEvent(
										new CustomEvent(
											"editor-goto-source-definition",
										),
									),
							},
							{
								label: "Go to Implementations",
								onClick: () =>
									window.dispatchEvent(
										new CustomEvent(
											"editor-goto-implementation",
										),
									),
							},
							{
								label: "Find All Implementations",
								onClick: () =>
									window.dispatchEvent(
										new CustomEvent(
											"editor-find-implementations",
										),
									),
							},
							{
								label: "Show Call Hierarchy",
								onClick: () =>
									window.dispatchEvent(
										new CustomEvent(
											"editor-call-hierarchy",
										),
									),
							},
							{
								label: "Format Document With...",
								onClick: () =>
									window.dispatchEvent(
										new CustomEvent("editor-format-with"),
									),
							},
							{
								label: "Refactor...",
								onClick: () =>
									window.dispatchEvent(
										new CustomEvent("editor-refactor"),
									),
							},
							{
								label: "Source Action...",
								onClick: () =>
									window.dispatchEvent(
										new CustomEvent("editor-source-action"),
									),
							},
						],
					},
					{ divider: true },
					{
						label: "Cut",
						shortcut: "Ctrl+X",
						onClick: () =>
							window.dispatchEvent(new CustomEvent("editor-cut")),
					},
					{
						label: "Copy",
						shortcut: "Ctrl+C",
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("editor-copy"),
							),
					},
					{
						label: "Paste",
						shortcut: "Ctrl+V",
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("editor-paste"),
							),
					},
					{ divider: true },
					{
						label: "Command Palette...",
						shortcut: "Ctrl+Shift+P",
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("editor-command-palette"),
							),
					},
				);
			} else if (contextType === "editor-tab") {
				const tabId = contextData.tabId;
				items.push(
					{
						category: "TAB ACTIONS",
						label: "Close Tab",
						icon: <XCircle size={14} />,
						onClick: () => fs.closeTab(tabId),
					},
					{
						category: "TAB ACTIONS",
						label: "Close Other Tabs",
						onClick: () => {
							fs.openTabs.forEach((id) => {
								if (id !== tabId) fs.closeTab(id);
							});
						},
					},
					{
						category: "TAB ACTIONS",
						label: "Close Saved Tabs",
						onClick: () => {
							fs.openTabs.forEach((id) => {
								if (!fs.dirtyFiles.includes(id))
									fs.closeTab(id);
							});
						},
					},
				);
			} else if (
				contextType === "terminal-tab" ||
				contextType === "terminal-tabs"
			) {
				const tabId = contextData.tabId;
				items.push(
					{
						category: "TERMINAL",
						label: "New Terminal",
						icon: <Plus size={14} />,
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("terminal-new-tab"),
							),
					},
					{
						category: "TERMINAL",
						label: "Clear Terminal Output",
						icon: <Trash2 size={14} />,
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("terminal-clear"),
							),
					},
				);
				if (tabId) {
					items.push({
						category: "TERMINAL",
						label: "Close Session",
						icon: <XCircle size={14} />,
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("terminal-close-tab", {
									detail: { id: tabId },
								}),
							),
					});
				}
			} else if (contextType === "terminal-workspace") {
				items.push(
					{
						category: "TERMINAL",
						label: "New Session (PowerShell)",
						icon: <Plus size={14} />,
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("terminal-new-tab"),
							),
					},
					{
						category: "TERMINAL",
						label: "Clear Console",
						icon: <Trash2 size={14} />,
						onClick: () =>
							window.dispatchEvent(
								new CustomEvent("terminal-clear"),
							),
					},
				);
			} else if (contextType === "sidebar") {
				items.push(
					{
						category: "NAVIGATION",
						label: "Show Home View",
						icon: <Eye size={14} />,
						onClick: () => setNavView("home"),
					},
					{
						category: "NAVIGATION",
						label: "Show Agent Chat",
						icon: <Bot size={14} />,
						onClick: () => setNavView("agent"),
					},
					{
						category: "NAVIGATION",
						label: "Show Secrets Config",
						icon: <Settings size={14} />,
						onClick: () => setNavView("secrets"),
					},
					{
						category: "NAVIGATION",
						label: "Show Database Manager",
						icon: <Copy size={14} />,
						onClick: () => setNavView("database"),
					},
				);
			} else {
				items.push(
					{
						category: "WORKSPACE",
						label: "Toggle Sidebar",
						icon: <Layout size={14} />,
						onClick: () => setSidebarOpen((v) => !v),
					},
					{
						category: "WORKSPACE",
						label: "Toggle Terminal panel",
						icon: <TerminalIcon size={14} />,
						onClick: () =>
							setBottomPanel((p) =>
								p === "terminal" ? "agent" : "terminal",
							),
					},
					{ divider: true },
					{
						category: "SYSTEM",
						label: "Reload Workspace",
						icon: <RefreshCw size={14} />,
						onClick: () => window.location.reload(),
					},
				);
			}

			setContextMenu({
				visible: true,
				x: e.clientX,
				y: e.clientY,
				items,
			});
		};

		window.addEventListener("click", handleCloseMenu);
		window.addEventListener("contextmenu", handleContextMenu, true);
		return () => {
			window.removeEventListener("click", handleCloseMenu);
			window.removeEventListener("contextmenu", handleContextMenu, true);
		};
	}, [fs, setBottomPanel, setNavView, setSidebarOpen]);

	const handleBottomChange = useCallback(
		(panel: BottomPanel) => {
			if (panel === "terminal" || panel === "agent" || panel === "web") {
				setBottomPanel(panel);
				if (!isMobile) setNavView("agent");
				if (isMobile) {
					setNavView((n) => (n === "home" ? "home" : "agent"));
					_setCarouselOpen(false);
				}
				return;
			}
			if (panel === "split") {
				setBottomPanel("split");
				_setCarouselOpen((o: boolean) => !o);
				return;
			}
			if (panel === "play") {
				setBottomPanel("terminal");
				if (!isMobile) setNavView("agent");
				setTimeout(() => {
					document.dispatchEvent(
						new CustomEvent("terminal-cmd", {
							detail: "npm run dev",
						}),
					);
				}, 100);
				return;
			}
			setBottomPanel(panel);
			if (panel === "preview") setNavView("home");
		},
		[isMobile],
	);

	const handleSidebarMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const startX = e.clientX;
			const startWidth = sidebarWidth;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const deltaX = moveEvent.clientX - startX;
				let newWidth = startWidth + deltaX;
				if (newWidth < 130) {
					newWidth = 64;
				} else if (newWidth > 400) {
					newWidth = 400;
				}
				setSidebarWidth(newWidth);
				window.dispatchEvent(new Event("resize"));
			};

			const handleMouseUp = () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
				window.dispatchEvent(new Event("resize"));
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		},
		[sidebarWidth, setSidebarWidth],
	);

	const handleResizerMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const startX = e.clientX;
			const container = document.querySelector(".split-container");
			if (!container) return;
			const containerWidth = container.getBoundingClientRect().width;
			const startPercent = primaryPercent;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const deltaX = moveEvent.clientX - startX;
				const deltaPercent = (deltaX / containerWidth) * 100;
				let newPercent = startPercent + deltaPercent;
				if (newPercent < 20) newPercent = 20;
				if (newPercent > 80) newPercent = 80;
				setPrimaryPercent(newPercent);
				window.dispatchEvent(new Event("resize"));
			};

			const handleMouseUp = () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
				window.dispatchEvent(new Event("resize"));
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		},
		[primaryPercent, setPrimaryPercent],
	);

	const handleExplorerMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const startX = e.clientX;
			const startWidth = explorerWidth;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const deltaX = startX - moveEvent.clientX;
				let newWidth = startWidth + deltaX;
				if (newWidth < 150) newWidth = 150;
				if (newWidth > 400) newWidth = 400;
				setExplorerWidth(newWidth);
				window.dispatchEvent(new Event("resize"));
			};

			const handleMouseUp = () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
				window.dispatchEvent(new Event("resize"));
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		},
		[explorerWidth, setExplorerWidth],
	);

	const tabs = useMemo(
		() =>
			fs.openTabs
				.map((id) => {
					const f = fs.flatFiles.find((x) => x.id === id);
					return f ? { id, name: f.node.name } : null;
				})
				.filter(Boolean) as { id: string; name: string }[],
		[fs.openTabs, fs.flatFiles],
	);

	const handleCreateFile = useCallback(() => {
		const name = prompt("Nome do ficheiro:");
		if (name) fs.createFile("root", name);
	}, [fs]);

	const handleCreateFolder = useCallback(() => {
		const name = prompt("Nome da pasta:");
		if (name) fs.createFolder("root", name);
	}, [fs]);

	const handleCarouselSelect = useCallback(
		(id: NavView | "new-tab") => {
			if (id === "new-tab") {
				fs.createFile("root", `untitled-${Date.now()}.ts`);
				setEditorOpen(true);
				_setCarouselOpen(false);
				setNavView("agent");
				setBottomPanel("agent");
				if (isMobile) setExplorerOpen(true);
			} else {
				setNavView(id);
				_setCarouselOpen(false);
				setBottomPanel("agent");
			}
		},
		[fs, isMobile],
	);

	const openFile = useCallback(
		(id: string) => {
			// If the file is an image, open in the preview/browser instead of the code editor
			const f = fs.flatFiles.find((x) => x.id === id);
			const imgExts = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"];
			const ext = f?.path?.split(".").pop()?.toLowerCase();
			if (ext && imgExts.includes(ext)) {
				const path = f?.path || "";
				// dispatch preview-open event with the preview route
				window.dispatchEvent(
					new CustomEvent("preview-open", {
						detail: { url: `/preview/${encodeURIComponent(path)}` },
					}),
				);
				setBottomPanel("web");
				if (isMobile) setExplorerOpen(false);
				return;
			}
			fs.openFile(id);
			setEditorOpen(true);
			if (isMobile) setExplorerOpen(false);
		},
		[fs, isMobile],
	);

	return (
		<div
			className={`app ${isMobile ? "mobile" : "desktop"} ${!sidebarOpen ? "sidebar-hidden" : ""} ${explorerOpen ? "explorer-open" : ""}`}
		>
			<div className="workspace">
				<TopMenuBar
					onCreateFile={handleCreateFile}
					onCreateFolder={handleCreateFolder}
					autoSave={false}
					onToggleAutoSave={() => {}}
					onSaveActiveFile={() => {}}
					onOpenFolder={fs.openFolderDialog}
				/>
				{/* Sidebar toggle */}
				<button
					onClick={() => setSidebarOpen((v) => !v)}
					className="hidden"
				/>
				{/* Terminal toggle */}
				<button
					onClick={() =>
						setBottomPanel((p) =>
							p === "terminal" ? "agent" : "terminal",
						)
					}
					className="hidden"
				/>
				{/* Preview toggle */}
				<button
					onClick={() =>
						setBottomPanel((p) =>
							p === "preview" ? "agent" : "preview",
						)
					}
					className="hidden"
				/>

				<div className="workspace-main">
					{sidebarOpen && !isMobile && (
						<>
							<Sidebar
								active={navView}
								onNavigate={setNavView}
								onNewTab={() => handleCarouselSelect("new-tab")}
								searchOpen={searchOpen}
								onSearchToggle={() => setSearchOpen((v) => !v)}
								explorerOpen={explorerOpen}
								onExplorerToggle={() =>
									setExplorerOpen((v) => !v)
								}
								style={{
									width: sidebarWidth,
									minWidth: sidebarWidth,
								}}
							/>
							<div
								className="sidebar-resizer"
								onMouseDown={handleSidebarMouseDown}
							/>
						</>
					)}

					<div className="content-area">
						<div
							className={`split-container ${editorOpen ? "with-editor" : ""}`}
						>
							<div
								className="primary-column"
								style={{
									width:
										editorOpen && !isMobile
											? `${primaryPercent}%`
											: undefined,
									flex:
										editorOpen && !isMobile
											? "none"
											: undefined,
								}}
							>
								{bottomPanel === "terminal" && !isMobile ? (
									<div className="terminal-workspace">
										<Terminal />
									</div>
								) : bottomPanel === "web" && !isMobile ? (
									<div className="web-workspace">
										<BrowserPreview />
									</div>
								) : (
									<div className="panel-stack">
										{navView === "home" && (
											<HomePanel
												onNavigate={(view) =>
													setNavView(view)
												}
											/>
										)}
										{navView === "history" && (
											<HistoryPanel
												tasks={tasks}
												chatHistory={chatHistory}
											/>
										)}
										{navView === "memory" && (
											<MemoryPanel
												memories={memories}
												onChange={setMemories}
											/>
										)}
										{navView === "sessions" && (
											<SessionsPanel
												sessions={sessions}
												onChange={setSessions}
											/>
										)}
										{navView === "secrets" && (
											<SecretsPanel
												secrets={secrets}
												onChange={setSecrets}
											/>
										)}
										{navView === "database" && (
											<DatabasePanel
												tables={tables}
												onChange={setTables}
											/>
										)}
										{navView === "auth" && (
											<AuthPanel
												secrets={secrets}
												onChangeSecrets={setSecrets}
											/>
										)}
										{navView === "extensions" && (
											<ExtensionsPanel />
										)}
										{navView === "agent" && (
											<div className="agent-section">
												<AgentPanel
													messages={messages}
													isThinking={isThinking}
													onSend={handleSend}
													onStop={stopResponse}
													onNewChat={startNewChat}
													onUploadFile={
														fs.uploadOSFile
													}
												/>
											</div>
										)}
									</div>
								)}
								{!isMobile && (
									<>
										<div className="dock-cradle-mask" />
										<BottomBar
											active={bottomPanel}
											onChange={handleBottomChange}
											mobile={isMobile}
										/>
									</>
								)}
							</div>

							{editorOpen && !isMobile && (
								<div
									className="split-resizer"
									onMouseDown={handleResizerMouseDown}
								/>
							)}

							{editorOpen && (
								<div
									className="editor-section"
									style={{
										marginRight:
											explorerOpen && !isMobile
												? 0
												: undefined,
									}}
								>
									<CodeEditor
										tabs={tabs}
										activeTab={fs.activeTab}
										content={fs.activeFile?.content ?? ""}
										language={
											fs.activeFile?.language ??
											"typescript"
										}
										onSelectTab={openFile}
										onCloseTab={fs.closeTab}
										onChange={(val) =>
											fs.updateContent(fs.activeTab, val)
										}
										onCloseEditor={() =>
											setEditorOpen(false)
										}
										dirtyFiles={fs.dirtyFiles}
									/>
								</div>
							)}
						</div>
					</div>

					{explorerOpen && !isMobile && (
						<>
							<div
								className="explorer-resizer"
								onMouseDown={handleExplorerMouseDown}
							/>
							<ExplorerPane
								nodes={fs.files}
								activeId={fs.activeTab}
								onOpen={openFile}
								onCreateFile={fs.createFile}
								onCreateFolder={fs.createFolder}
								onDelete={fs.deleteFile}
								variant="docked"
								onClose={() => setExplorerOpen(false)}
								onOpenFolder={fs.openFolderDialog}
								style={{
									width: explorerWidth,
									minWidth: explorerWidth,
								}}
							/>
						</>
					)}

					{explorerOpen && isMobile && (
						<>
							<button
								className="explorer-backdrop"
								onClick={() => setExplorerOpen(false)}
							/>
							<ExplorerPane
								nodes={fs.files}
								activeId={fs.activeTab}
								onOpen={openFile}
								onCreateFile={fs.createFile}
								onCreateFolder={fs.createFolder}
								onDelete={fs.deleteFile}
								variant="drawer"
								onClose={() => setExplorerOpen(false)}
								onOpenFolder={fs.openFolderDialog}
							/>
						</>
					)}
				</div>
			</div>

			{contextMenu.visible && (
				<>
					<style>{`
            @keyframes contextMenuFadeIn {
              from {
                opacity: 0;
                transform: scale(0.96) translateY(-4px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
            .context-menu-item {
              position: relative;
            }
          `}</style>
					<div
						id="custom-context-menu"
						style={{
							position: "fixed",
							top: contextMenu.y,
							left: contextMenu.x,
							background: "#252526",
							border: "1px solid #454545",
							borderRadius: "5px",
							boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
							padding: "6px 0",
							zIndex: 999999,
							minWidth: "260px",
							userSelect: "none",
							transformOrigin: "top left",
							animation:
								"contextMenuFadeIn 0.08s cubic-bezier(0.16, 1, 0.3, 1) forwards",
							fontFamily:
								"Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
						}}
					>
						{(() => {
							let lastCategory: string | null = null;
							return contextMenu.items.map((item, idx) => {
								if (item.divider) {
									return (
										<div
											key={idx}
											style={{
												height: "1px",
												background: "#454545",
												margin: "6px 0",
											}}
										/>
									);
								}

								const showCategory =
									item.category &&
									item.category !== lastCategory;
								if (item.category) {
									lastCategory = item.category;
								}

								return (
									<div
										key={idx}
										className="context-menu-item"
										onMouseEnter={(e) => {
											if (item.submenu) {
												const submenuEl =
													e.currentTarget.querySelector(
														".context-submenu",
													) as HTMLElement;
												if (submenuEl) {
													submenuEl.style.display =
														"block";
													submenuEl.style.left =
														"99%";
													submenuEl.style.right =
														"auto";
													submenuEl.style.top =
														"-4px";

													const rect =
														submenuEl.getBoundingClientRect();
													if (
														rect.right >
														window.innerWidth
													) {
														submenuEl.style.left =
															"auto";
														submenuEl.style.right =
															"99%";
													}
													if (
														rect.bottom >
														window.innerHeight
													) {
														const overflow =
															rect.bottom -
															window.innerHeight;
														submenuEl.style.top = `-${overflow + 12}px`;
													}
												}
											}
										}}
										onMouseLeave={(e) => {
											if (item.submenu) {
												const submenuEl =
													e.currentTarget.querySelector(
														".context-submenu",
													) as HTMLElement;
												if (submenuEl) {
													submenuEl.style.display =
														"none";
												}
											}
										}}
									>
										{showCategory && (
											<div
												style={{
													fontSize: "9px",
													fontWeight: 700,
													color: "#858585",
													padding:
														"4px 14px 2px 14px",
													textTransform: "uppercase",
													letterSpacing: "1px",
												}}
											>
												{item.category}
											</div>
										)}
										<div
											onClick={(e) => {
												e.stopPropagation();
												if (item.onClick) {
													item.onClick();
													setContextMenu((prev) => ({
														...prev,
														visible: false,
													}));
												}
											}}
											style={{
												display: "flex",
												alignItems: "center",
												justifyContent: "space-between",
												padding: "6px 14px",
												cursor: "pointer",
												color: item.color || "#cccccc",
												fontSize: "13px",
												fontWeight: 400,
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.background =
													"#04395e";
												e.currentTarget.style.color =
													"#ffffff";
												const shortcutSpan =
													e.currentTarget.querySelector(
														".shortcut-text",
													) as HTMLSpanElement;
												if (shortcutSpan)
													shortcutSpan.style.color =
														"#ffffff";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.background =
													"transparent";
												e.currentTarget.style.color =
													item.color || "#cccccc";
												const shortcutSpan =
													e.currentTarget.querySelector(
														".shortcut-text",
													) as HTMLSpanElement;
												if (shortcutSpan)
													shortcutSpan.style.color =
														"#858585";
											}}
										>
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: item.icon
														? "8px"
														: "0px",
												}}
											>
												{item.icon}
												<span>{item.label}</span>
											</div>
											{item.shortcut && (
												<span
													className="shortcut-text"
													style={{
														color: "#858585",
														fontSize: "12px",
														paddingLeft: "32px",
														fontFamily:
															"Segoe UI, sans-serif",
													}}
												>
													{item.shortcut}
												</span>
											)}
											{item.submenu && (
												<ChevronRight
													size={14}
													style={{
														opacity: 0.6,
														marginLeft: "32px",
													}}
												/>
											)}
										</div>

										{item.submenu && (
											<div
												className="context-submenu"
												style={{
													position: "absolute",
													left: "99%",
													top: "-4px",
													background: "#252526",
													border: "1px solid #454545",
													borderRadius: "5px",
													boxShadow:
														"0 2px 10px rgba(0, 0, 0, 0.5)",
													padding: "6px 0",
													minWidth: "220px",
													display: "none",
													zIndex: 9999999,
												}}
											>
												{item.submenu.map(
													(sub, sidx) => (
														<div
															key={sidx}
															onClick={(e) => {
																e.stopPropagation();
																sub.onClick();
																setContextMenu(
																	(prev) => ({
																		...prev,
																		visible: false,
																	}),
																);
															}}
															style={{
																display: "flex",
																alignItems:
																	"center",
																justifyContent:
																	"space-between",
																padding:
																	"6px 14px",
																cursor: "pointer",
																color: "#cccccc",
																fontSize:
																	"13px",
																fontWeight: 400,
															}}
															onMouseEnter={(
																e,
															) => {
																e.currentTarget.style.background =
																	"#04395e";
																e.currentTarget.style.color =
																	"#ffffff";
															}}
															onMouseLeave={(
																e,
															) => {
																e.currentTarget.style.background =
																	"transparent";
																e.currentTarget.style.color =
																	"#cccccc";
															}}
														>
															<div
																style={{
																	display:
																		"flex",
																	alignItems:
																		"center",
																	gap: sub.icon
																		? "8px"
																		: "0px",
																}}
															>
																{sub.icon}
																<span>
																	{sub.label}
																</span>
															</div>
														</div>
													),
												)}
											</div>
										)}
									</div>
								);
							});
						})()}
					</div>
				</>
			)}
		</div>
	);
}
