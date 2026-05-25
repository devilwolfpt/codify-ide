import { useState, useEffect, useRef } from "react";
import {
	ChevronLeft,
	ChevronRight,
	LayoutGrid,
	PanelRight,
} from "lucide-react";
import { CraftyLogo as Logo } from "./Logo";

interface TopMenuBarProps {
	onCreateFile: () => void;
	onCreateFolder: () => void;
	autoSave: boolean;
	onToggleAutoSave: () => void;
	onSaveActiveFile: () => void;
	onOpenFolder: () => void;
}

interface MenuItem {
	label: string;
	shortcut?: string;
	action?: () => void;
	divider?: boolean;
}

export function TopMenuBar({
	onCreateFile,
	onCreateFolder,
	autoSave,
	onToggleAutoSave,
	onSaveActiveFile,
	onOpenFolder,
}: TopMenuBarProps) {
	const [activeMenu, setActiveMenu] = useState<string | null>(null);
	const [showAbout, setShowAbout] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	// Close menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				menuRef.current &&
				!menuRef.current.contains(event.target as Node)
			) {
				setActiveMenu(null);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const menus: Record<string, MenuItem[]> = {
		File: [
			{
				label: "Novo Ficheiro",
				shortcut: "Ctrl+N",
				action: onCreateFile,
			},
			{
				label: "Nova Pasta",
				shortcut: "Ctrl+Shift+N",
				action: onCreateFolder,
			},
			{
				label: "Abrir Pasta...",
				shortcut: "Ctrl+O",
				action: onOpenFolder,
			},
			{ divider: true, label: "" },
			{
				label: "Guardar Ficheiro",
				shortcut: "Ctrl+S",
				action: onSaveActiveFile,
			},
			{
				label: autoSave ? "✓ Auto Save" : "  Auto Save",
				action: onToggleAutoSave,
			},
		],
	};

	const handleMenuClick = (menu: string) => {
		if (activeMenu === menu) {
			setActiveMenu(null);
		} else {
			setActiveMenu(menu);
		}
	};

	const handleMenuHover = (menu: string) => {
		if (activeMenu !== null) {
			setActiveMenu(menu);
		}
	};

	const handleAction = (action?: () => void) => {
		setActiveMenu(null);
		if (action) action();
	};

	return (
		<div className="top-menu-bar" ref={menuRef}>
			<div className="floating-logo-menu">
				<div className="top-menu-logo">
					<Logo size={24} />
					<span className="top-menu-brand">Codify</span>
				</div>

				<div className="top-menu-items">
					{Object.keys(menus).map((menuName) => (
						<div key={menuName} className="top-menu-item-container">
							<button
								type="button"
								className={`top-menu-btn ${activeMenu === menuName ? "active" : ""}`}
								onClick={() => handleMenuClick(menuName)}
								onMouseEnter={() => handleMenuHover(menuName)}
							>
								{menuName}
							</button>

							{activeMenu === menuName && (
								<div className="top-menu-dropdown">
									{menus[menuName].map((item, idx) =>
										item.divider ? (
											<div
												key={`div-${idx}`}
												className="top-menu-divider"
											/>
										) : (
											<button
												key={item.label}
												type="button"
												className="top-menu-dropdown-item"
												onClick={() =>
													handleAction(item.action)
												}
											>
												<span className="dropdown-label">
													{item.label}
												</span>
												{item.shortcut && (
													<span className="dropdown-shortcut">
														{item.shortcut}
													</span>
												)}
											</button>
										),
									)}
								</div>
							)}
						</div>
					))}
				</div>
			</div>

			<div className="floating-controls">
				<button
					type="button"
					className="top-menu-nav-btn"
					aria-label="Voltar"
					title="Voltar"
				>
					<ChevronLeft size={16} />
				</button>
				<button
					type="button"
					className="top-menu-nav-btn"
					aria-label="Avançar"
					title="Avançar"
				>
					<ChevronRight size={16} />
				</button>
				<button
					type="button"
					className="top-menu-extra-btn top-menu-agents-btn"
					aria-label="Open in Agents"
					title="Open in Agents"
				>
					<span className="agents-label">Open in Agents</span>
				</button>
				<button
					type="button"
					className="top-menu-extra-btn"
					aria-label="Layout"
					title="Layout"
				>
					<LayoutGrid size={16} />
				</button>
				<button
					type="button"
					className="top-menu-extra-btn"
					aria-label="Split Panel"
					title="Split Panel"
				>
					<PanelRight size={16} />
				</button>
			</div>

			<div className="window-controls">
				<button
					type="button"
					className="window-control-btn minimize"
					aria-label="Minimizar"
					onClick={() =>
						(window as any).electron?.ipcRenderer?.send(
							"window-minimize",
						)
					}
				>
					<svg
						width="10"
						height="1"
						viewBox="0 0 10 1"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<rect width="10" height="1" fill="currentColor" />
					</svg>
				</button>
				<button
					type="button"
					className="window-control-btn maximize"
					aria-label="Maximizar"
					onClick={() =>
						(window as any).electron?.ipcRenderer?.send(
							"window-maximize",
						)
					}
				>
					<svg
						width="10"
						height="10"
						viewBox="0 0 10 10"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<rect
							x="0.5"
							y="0.5"
							width="9"
							height="9"
							stroke="currentColor"
							fill="none"
						/>
					</svg>
				</button>
				<button
					type="button"
					className="window-control-btn close"
					aria-label="Fechar"
					onClick={() => {
						// Optionally keep the confirm if they really want, but generally desktop apps close immediately
						// or handle confirmation on the backend via window.on('close'). We'll just close it directly.
						(window as any).electron?.ipcRenderer?.send(
							"window-close",
						);
					}}
				>
					<svg
						width="10"
						height="10"
						viewBox="0 0 10 10"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M1 1L9 9M9 1L1 9"
							stroke="currentColor"
							strokeLinecap="round"
						/>
					</svg>
				</button>
			</div>

			{showAbout && (
				<div
					className="about-modal-backdrop"
					onClick={() => setShowAbout(false)}
				>
					<div
						className="about-modal"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="about-modal-header">
							<h3>Sobre o Codify</h3>
							<button
								type="button"
								className="about-close-btn"
								onClick={() => setShowAbout(false)}
							>
								&times;
							</button>
						</div>
						<div className="about-modal-content">
							<div className="about-logo-wrapper">
								<Logo size={64} variant="filled" />
							</div>
							<h2>
								Codify{" "}
								<span className="version-badge">v1.2.0</span>
							</h2>
							<p className="about-description">
								Um IDE premium de desenvolvimento web e
								scripting físico super otimizado e alimentado
								por inteligência artificial local de elite.
							</p>

							<div className="about-details">
								<div className="detail-row">
									<span>Motor IA Principal:</span>
									<strong>Neuria-v1.ian (Elite Llama)</strong>
								</div>
								<div className="detail-row">
									<span>Modelo de Co-Piloto:</span>
									<strong>
										Qwen2.5-Coder 1.5B (Flash Attention)
									</strong>
								</div>
								<div className="detail-row">
									<span>Ambiente de Execução:</span>
									<strong>
										Node.js, Python, NPM (Integrated Shell)
									</strong>
								</div>
								<div className="detail-row">
									<span>Aceleração por Hardware:</span>
									<strong>
										GPU CUDA/Vulkan Offloading Ativo
									</strong>
								</div>
							</div>

							<div className="about-footer">
								<p>
									© 2026 Google Deepmind & Codify Team. Todos
									os direitos reservados.
								</p>
								<button
									type="button"
									className="about-btn-ok"
									onClick={() => setShowAbout(false)}
								>
									Confirmar
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
