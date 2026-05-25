import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { spawn, exec } from "node:child_process";
import { WebSocketServer } from "ws";
import pty from "node-pty";
import os from "node:os";
import { VertexAI } from "@google-cloud/vertexai";
import { GoogleAuth } from "google-auth-library";

let currentWorkspacePath = process.cwd();

function VsixInstallerPlugin() {
	return {
		name: "vsix-installer",
		configureServer(server: any) {
			server.middlewares.use((req: any, res: any, next: any) => {
				if (
					req.url === "/api/install-extension" &&
					req.method === "POST"
				) {
					let body = "";
					req.on("data", (chunk: any) => {
						body += chunk.toString();
					});
					req.on("end", () => {
						try {
							const { downloadUrl, id, version } =
								JSON.parse(body);
							if (!downloadUrl) {
								res.statusCode = 400;
								res.end("Missing downloadUrl");
								return;
							}

							const extDir = path.join(
								process.cwd(),
								".extensions",
							);
							if (!fs.existsSync(extDir))
								fs.mkdirSync(extDir, { recursive: true });

							const fileName = `${id}-${version}.vsix`;
							return {
								name: "vsix-installer",
							};
							const { pathStr, content, isFolder } =
								JSON.parse(body);
							if (
								!pathStr ||
								pathStr.includes("..") ||
								pathStr === "..."
							) {
								res.writeHead(400, {
									"Content-Type": "application/json",
								});
								res.end(
									JSON.stringify({
										success: false,
										error: "Caminho inválido",
									}),
								);
								return;
							}
							const cleanPath = pathStr.replace(/^[\\\/]+/, "");
							const absPath = path.resolve(
								currentWorkspacePath,
								cleanPath,
							);
							if (isFolder) {
								if (!fs.existsSync(absPath)) {
									fs.mkdirSync(absPath, { recursive: true });
								}
							} else {
								const parentDir = path.dirname(absPath);
								if (!fs.existsSync(parentDir)) {
									fs.mkdirSync(parentDir, {
										recursive: true,
									});
								}
								fs.writeFileSync(
									absPath,
									content ?? "",
									"utf8",
								);
							}
							res.writeHead(200, {
								"Content-Type": "application/json",
							});
							res.end(JSON.stringify({ success: true }));
						} catch (e: any) {
							res.writeHead(500, {
								"Content-Type": "application/json",
							});
							res.end(
								JSON.stringify({
									success: false,
									error: e.message,
								}),
							);
						}
					});
					return;
				}
				if (
					req.url === "/api/save-file-base64" &&
					req.method === "POST"
				) {
					let body = "";
					req.on("data", (chunk: any) => {
						body += chunk.toString();
					});
					req.on("end", () => {
						try {
							const { pathStr, base64 } = JSON.parse(body);
							if (
								!pathStr ||
								pathStr.includes("..") ||
								pathStr === "..."
							) {
								res.writeHead(400, {
									"Content-Type": "application/json",
								});
								res.end(
									JSON.stringify({
										success: false,
										error: "Caminho inválido",
									}),
								);
								return;
							}
							const cleanPath = pathStr.replace(/^[\\\/]+/, "");
							const absPath = path.resolve(
								currentWorkspacePath,
								cleanPath,
							);

							const parentDir = path.dirname(absPath);
							if (!fs.existsSync(parentDir)) {
								fs.mkdirSync(parentDir, { recursive: true });
							}

							const buffer = Buffer.from(base64, "base64");
							fs.writeFileSync(absPath, buffer);

							res.writeHead(200, {
								"Content-Type": "application/json",
							});
							res.end(JSON.stringify({ success: true }));
						} catch (e: any) {
							res.writeHead(500, {
								"Content-Type": "application/json",
							});
							res.end(
								JSON.stringify({
									success: false,
									error: e.message,
								}),
							);
						}
					});
					return;
				}

				next();
			});

			if (!server.httpServer) return;

			const wss = new WebSocketServer({ noServer: true });

			server.httpServer.on(
				"upgrade",
				(request: any, socket: any, head: any) => {
					if (request.url?.startsWith("/api/terminal")) {
						wss.handleUpgrade(request, socket, head, (ws) => {
							wss.emit("connection", ws, request);
						});
					}
				},
			);

			wss.on("connection", (ws: any, req: any) => {
				let shellCmd = "powershell.exe";
				if (req && req.url) {
					if (req.url.includes("shell=cmd")) shellCmd = "cmd.exe";
					if (req.url.includes("shell=bash")) shellCmd = "bash.exe";
					if (req.url.includes("shell=wsl")) shellCmd = "wsl.exe";
				}

				const shell = pty.spawn(shellCmd, [], {
					name: "xterm-color",
					cols: 80,
					rows: 30,
					cwd: currentWorkspacePath,
					env: process.env as any,
				});

				shell.onData((data) => ws.send(data));

				ws.on("message", (msg) => {
					shell.write(msg.toString());
				});

				ws.on("close", () => {
					shell.kill();
				});

				shell.onExit(() => {
					ws.close();
				});
			});
		},
	};
}

