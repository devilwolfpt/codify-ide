import { useRef, useEffect, useCallback } from "react";
import Editor, { Monaco, loader } from "@monaco-editor/react";
import { X } from "lucide-react";
import * as monacoEditor from "monaco-editor";

// Import Web Workers using Vite's ?worker syntax
// These use the REAL prettier and eslint packages — same engines as VS Code extensions
import PrettierWorker from "../workers/prettier.worker.ts?worker";
// ESLint worker disabled due to Node.js dependencies incompatible with Web Workers
// import ESLintWorker from '../workers/eslint.worker.ts?worker'
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

loader.config({ monaco: monacoEditor as any });

if (typeof window !== "undefined") {
	const globalWindow = window as any;
	if (!globalWindow.MonacoEnvironment) {
		globalWindow.MonacoEnvironment = {
			getWorker(_: unknown, label: string) {
				switch (label) {
					case "json":
						return new JsonWorker();
					case "css":
					case "scss":
					case "less":
						return new CssWorker();
					case "html":
					case "handlebars":
					case "razor":
						return new HtmlWorker();
					case "typescript":
					case "javascript":
						return new TsWorker();
					default:
						return new EditorWorker();
				}
			},
		};
	}
}

interface CodeEditorProps {
	tabs: { id: string; name: string }[];
	activeTab: string;
	content: string;
	language: string;
	onSelectTab: (id: string) => void;
	onCloseTab: (id: string) => void;
	onChange: (value: string) => void;
	onCloseEditor?: () => void;
	dirtyFiles?: string[];
}

interface ExtensionState {
	id: string;
	installed: boolean;
	enabled: boolean;
}

// Singleton workers — created once, reused for all format/lint requests
let prettierWorkerInstance: Worker | null = null;
// let eslintWorkerInstance: Worker | null = null

function getPrettierWorker(): Worker {
	if (!prettierWorkerInstance) {
		prettierWorkerInstance = new PrettierWorker();
	}
	return prettierWorkerInstance;
}

// function getESLintWorker(): Worker {
//   if (!eslintWorkerInstance) {
//     eslintWorkerInstance = new ESLintWorker()
//   }
//   return eslintWorkerInstance
// }

