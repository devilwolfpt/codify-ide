/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { spawn, exec } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");
const https = require("https");
const os = require("os");
const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const { autoUpdater } = require("electron-updater");

let mainWindow = null;
let viteProcess = null;
let packagedServer = null;
let currentWorkspacePath = process.cwd();
let llamaSession = null;
let llamaLoading = false;
let loadedModelPath = null;
const PORT = 5173;

// If packaged (or explicitly requested) disable GPU acceleration to avoid
// crashing buggy graphics drivers on first-run systems.
const forceDisableGPU = process.env.FORCE_DISABLE_GPU === "1";
if (app.isPackaged || forceDisableGPU) {
	try {
		app.disableHardwareAcceleration();
		console.log("[electron] Hardware acceleration disabled");
	} catch (err) {
		console.warn("[electron] Failed to disable hardware acceleration", err);
	}
}

// Log GPU process crashes and attempt graceful fallback (disable GPU on next run)
app.on("gpu-process-crashed", (event, killed) => {
	console.error("[electron] GPU process crashed. killed=", killed);
});

// ─── Configure models path ───────────────────────────────────────────────────
function getModelsPath() {
	const candidates = app.isPackaged
		? [
				path.join(path.dirname(app.getPath("exe")), "models"),
				path.join(process.resourcesPath, "models"),
				path.join(process.resourcesPath, "app.asar.unpacked", "models"),
			]
		: [path.join(__dirname, "..", "models")];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}

	return candidates[0];
}

function getWorkspaceRoot() {
	return currentWorkspacePath;
}

function sendJson(res, statusCode, payload) {
	res.writeHead(statusCode, { "Content-Type": "application/json" });
	res.end(JSON.stringify(payload));
}

function getMimeType(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	const map = {
		".html": "text/html; charset=utf-8",
		".css": "text/css; charset=utf-8",
		".js": "application/javascript; charset=utf-8",
		".mjs": "application/javascript; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".svg": "image/svg+xml",
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".gif": "image/gif",
		".webp": "image/webp",
		".ico": "image/x-icon",
		".txt": "text/plain; charset=utf-8",
	};
	return map[ext] || "application/octet-stream";
}

function buildWorkspaceTree(absPath) {
	const ignoredNames = new Set([
		"node_modules",
		".git",
		".extensions",
		".next",
		"dist",
		"build",
		".gemini",
		"venv",
		".venv",
		"env",
		"__pycache__",
		"out",
		"target",
	]);

	const readDir = (dirPath) => {
		const entries = fs.readdirSync(dirPath, { withFileTypes: true });
		const nodes = [];

		for (const item of entries) {
			if (ignoredNames.has(item.name)) continue;

			const fullItemPath = path.join(dirPath, item.name);
			const relPath = path
				.relative(absPath, fullItemPath)
				.replace(/\\/g, "/");
			const id = relPath || item.name;

			if (item.isDirectory()) {
				nodes.push({
					id,
					name: item.name,
					type: "folder",
					children: readDir(fullItemPath),
				});
			} else {
				const ext = item.name.toLowerCase().includes(".")
					? item.name.toLowerCase().split(".").pop()
					: "";
				const langMap = {
					ts: "typescript",
					tsx: "typescript",
					js: "javascript",
					jsx: "javascript",
					json: "json",
					md: "markdown",
					css: "css",
					html: "html",
					py: "python",
					txt: "plaintext",
					ini: "plaintext",
					cfg: "plaintext",
					conf: "plaintext",
					log: "plaintext",
					env: "plaintext",
					yml: "yaml",
					yaml: "yaml",
					toml: "toml",
					xml: "xml",
					csv: "plaintext",
					sh: "shell",
					bat: "bat",
				};
				nodes.push({
					id,
					name: item.name,
					type: "file",
					language: langMap[ext || ""] || "plaintext",
				});
			}
		}

		return nodes.sort((a, b) => {
			if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
	};

	const rootName = path.basename(absPath) || "projeto";
	return [
		{
			id: "root",
			name: rootName,
			type: "folder",
			children: readDir(absPath),
		},
	];
}

function getPreviewWorkspaceRoot() {
	const root = getWorkspaceRoot();
	if (root === process.cwd()) {
		const sitePath = path.join(root, "site");
		if (fs.existsSync(sitePath)) return sitePath;
	}
	return root;
}

function listWorkspaceFiles(dir, baseDir = dir) {
	try {
		const items = fs.readdirSync(dir, { withFileTypes: true });
		const list = [];
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
			) {
				continue;
			}
			const fullPath = path.join(dir, item.name);
			const relPath = path
				.relative(baseDir, fullPath)
				.replace(/\\/g, "/");
			if (item.isDirectory()) {
				list.push(relPath + "/");
				list.push(...listWorkspaceFiles(fullPath, baseDir));
			} else {
				list.push(relPath);
			}
		}
		return list;
	} catch {
		return [];
	}
}

