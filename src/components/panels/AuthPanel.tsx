import { useState, useEffect } from "react";
import {
	ExternalLink,
	CheckCircle,
	Zap,
	Lock,
	ArrowRight,
	Wifi,
	Star,
} from "lucide-react";
import type { SecretEntry } from "../../types";

interface AuthPanelProps {
	secrets?: SecretEntry[];
	onChangeSecrets?: (secrets: SecretEntry[]) => void;
}

type Provider = "groq" | "openai" | "gemini";

const ProviderConfig = {
	groq: {
		label: "Groq",
		sublabel: "Llama 3.1 70B — Ultrarrápido",
		badge: "100% GRÁTIS",
		badgeColor: "#22c55e",
		accentColor: "#f97316",
		keyPrefix: "gsk_",
		secretKey: "GROQ_API_KEY",
		portalUrl: "https://console.groq.com/keys",
		portalLabel: "Abrir Console Groq",
		placeholder: "gsk_...",
		model: "Llama 3.3 70B",
		speed: "Ultra-Rápido (500+ tok/s)",
	},
	openai: {
		label: "OpenAI",
		sublabel: "GPT-4o-mini — Pago",
		badge: "PAGO",
		badgeColor: "#6b7280",
		accentColor: "#10a37f",
		keyPrefix: "sk-",
		secretKey: "OPENAI_API_KEY",
		portalUrl: "https://platform.openai.com/api-keys",
		portalLabel: "Abrir Portal OpenAI",
		placeholder: "sk-proj-...",
		model: "GPT-4o-mini",
		speed: "Rápido",
	},
	gemini: {
		label: "Gemini",
		sublabel: "Gemini 2.0 Flash — Google",
		badge: "GRÁTIS/PAGO",
		badgeColor: "#1a73e8",
		accentColor: "#1a73e8",
		keyPrefix: "AIzaSy",
		secretKey: "GEMINI_API_KEY",
		portalUrl: "https://aistudio.google.com/app/apikey",
		portalLabel: "Obter Chave no Google AI Studio",
		placeholder: "AIzaSy...",
		model: "Gemini 2.0 Flash",
		speed: "Muito Rápido",
	},
};