export function CodeEditor({
	tabs,
	activeTab,
	content,
	language,
	onSelectTab,
	onCloseTab,
	onChange,
	onCloseEditor,
	dirtyFiles = [],
}: CodeEditorProps) {
	const editorRef = useRef<any>(null);
	const monacoRef = useRef<Monaco | null>(null);
	const gitlensDecorationsRef = useRef<string[]>([]);
	const activeExtsRef = useRef<ExtensionState[]>([]);
	// ESLint linting disabled — commented out unused refs
	// const lintDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const requestIdRef = useRef(0); // Still needed for Prettier

	// ─── Extension State ────────────────────────────────────────────────────────

	const refreshActiveExtensions = useCallback(() => {
		try {
			const saved = localStorage.getItem("codify-extensions-list");
			if (saved) activeExtsRef.current = JSON.parse(saved);
			else activeExtsRef.current = [];
		} catch {
			activeExtsRef.current = [];
		}
	}, []);

	const isExtActive = useCallback(
		(id: string) =>
			activeExtsRef.current.some(
				(e) => e.id === id && e.installed && e.enabled,
			),
		[],
	);

	useEffect(() => {
		refreshActiveExtensions();
		const poll = setInterval(refreshActiveExtensions, 800);
		return () => clearInterval(poll);
	}, [refreshActiveExtensions]);

	// ─── Real ESLint (via Web Worker) ──────────────────────────────────────────
	// ESLint linting disabled due to Web Worker compatibility issues with Node.js dependencies

	useEffect(() => {
		const triggerMonaco = (actionId: string) => {
			if (editorRef.current) {
				editorRef.current.focus();
				const action = editorRef.current.getAction(actionId);
				if (action) {
					action.run();
				} else {
					editorRef.current.trigger("editor", actionId, null);
				}
			}
		};

		const handleFormat = () =>
			triggerMonaco("editor.action.formatDocument");
		const handleFormatWith = () =>
			triggerMonaco("editor.action.formatDocument.multiple");
		const handleCommandPalette = () =>
			triggerMonaco("editor.action.quickCommand");
		const handleGotoDefinition = () =>
			triggerMonaco("editor.action.revealDefinition");
		const handleGotoTypeDefinition = () =>
			triggerMonaco("editor.action.goToTypeDefinition");
		const handleGotoSourceDefinition = () =>
			triggerMonaco("editor.action.goToDeclaration");
		const handleGotoImplementation = () =>
			triggerMonaco("editor.action.goToImplementation");
		const handleGotoReferences = () =>
			triggerMonaco("editor.action.referenceSearch.trigger");
		const handlePeekDefinition = () =>
			triggerMonaco("editor.action.peekDefinition");
		const handlePeekReferences = () =>
			triggerMonaco("editor.action.peekReferences");
		const handleFindReferences = () =>
			triggerMonaco("editor.action.referenceSearch.trigger");
		const handleFindImplementations = () =>
			triggerMonaco("editor.action.peekImplementation");
		const handleCallHierarchy = () =>
			triggerMonaco("editor.action.showCallHierarchy");
		const handleRenameSymbol = () => triggerMonaco("editor.action.rename");
		const handleChangeOccurrences = () =>
			triggerMonaco("editor.action.changeAll");
		const handleRefactor = () => triggerMonaco("editor.action.refactor");
		const handleSourceAction = () =>
			triggerMonaco("editor.action.sourceAction");
		const handleCut = () => {
			if (editorRef.current) {
				editorRef.current.focus();
				const selection = editorRef.current.getSelection();
				const text = editorRef.current
					.getModel()
					?.getValueInRange(selection);
				if (text) {
					navigator.clipboard.writeText(text).then(() => {
						editorRef.current.executeEdits("clipboard", [
							{
								range: selection,
								text: "",
								forceMoveMarkers: true,
							},
						]);
					});
				}
			}
		};
		const handleCopy = () => {
			if (editorRef.current) {
				editorRef.current.focus();
				const selection = editorRef.current.getSelection();
				const text = editorRef.current
					.getModel()
					?.getValueInRange(selection);
				if (text) {
					navigator.clipboard.writeText(text);
				}
			}
		};
		const handlePaste = () => {
			if (editorRef.current) {
				editorRef.current.focus();
				navigator.clipboard
					.readText()
					.then((text) => {
						if (text) {
							const selection = editorRef.current.getSelection();
							editorRef.current.executeEdits("clipboard", [
								{
									range: selection,
									text: text,
									forceMoveMarkers: true,
								},
							]);
						}
					})
					.catch(() => {
						triggerMonaco("editor.action.clipboardPasteAction");
					});
			}
		};
		const handleFold = () => triggerMonaco("editor.action.fold");
		const handleUnfold = () => triggerMonaco("editor.action.unfold");

		const handleExplain = () => {
			if (editorRef.current) {
				const selection = editorRef.current.getSelection();
				const selectedText = editorRef.current
					.getModel()
					?.getValueInRange(selection);
				if (selectedText) {
					window.dispatchEvent(
						new CustomEvent("send-to-agent", {
							detail: {
								text: `Explica o seguinte pedaço de código:\n\`\`\`tsx\n${selectedText}\n\`\`\``,
							},
						}),
					);
				} else {
					const allText = editorRef.current.getValue();
					window.dispatchEvent(
						new CustomEvent("send-to-agent", {
							detail: {
								text: `Explica o código completo deste ficheiro:\n\`\`\`tsx\n${allText}\n\`\`\``,
							},
						}),
					);
				}
			}
		};

		const handleOptimize = () => {
			if (editorRef.current) {
				const selection = editorRef.current.getSelection();
				const selectedText = editorRef.current
					.getModel()
					?.getValueInRange(selection);
				if (selectedText) {
					window.dispatchEvent(
						new CustomEvent("send-to-agent", {
							detail: {
								text: `Optimiza este pedaço de código, aplicando boas práticas e explicando as correções:\n\`\`\`tsx\n${selectedText}\n\`\`\``,
							},
						}),
					);
				} else {
					const allText = editorRef.current.getValue();
					window.dispatchEvent(
						new CustomEvent("send-to-agent", {
							detail: {
								text: `Optimiza o código completo deste ficheiro:\n\`\`\`tsx\n${allText}\n\`\`\``,
							},
						}),
					);
				}
			}
		};

		window.addEventListener("editor-format", handleFormat);
		window.addEventListener("editor-format-with", handleFormatWith);
		window.addEventListener("editor-explain-code", handleExplain);
		window.addEventListener("editor-optimize-code", handleOptimize);
		window.addEventListener("editor-command-palette", handleCommandPalette);
		window.addEventListener("editor-goto-definition", handleGotoDefinition);
		window.addEventListener(
			"editor-goto-type-definition",
			handleGotoTypeDefinition,
		);
		window.addEventListener(
			"editor-goto-source-definition",
			handleGotoSourceDefinition,
		);
		window.addEventListener(
			"editor-goto-implementation",
			handleGotoImplementation,
		);
		window.addEventListener("editor-goto-references", handleGotoReferences);
		window.addEventListener("editor-peek-definition", handlePeekDefinition);
		window.addEventListener("editor-peek-references", handlePeekReferences);
		window.addEventListener("editor-find-references", handleFindReferences);
		window.addEventListener(
			"editor-find-implementations",
			handleFindImplementations,
		);
		window.addEventListener("editor-call-hierarchy", handleCallHierarchy);
		window.addEventListener("editor-rename-symbol", handleRenameSymbol);
		window.addEventListener(
			"editor-change-occurrences",
			handleChangeOccurrences,
		);
		window.addEventListener("editor-refactor", handleRefactor);
		window.addEventListener("editor-source-action", handleSourceAction);
		window.addEventListener("editor-cut", handleCut);
		window.addEventListener("editor-copy", handleCopy);
		window.addEventListener("editor-paste", handlePaste);
		window.addEventListener("editor-fold", handleFold);
		window.addEventListener("editor-unfold", handleUnfold);

		return () => {
			window.removeEventListener("editor-format", handleFormat);
			window.removeEventListener("editor-format-with", handleFormatWith);
			window.removeEventListener("editor-explain-code", handleExplain);
			window.removeEventListener("editor-optimize-code", handleOptimize);
			window.removeEventListener(
				"editor-command-palette",
				handleCommandPalette,
			);
			window.removeEventListener(
				"editor-goto-definition",
				handleGotoDefinition,
			);
			window.removeEventListener(
				"editor-goto-type-definition",
				handleGotoTypeDefinition,
			);
			window.removeEventListener(
				"editor-goto-source-definition",
				handleGotoSourceDefinition,
			);
			window.removeEventListener(
				"editor-goto-implementation",
				handleGotoImplementation,
			);
			window.removeEventListener(
				"editor-goto-references",
				handleGotoReferences,
			);
			window.removeEventListener(
				"editor-peek-definition",
				handlePeekDefinition,
			);
			window.removeEventListener(
				"editor-peek-references",
				handlePeekReferences,
			);
			window.removeEventListener(
				"editor-find-references",
				handleFindReferences,
			);
			window.removeEventListener(
				"editor-find-implementations",
				handleFindImplementations,
			);
			window.removeEventListener(
				"editor-call-hierarchy",
				handleCallHierarchy,
			);
			window.removeEventListener(
				"editor-rename-symbol",
				handleRenameSymbol,
			);
			window.removeEventListener(
				"editor-change-occurrences",
				handleChangeOccurrences,
			);
			window.removeEventListener("editor-refactor", handleRefactor);
			window.removeEventListener(
				"editor-source-action",
				handleSourceAction,
			);
			window.removeEventListener("editor-cut", handleCut);
			window.removeEventListener("editor-copy", handleCopy);
			window.removeEventListener("editor-paste", handlePaste);
			window.removeEventListener("editor-fold", handleFold);
			window.removeEventListener("editor-unfold", handleUnfold);
		};
	}, []);

	// ─── GitLens Blame Annotations ─────────────────────────────────────────────

	const updateGitLensBlame = useCallback(
		(lineNumber: number) => {
			const editor = editorRef.current;
			const monaco = monacoRef.current;
			if (!editor || !monaco) return;

			if (!isExtActive("eamodio.gitlens")) {
				gitlensDecorationsRef.current = editor.deltaDecorations(
					gitlensDecorationsRef.current,
					[],
				);
				return;
			}

			// In a real local app with git access (Tauri/Electron), you'd call
			// isomorphic-git here. In the browser, we show context-aware annotations
			// based on the active file and simulated commit data.
			const blameMessages = [
				"You, just now • Unsaved changes",
				"You, 2 minutes ago • Initial commit",
				"You, 5 minutes ago • Refactor editor setup",
				"You, 12 minutes ago • Add extension host layer",
			];
			const blame = blameMessages[lineNumber % blameMessages.length];

			gitlensDecorationsRef.current = editor.deltaDecorations(
				gitlensDecorationsRef.current,
				[
					{
						range: new monaco.Range(lineNumber, 1, lineNumber, 1),
						options: {
							isWholeLine: true,
							after: {
								content: `   ${blame}`,
								inlineClassName: "gitlens-blame-decoration",
							},
						},
					},
				],
			);
		},
		[isExtActive],
	);

	// ─── Monaco onMount: register ALL providers ─────────────────────────────────

	const handleEditorMount = useCallback(
		(editor: any, monaco: Monaco) => {
			editorRef.current = editor;
			monacoRef.current = monaco;

			// Register Custom Context Menu Actions directly inside Monaco
			editor.addAction({
				id: "explain-selection",
				label: "AI: Explain Code with Agent",
				contextMenuGroupId: "1_modification",
				contextMenuOrder: 1.5,
				run: (ed: any) => {
					const selection = ed.getSelection();
					const selectedText = ed
						.getModel()
						?.getValueInRange(selection);
					if (selectedText) {
						window.dispatchEvent(
							new CustomEvent("send-to-agent", {
								detail: {
									text: `Explica o seguinte pedaço de código:\n\`\`\`tsx\n${selectedText}\n\`\`\``,
								},
							}),
						);
					} else {
						const allText = ed.getValue();
						window.dispatchEvent(
							new CustomEvent("send-to-agent", {
								detail: {
									text: `Explica o código completo deste ficheiro:\n\`\`\`tsx\n${allText}\n\`\`\``,
								},
							}),
						);
					}
				},
			});

			editor.addAction({
				id: "optimize-code",
				label: "AI: Optimize Code with Agent",
				contextMenuGroupId: "1_modification",
				contextMenuOrder: 1.6,
				run: (ed: any) => {
					const selection = ed.getSelection();
					const selectedText = ed
						.getModel()
						?.getValueInRange(selection);
					if (selectedText) {
						window.dispatchEvent(
							new CustomEvent("send-to-agent", {
								detail: {
									text: `Optimiza este pedaço de código, aplicando boas práticas e explicando as correções:\n\`\`\`tsx\n${selectedText}\n\`\`\``,
								},
							}),
						);
					} else {
						const allText = ed.getValue();
						window.dispatchEvent(
							new CustomEvent("send-to-agent", {
								detail: {
									text: `Optimiza o código completo deste ficheiro:\n\`\`\`tsx\n${allText}\n\`\`\``,
								},
							}),
						);
					}
				},
			});

			editor.addAction({
				id: "generate-tests",
				label: "AI: Generate Unit Tests",
				contextMenuGroupId: "1_modification",
				contextMenuOrder: 1.7,
				run: (ed: any) => {
					const selection = ed.getSelection();
					const selectedText = ed
						.getModel()
						?.getValueInRange(selection);
					const textToUse = selectedText || ed.getValue();
					window.dispatchEvent(
						new CustomEvent("send-to-agent", {
							detail: {
								text: `Escreve testes unitários completos em Vitest/Jest para o seguinte código:\n\`\`\`tsx\n${textToUse}\n\`\`\``,
							},
						}),
					);
				},
			});

			editor.addAction({
				id: "document-code",
				label: "AI: Document Code (JSDoc)",
				contextMenuGroupId: "1_modification",
				contextMenuOrder: 1.8,
				run: (ed: any) => {
					const selection = ed.getSelection();
					const selectedText = ed
						.getModel()
						?.getValueInRange(selection);
					const textToUse = selectedText || ed.getValue();
					window.dispatchEvent(
						new CustomEvent("send-to-agent", {
							detail: {
								text: `Adiciona comentários explicativos JSDoc ao seguinte código:\n\`\`\`tsx\n${textToUse}\n\`\`\``,
							},
						}),
					);
				},
			});

			editor.addAction({
				id: "git-blame",
				label: "Git: Git Blame Current Line",
				contextMenuGroupId: "9_cutcopypaste",
				contextMenuOrder: 2.0,
				run: (ed: any) => {
					const position = ed.getPosition();
					if (position) {
						const lineNumber = position.lineNumber;
						const blameMessages = [
							"You, just now • Unsaved changes",
							"You, 2 minutes ago • Initial commit",
							"You, 5 minutes ago • Refactor editor setup",
							"You, 12 minutes ago • Add extension host layer",
						];
						const blame =
							blameMessages[lineNumber % blameMessages.length];
						alert(`Linha ${lineNumber}: ${blame}`);
					}
				},
			});

			// ── 1. Real Prettier Formatting Provider ──────────────────────────────────
			// When extension is enabled: uses the REAL prettier.format() in a worker
			// Same behavior as installing "Prettier - Code formatter" in VS Code
			monaco.languages.registerDocumentFormattingEditProvider(language, {
				async provideDocumentFormattingEdits(model: any) {
					if (!isExtActive("esbenp.prettier-vscode")) return [];

					return new Promise((resolve) => {
						const requestId = ++requestIdRef.current;
						const worker = getPrettierWorker();

						const handler = (event: MessageEvent) => {
							if (event.data.requestId !== requestId) return;
							worker.removeEventListener("message", handler);

							if (event.data.error) {
								// Prettier parse error — don't format, show nothing
								resolve([]);
							} else {
								resolve([
									{
										range: model.getFullModelRange(),
										text: event.data.code,
									},
								]);
							}
						};

						worker.addEventListener("message", handler);
						worker.postMessage({
							type: "format",
							code: model.getValue(),
							language,
							requestId,
						});
					});
				},
			});

			// ── 2. Disable Monaco's built-in TS/JS validator (ESLint will handle it) ──
			// Same as what the VS Code ESLint extension does on activation
			monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
				{
					noSemanticValidation: false, // keep semantic: helpful for types
					noSyntaxValidation: false, // keep syntax: catches parse errors
				},
			);

			// ── 3. GitHub Copilot-style Inline Completions ────────────────────────────
			// Copilot is proprietary — we provide intelligent local completions
			// triggered by the same gestures (pause after typing)
			monaco.languages.registerInlineCompletionsProvider(language, {
				provideInlineCompletions(model: any, position: any) {
					if (!isExtActive("github.copilot")) return { items: [] };

					const line = model.getLineContent(position.lineNumber);
					const before = line
						.substring(0, position.column - 1)
						.trim();
					const fullText: string = model.getValue();
					const items: any[] = [];

					// Smart context-aware completions
					const triggers: [string | RegExp, string][] = [
						[
							"import React",
							", { useState, useEffect } from 'react'",
						],
						[
							/^import \{[^}]*$/,
							" useState, useEffect } from 'react'",
						],
						["const [loading", ", setLoading] = useState(false)"],
						["const [data", ", setData] = useState(null)"],
						[
							"const [error",
							", setError] = useState<string | null>(null)",
						],
						["const [count", ", setCount] = useState(0)"],
						[
							"useEffect(() =>",
							" {\n  // fetch data or side effect\n}, [])",
						],
						[
							/^async function fetch/,
							`Data() {\n  try {\n    const res = await fetch('/api/data')\n    const json = await res.json()\n    return json\n  } catch (err) {\n    console.error(err)\n  }\n}`,
						],
						[
							/^interface [A-Z]\w+ \{?$/,
							fullText.includes("interface")
								? "\n  id: string\n  name: string\n  createdAt: Date\n}"
								: "",
						],
						["console.l", "og('debug:', value)"],
						[
							"for (let i",
							" = 0; i < arr.length; i++) {\n  console.log(arr[i])\n}",
						],
						[/^const \w+ = \(\) =>$/, " {\n  return null\n}"],
						[
							"try {",
							"\n  // code\n} catch (err) {\n  console.error(err)\n}",
						],
					];

					for (const [trigger, completion] of triggers) {
						const matched =
							typeof trigger === "string"
								? before.startsWith(trigger) ||
									before === trigger
								: trigger.test(before);

						if (
							matched &&
							typeof completion === "string" &&
							completion
						) {
							items.push({
								insertText: completion,
								range: new monaco.Range(
									position.lineNumber,
									position.column,
									position.lineNumber,
									position.column,
								),
							});
							break;
						}
					}

					return { items };
				},
				freeInlineCompletions() {},
			});

			// ── 4. GitLens Blame on cursor move ──────────────────────────────────────
			editor.onDidChangeCursorPosition((e: any) => {
				updateGitLensBlame(e.position.lineNumber);
			});

			// Initial run
			// ESLint linting disabled
			// runRealESLint(content, language)
		},
		[language, isExtActive, updateGitLensBlame, content],
	);

	if (tabs.length === 0) {
		return (
			<div className="code-editor">
				<div className="editor-tabs">
					{onCloseEditor && (
						<button
							type="button"
							className="editor-close-btn"
							onClick={onCloseEditor}
							aria-label="Fechar editor"
							title="Fechar editor"
						>
							<X size={16} />
						</button>
					)}
				</div>
				<div className="editor-empty">
					<p>Abre um ficheiro no explorador</p>
					<span>Ctrl+P para pesquisar</span>
				</div>
			</div>
		);
	}

	return (
		<div className="code-editor">
			<div className="editor-tabs">
				{tabs.map((tab) => (
					<div
						key={tab.id}
						role="tab"
						tabIndex={0}
						className={`editor-tab ${tab.id === activeTab ? "active" : ""} ${dirtyFiles.includes(tab.id) ? "dirty" : ""}`}
						data-context-type="editor-tab"
						data-tab-id={tab.id}
						onClick={() => onSelectTab(tab.id)}
						onKeyDown={(e) =>
							e.key === "Enter" && onSelectTab(tab.id)
						}
					>
						<span>{tab.name}</span>
						{dirtyFiles.includes(tab.id) && (
							<span
								className="tab-dirty-dot"
								title="Alterações não salvas"
							/>
						)}
						<button
							type="button"
							className="tab-close"
							onClick={(e) => {
								e.stopPropagation();
								onCloseTab(tab.id);
							}}
							aria-label={`Fechar ${tab.name}`}
						>
							<X size={14} />
						</button>
					</div>
				))}
				{onCloseEditor && (
					<button
						type="button"
						className="editor-close-btn"
						onClick={onCloseEditor}
						aria-label="Fechar editor"
						title="Fechar editor"
					>
						<X size={16} />
					</button>
				)}
			</div>

			<div className="editor-body" data-context-type="editor">
				<Editor
					height="100%"
					language={language}
					value={content}
					onChange={(v) => onChange(v ?? "")}
					theme="vs-dark"
					onMount={handleEditorMount}
					options={{
						fontSize: 13,
						fontFamily: "JetBrains Mono, Consolas, monospace",
						minimap: { enabled: true },
						contextmenu: false,
						scrollBeyondLastLine: false,
						padding: { top: 12 },
						wordWrap: "on",
						automaticLayout: true,
						tabSize: 2,
						formatOnPaste: true,
						formatOnType: false,
						bracketPairColorization: { enabled: true },
						// Enable ghost text (inline suggestions — Copilot style)
						inlineSuggest: { enabled: true, showToolbar: "always" },
						// Enable code lens (GitLens uses this too)
						codeLens: true,
						// Lightbulb for quick fixes (ESLint suggestions)
						lightbulb: { enabled: "on" as any },
					}}
				/>
			</div>
		</div>
	);
}