function getBestLocalModelPath() {
	const modelsRoot = getModelsPath();
	const candidates = [
		path.join(modelsRoot, "models", "qwen2.5-coder-1.5b-q4_k_m.gguf"),
		path.join(modelsRoot, "qwen2.5-coder-1.5b-q4_k_m.gguf"),
		path.join(modelsRoot, "neuria-v1.ian"),
		path.join(modelsRoot, "models", "neuria-v1.ian"),
		path.join(process.cwd(), "models", "qwen2.5-coder-1.5b-q4_k_m.gguf"),
		path.join(process.cwd(), "qwen2.5-coder-1.5b-q4_k_m.gguf"),
		path.join(process.cwd(), "neuria-v1.ian"),
	];

	if (app.isPackaged) {
		const exeDir = path.dirname(app.getPath("exe"));
		candidates.push(path.join(exeDir, "neuria-v1.ian"));
		candidates.push(path.join(exeDir, "qwen2.5-coder-1.5b-q4_k_m.gguf"));
	}

	for (const modelPath of candidates) {
		if (!fs.existsSync(modelPath)) continue;
		const stats = fs.statSync(modelPath);
		if (
			modelPath.includes("qwen2.5-coder-1.5b") &&
			stats.size < 800 * 1024 * 1024
		) {
			console.log(
				`[electron] Qwen model found but still looks incomplete: ${modelPath} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`,
			);
			continue;
		}
		return {
			path: modelPath,
			name: path.basename(modelPath),
			size: stats.size,
		};
	}

	return null;
}

function getCodifySystemPrompt() {
	return [
		"Tu és a Neuria, uma Inteligência Artificial integrada no editor Codify. Respondes em português europeu de forma concisa e direta.",
		"Quando precisares de editar código, lê primeiro o ficheiro alvo em blocos próximos, analisa as linhas adjacentes e faz apenas as substituições necessárias.",
		"Prefere edições in-place precisas em vez de criar novos ficheiros; só cria um novo ficheiro quando isso for realmente necessário.",
		"Se o ficheiro for grande, lê os trechos relevantes antes de alterar, como faria um agente cuidadoso no VS Code.",
	].join(" ");
}

