import { useState, useEffect } from "react";
import { X, Settings, Plus, Trash2, Code, BookOpen } from "lucide-react";

export interface ConfigSettings {
	ollamaModels: string[];
	ollamaMode: "local" | "remote";
	ollamaHost: string;
	apiKeys: {
		gemini?: string;
		openai?: string;
		groq?: string;
	};
	systemPrompt: string;
	customInstructions: string;
}

interface SettingsPanelProps {
	open: boolean;
	onClose: () => void;
	settings: ConfigSettings;
	onSave: (settings: ConfigSettings) => void;
}

export function SettingsPanel({
	open,
	onClose,
	settings,
	onSave,
}: SettingsPanelProps) {
	const [localSettings, setLocalSettings] =
		useState<ConfigSettings>(settings);
	const [newModel, setNewModel] = useState("");
	const [activeTab, setActiveTab] = useState<
		"models" | "api" | "prompt" | "instructions"
	>("models");
	const [detectStatus, setDetectStatus] = useState<
		"idle" | "loading" | "done" | "error"
	>("idle");
	const [detectError, setDetectError] = useState<string | null>(null);
	const [connectionStatus, setConnectionStatus] = useState<
		"idle" | "loading" | "ok" | "error"
	>("idle");
	const [connectionError, setConnectionError] = useState<string | null>(null);

	useEffect(() => {
		setLocalSettings(settings);
	}, [settings]);

	// Quando o painel abre, tentar detetar automaticamente os modelos Ollama
	useEffect(() => {
		if (!open) return;
		// dispara a deteção automática
		detectOllamaModels();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const handleAddModel = () => {
		if (newModel.trim()) {
			setLocalSettings({
				...localSettings,
				ollamaModels: [...localSettings.ollamaModels, newModel.trim()],
			});
			setNewModel("");
		}
	};

	const handleRemoveModel = (model: string) => {
		setLocalSettings({
			...localSettings,
			ollamaModels: localSettings.ollamaModels.filter((m) => m !== model),
		});
	};

	const handleSave = () => {
		onSave(localSettings);
		onClose();
	};

	const normalizedHost =
		localSettings.ollamaHost?.trim() || "http://127.0.0.1:11434";

	const modeLabel =
		localSettings.ollamaMode === "remote" ? "remoto" : "local";

	async function detectOllamaModels() {
		setDetectStatus("loading");
		setDetectError(null);
		try {
			const params = new URLSearchParams({
				host:
					localSettings.ollamaMode === "remote"
						? normalizedHost
						: "local",
			});
			const res = await fetch(`/api/ollama/models?${params.toString()}`);
			if (res.ok) {
				const data = await res.json();
				const models: string[] = Array.isArray(data)
					? data
					: Array.isArray(data?.models)
						? data.models
						: [];
				if (models.length > 0) {
					setLocalSettings((s) => ({
						...s,
						ollamaModels: Array.from(
							new Set([...s.ollamaModels, ...models]),
						),
					}));
					setDetectStatus("done");
					return;
				}
			}
			// Fallback local: tentar carregar ficheiro JSON estático
			if (localSettings.ollamaMode === "local") {
				try {
					const res2 = await fetch("/models/ollama-models.json");
					if (res2.ok) {
						const data2 = await res2.json();
						if (Array.isArray(data2)) {
							setLocalSettings((s) => ({
								...s,
								ollamaModels: Array.from(
									new Set([...s.ollamaModels, ...data2]),
								),
							}));
							setDetectStatus("done");
							return;
						}
					}
				} catch (e) {
					// ignore fallback error
				}
			}
			setDetectStatus("error");
			setDetectError(
				`Não foi possível detetar modelos Ollama (${modeLabel}).`,
			);
		} catch (err: any) {
			setDetectStatus("error");
			setDetectError(err?.message || "Erro desconhecido");
		}
	}

	async function testOllamaConnection() {
		setConnectionStatus("loading");
		setConnectionError(null);
		try {
			const params = new URLSearchParams({
				host:
					localSettings.ollamaMode === "remote"
						? normalizedHost
						: "local",
			});
			const res = await fetch(`/api/ollama/models?${params.toString()}`);
			if (!res.ok) {
				setConnectionStatus("error");
				setConnectionError(`Falha HTTP ${res.status}`);
				return;
			}
			const data = await res.json();
			if (data?.success === false) {
				setConnectionStatus("error");
				setConnectionError(
					data?.error || "Sem resposta do servidor Ollama",
				);
				return;
			}
			setConnectionStatus("ok");
		} catch (err: any) {
			setConnectionStatus("error");
			setConnectionError(err?.message || "Erro desconhecido");
		}
	}

	if (!open) return null;

	return (
		<div className="settings-overlay" onClick={onClose} role="presentation">
			<div
				className="settings-panel"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
			>
				<header className="settings-header">
					<div className="settings-title">
						<Settings size={20} />
						<h2>Configurações</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="settings-close"
						aria-label="Fechar"
					>
						<X size={20} />
					</button>
				</header>

				<div className="settings-tabs">
					<button
						className={`settings-tab ${activeTab === "models" ? "active" : ""}`}
						onClick={() => setActiveTab("models")}
					>
						<Code size={16} />
						Modelos
					</button>
					<button
						className={`settings-tab ${activeTab === "api" ? "active" : ""}`}
						onClick={() => setActiveTab("api")}
					>
						🔑 API
					</button>
					<button
						className={`settings-tab ${activeTab === "prompt" ? "active" : ""}`}
						onClick={() => setActiveTab("prompt")}
					>
						💬 Prompt
					</button>
					<button
						className={`settings-tab ${activeTab === "instructions" ? "active" : ""}`}
						onClick={() => setActiveTab("instructions")}
					>
						<BookOpen size={16} />
						Instruções
					</button>
				</div>

				<div className="settings-content">
					{/* Modelos Tab */}
					{activeTab === "models" && (
						<div className="settings-section">
							<h3>Modelos GGUF do Ollama</h3>
							<p className="settings-desc">
								Adicione modelos locais GGUF que está a executar
								via Ollama
							</p>

							<div className="settings-field">
								<label>Fonte Ollama</label>
								<div className="settings-ollama-mode-row">
									<label className="settings-radio">
										<input
											type="radio"
											name="ollama-mode"
											checked={
												localSettings.ollamaMode ===
												"local"
											}
											onChange={() =>
												setLocalSettings((s) => ({
													...s,
													ollamaMode: "local",
												}))
											}
										/>
										<span>Local</span>
									</label>
									<label className="settings-radio">
										<input
											type="radio"
											name="ollama-mode"
											checked={
												localSettings.ollamaMode ===
												"remote"
											}
											onChange={() =>
												setLocalSettings((s) => ({
													...s,
													ollamaMode: "remote",
												}))
											}
										/>
										<span>Remoto</span>
									</label>
								</div>
							</div>

							<div className="settings-field">
								<label>URL do Ollama</label>
								<input
									type="text"
									placeholder="http://127.0.0.1:11434"
									value={localSettings.ollamaHost}
									onChange={(e) =>
										setLocalSettings((s) => ({
											...s,
											ollamaHost: e.target.value,
										}))
									}
									className="settings-input"
									disabled={
										localSettings.ollamaMode === "local"
									}
								/>
							</div>

							<div
								style={{
									display: "flex",
									gap: 8,
									alignItems: "center",
									marginBottom: 12,
								}}
							>
								<button
									type="button"
									className="settings-btn secondary"
									onClick={detectOllamaModels}
								>
									Detectar modelos Ollama
								</button>
								<button
									type="button"
									className="settings-btn secondary"
									onClick={testOllamaConnection}
								>
									Testar ligação
								</button>
								{detectStatus === "loading" && (
									<span
										style={{
											color: "var(--accent)",
											fontSize: 13,
										}}
									>
										A detectar…
									</span>
								)}
								{detectStatus === "done" && (
									<span
										style={{
											color: "#7dd3fc",
											fontSize: 13,
										}}
									>
										Modelos adicionados
									</span>
								)}
								{detectStatus === "error" && (
									<span
										style={{
											color: "#fb7185",
											fontSize: 13,
										}}
									>
										{detectError}
									</span>
								)}
								{connectionStatus === "loading" && (
									<span
										style={{
											color: "var(--accent)",
											fontSize: 13,
										}}
									>
										A testar ligação…
									</span>
								)}
								{connectionStatus === "ok" && (
									<span
										style={{
											color: "#34d399",
											fontSize: 13,
										}}
									>
										Ligação OK ({modeLabel})
									</span>
								)}
								{connectionStatus === "error" && (
									<span
										style={{
											color: "#fb7185",
											fontSize: 13,
										}}
									>
										{connectionError}
									</span>
								)}
							</div>

							<div className="settings-add-model">
								<input
									type="text"
									placeholder="ex: qwen2.5-coder:7b"
									value={newModel}
									onChange={(e) =>
										setNewModel(e.target.value)
									}
									onKeyPress={(e) => {
										if (e.key === "Enter") handleAddModel();
									}}
									className="settings-input"
								/>
								<button
									type="button"
									onClick={handleAddModel}
									className="settings-add-btn"
									title="Adicionar modelo"
								>
									<Plus size={18} />
								</button>
							</div>

							<ul className="settings-list">
								{localSettings.ollamaModels.map((model) => (
									<li
										key={model}
										className="settings-list-item"
									>
										<span>{model}</span>
										<button
											type="button"
											onClick={() =>
												handleRemoveModel(model)
											}
											className="settings-remove-btn"
											title="Remover modelo"
										>
											<Trash2 size={16} />
										</button>
									</li>
								))}
							</ul>
						</div>
					)}

					{/* API Tab */}
					{activeTab === "api" && (
						<div className="settings-section">
							<h3>Chaves de API</h3>
							<p className="settings-desc">
								Configure suas chaves de API para os serviços
								cloud
							</p>

							<div className="settings-field">
								<label>Gemini API Key</label>
								<input
									type="password"
									placeholder="Sua chave de API do Gemini"
									value={localSettings.apiKeys.gemini || ""}
									onChange={(e) =>
										setLocalSettings({
											...localSettings,
											apiKeys: {
												...localSettings.apiKeys,
												gemini: e.target.value,
											},
										})
									}
									className="settings-input"
								/>
							</div>

							<div className="settings-field">
								<label>OpenAI API Key</label>
								<input
									type="password"
									placeholder="Sua chave de API da OpenAI"
									value={localSettings.apiKeys.openai || ""}
									onChange={(e) =>
										setLocalSettings({
											...localSettings,
											apiKeys: {
												...localSettings.apiKeys,
												openai: e.target.value,
											},
										})
									}
									className="settings-input"
								/>
							</div>

							<div className="settings-field">
								<label>Groq API Key</label>
								<input
									type="password"
									placeholder="Sua chave de API da Groq"
									value={localSettings.apiKeys.groq || ""}
									onChange={(e) =>
										setLocalSettings({
											...localSettings,
											apiKeys: {
												...localSettings.apiKeys,
												groq: e.target.value,
											},
										})
									}
									className="settings-input"
								/>
							</div>
						</div>
					)}

					{/* Prompt Tab */}
					{activeTab === "prompt" && (
						<div className="settings-section">
							<h3>Prompt do Sistema</h3>
							<p className="settings-desc">
								Customize o comportamento padrão do assistente
							</p>

							<textarea
								value={localSettings.systemPrompt}
								onChange={(e) =>
									setLocalSettings({
										...localSettings,
										systemPrompt: e.target.value,
									})
								}
								className="settings-textarea"
								rows={8}
								placeholder="Defina como o assistente deve se comportar..."
							/>
						</div>
					)}

					{/* Instructions Tab */}
					{activeTab === "instructions" && (
						<div className="settings-section">
							<h3>Instruções Personalizadas</h3>
							<p className="settings-desc">
								Como no VS Code, adicione instruções globais
								para o assistente
							</p>

							<textarea
								value={localSettings.customInstructions}
								onChange={(e) =>
									setLocalSettings({
										...localSettings,
										customInstructions: e.target.value,
									})
								}
								className="settings-textarea"
								rows={8}
								placeholder="Adicione instruções personalizadas aqui..."
							/>
						</div>
					)}
				</div>

				<footer className="settings-footer">
					<button
						type="button"
						onClick={onClose}
						className="settings-btn secondary"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={handleSave}
						className="settings-btn primary"
					>
						Guardar Alterações
					</button>
				</footer>
			</div>
		</div>
	);
}
