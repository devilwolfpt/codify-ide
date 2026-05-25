import { useCallback, useState, useRef } from "react";
import type { ChatMessage, SecretEntry } from "../types";
import { WELCOME_MESSAGES } from "../data/defaults";
import { usePersisted } from "./usePersisted";

export function useAgent(
	onFileOperation?: (
		type: "file" | "folder" | "command",
		path: string,
		content?: string,
	) => void,
	activeFileName?: string,
	secrets?: SecretEntry[],
) {
	const [messages, setMessages] = usePersisted<ChatMessage[]>(
		"codify-chat",
		WELCOME_MESSAGES,
	);
	const [isThinking, setIsThinking] = useState(false);
	const abortControllerRef = useRef<AbortController | null>(null);

	const stopResponse = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		setIsThinking(false);
	}, []);

	const sendMessage = useCallback(
		async (
			content: string,
			planMode: boolean,
			provider?: string,
			options?: {
				apiKeys?: { openai?: string; groq?: string; gemini?: string };
				ollamaHost?: string;
			},
		) => {
			const userMsg: ChatMessage = {
				id: `msg-${Date.now()}`,
				role: "user",
				content: planMode ? `[Plan] ${content}` : content,
				timestamp: Date.now(),
			};
			setMessages((m) => [...m, userMsg]);
			setIsThinking(true);

			const openaiApiKey =
				options?.apiKeys?.openai ||
				secrets?.find((s) => s.key === "OPENAI_API_KEY")?.value ||
				"";
			const groqApiKey =
				options?.apiKeys?.groq ||
				secrets?.find((s) => s.key === "GROQ_API_KEY")?.value ||
				"";
			const geminiApiKey =
				options?.apiKeys?.gemini ||
				secrets?.find((s) => s.key === "GEMINI_API_KEY")?.value ||
				"";

			const assistantMsgId = `msg-${Date.now()}-r`;
			const assistantMsg: ChatMessage = {
				id: assistantMsgId,
				role: "assistant",
				content: "*Inicializando a Neuria...*",
				timestamp: Date.now(),
			};
			setMessages((m) => [...m, assistantMsg]);

			// Initialize AbortController for this request
			const controller = new AbortController();
			abortControllerRef.current = controller;

			try {
				const response = await fetch("/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						prompt: content,
						activeFileName: activeFileName || "",
						openaiApiKey: openaiApiKey,
						groqApiKey: groqApiKey,
						geminiApiKey: geminiApiKey,
						agentProvider: provider || "gemini",
						ollamaHost: options?.ollamaHost || undefined,
					}),
					signal: controller.signal,
				});

				if (!response.ok) {
					throw new Error("Falha ao ligar ao servidor");
				}

				const reader = response.body?.getReader();
				if (!reader)
					throw new Error("Falha ao ler o stream de resposta");

				const decoder = new TextDecoder();
				let replyText = "";
				let done = false;
				let isFirstToken = true;

				while (!done) {
					const { value, done: doneReading } = await reader.read();
					done = doneReading;
					if (value) {
						const chunk = decoder.decode(value, { stream: true });
						const lines = chunk.split("\n");

						for (const line of lines) {
							if (line.startsWith("data: ")) {
								try {
									const data = JSON.parse(line.slice(6));
									if (data.type === "progress") {
										// Update progress indicator
										setMessages((m) =>
											m.map((msg) =>
												msg.id === assistantMsgId
													? {
															...msg,
															content: `**A carregar o modelo Neuria AI...**\n\n> Progresso: ${data.value}% - ${data.message}\n\n*Nota: O modelo está a ser otimizado com aceleração de hardware GPU (Vulkan) e Flash Attention para máxima velocidade de resposta!*`,
														}
													: msg,
											),
										);
									} else if (data.type === "loaded") {
										replyText =
											"*Neuria a formular resposta...*\n\n";
										setMessages((m) =>
											m.map((msg) =>
												msg.id === assistantMsgId
													? {
															...msg,
															content: replyText,
														}
													: msg,
											),
										);
									} else if (
										data.type === "token" ||
										data.type === "done"
									) {
										if (data.type === "token") {
											if (isFirstToken) {
												replyText = "";
												isFirstToken = false;
											}
											replyText += data.token;
										}

										// Live extraction of operations for rich UI
										const ops: NonNullable<
											ChatMessage["operations"]
										> = [];

										const openFileRegex =
											/<create_file\s+path=["']([^"']+)["']/g;
										let fm;
										while (
											(fm =
												openFileRegex.exec(
													replyText,
												)) !== null
										) {
											const path = fm[1];
											const escapedPath = path.replace(
												/[.*+?^${}()|[\]\\]/g,
												"\\$&",
											);
											const closedRegex = new RegExp(
												`<create_file\\s+path=["']${escapedPath}["']\\s*>([\\s\\S]*?)<\\/create_file>`,
											);
											const isClosed =
												closedRegex.test(replyText) ||
												data.type === "done";
											ops.push({
												id: `file-${path}-${ops.length}`,
												type: "file",
												path,
												status: isClosed
													? "done"
													: "pending",
											});
										}

										const openFolderRegex =
											/<create_folder\s+path=["']([^"']+)["']/g;
										let fom;
										while (
											(fom =
												openFolderRegex.exec(
													replyText,
												)) !== null
										) {
											const path = fom[1];
											const escapedPath = path.replace(
												/[.*+?^${}()|[\]\\]/g,
												"\\$&",
											);
											const closedRegex = new RegExp(
												`<create_folder\\s+path=["']${escapedPath}["']\\s*\\/?\\s*>`,
											);
											const isClosed =
												closedRegex.test(replyText) ||
												data.type === "done";
											ops.push({
												id: `folder-${path}-${ops.length}`,
												type: "folder",
												path,
												status: isClosed
													? "done"
													: "pending",
											});
										}

										const openCmdRegex =
											/<execute_command\s+command=["']([^"']+)["']/g;
										let cm;
										while (
											(cm =
												openCmdRegex.exec(
													replyText,
												)) !== null
										) {
											const cmd = cm[1];
											const escapedCmd = cmd.replace(
												/[.*+?^${}()|[\]\\]/g,
												"\\$&",
											);
											const closedRegex = new RegExp(
												`<execute_command\\s+command=["']${escapedCmd}["']\\s*\\/?\\s*>`,
											);
											const isClosed =
												closedRegex.test(replyText) ||
												data.type === "done";
											ops.push({
												id: `cmd-${cmd}-${ops.length}`,
												type: "command",
												path: cmd,
												status: isClosed
													? "done"
													: "pending",
											});
										}

										setMessages((m) =>
											m.map((msg) =>
												msg.id === assistantMsgId
													? {
															...msg,
															content: replyText,
															operations:
																ops.length > 0
																	? ops
																	: undefined,
														}
													: msg,
											),
										);

										if (data.type === "done") {
											// Synchronize physical files to React virtual filesystem explorer tree
											const folderRegex =
												/<create_folder\s+path=["']([^"']+)["']\s*\/?\s*>/g;
											let folderMatch;
											while (
												(folderMatch =
													folderRegex.exec(
														replyText,
													)) !== null
											) {
												const relPath = folderMatch[1];
												if (
													relPath !== "..." &&
													!relPath.includes(
														"caminho/da/pasta",
													)
												) {
													onFileOperation?.(
														"folder",
														relPath,
													);
												}
											}

											const fileRegex =
												/<create_file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/create_file>/g;
											let fileMatch;
											while (
												(fileMatch =
													fileRegex.exec(
														replyText,
													)) !== null
											) {
												const relPath = fileMatch[1];
												const fileContent =
													fileMatch[2];
												if (
													relPath !== "..." &&
													!relPath.includes(
														"caminho/do/ficheiro",
													)
												) {
													onFileOperation?.(
														"file",
														relPath,
														fileContent,
													);
												}
											}

											const cmdRegex =
												/<execute_command\s+command=["']([^"']+)["']\s*\/?\s*>/g;
											let cmdMatch;
											while (
												(cmdMatch =
													cmdRegex.exec(
														replyText,
													)) !== null
											) {
												const cmd = cmdMatch[1];
												onFileOperation?.(
													"command",
													cmd,
												);
											}
										}
									} else if (data.type === "error") {
										throw new Error(data.message);
									}
								} catch (e) {
									// Ignore incomplete JSON chunks
								}
							}
						}
					}
				}
			} catch (err: any) {
				if (err.name === "AbortError") {
					setMessages((m) =>
						m.map((msg) =>
							msg.id === assistantMsgId
								? {
										...msg,
										content:
											msg.content.replace(
												/\*Neuria a formular resposta\.\.\.\*|\*Inicializando a Neuria\.\.\.\*/g,
												"",
											) +
											"\n\n*Resposta interrompida pelo utilizador.*",
									}
								: msg,
						),
					);
				} else {
					setMessages((m) =>
						m.map((msg) =>
							msg.id === assistantMsgId
								? {
										...msg,
										content: `**Erro da Neuria:** ${err.message || "Não foi possível ligar ao servidor do modelo."}\n\n*Certifica-te de que os ficheiros do modelo (como neuria-v1.ian ou qwen2.5-coder-1.5b-q4_k_m.gguf) estão localizados na pasta do projeto e que o servidor local está a correr.*`,
									}
								: msg,
						),
					);
				}
			} finally {
				if (abortControllerRef.current === controller) {
					abortControllerRef.current = null;
				}
				setIsThinking(false);
			}
		},
		[setMessages, setIsThinking, onFileOperation, activeFileName],
	);

	return { messages, isThinking, sendMessage, stopResponse, setMessages };
}