function normalizeOllamaHost(host) {
	const value = (host || "").trim();
	if (!value || value === "local") return "http://127.0.0.1:11434";
	if (!/^https?:\/\//i.test(value)) return `http://${value}`;
	return value.replace(/\/$/, "");
}

async function getOllamaModels(host) {
	const baseUrl = normalizeOllamaHost(host);
	const tagsUrl = new URL("/api/tags", baseUrl).toString();
	const response = await fetch(tagsUrl);
	if (!response.ok) {
		throw new Error(`Ollama respondeu com HTTP ${response.status}`);
	}
	const data = await response.json();
	if (Array.isArray(data?.models)) {
		return data.models.map((model) => model?.name).filter(Boolean);
	}
	if (Array.isArray(data?.tags)) {
		return data.tags.map((model) => model?.name).filter(Boolean);
	}
	return [];
}

async function streamOllamaChat({
	res,
	modelName,
	host,
	prompt,
	activeFileName,
}) {
	const baseUrl = normalizeOllamaHost(host);
	const chatUrl = new URL("/api/chat", baseUrl).toString();
	const systemPrompt = getCodifySystemPrompt();

	res.write(
		`data: ${JSON.stringify({ type: "progress", value: 10, message: `A ligar ao Ollama (${modelName})...` })}\n\n`,
	);
	res.write(`data: ${JSON.stringify({ type: "loaded" })}\n\n`);

	const response = await fetch(chatUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: modelName,
			stream: true,
			messages: [
				{ role: "system", content: systemPrompt },
				{
					role: "user",
					content: activeFileName
						? `[Ficheiro ativo: ${activeFileName}]\n${prompt}`
						: prompt,
				},
			],
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Ollama respondeu com HTTP ${response.status}: ${errorText}`,
		);
	}

	if (!response.body) {
		throw new Error("Ollama não devolveu stream de resposta.");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let reply = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() || "";
		for (const line of lines) {
			const cleanLine = line.trim();
			if (!cleanLine) continue;
			try {
				const data = JSON.parse(cleanLine);
				const token = data?.message?.content || data?.response || "";
				if (token) {
					reply += token;
					res.write(
						`data: ${JSON.stringify({ type: "token", token })}\n\n`,
					);
				}
				if (data?.done) {
					break;
				}
			} catch {
				// Ignore incomplete JSON lines from the stream.
			}
		}
	}

	return reply;
}

async function getLlamaSession(onProgress) {
	const { getLlama, LlamaChatSession } = await import("node-llama-cpp");
	const bestModel = getBestLocalModelPath();
	if (!bestModel) {
		throw new Error(
			"Nenhum modelo de IA (.ian ou .gguf) foi encontrado na pasta do projeto ou ao lado do exe.",
		);
	}

	if (llamaSession && loadedModelPath !== bestModel.path) {
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
		onProgress(5, "A inicializar motor de IA...");
		const llama = await getLlama();
		onProgress(15, `A carregar ${bestModel.name}...`);
		const model = await llama.loadModel({ modelPath: bestModel.path });
		const context = await model.createContext({
			contextSize: 4096,
			threads: Math.max(1, os.cpus().length - 1),
			flashAttention: true,
		});
		llamaSession = new LlamaChatSession({
			contextSequence: context.getSequence(),
			systemPrompt: getCodifySystemPrompt(),
		});
		loadedModelPath = bestModel.path;
		onProgress(100, `Modelo ${bestModel.name} ativo!`);
		return llamaSession;
	} catch (err) {
		llamaSession = null;
		loadedModelPath = null;
		throw err;
	} finally {
		llamaLoading = false;
	}
}

async function handleChatRequest(req, res) {
	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
		"X-Accel-Buffering": "no",
	});

	let body = "";
	req.on("data", (chunk) => {
		body += chunk.toString();
	});
	req.on("end", async () => {
		try {
			const parsed = JSON.parse(body || "{}");
			const prompt = parsed.prompt || "";
			const activeFileName = parsed.activeFileName || "";
			const agentProvider = parsed.agentProvider || "auto";
			const ollamaHost = parsed.ollamaHost || "http://127.0.0.1:11434";
			const isOllamaProvider = agentProvider.startsWith("ollama:");
			const requestedOllamaModel = isOllamaProvider
				? agentProvider.slice("ollama:".length).trim()
				: "";
			const isLocalProvider =
				agentProvider === "auto" ||
				agentProvider === "local" ||
				agentProvider === "neuria-ai" ||
				agentProvider === "qweum-ai";

			const isCodeTask =
				/\b(cria|criar|edit(a|ar)?|escreve|faz|gera|adiciona|instala|apaga|remove|mostra|abre|executa|roda|corrige|debug|programa|código|ficheiro|pasta|projeto|script|html|css|js|py|json|npm|pip|git|site|app|jogo|game|função|class|import|export|componente|página|analisa|vê|lê|pdf|imagem|vídeo|foto|resumo|resumir)\b/i.test(
					prompt,
				) || !!activeFileName;

			let enrichedPrompt = prompt;
			if (isCodeTask) {
				const filesList = listWorkspaceFiles(getWorkspaceRoot());
				const filesSummary =
					filesList.length > 0
						? filesList.join("\n")
						: "(pasta vazia)";
				let fileContext = "";
				for (const relPath of filesList) {
					if (relPath.endsWith("/")) continue;
					const baseName = path.basename(relPath);
					const isMentioned =
						prompt.toLowerCase().includes(relPath.toLowerCase()) ||
						prompt.toLowerCase().includes(baseName.toLowerCase());
					const isActive =
						activeFileName &&
						(activeFileName.toLowerCase() ===
							relPath.toLowerCase() ||
							activeFileName.toLowerCase() ===
								baseName.toLowerCase());
					if (isMentioned || isActive) {
						const absPath = path.resolve(
							getWorkspaceRoot(),
							relPath,
						);
						try {
							const ext = path.extname(absPath).toLowerCase();
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
							if (isText || ext === "") {
								const content = fs.readFileSync(
									absPath,
									"utf8",
								);
								fileContext += `=== FICHEIRO: ${relPath} ===\n${content.slice(0, 4000)}\n===\n\n`;
							}
						} catch (e) {
							console.error(
								`[electron] Erro ao ler ${relPath}:`,
								e.message,
							);
						}
					}
				}
				enrichedPrompt =
					`[Pasta ativa: ${getWorkspaceRoot()}]\n` +
					`[Ficheiros do projeto:\n${filesSummary}]\n\n` +
					(fileContext
						? `[Conteúdo dos ficheiros relevantes:\n${fileContext}]\n`
						: "") +
					`Mensagem do utilizador:\n${prompt}`;
			}

			if (isOllamaProvider) {
				const modelName = requestedOllamaModel || "llama3.2";
				const reply = await streamOllamaChat({
					res,
					modelName,
					host: ollamaHost,
					prompt: enrichedPrompt,
					activeFileName,
				});
				res.write(
					`data: ${JSON.stringify({ type: "done", operations: [] })}\n\n`,
				);
				res.end();
				return reply;
			}

			if (!isLocalProvider) {
				res.write(
					`data: ${JSON.stringify({ type: "token", token: "⚠️ Este provider não está configurado para o exe. Usa Auto, Local ou um modelo Ollama (ollama:nome-do-modelo)." })}\n\n`,
				);
				res.write(`data: [DONE]\n\n`);
				res.end();
				return;
			}

			const session = await getLlamaSession((pct, msg) => {
				res.write(
					`data: ${JSON.stringify({ type: "progress", value: pct, message: msg })}\n\n`,
				);
			});

			if (!session) {
				throw new Error("Falha ao carregar a sessão local de IA");
			}

			res.write(`data: ${JSON.stringify({ type: "loaded" })}\n\n`);
			let reply = "";
			reply = await session.prompt(enrichedPrompt, {
				onTextChunk: (chunk) => {
					reply += chunk;
					res.write(
						`data: ${JSON.stringify({ type: "token", token: chunk })}\n\n`,
					);
				},
			});

			res.write(
				`data: ${JSON.stringify({ type: "done", operations: [] })}\n\n`,
			);
			res.end();
		} catch (err) {
			console.error("[electron] /api/chat error:", err);
			res.write(
				`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`,
			);
			res.end();
		}
	});
}

function serveStaticFile(res, filePath, fallbackContentType) {
	if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
		return false;
	}
	res.writeHead(200, {
		"Content-Type": fallbackContentType || getMimeType(filePath),
	});
	res.end(fs.readFileSync(filePath));
	return true;
}

async function startPackagedServer() {
	if (!app.isPackaged || packagedServer) return;

	const distRoot = path.join(__dirname, "..", "dist");
	const htmlEntry = path.join(distRoot, "index.html");
	const publicRoot = path.join(__dirname, "..", "public");

	packagedServer = http.createServer(async (req, res) => {
		try {
			const requestUrl = new URL(req.url || "/", "http://localhost");
			const pathname = decodeURIComponent(requestUrl.pathname);

			if (pathname === "/") {
				serveStaticFile(res, htmlEntry, "text/html; charset=utf-8");
				return;
			}

			if (pathname === "/preview") {
				res.writeHead(301, { Location: "/preview/" });
				res.end();
				return;
			}

			if (pathname.startsWith("/preview/")) {
				const relPath = pathname.replace(/^\/preview/, "");
				const workspaceRoot = getPreviewWorkspaceRoot();
				const targetPath =
					relPath === "/" || relPath === ""
						? path.join(workspaceRoot, "index.html")
						: path.join(workspaceRoot, relPath);

				if (serveStaticFile(res, targetPath)) return;
				res.writeHead(404, {
					"Content-Type": "text/plain; charset=utf-8",
				});
				res.end("Ficheiro nao encontrado no workspace ativo");
				return;
			}

			if (pathname === "/api/read-folder" && req.method === "GET") {
				const targetPath =
					requestUrl.searchParams.get("path") || getWorkspaceRoot();
				const absPath = path.resolve(targetPath);
				if (!fs.existsSync(absPath)) {
					sendJson(res, 404, {
						success: false,
						error: "Pasta não encontrada",
					});
					return;
				}
				currentWorkspacePath = absPath;
				sendJson(res, 200, {
					success: true,
					files: buildWorkspaceTree(absPath),
					path: absPath,
				});
				return;
			}

			if (
				pathname === "/api/open-folder-dialog" &&
				req.method === "GET"
			) {
				const result = await dialog.showOpenDialog(mainWindow, {
					properties: ["openDirectory"],
					buttonLabel: "Selecionar pasta do projeto",
				});

				if (result.canceled || !result.filePaths[0]) {
					sendJson(res, 200, {
						success: false,
						error: "Cancelado pelo utilizador",
					});
					return;
				}

				const absPath = path.resolve(result.filePaths[0]);
				currentWorkspacePath = absPath;
				sendJson(res, 200, {
					success: true,
					files: buildWorkspaceTree(absPath),
					path: absPath,
				});
				return;
			}

			if (pathname === "/api/read-file" && req.method === "GET") {
				const relPath = requestUrl.searchParams.get("path");
				if (!relPath) {
					sendJson(res, 400, {
						success: false,
						error: "Caminho em falta",
					});
					return;
				}
				const absPath = path.resolve(currentWorkspacePath, relPath);
				if (
					!absPath.startsWith(path.resolve(currentWorkspacePath)) ||
					!fs.existsSync(absPath) ||
					!fs.statSync(absPath).isFile()
				) {
					sendJson(res, 404, {
						success: false,
						error: "Ficheiro não encontrado",
					});
					return;
				}
				sendJson(res, 200, {
					success: true,
					content: fs.readFileSync(absPath, "utf8"),
				});
				return;
			}

			if (pathname === "/api/chat" && req.method === "POST") {
				await handleChatRequest(req, res);
				return;
			}

			if (pathname === "/api/save-file" && req.method === "POST") {
				let body = "";
				req.on("data", (chunk) => {
					body += chunk.toString();
				});
				req.on("end", () => {
					try {
						const parsed = JSON.parse(body || "{}");
						const pathStr = parsed.pathStr;
						const content = parsed.content ?? "";
						const isFolder = !!parsed.isFolder;
						if (
							!pathStr ||
							pathStr.includes("..") ||
							pathStr === "..."
						) {
							sendJson(res, 400, {
								success: false,
								error: "Caminho inválido",
							});
							return;
						}
						const cleanPath = pathStr.replace(/^[\\\/]+/, "");
						const absPath = path.resolve(
							currentWorkspacePath,
							cleanPath,
						);
						if (
							!absPath.startsWith(
								path.resolve(currentWorkspacePath),
							)
						) {
							sendJson(res, 400, {
								success: false,
								error: "Caminho inválido",
							});
							return;
						}
						if (isFolder) {
							if (!fs.existsSync(absPath))
								fs.mkdirSync(absPath, { recursive: true });
						} else {
							const parentDir = path.dirname(absPath);
							if (!fs.existsSync(parentDir))
								fs.mkdirSync(parentDir, { recursive: true });
							fs.writeFileSync(absPath, content, "utf8");
						}
						sendJson(res, 200, { success: true });
					} catch (e) {
						sendJson(res, 500, {
							success: false,
							error: e.message,
						});
					}
				});
				return;
			}

			if (pathname === "/api/save-file-base64" && req.method === "POST") {
				let body = "";
				req.on("data", (chunk) => {
					body += chunk.toString();
				});
				req.on("end", () => {
					try {
						const parsed = JSON.parse(body || "{}");
						const pathStr = parsed.pathStr;
						const base64 = parsed.base64;
						if (
							!pathStr ||
							pathStr.includes("..") ||
							pathStr === "..."
						) {
							sendJson(res, 400, {
								success: false,
								error: "Caminho inválido",
							});
							return;
						}
						const cleanPath = pathStr.replace(/^[\\\/]+/, "");
						const absPath = path.resolve(
							currentWorkspacePath,
							cleanPath,
						);
						if (
							!absPath.startsWith(
								path.resolve(currentWorkspacePath),
							)
						) {
							sendJson(res, 400, {
								success: false,
								error: "Caminho inválido",
							});
							return;
						}
						const parentDir = path.dirname(absPath);
						if (!fs.existsSync(parentDir))
							fs.mkdirSync(parentDir, { recursive: true });
						fs.writeFileSync(
							absPath,
							Buffer.from(base64, "base64"),
						);
						sendJson(res, 200, { success: true });
					} catch (e) {
						sendJson(res, 500, {
							success: false,
							error: e.message,
						});
					}
				});
				return;
			}

			if (pathname === "/api/ollama/models" && req.method === "GET") {
				const host = requestUrl.searchParams.get("host") || "local";
				const normalizedHost = normalizeOllamaHost(host);

				try {
					const models = await getOllamaModels(normalizedHost);
					sendJson(res, 200, { success: true, models });
				} catch (err) {
					const fallbackCandidates = [
						path.join(publicRoot, "models", "ollama-models.json"),
						path.join(
							process.resourcesPath,
							"public",
							"models",
							"ollama-models.json",
						),
					];
					for (const fallbackPath of fallbackCandidates) {
						if (fs.existsSync(fallbackPath)) {
							try {
								const raw = fs.readFileSync(
									fallbackPath,
									"utf8",
								);
								const parsed = JSON.parse(raw);
								if (Array.isArray(parsed)) {
									sendJson(res, 200, {
										success: true,
										models: parsed,
									});
									return;
								}
							} catch {}
						}
					}

					sendJson(res, 200, {
						success: false,
						error: err.message,
						models: [],
					});
				}
				return;
			}

			if (
				pathname === "/api/install-extension" &&
				req.method === "POST"
			) {
				let body = "";
				req.on("data", (chunk) => {
					body += chunk.toString();
				});
				req.on("end", () => {
					try {
						const parsed = JSON.parse(body || "{}");
						const downloadUrl = parsed.downloadUrl;
						const id = parsed.id;
						const version = parsed.version;
						if (!downloadUrl) {
							sendJson(res, 400, {
								success: false,
								error: "Missing downloadUrl",
							});
							return;
						}
						const extDir = path.join(
							currentWorkspacePath,
							".extensions",
						);
						if (!fs.existsSync(extDir))
							fs.mkdirSync(extDir, { recursive: true });
						const filePath = path.join(
							extDir,
							`${id}-${version}.vsix`,
						);
						const file = fs.createWriteStream(filePath);
						const download = (url) => {
							https
								.get(url, (response) => {
									if (
										response.statusCode === 301 ||
										response.statusCode === 302
									) {
										download(response.headers.location);
										return;
									}
									response.pipe(file);
									file.on("finish", () => {
										file.close();
										sendJson(res, 200, {
											success: true,
											path: filePath,
										});
									});
								})
								.on("error", (error) => {
									sendJson(res, 500, {
										success: false,
										error: error.message,
									});
								});
						};
						download(downloadUrl);
					} catch (e) {
						sendJson(res, 500, {
							success: false,
							error: e.message,
						});
					}
				});
				return;
			}

			if (
				pathname.startsWith("/assets/") ||
				pathname === "/favicon.ico"
			) {
				const assetRoot = fs.existsSync(distRoot)
					? distRoot
					: publicRoot;
				const target = path.join(
					assetRoot,
					pathname.replace(/^\//, ""),
				);
				if (serveStaticFile(res, target)) return;
			}

			if (
				serveStaticFile(
					res,
					path.join(distRoot, pathname.replace(/^\//, "")),
				)
			) {
				return;
			}

			serveStaticFile(res, htmlEntry, "text/html; charset=utf-8");
		} catch (error) {
			res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
			res.end(error.message);
		}
	});

	await new Promise((resolve) => {
		packagedServer.listen(PORT, resolve);
	});

	const wss = new WebSocketServer({ noServer: true });
	packagedServer.on("upgrade", (request, socket, head) => {
		if (request.url?.startsWith("/api/terminal")) {
			wss.handleUpgrade(request, socket, head, (ws) => {
				wss.emit("connection", ws, request);
			});
		}
	});

	wss.on("connection", (ws, req) => {
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
			env: process.env,
		});

		shell.onData((data) => ws.send(data));
		ws.on("message", (message) => shell.write(message.toString()));
		ws.on("close", () => shell.kill());
		shell.onExit(() => ws.close());
	});
}

// ─── Wait until Vite dev server is ready ────────────────────────────────────
function waitForServer(retries = 120) {
	return new Promise((resolve) => {
		const check = (n) => {
			if (n <= 0) return resolve(); // give up after 60 s, try anyway
			const req = http.get(`http://localhost:${PORT}`, () => resolve());
			req.on("error", () => setTimeout(() => check(n - 1), 500));
			req.end();
		};
		check(retries);
	});
}