function RealLlamaPlugin() {
	let llamaSession: any = null;
	let llamaLoading = false;
	let loadedModelPath: string | null = null;

	function getBestModelPath() {
		const possiblePaths = [
			path.join(
				process.cwd(),
				"models",
				"models",
				"qwen2.5-coder-1.5b-q4_k_m.gguf",
			),
			path.join(
				process.cwd(),
				"models",
				"qwen2.5-coder-1.5b-q4_k_m.gguf",
			),
			path.join(process.cwd(), "qwen2.5-coder-1.5b-q4_k_m.gguf"),
			path.join(process.cwd(), "neuria-v1.ian"),
		];

		for (const modelPath of possiblePaths) {
			if (fs.existsSync(modelPath)) {
				const stats = fs.statSync(modelPath);
				// Se for o modelo de 1.5B, garantir que não é um ficheiro temporário ou incompleto (ex: < 800MB)
				if (
					modelPath.includes("qwen2.5-coder-1.5b") &&
					stats.size < 800 * 1024 * 1024
				) {
					console.log(
						`[Llama Host] Modelo 1.5B detetado em ${modelPath}, mas o download ainda está a decorrer (${(stats.size / (1024 * 1024)).toFixed(2)} MB). A saltar...`,
					);
					continue;
				}
				return {
					path: modelPath,
					name: path.basename(modelPath),
					size: stats.size,
				};
			}
		}
		return null;
	}

	async function getLlamaSession(
		onProgress: (pct: number, msg: string) => void,
	) {
		const { getLlama, LlamaChatSession } = await import("node-llama-cpp");
		const bestModel = getBestModelPath();
		if (!bestModel) {
			throw new Error(
				"Nenhum modelo de IA (.ian ou .gguf) foi encontrado na pasta do projeto!",
			);
		}

		// Se o modelo detetado for diferente do que está carregado em memória, reinicia a sessão
		if (llamaSession && loadedModelPath !== bestModel.path) {
			console.log(
				`[Llama Host] Transição de modelo detetada: de ${loadedModelPath} para ${bestModel.path}. A recarregar...`,
			);
			llamaSession = null;
		}

		if (llamaSession) return llamaSession;
		if (llamaLoading) {
			let mockPct = 20;
			while (llamaLoading) {
				onProgress(mockPct, `A carregar o modelo ${bestModel.name}...`);
				if (mockPct < 95) mockPct += 5;
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
			return llamaSession;
		}

		llamaLoading = true;
		try {
			console.log(
				`[Llama Host] Loading ${bestModel.name} (${(bestModel.size / (1024 * 1024)).toFixed(1)} MB)...`,
			);
			onProgress(5, "A inicializar motor de IA...");

			let llama = await getLlama(); // Ativa deteção automática de GPU (CUDA, Metal, Vulkan) de qualquer PC!
			const gpuType = llama.gpu ? llama.gpu.toUpperCase() : "CPU";
			const gpuSupport = llama.supportsGpuOffloading
				? "ATIVA"
				: "INATIVA";

			console.log(
				`[Llama Host] GPU Detetada: ${gpuType} | Aceleração por Hardware: ${gpuSupport}`,
			);
			onProgress(
				15,
				`GPU Detetada: ${gpuType} (Aceleração por Hardware: ${gpuSupport}) - Carregando ${bestModel.name}...`,
			);

			let pct = 20;
			const interval = setInterval(() => {
				if (pct < 85) {
					pct += 5;
					onProgress(pct, `Lendo blocos do modelo: ${pct}%...`);
				}
			}, 300);

			let model;
			try {
				model = await llama.loadModel({
					modelPath: bestModel.path,
				});
			} catch (loadErr) {
				clearInterval(interval);
				throw loadErr;
			}
			clearInterval(interval);

			onProgress(85, "Alocando contexto na GPU/RAM...");
			let context;
			try {
				context = await model.createContext({
					contextSize: 4096,
					threads: Math.max(1, os.cpus().length - 1),
					flashAttention: true, // Flash Attention para máxima performance!
				});
			} catch (ctxErr) {
				console.warn(
					"[Llama Host] Falha ao alocar contexto na GPU. Tentando alocação segura em CPU (gpu: false)...",
					ctxErr,
				);
				onProgress(
					88,
					"A carregar contexto em modo de compatibilidade CPU...",
				);

				// Re-carregar llama com GPU desativada para CPU RAM
				const cpuLlama = await getLlama({ gpu: false });
				const cpuModel = await cpuLlama.loadModel({
					modelPath: bestModel.path,
				});
				context = await cpuModel.createContext({
					contextSize: 4096,
					threads: Math.max(1, os.cpus().length - 1),
				});
			}

			onProgress(95, "Abrindo sessão de conversa Neuria...");
			llamaSession = new LlamaChatSession({
				contextSequence: context.getSequence(),
				systemPrompt: `Tu és a Neuria, uma Inteligência Artificial de elite integrada no editor Codify. Respondes em português europeu de forma concisa e direta.

Se o utilizador fizer uma pergunta simples (ex: "olá", "como estás?", "o que é X?"), responde de forma natural e curta. Não cries ficheiros nem operações desnecessárias.

Só quando o utilizador pedir explicitamente para criar, editar ou gerir ficheiros/código é que deves usar as seguintes tags XML:

- Para criar/escrever um ficheiro:
<create_file path="caminho/relativo/ficheiro.ext">
conteúdo completo do ficheiro
</create_file>

- Para criar uma pasta:
<create_folder path="caminho/relativo/pasta" />

- Para executar um comando no terminal:
<execute_command command="comando" />

IMPORTANTE: Usa SEMPRE caminhos relativos (ex: "src/index.html"), NUNCA caminhos absolutos (ex: "D:\\...\\index.html"). Podes criar múltiplos ficheiros na mesma resposta. Sê conciso.`,
			});
			loadedModelPath = bestModel.path;
			onProgress(100, `Modelo ${bestModel.name} ativo!`);
			console.log(
				`[Llama Host] Model ${bestModel.name} loaded successfully!`,
			);
		} catch (err: any) {
			console.error(
				"[Llama Host Error] Falha com o modelo primário. A tentar fallback...",
				err,
			);

			// Se falhar com o modelo primário (neuria-v1.ian), tenta o modelo secundário de 1.5B
			if (bestModel?.path.includes("neuria-v1.ian")) {
				try {
					const fallbackModelPath = path.join(
						process.cwd(),
						"models",
						"qwen2.5-coder-1.5b-q4_k_m.gguf",
					);
					if (fs.existsSync(fallbackModelPath)) {
						console.log(
							`[Llama Host Fallback] A carregar modelo de fallback leve: ${fallbackModelPath}`,
						);
						onProgress(
							40,
							"Falha no modelo principal. A carregar o modelo de fallback leve...",
						);

						let llama = await getLlama();
						let model;
						let context;
						try {
							model = await llama.loadModel({
								modelPath: fallbackModelPath,
							});
							context = await model.createContext({
								contextSize: 4096,
								threads: Math.max(1, os.cpus().length - 1),
								flashAttention: true,
							});
						} catch (fallbackCtxErr) {
							console.warn(
								"[Llama Host Fallback] Falha ao criar contexto leve em GPU. Tentando em CPU...",
								fallbackCtxErr,
							);
							const cpuLlama = await getLlama({ gpu: false });
							const cpuModel = await cpuLlama.loadModel({
								modelPath: fallbackModelPath,
							});
							context = await cpuModel.createContext({
								contextSize: 4096,
								threads: Math.max(1, os.cpus().length - 1),
							});
						}

						llamaSession = new LlamaChatSession({
							contextSequence: context.getSequence(),
							systemPrompt: `Tu és a Neuria, uma Inteligência Artificial de elite integrada no editor Codify. Respondes em português europeu de forma concisa e direta.

Se o utilizador fizer uma pergunta simples (ex: "olá", "como estás?", "o que é X?"), responde de forma natural e curta. Não cries ficheiros nem operações desnecessárias.

Só quando o utilizador pedir explicitamente para criar, editar ou gerir ficheiros/código é que deves usar as seguintes tags XML:

- Para criar/escrever um ficheiro:
<create_file path="caminho/relativo/ficheiro.ext">
conteúdo completo do ficheiro
</create_file>

- Para criar uma pasta:
<create_folder path="caminho/relativo/pasta" />

- Para executar um comando no terminal:
<execute_command command="comando" />

IMPORTANTE: Usa SEMPRE caminhos relativos (ex: "src/index.html"), NUNCA caminhos absolutos (ex: "D:\\...\\index.html"). Podes criar múltiplos ficheiros na mesma resposta. Sê conciso.`,
						});
						loadedModelPath = fallbackModelPath;
						onProgress(100, "Modelo de fallback leve ativo!");
						llamaLoading = false;
						return llamaSession;
					}
				} catch (fallbackErr) {
					console.error(
						"[Llama Host Error] Falha fatal inclusive no fallback:",
						fallbackErr,
					);
				}
			}

			throw err;
		} finally {
			llamaLoading = false;
		}
		return llamaSession;
	}

	return {
		name: "real-llama",
		configureServer(server: any) {
			server.middlewares.use((req: any, res: any, next: any) => {
				if (req.url === "/api/chat" && req.method === "POST") {
					res.writeHead(200, {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache, no-transform",
						Connection: "keep-alive",
						"X-Accel-Buffering": "no",
					});

					let body = "";
					req.on("data", (chunk: any) => {
						body += chunk.toString();
					});
					req.on("end", async () => {
						try {
							const parsed = JSON.parse(body);
							const prompt = parsed.prompt;
							const activeFileName = parsed.activeFileName || "";
							const openaiApiKey = parsed.openaiApiKey || "";
							const groqApiKey = parsed.groqApiKey || "";
							const geminiApiKey = parsed.geminiApiKey || "";
							const agentProvider =
								parsed.agentProvider || "gemini";

							// Recursive helper to list all active files in current workspace for context awareness
							const listWorkspaceFiles = (
								dir: string,
								baseDir = dir,
							): string[] => {
								try {
									const items = fs.readdirSync(dir, {
										withFileTypes: true,
									});
									let list: string[] = [];
									for (const item of items) {
										if (
											[
												"node_modules",
												".git",
												".extensions",
												".next",
												"dist",
												"build",
												".gemini",
												"venv",
											].includes(item.name)
										)
											continue;
										const fullPath = path.join(
											dir,
											item.name,
										);
										const relPath = path
											.relative(baseDir, fullPath)
											.replace(/\\/g, "/");
										if (item.isDirectory()) {
											list.push(relPath + "/");
											list.push(
												...listWorkspaceFiles(
													fullPath,
													baseDir,
												),
											);
										} else {
											list.push(relPath);
										}
									}
									return list;
								} catch {
									return [];
								}
							};

							// Detect se isto é uma tarefa de código/ficheiro/análise
							const isCodeTask =
								/\b(cria|cria[r]?|edit[a]?|escreve|faz|gera|adiciona|instala|apaga|remove|mostra|abre|executa|roda|corrige|debug|programa|código|ficheiro|pasta|projeto|script|html|css|js|py|json|npm|pip|git|site|app|jogo|game|função|class|import|export|componente|página|analisa|vê|lê|pdf|imagem|vídeo|foto|resumo|resumir)\b/i.test(
									prompt,
								) || !!activeFileName;

							let enrichedPrompt: string;

							if (isCodeTask) {
								const filesList =
									listWorkspaceFiles(currentWorkspacePath);
								const filesSummary =
									filesList.length > 0
										? filesList.join("\n")
										: "(pasta vazia)";

								// Selectively read file contents of active or mentioned files
								let fileContext = "";
								for (const relPath of filesList) {
									if (relPath.endsWith("/")) continue;

									const baseName = path.basename(relPath);
									const isMentioned =
										prompt
											.toLowerCase()
											.includes(relPath.toLowerCase()) ||
										prompt
											.toLowerCase()
											.includes(baseName.toLowerCase());
									const isActive =
										activeFileName &&
										(activeFileName.toLowerCase() ===
											relPath.toLowerCase() ||
											activeFileName.toLowerCase() ===
												baseName.toLowerCase());

									if (isMentioned || isActive) {
										const absPath = path.resolve(
											currentWorkspacePath,
											relPath,
										);
										try {
											const ext = path
												.extname(absPath)
												.toLowerCase();
											const isImage = [
												".png",
												".jpg",
												".jpeg",
												".gif",
												".bmp",
												".webp",
											].includes(ext);
											const isPdf = ext === ".pdf";
											const isVideo = [
												".mp4",
												".mkv",
												".avi",
												".mov",
											].includes(ext);
											const isText = [
												".ts",
												".tsx",
												".js",
												".jsx",
												".json",
												".md",
												".css",
												".html",
												".py",
												".txt",
												".sh",
												".bat",
												".yml",
												".yaml",
												".toml",
												".xml",
												".csv",
												".env",
											].includes(ext);

											if (isPdf) {
												const pdfParse = (
													await import("pdf-parse")
												).default;
												const dataBuffer =
													fs.readFileSync(absPath);
												const data =
													await pdfParse(dataBuffer);
												fileContext += `=== FICHEIRO PDF: ${relPath} ===\n${data.text.slice(0, 4000)}\n===\n\n`;
											} else if (isImage) {
												const Tesseract = (
													await import("tesseract.js")
												).default;
												const result =
													await Tesseract.recognize(
														absPath,
														"por+eng",
													);
												fileContext += `=== IMAGEM (Texto Extraído OCR): ${relPath} ===\n${result.data.text.slice(0, 4000)}\n===\n\n`;
											} else if (isVideo) {
												const stats =
													fs.statSync(absPath);
												fileContext += `=== VÍDEO (Metadados): ${relPath} ===\nTamanho: ${(stats.size / (1024 * 1024)).toFixed(2)} MB\nTipo: Vídeo\n(Nota para a IA: Tu não consegues ver o conteúdo do vídeo, apenas sabes que ele existe e o seu tamanho. Se o utilizador perguntar, explica isso.)\n===\n\n`;
											} else if (isText || ext === "") {
												const content = fs.readFileSync(
													absPath,
													"utf8",
												);
												const truncatedContent =
													content.length > 4000
														? content.slice(
																0,
																4000,
															) +
															"\n... (truncado) ..."
														: content;
												fileContext += `=== FICHEIRO: ${relPath} ===\n${truncatedContent}\n===\n\n`;
											} else {
												const stats =
													fs.statSync(absPath);
												fileContext += `=== FICHEIRO BINÁRIO/DESCONHECIDO: ${relPath} ===\nTamanho: ${(stats.size / (1024 * 1024)).toFixed(2)} MB\n(Nota para a IA: Este formato de ficheiro não é suportado para leitura direta de texto local. Ignora o conteúdo deste ficheiro.)\n===\n\n`;
											}
										} catch (e: any) {
											console.error(
												`[Llama Host] Erro ao ler ${relPath}:`,
												e.message,
											);
										}
									}
								}

								enrichedPrompt =
									`[Pasta ativa: ${currentWorkspacePath}]\n` +
									`[Ficheiros do projeto:\n${filesSummary}]\n\n` +
									(fileContext
										? `[Conteúdo dos ficheiros relevantes:\n${fileContext}]\n`
										: "") +
									`Mensagem do utilizador:\n${prompt}`;
							} else {
								// Simple conversational message — no file context needed
								enrichedPrompt = prompt;
							}

							let reply = "";
							const isValidGeminiKey =
								geminiApiKey &&
								geminiApiKey.length > 20 &&
								!geminiApiKey.includes("•");
							const isValidGroqKey =
								groqApiKey &&
								groqApiKey.startsWith("gsk_") &&
								groqApiKey.length > 20;
							const isValidOpenaiKey =
								openaiApiKey &&
								openaiApiKey.startsWith("sk-") &&
								openaiApiKey.length > 20 &&
								!openaiApiKey.includes("•");

							// Debug log to verify key routing
							console.log(
								`[AI Router] geminiKey: ${geminiApiKey ? geminiApiKey.slice(0, 8) + "...(len=" + geminiApiKey.length + ")" : "EMPTY"} | valid=${isValidGeminiKey}`,
							);
							console.log(
								`[AI Router] groqKey: ${groqApiKey ? groqApiKey.slice(0, 8) + "...(len=" + groqApiKey.length + ")" : "EMPTY"} | valid=${isValidGroqKey}`,
							);
							console.log(
								`[AI Router] openaiKey: ${openaiApiKey ? openaiApiKey.slice(0, 8) + "...(len=" + openaiApiKey.length + ")" : "EMPTY"} | valid=${isValidOpenaiKey}`,
							);
							console.log(
								`[AI Router] Route: ${isValidGeminiKey ? "GEMINI" : isValidGroqKey ? "GROQ" : isValidOpenaiKey ? "OPENAI" : "LOCAL LLAMA"}`,
							);

							const systemPrompt = `Tu és a Neuria, uma Inteligência Artificial de elite integrada no editor Codify. Respondes em português europeu de forma concisa e direta.

Se o utilizador fizer uma pergunta simples (ex: "olá", "como estás?", "o que é X?"), responde de forma natural e curta. Não cries ficheiros nem operações desnecessárias.

Só quando o utilizador pedir explicitamente para criar, editar ou gerir ficheiros/código é que deves usar as seguintes tags XML:

- Para criar/escrever um ficheiro:
<create_file path="caminho/relativo/ficheiro.ext">
conteúdo completo do ficheiro
</create_file>

- Para criar uma pasta:
<create_folder path="caminho/relativo/pasta" />

- Para executar um comando no terminal:
<execute_command command="comando" />

IMPORTANTE: Usa SEMPRE caminhos relativos (ex: "src/index.html"), NUNCA caminhos absolutos (ex: "D:\\...\\index.html"). Podes criar múltiplos ficheiros na mesma resposta. Sê conciso.`;

							const callGeminiNative = async () => {
								try {
									res.write(
										`data: ${JSON.stringify({ type: "progress", value: 30, message: `A obter credenciais nativas Google (OAuth2 ADC)...` })}\n\n`,
									);

									// Use Google Application Default Credentials to get a Bearer token
									// This works exactly like Antigravity — no API key, no project needed
									const auth = new GoogleAuth({
										scopes: [
											"https://www.googleapis.com/auth/cloud-platform",
										],
									});
									const client = await auth.getClient();
									const tokenResponse = await (
										client as any
									).getAccessToken();
									const accessToken =
										tokenResponse.token || tokenResponse;

									if (!accessToken)
										throw new Error("credentials");

									console.log(
										"[Native] OAuth2 Bearer token obtained successfully.",
									);
									res.write(
										`data: ${JSON.stringify({ type: "progress", value: 70, message: `A ligar ao Gemini com acesso nativo Google...` })}\n\n`,
									);

									const model = "gemini-2.0-flash";
									const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

									const apiResponse = await fetch(apiUrl, {
										method: "POST",
										headers: {
											"Content-Type": "application/json",
											Authorization: `Bearer ${accessToken}`,
										},
										body: JSON.stringify({
											contents: [
												{
													role: "user",
													parts: [
														{
															text: enrichedPrompt,
														},
													],
												},
											],
											systemInstruction: {
												parts: [{ text: systemPrompt }],
											},
										}),
									});

									if (!apiResponse.ok) {
										const errText =
											await apiResponse.text();
										throw new Error(
											`API error ${apiResponse.status}: ${errText}`,
										);
									}

									res.write(
										`data: ${JSON.stringify({ type: "loaded" })}\n\n`,
									);
									console.log(
										`[Native] Gemini stream started.`,
									);

									const reader = (
										apiResponse.body as any
									).getReader();
									const decoder = new TextDecoder();
									let tokenCount = 0;
									let buffer = "";

									while (true) {
										const { done, value } =
											await reader.read();
										if (done) break;
										buffer += decoder.decode(value, {
											stream: true,
										});
										const lines = buffer.split("\n");
										buffer = lines.pop() ?? "";
										for (const line of lines) {
											const cleanLine = line.trim();
											if (
												!cleanLine ||
												!cleanLine.startsWith("data: ")
											)
												continue;
											const rawJson = cleanLine
												.slice(6)
												.trim();
											if (rawJson === "[DONE]") continue;
											try {
												const data =
													JSON.parse(rawJson);
												const textToken =
													data.candidates?.[0]
														?.content?.parts?.[0]
														?.text || "";
												if (textToken) {
													reply += textToken;
													tokenCount++;
													res.write(
														`data: ${JSON.stringify({ type: "token", token: textToken })}\n\n`,
													);
												}
											} catch (_) {
												/* ignore incomplete JSON */
											}
										}
									}
									console.log(
										`[Native] Stream complete. Tokens: ${tokenCount}`,
									);
								} catch (err: any) {
									console.error(
										"[Native] Auth failed:",
										err.message,
									);
									res.write(
										`data: ${JSON.stringify({ type: "loaded" })}\n\n`,
									);
									const isCredError =
										err.message.includes("credentials") ||
										err.message.includes(
											"Could not load",
										) ||
										err.message.includes("project");
									const errorMessage = isCredError
										? "⚠️ **Acesso Negado à Infraestrutura Interna**\n\nO servidor não encontrou credenciais nativas da Google. Para autorizar esta máquina, tens de:\n\n1. Abrir um novo terminal\n2. Correr o comando corporativo: `gcloud auth application-default login`\n3. Ter um projeto Cloud ID pré-configurado.\n\nAté o fazeres, tens de usar uma API Key padrão."
										: `Erro nativo: ${err.message}`;
									res.write(
										`data: ${JSON.stringify({ type: "token", token: errorMessage })}\n\n`,
									);
								}
							};

							const callGeminiApi = async (key: string) => {
								const model = "gemini-2.0-flash";
								const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`;
								console.log(`[Gemini] Calling Gemini API...`);
								res.write(
									`data: ${JSON.stringify({ type: "progress", value: 50, message: `A conectar ao Gemini (Modo Rápido)...` })}\n\n`,
								);
								res.write(
									`data: ${JSON.stringify({ type: "loaded" })}\n\n`,
								);

								const apiResponse = await fetch(apiUrl, {
									method: "POST",
									headers: {
										"Content-Type": "application/json",
									},
									body: JSON.stringify({
										contents: [
											{
												role: "user",
												parts: [
													{ text: enrichedPrompt },
												],
											},
										],
										systemInstruction: {
											parts: [{ text: systemPrompt }],
										},
									}),
								});

								console.log(
									`[Gemini] Response status: ${apiResponse.status}`,
								);

								if (!apiResponse.ok) {
									const errText = await apiResponse.text();
									throw new Error(
										`Erro da API Gemini: ${apiResponse.status} - ${errText}`,
									);
								}

								if (!apiResponse.body) {
									throw new Error(
										`Gemini: response body is null`,
									);
								}

								const reader = (
									apiResponse.body as any
								).getReader();
								const decoder = new TextDecoder();
								let tokenCount = 0;
								let buffer = "";

								while (true) {
									const { done, value } = await reader.read();
									if (done) break;

									buffer += decoder.decode(value, {
										stream: true,
									});
									const lines = buffer.split("\n");
									buffer = lines.pop() ?? ""; // keep incomplete last line in buffer

									for (const line of lines) {
										const cleanLine = line.trim();
										if (!cleanLine) continue;
										if (cleanLine.startsWith("data: ")) {
											const rawJson = cleanLine
												.slice(6)
												.trim();
											if (rawJson === "[DONE]") continue;
											try {
												const data =
													JSON.parse(rawJson);
												const textToken =
													data.candidates?.[0]
														?.content?.parts?.[0]
														?.text || "";
												if (textToken) {
													reply += textToken;
													tokenCount++;
													res.write(
														`data: ${JSON.stringify({ type: "token", token: textToken })}\n\n`,
													);
												}
											} catch (_) {
												/* ignore incomplete JSON */
											}
										}
									}
								}
								console.log(
									`[Gemini] Stream complete. Tokens sent: ${tokenCount}`,
								);
							};

							const callCloudApi = async (
								apiUrl: string,
								authKey: string,
								model: string,
								providerLabel: string,
							) => {
								console.log(
									`[${providerLabel}] Calling ${apiUrl} with model ${model}...`,
								);
								res.write(
									`data: ${JSON.stringify({ type: "progress", value: 50, message: `A conectar ao ${providerLabel} (Modo Rápido)...` })}\n\n`,
								);
								res.write(
									`data: ${JSON.stringify({ type: "loaded" })}\n\n`,
								);

								const apiResponse = await fetch(apiUrl, {
									method: "POST",
									headers: {
										"Content-Type": "application/json",
										Authorization: `Bearer ${authKey}`,
									},
									body: JSON.stringify({
										model,
										messages: [
											{
												role: "system",
												content: systemPrompt,
											},
											{
												role: "user",
												content: enrichedPrompt,
											},
										],
										stream: true,
									}),
								});

								console.log(
									`[${providerLabel}] Response status: ${apiResponse.status}`,
								);

								if (!apiResponse.ok) {
									const errText = await apiResponse.text();
									throw new Error(
										`Erro da API ${providerLabel}: ${apiResponse.status} - ${errText}`,
									);
								}

								if (!apiResponse.body) {
									throw new Error(
										`${providerLabel}: response body is null`,
									);
								}

								// Use explicit getReader() + TextDecoder for reliable Node.js v24 streaming
								const reader = (
									apiResponse.body as any
								).getReader();
								const decoder = new TextDecoder();
								let tokenCount = 0;
								let buffer = "";

								while (true) {
									const { done, value } = await reader.read();
									if (done) break;

									buffer += decoder.decode(value, {
										stream: true,
									});
									const lines = buffer.split("\n");
									buffer = lines.pop() ?? ""; // keep incomplete last line in buffer

									for (const line of lines) {
										const cleanLine = line.trim();
										if (
											!cleanLine ||
											cleanLine === "data: [DONE]"
										)
											continue;
										if (cleanLine.startsWith("data: ")) {
											try {
												const data = JSON.parse(
													cleanLine.slice(6),
												);
												const textToken =
													data.choices?.[0]?.delta
														?.content || "";
												if (textToken) {
													reply += textToken;
													tokenCount++;
													res.write(
														`data: ${JSON.stringify({ type: "token", token: textToken })}\n\n`,
													);
												}
											} catch (_) {
												/* ignore incomplete JSON */
											}
										}
									}
								}
								console.log(
									`[${providerLabel}] Stream complete. Tokens sent: ${tokenCount}`,
								);
							};

							console.log(
								`[AI Router] Route: ${agentProvider.toUpperCase()}`,
							);

							switch (agentProvider) {
								case "gemini":
									if (!isValidGeminiKey) {
										res.write(
											`data: ${JSON.stringify({ type: "token", token: '⚠️ **Chave Gemini Ausente**\n\nPor favor, vai à aba **Auth**, clica em "Sign in with Google" e cola a tua API Key gratuita do Google AI Studio.' })}\n\n`,
										);
										res.write(`data: [DONE]\n\n`);
										res.end();
										return;
									}
									await callGeminiApi(geminiApiKey);
									break;
								case "openai":
									if (!isValidOpenaiKey) {
										res.write(
											`data: ${JSON.stringify({ type: "token", token: "⚠️ **Chave OpenAI Ausente**\n\nPor favor, vai à aba **Auth** e introduz a tua chave para usar o ChatGPT (gpt-4o-mini)." })}\n\n`,
										);
										res.write(`data: [DONE]\n\n`);
										res.end();
										return;
									}
									await callCloudApi(
										"https://api.openai.com/v1/chat/completions",
										openaiApiKey,
										"gpt-4o-mini",
										"OpenAI",
									);
									break;
								case "groq":
									if (!isValidGroqKey) {
										res.write(
											`data: ${JSON.stringify({ type: "token", token: "⚠️ **Chave Groq Ausente**\n\nPor favor, vai à aba **Auth** e introduz a tua chave para usar o Groq (Llama 3)." })}\n\n`,
										);
										res.write(`data: [DONE]\n\n`);
										res.end();
										return;
									}
									await callCloudApi(
										"https://api.groq.com/openai/v1/chat/completions",
										groqApiKey,
										"llama-3.3-70b-versatile",
										"Groq (Grátis)",
									);
									break;
								case "local":
								default:
									// Send loading progress updates to SSE
									const session = await getLlamaSession(
										(pct, msg) => {
											res.write(
												`data: ${JSON.stringify({ type: "progress", value: pct, message: msg })}\n\n`,
											);
										},
									);

									if (!session) {
										res.write(
											`data: ${JSON.stringify({ type: "error", message: "Falha ao carregar o modelo neuria-v1.ian" })}\n\n`,
										);
										res.end();
										return;
									}

									res.write(
										`data: ${JSON.stringify({ type: "loaded" })}\n\n`,
									);

									// Stream tokens during generation using clean prompt to avoid repetition bias
									reply = await session.prompt(
										enrichedPrompt,
										{
											onTextChunk: (chunk) => {
												res.write(
													`data: ${JSON.stringify({ type: "token", token: chunk })}\n\n`,
												);
											},
										},
									);
							}

							// Intercept XML tags for physical execution
							const operations: string[] = [];

							// 1. Parse and create folders
							const folderRegex =
								/<create_folder\s+path=["']([^"']+)["']\s*\/?\s*>/g;
							let folderMatch;
							while (
								(folderMatch = folderRegex.exec(reply)) !== null
							) {
								const relPath = folderMatch[1];
								if (
									relPath === "..." ||
									relPath.includes("caminho/da/pasta")
								) {
									console.log(
										`[Llama Host] Ignorada a pasta placeholder: ${relPath}`,
									);
									continue;
								}
								const cleanRelPath = relPath.replace(
									/^[\\\/]+/,
									"",
								);
								const absPath = path.resolve(
									currentWorkspacePath,
									cleanRelPath,
								);
								if (!fs.existsSync(absPath)) {
									fs.mkdirSync(absPath, { recursive: true });
									operations.push(
										`Pasta física criada: ${cleanRelPath}`,
									);
								}
							}

							// 2. Parse and write files
							const fileRegex =
								/<create_file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/create_file>/g;
							let fileMatch;
							while (
								(fileMatch = fileRegex.exec(reply)) !== null
							) {
								const relPath = fileMatch[1];
								if (
									relPath === "..." ||
									relPath.includes("caminho/do/ficheiro")
								) {
									console.log(
										`[Llama Host] Ignorado o ficheiro placeholder: ${relPath}`,
									);
									continue;
								}
								const content = fileMatch[2];
								const cleanRelPath = relPath.replace(
									/^[\\\/]+/,
									"",
								);
								const absPath = path.resolve(
									currentWorkspacePath,
									cleanRelPath,
								);

								const parentDir = path.dirname(absPath);
								if (!fs.existsSync(parentDir)) {
									fs.mkdirSync(parentDir, {
										recursive: true,
									});
								}

								fs.writeFileSync(absPath, content, "utf8");
								operations.push(
									`Ficheiro físico gravado: ${cleanRelPath}`,
								);
							}

							// End the stream with operations
							res.write(
								`data: ${JSON.stringify({ type: "done", operations })}\n\n`,
							);
							res.end();
						} catch (err: any) {
							console.error(
								"[Llama Host Error] Ocorreu um erro no chat:",
								err,
							);
							// Self-healing: if context compression or sequence allocation fails, reset llamaSession to null
							if (
								err.message &&
								(err.message.includes("compress") ||
									err.message.includes("context") ||
									err.message.includes("sequence") ||
									err.message.includes("shift"))
							) {
								console.log(
									"[Llama Host] Erro de contexto detetado. A limpar a sessão para autorecuperação no próximo pedido...",
								);
								llamaSession = null;
							}
							res.write(
								`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`,
							);
							res.end();
						}
					});
				} else {
					next();
				}
			});
		},
	};
}

function RealTerminalPlugin() {
	return {
		name: "real-terminal",
		configureServer(server: any) {
			// Terminal plugin is provided in packaged Electron; in dev we can noop or reuse existing ws handler.
			return;
		},
	};
}

export default defineConfig({
	plugins: [
		react(),
		VsixInstallerPlugin(),
		RealTerminalPlugin(),
		RealLlamaPlugin(),
	],
	server: {
		port: 5173,
		open: true,
		watch: {
			ignored: [
				"**/node_modules/**",
				"**/.git/**",
				"**/.extensions/**",
				"**/models/**",
				"**/dist/**",
				"**/*.gguf",
				"**/*.ian",
			],
		},
	},

	worker: {
		format: "es",
	},

	resolve: {
		alias: {
			// Shim Node.js-only parts of ESLint so Linter class works in browser/worker
			"@humanfs/node": "@humanfs/memory",
			"@humanwhocodes/retry": "@humanwhocodes/retry",
		},
	},

	optimizeDeps: {
		include: [
			"prettier/standalone",
			"prettier/plugins/babel",
			"prettier/plugins/estree",
			"prettier/plugins/typescript",
			"prettier/plugins/postcss",
			"prettier/plugins/html",
			"prettier/plugins/markdown",
		],
		exclude: ["eslint"],
	},

	base: "./",
	build: {
		outDir: "dist",
		assetsDir: "assets",
		minify: "terser",
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("prettier")) return "prettier-chunk";
					if (id.includes("eslint")) return "eslint-chunk";
				},
			},
		},
	},
});