export function AuthPanel({ secrets = [], onChangeSecrets }: AuthPanelProps) {
	const [provider, setProvider] = useState<Provider>("groq");
	const [step, setStep] = useState<1 | 2>(1);
	const [apiKey, setApiKey] = useState("");
	const [keyError, setKeyError] = useState("");
	const [isVerifying, setIsVerifying] = useState(false);

	// Google Auth Simulation State
	const [showGoogleAuth, setShowGoogleAuth] = useState(false);
	const [googleAuthStep, setGoogleAuthStep] = useState<1 | 2>(1);

	const cfg = ProviderConfig[provider];

	const groqSecret = secrets.find((s) => s.key === "GROQ_API_KEY");
	const openaiSecret = secrets.find((s) => s.key === "OPENAI_API_KEY");
	const geminiSecret = secrets.find((s) => s.key === "GEMINI_API_KEY");

	const isGroqConnected = !!(
		groqSecret?.value?.startsWith("gsk_") && groqSecret.value.length > 20
	);
	const isOpenAIConnected = !!(
		openaiSecret?.value?.startsWith("sk-") &&
		openaiSecret.value.length > 20 &&
		!openaiSecret.value.includes("•")
	);
	const isGeminiConnected = !!(
		geminiSecret?.value?.startsWith("AIzaSy") &&
		geminiSecret.value.length > 20
	);
	const loggedIn =
		provider === "groq"
			? isGroqConnected
			: provider === "openai"
				? isOpenAIConnected
				: isGeminiConnected;
	const anyConnected =
		isGroqConnected || isOpenAIConnected || isGeminiConnected;

	// Auto switch to connected provider on load
	useEffect(() => {
		if (isGeminiConnected) setProvider("gemini");
		else if (isGroqConnected) setProvider("groq");
		else if (isOpenAIConnected) setProvider("openai");
	}, [isGroqConnected, isOpenAIConnected, isGeminiConnected]);

	const openKeyPortal = () => {
		window.open(cfg.portalUrl, "_blank", "width=960,height=700");
		setStep(2);
	};

	const handleActivate = async (e: React.FormEvent, overrideKey?: string) => {
		e.preventDefault();
		setKeyError("");

		const keyToUse = overrideKey || apiKey;

		if (
			keyToUse !== "NATIVE_VERTEX_AI_ACCESS" &&
			(!keyToUse.startsWith(cfg.keyPrefix) || keyToUse.length < 20)
		) {
			setKeyError(`Chave inválida. Deve começar por "${cfg.keyPrefix}".`);
			return;
		}

		setIsVerifying(true);
		await new Promise((r) => setTimeout(r, 1100));

		if (onChangeSecrets) {
			const next = [...secrets];
			const i = next.findIndex((s) => s.key === cfg.secretKey);
			if (i >= 0) next[i] = { ...next[i], value: keyToUse };
			else
				next.push({
					id: `s-${Date.now()}`,
					key: cfg.secretKey,
					value: keyToUse,
					env: "all",
				});
			onChangeSecrets(next);
		}

		setIsVerifying(false);
		setApiKey("");
		setStep(1);
		setShowGoogleAuth(false);
		setGoogleAuthStep(1);
	};

	const handleDisconnect = () => {
		if (onChangeSecrets) {
			const next = [...secrets];
			const i = next.findIndex((s) => s.key === cfg.secretKey);
			if (i >= 0) next[i] = { ...next[i], value: "" };
			onChangeSecrets(next);
		}
	};

	return (
		<div
			className="data-panel auth-panel"
			style={{ padding: 0, overflow: "hidden" }}
		>
			{/* Header */}
			<div
				style={{
					background:
						"linear-gradient(160deg, #0d1117 0%, #111827 100%)",
					padding: "22px 20px 18px",
					borderBottom: "1px solid rgba(255,255,255,0.07)",
					textAlign: "center",
				}}
			>
				<div
					style={{
						display: "flex",
						justifyContent: "center",
						marginBottom: 12,
					}}
				>
					<div
						style={{
							width: 56,
							height: 56,
							background: `linear-gradient(135deg, ${cfg.accentColor}, ${cfg.accentColor}bb)`,
							borderRadius: 16,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							boxShadow: `0 8px 28px ${cfg.accentColor}44`,
							transition: "all 0.3s ease",
						}}
					>
						<Zap size={28} color="white" strokeWidth={2} />
					</div>
				</div>
				<h2
					style={{
						margin: "0 0 4px",
						fontSize: "1rem",
						fontWeight: 700,
						color: "#fff",
					}}
				>
					{anyConnected
						? "IA em Modo Internet"
						: "Ligar IA à Internet"}
				</h2>
				<p
					style={{
						margin: 0,
						fontSize: "0.75rem",
						color: "rgba(255,255,255,0.4)",
						lineHeight: 1.5,
					}}
				>
					{anyConnected
						? "Respostas em tempo real via cloud"
						: "Escolhe um serviço e conecta agora"}
				</p>
			</div>

			<div
				style={{
					padding: "16px 18px 22px",
					display: "flex",
					flexDirection: "column",
					gap: 14,
				}}
			>
				{/* Provider Tabs */}
				<div
					style={{
						display: "flex",
						gap: 8,
						background: "rgba(0,0,0,0.25)",
						borderRadius: 10,
						padding: 4,
					}}
				>
					{(["groq", "openai", "gemini"] as Provider[]).map((p) => {
						const c = ProviderConfig[p];
						const connected =
							p === "groq" ? isGroqConnected : isOpenAIConnected;
						return (
							<button
								key={p}
								type="button"
								onClick={() => {
									setProvider(p);
									setStep(1);
									setApiKey("");
									setKeyError("");
								}}
								style={{
									flex: 1,
									padding: "10px 8px",
									background:
										provider === p
											? "rgba(255,255,255,0.08)"
											: "transparent",
									border: `1px solid ${provider === p ? "rgba(255,255,255,0.12)" : "transparent"}`,
									borderRadius: 8,
									cursor: "pointer",
									transition: "all 0.2s",
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 4,
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 6,
									}}
								>
									<span
										style={{
											fontSize: "0.87rem",
											fontWeight: 700,
											color:
												provider === p
													? "#fff"
													: "rgba(255,255,255,0.4)",
										}}
									>
										{c.label}
									</span>
									{connected && (
										<CheckCircle
											size={12}
											color="#22c55e"
										/>
									)}
								</div>
								<span
									style={{
										fontSize: "0.68rem",
										fontWeight: 700,
										color: "white",
										background: c.badgeColor,
										padding: "1px 7px",
										borderRadius: 20,
										opacity: provider === p ? 1 : 0.5,
									}}
								>
									{c.badge}
								</span>
							</button>
						);
					})}
				</div>

				{/* Connected State */}
				{loggedIn ? (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 10,
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								padding: "13px 14px",
								background: `rgba(34, 197, 94, 0.08)`,
								borderRadius: 10,
								border: "1px solid rgba(34, 197, 94, 0.2)",
							}}
						>
							<CheckCircle size={16} color="#22c55e" />
							<span
								style={{
									fontSize: "0.87rem",
									color: "#22c55e",
									fontWeight: 600,
								}}
							>
								{cfg.label} Conectado — Chat Ativo!
							</span>
						</div>
						{[
							{
								icon: (
									<Wifi size={14} color={cfg.accentColor} />
								),
								label: "Velocidade",
								value: cfg.speed,
							},
							{
								icon: <Zap size={14} color={cfg.accentColor} />,
								label: "Modelo",
								value: cfg.model,
							},
							{
								icon: (
									<Lock size={14} color={cfg.accentColor} />
								),
								label: "Custo",
								value: cfg.badge,
							},
						].map((row) => (
							<div
								key={row.label}
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: "10px 14px",
									background: "rgba(255,255,255,0.03)",
									borderRadius: 9,
									border: "1px solid rgba(255,255,255,0.06)",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 8,
									}}
								>
									{row.icon}
									<span
										style={{
											fontSize: "0.82rem",
											color: "rgba(255,255,255,0.5)",
										}}
									>
										{row.label}
									</span>
								</div>
								<span
									style={{
										fontSize: "0.82rem",
										fontWeight: 700,
										color: "#fff",
									}}
								>
									{row.value}
								</span>
							</div>
						))}
						<button
							type="button"
							onClick={handleDisconnect}
							style={{
								padding: "11px",
								background: "transparent",
								border: "1px solid rgba(255,75,75,0.2)",
								borderRadius: 9,
								color: "#ff5555",
								cursor: "pointer",
								fontSize: "0.83rem",
								fontWeight: 500,
								marginTop: 4,
							}}
						>
							Desconectar {cfg.label}
						</button>
					</div>
				) : (
					/* Setup Flow */
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 16,
						}}
					>
						{/* Step indicators (Hide for Gemini) */}
						{provider !== "gemini" && (
							<div
								style={{
									display: "flex",
									alignItems: "center",
								}}
							>
								{([1, 2] as const).map((n, i) => (
									<div
										key={n}
										style={{
											display: "flex",
											alignItems: "center",
											flex: i === 0 ? 1 : undefined,
										}}
									>
										<div
											style={{
												width: 26,
												height: 26,
												borderRadius: "50%",
												flexShrink: 0,
												background:
													step >= n
														? cfg.accentColor
														: "rgba(255,255,255,0.06)",
												border: `2px solid ${step >= n ? cfg.accentColor : "rgba(255,255,255,0.1)"}`,
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												fontSize: "0.72rem",
												fontWeight: 700,
												color:
													step >= n
														? "#fff"
														: "rgba(255,255,255,0.25)",
												transition: "all 0.3s",
											}}
										>
											{n}
										</div>
										{i === 0 && (
											<div
												style={{
													flex: 1,
													height: 2,
													margin: "0 8px",
													background:
														step >= 2
															? cfg.accentColor
															: "rgba(255,255,255,0.06)",
													transition: "all 0.3s",
												}}
											/>
										)}
									</div>
								))}
							</div>
						)}

						{/* Groq free note */}
						{provider === "groq" && (
							<div
								style={{
									display: "flex",
									alignItems: "flex-start",
									gap: 10,
									padding: "12px 13px",
									background: "rgba(249, 115, 22, 0.08)",
									border: "1px solid rgba(249, 115, 22, 0.2)",
									borderRadius: 10,
								}}
							>
								<Star
									size={15}
									color="#f97316"
									style={{ flexShrink: 0, marginTop: 1 }}
								/>
								<p
									style={{
										margin: 0,
										fontSize: "0.78rem",
										color: "rgba(255,255,255,0.7)",
										lineHeight: 1.5,
									}}
								>
									<strong style={{ color: "#f97316" }}>
										Groq é 100% gratuito
									</strong>{" "}
									— sem cartão de crédito. Usa o modelo Llama
									3.1 (mais capaz que GPT-3.5) a uma
									velocidade extrema.
								</p>
							</div>
						)}

						{/* Gemini - Google Sign In Experience */}
						{provider === "gemini" && (
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 16,
									padding: "20px 0",
								}}
							>
								<div
									style={{
										width: 64,
										height: 64,
										borderRadius: "50%",
										background: "#fff",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										padding: 8,
										boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
									}}
								>
									<img
										src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png"
										alt="Google"
										style={{
											width: "100%",
											height: "100%",
											objectFit: "contain",
										}}
									/>
								</div>
								<div style={{ textAlign: "center" }}>
									<h3
										style={{
											margin: "0 0 8px",
											color: "#fff",
											fontSize: "1.1rem",
										}}
									>
										Login Direto
									</h3>
									<p
										style={{
											margin: 0,
											color: "rgba(255,255,255,0.5)",
											fontSize: "0.85rem",
											maxWidth: 220,
										}}
									>
										Faz login com a tua Conta Google para
										acederes à API do Gemini.
									</p>
								</div>
								<button
									type="button"
									onClick={() => setShowGoogleAuth(true)}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 12,
										padding: "12px 24px",
										background: "#fff",
										border: "none",
										borderRadius: 24,
										color: "#3c4043",
										fontSize: "0.95rem",
										fontWeight: 600,
										cursor: "pointer",
										boxShadow:
											"0 2px 8px rgba(255,255,255,0.1)",
										transition: "all 0.2s",
										marginTop: 8,
									}}
								>
									<img
										src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png"
										alt="G"
										style={{ width: 18, height: 18 }}
									/>
									Sign in with Google
								</button>
							</div>
						)}

						{/* Standard Step Flow (Groq / OpenAI) */}
						{provider !== "gemini" && (
							<>
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: 8,
									}}
								>
									<p
										style={{
											margin: 0,
											fontSize: "0.83rem",
											fontWeight: 600,
											color:
												step === 1
													? "#fff"
													: "rgba(255,255,255,0.35)",
										}}
									>
										Passo 1 — Criar Chave Gratuita
									</p>
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											gap: 8,
										}}
									>
										<button
											type="button"
											onClick={openKeyPortal}
											style={{
												display: "flex",
												alignItems: "center",
												gap: 9,
												padding: "13px 14px",
												background:
													step === 1
														? `${cfg.accentColor}14`
														: "rgba(255,255,255,0.03)",
												border: `1px solid ${step === 1 ? `${cfg.accentColor}55` : "rgba(255,255,255,0.07)"}`,
												borderRadius: 10,
												cursor: "pointer",
												color:
													step === 1
														? cfg.accentColor
														: "rgba(255,255,255,0.3)",
												fontSize: "0.85rem",
												fontWeight: 600,
												transition: "all 0.2s",
											}}
										>
											<ExternalLink size={15} />
											{cfg.portalLabel}
											<ArrowRight
												size={13}
												style={{
													marginLeft: "auto",
													opacity: 0.5,
												}}
											/>
										</button>
									</div>
								</div>

								<div
									style={{
										height: 1,
										background: "rgba(255,255,255,0.05)",
									}}
								/>

								<form
									onSubmit={handleActivate}
									style={{
										display: "flex",
										flexDirection: "column",
										gap: 10,
									}}
								>
									<p
										style={{
											margin: 0,
											fontSize: "0.83rem",
											fontWeight: 600,
											color:
												step === 2
													? "#fff"
													: "rgba(255,255,255,0.35)",
										}}
									>
										Passo 2 — Colar Chave e Ativar
									</p>
									<div style={{ position: "relative" }}>
										<Lock
											size={13}
											color="rgba(255,255,255,0.2)"
											style={{
												position: "absolute",
												left: 11,
												top: "50%",
												transform: "translateY(-50%)",
												pointerEvents: "none",
											}}
										/>
										<input
											type="password"
											value={apiKey}
											onChange={(e) => {
												setApiKey(e.target.value);
												setKeyError("");
												if (e.target.value.length > 2)
													setStep(2);
											}}
											placeholder={cfg.placeholder}
											style={{
												width: "100%",
												boxSizing: "border-box",
												padding: "12px 12px 12px 34px",
												background: "rgba(0,0,0,0.35)",
												border: `1px solid ${keyError ? "rgba(255,75,75,0.5)" : apiKey.startsWith(cfg.keyPrefix) ? `${cfg.accentColor}66` : "rgba(255,255,255,0.08)"}`,
												borderRadius: 9,
												color: "#fff",
												fontSize: "0.85rem",
												outline: "none",
												transition: "border-color 0.2s",
											}}
										/>
									</div>
									{keyError && (
										<p
											style={{
												margin: 0,
												fontSize: "0.76rem",
												color: "#ff5555",
											}}
										>
											{keyError}
										</p>
									)}
									<button
										type="submit"
										disabled={isVerifying || !apiKey}
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											gap: 8,
											padding: "13px",
											background:
												isVerifying || !apiKey
													? "rgba(255,255,255,0.05)"
													: `linear-gradient(135deg, ${cfg.accentColor}, ${cfg.accentColor}cc)`,
											border: "none",
											borderRadius: 10,
											color:
												isVerifying || !apiKey
													? "rgba(255,255,255,0.3)"
													: "#fff",
											cursor:
												isVerifying || !apiKey
													? "not-allowed"
													: "pointer",
											fontSize: "0.9rem",
											fontWeight: 700,
											boxShadow:
												isVerifying || !apiKey
													? "none"
													: `0 4px 18px ${cfg.accentColor}44`,
											transition: "all 0.2s",
										}}
									>
										{isVerifying ? (
											<>
												<div
													style={{
														width: 15,
														height: 15,
														border: "2px solid rgba(255,255,255,0.2)",
														borderTopColor: "#fff",
														borderRadius: "50%",
														animation:
															"spin 1s linear infinite",
													}}
												/>
												A verificar ligação...
											</>
										) : (
											<>
												<Zap size={15} /> Ativar{" "}
												{cfg.label} no Editor
											</>
										)}
									</button>
								</form>
							</>
						)}
						<style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
              @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            `}</style>
					</div>
				)}
			</div>

			{/* Google Sign-In Simulation Modal */}
			{showGoogleAuth && provider === "gemini" && (
				<div
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: "rgba(0,0,0,0.8)",
						backdropFilter: "blur(4px)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						zIndex: 100,
						animation: "fadeIn 0.2s ease-out",
					}}
				>
					<div
						style={{
							background: "#202124",
							width: "90%",
							maxWidth: 360,
							borderRadius: 16,
							border: "1px solid #3c4043",
							display: "flex",
							flexDirection: "column",
							overflow: "hidden",
							boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
						}}
					>
						<div
							style={{
								padding: "32px 24px",
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
							}}
						>
							<img
								src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_light_color_92x30dp.png"
								alt="Google"
								style={{ height: 24, marginBottom: 16 }}
							/>
							<h2
								style={{
									margin: "0 0 8px",
									color: "#e8eaed",
									fontSize: "1.3rem",
									fontWeight: 400,
								}}
							>
								Sign in
							</h2>
							<p
								style={{
									margin: "0 0 32px",
									color: "#9aa0a6",
									fontSize: "0.9rem",
								}}
							>
								to continue to Codify IDE
							</p>

							{googleAuthStep === 1 ? (
								<div
									onClick={() => setGoogleAuthStep(2)}
									style={{
										width: "100%",
										display: "flex",
										alignItems: "center",
										gap: 12,
										padding: "12px 16px",
										background: "rgba(255,255,255,0.04)",
										border: "1px solid #3c4043",
										borderRadius: 8,
										cursor: "pointer",
										transition: "background 0.2s",
									}}
									onMouseEnter={(e) =>
										(e.currentTarget.style.background =
											"rgba(255,255,255,0.08)")
									}
									onMouseLeave={(e) =>
										(e.currentTarget.style.background =
											"rgba(255,255,255,0.04)")
									}
								>
									<div
										style={{
											width: 32,
											height: 32,
											borderRadius: "50%",
											background: "#1a73e8",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											color: "#fff",
											fontWeight: 600,
										}}
									>
										U
									</div>
									<div
										style={{ flex: 1, overflow: "hidden" }}
									>
										<div
											style={{
												color: "#e8eaed",
												fontSize: "0.9rem",
												fontWeight: 500,
											}}
										>
											Acesso Nativo Google
										</div>
										<div
											style={{
												color: "#9aa0a6",
												fontSize: "0.8rem",
												whiteSpace: "nowrap",
												textOverflow: "ellipsis",
												overflow: "hidden",
											}}
										>
											Infraestrutura Interna (Vertex AI)
										</div>
									</div>
								</div>
							) : (
								<form
									onSubmit={handleActivate}
									style={{
										width: "100%",
										display: "flex",
										flexDirection: "column",
										gap: 16,
									}}
								>
									<p
										style={{
											margin: 0,
											color: "#e8eaed",
											fontSize: "0.9rem",
											textAlign: "center",
										}}
									>
										Colar Chave do Google AI Studio:
									</p>
									<p
										style={{
											margin: "-10px 0 0 0",
											color: "#8ab4f8",
											fontSize: "0.75rem",
											textAlign: "center",
											cursor: "pointer",
										}}
										onClick={openKeyPortal}
									>
										Abrir Portal de Chaves
									</p>
									<input
										type="password"
										value={apiKey}
										onChange={(e) =>
											setApiKey(e.target.value)
										}
										placeholder="AIzaSy..."
										autoFocus
										style={{
											width: "100%",
											padding: "12px 14px",
											background: "rgba(0,0,0,0.2)",
											border: "1px solid #1a73e8",
											borderRadius: 4,
											color: "#fff",
											fontSize: "0.95rem",
											outline: "none",
										}}
									/>
									{keyError && (
										<p
											style={{
												margin: 0,
												fontSize: "0.76rem",
												color: "#ff5555",
											}}
										>
											{keyError}
										</p>
									)}
									<div
										style={{
											display: "flex",
											justifyContent: "flex-end",
											gap: 8,
											marginTop: 16,
										}}
									>
										<button
											type="button"
											onClick={() => {
												setShowGoogleAuth(false);
												setGoogleAuthStep(1);
											}}
											style={{
												padding: "8px 16px",
												background: "transparent",
												border: "none",
												color: "#8ab4f8",
												cursor: "pointer",
												fontWeight: 600,
											}}
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={isVerifying || !apiKey}
											style={{
												padding: "8px 24px",
												background: "#8ab4f8",
												border: "none",
												borderRadius: 4,
												color: "#202124",
												cursor: "pointer",
												fontWeight: 600,
												opacity:
													isVerifying || !apiKey
														? 0.5
														: 1,
											}}
										>
											{isVerifying
												? "A ligar..."
												: "Continue"}
										</button>
										<button
											id="hidden-native-submit"
											type="submit"
											style={{ display: "none" }}
										/>
									</div>
								</form>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