// ─── Start Vite dev server ───────────────────────────────────────────────────
function startVite() {
	// Em produção, o servidor Vite já não é necessário (usa ficheiros estáticos)
	if (app.isPackaged) return;

	const appRoot = path.join(__dirname, "..");
	const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

	// Tenta spawn normal; em caso de erro (EINVAL, ENOENT, etc.) tenta com shell:true
	try {
		viteProcess = spawn(npmCmd, ["run", "dev"], {
			cwd: appRoot,
			env: { ...process.env },
			shell: false,
			windowsHide: true,
		});
	} catch (err) {
		console.warn(
			"[vite] spawn failed (no-shell), retrying with shell:true",
			err && err.message,
		);
		try {
			viteProcess = spawn(npmCmd, ["run", "dev"], {
				cwd: appRoot,
				env: { ...process.env },
				shell: true,
				windowsHide: true,
			});
		} catch (err2) {
			console.error(
				"[vite] spawn failed with shell as well:",
				err2 && err2.message,
			);
			viteProcess = null;
			return;
		}
	}

	if (!viteProcess) return;

	viteProcess.on("error", (err) => {
		console.error("[vite] process error:", err && err.message);
	});

	viteProcess.stdout?.on("data", (d) =>
		console.log("[vite]", d.toString().trim()),
	);
	viteProcess.stderr?.on("data", (d) =>
		console.error("[vite]", d.toString().trim()),
	);
	viteProcess.on("exit", (code) =>
		console.log("[vite] exited with code", code),
	);
}

// ─── Create main window ──────────────────────────────────────────────────────
async function createWindow() {
	// Permite forçar frameless em desenvolvimento definindo a var de ambiente
	// `FORCE_FRAMELESS=1` (útil para testar sem empacotar).
	const forceFrameless = process.env.FORCE_FRAMELESS === "1";

	mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 800,
		minHeight: 500,
		// Em produção queremos usar a barra personalizada definida na UI
		// (remover a barra de título nativa do SO).
		frame: app.isPackaged || forceFrameless ? false : true,
		// Esconde a barra de menu automática (Windows/Linux)
		autoHideMenuBar: true,
		// macOS: permitir estilos ocultos de barra de título quando apropriado
		titleBarStyle:
			process.platform === "darwin" ? "hiddenInset" : undefined,
		backgroundColor: "#0f0f0f",
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			webSecurity: false,
			preload: path.join(__dirname, "preload.cjs"),
		},
		show: false,
		title: "Codify",
	});

	// Carrega a aplicação
	if (app.isPackaged) {
		mainWindow.loadURL(`http://localhost:${PORT}`);
	} else {
		// Em desenvolvimento, espera que o servidor Vite esteja pronto
		await waitForServer();
		mainWindow.loadURL(`http://localhost:${PORT}`);
	}

	// Mostra a janela apenas após o conteúdo estar completamente carregado
	mainWindow.webContents.once("did-finish-load", () => {
		console.log("[electron] Content loaded, showing window");
		mainWindow.show();
		mainWindow.focus();
	});

	// Mostra a janela mesmo se houver erro de carregamento (para ver mensagens de erro)
	mainWindow.webContents.on("failed-to-finish-load", () => {
		console.log("[electron] Failed to load, showing window anyway");
		if (!mainWindow.isVisible()) {
			mainWindow.show();
			mainWindow.focus();
		}
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});

	// Abre links externos no browser do sistema
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});
}

// ─── IPC: controlos de janela ────────────────────────────────────────────────
ipcMain.on("window-minimize", () => mainWindow?.minimize());
ipcMain.on("window-maximize", () => {
	if (mainWindow?.isMaximized()) mainWindow.unmaximize();
	else mainWindow?.maximize();
});
ipcMain.on("window-close", () => mainWindow?.close());

// ─── IPC: Models path ────────────────────────────────────────────────────────
ipcMain.handle("get-models-path", () => {
	const modelsPath = getModelsPath();
	console.log("[electron] Models path:", modelsPath);
	return modelsPath;
});

// ─── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
	if (app.isPackaged) {
		startPackagedServer().then(() => createWindow());
		autoUpdater.checkForUpdatesAndNotify();
	} else {
		startVite();
		createWindow();
	}

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (viteProcess) {
		viteProcess.kill();
		viteProcess = null;
	}
	if (packagedServer) {
		packagedServer.close();
		packagedServer = null;
	}
	if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
	if (viteProcess) {
		viteProcess.kill();
		viteProcess = null;
	}
	if (packagedServer) {
		packagedServer.close();
		packagedServer = null;
	}
});
