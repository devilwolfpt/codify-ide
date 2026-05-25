import { useState, useRef, useEffect } from "react";
import {
	ArrowLeft,
	ArrowRight,
	RotateCw,
	ExternalLink,
	Link2,
	Monitor,
	Palette,
	Settings,
	Copy,
	MousePointer2,
	Hand,
	Pencil,
	Layout,
	Plus,
	Play,
	Wrench,
	Globe,
	X,
	Columns,
} from "lucide-react";

export function BrowserPreview() {
	const initialUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}/preview/`;
	const [url, setUrl] = useState(initialUrl);
	const [inputUrl, setInputUrl] = useState(initialUrl);
	const [key, setKey] = useState(0);
	const [canvasMode, setCanvasMode] = useState(false);
	const [showUrlPopup, setShowUrlPopup] = useState(false);
	const [showDevicePopup, setShowDevicePopup] = useState(false);
	const [activeDevice, setActiveDevice] = useState("Full size");
	const [canvasTool, setCanvasTool] = useState("pointer");
	const [showLogs, setShowLogs] = useState(false);
	const [isPrivateDevEnabled, setIsPrivateDevEnabled] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const popupRef = useRef<HTMLDivElement>(null);
	const devicePopupRef = useRef<HTMLDivElement>(null);

	// Click outside to close popup
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				popupRef.current &&
				!popupRef.current.contains(event.target as Node)
			) {
				setShowUrlPopup(false);
			}
			if (
				devicePopupRef.current &&
				!devicePopupRef.current.contains(event.target as Node)
			) {
				setShowDevicePopup(false);
			}
		};

		if (showUrlPopup || showDevicePopup) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [showUrlPopup, showDevicePopup]);

	const devices = [
		"Full size",
		"16:9",
		"iPhone SE",
		"iPhone Air",
		"iPhone 17",
		"iPhone 17 Pro",
		"iPhone 17 Pro Max",
		"Pixel 10",
		"Pixel 10 Pro",
		"Pixel 10 Pro XL",
		"Samsung Galaxy S25",
		"Samsung Galaxy S25+",
		"Samsung Galaxy S25 Ultra",
	];
	// allow external components to request a preview via CustomEvent('preview-open', { detail: { url } })
	useEffect(() => {
		const handler = (e: any) => {
			const u = e?.detail?.url;
			if (typeof u === "string") {
				setUrl(u);
				setInputUrl(u);
				setKey((k) => k + 1);
				setCanvasMode(false);
			}
		};
		window.addEventListener("preview-open", handler as EventListener);
		return () =>
			window.removeEventListener(
				"preview-open",
				handler as EventListener,
			);
	}, []);

	const handleNavigate = (e: React.FormEvent) => {
		e.preventDefault();
		let targetUrl = inputUrl.trim();
		if (!/^https?:\/\//i.test(targetUrl)) {
			targetUrl = "http://" + targetUrl;
		}
		setUrl(targetUrl);
		setInputUrl(targetUrl);
		setCanvasMode(false);
	};

	const handleReload = () => {
		setKey((prev) => prev + 1);
		setCanvasMode(false);
	};

	const handleOpenExternal = () => {
		window.open(url, "_blank");
	};

	const syncCanvasMode = (enabled: boolean) => {
		if (iframeRef.current?.contentWindow) {
			try {
				const iframeDoc =
					iframeRef.current.contentDocument ||
					iframeRef.current.contentWindow.document;
				if (!iframeDoc) return;

				if (enabled) {
					// Inject Canvas editing functionality
					const script = iframeDoc.createElement("script");
					script.id = "canvas-edit-script";
					script.textContent = `
          (function() {
            if (window.__canvasObserver) return;
            let editedElements = new WeakMap();
            let processed = new WeakSet();

            const editableSelectors = 'p, h1, h2, h3, h4, h5, h6, span, div, a, li, button, label, figcaption';

            function isEditableElement(el) {
              if (processed.has(el)) return false;
              if (!el.textContent.trim()) return false;
              if (el.querySelector('input, textarea, script, style')) return false;
              if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return false;
              
              return ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'DIV', 'A', 'LI', 'BUTTON', 'LABEL', 'FIGCAPTION'].includes(el.tagName);
            }

            function enableEditableElement(el) {
              if (!isEditableElement(el)) return;
              
              processed.add(el);
              el.dataset.oldOutline = el.style.outline;
              el.dataset.oldCursor = el.style.cursor;
              el.contentEditable = 'true';
              el.spellcheck = false;
              
              el.style.outline = '2px dashed rgba(79, 195, 247, 0.4)';
              el.style.outlineOffset = '2px';
              el.style.cursor = 'text';
              
              editedElements.set(el, el.innerHTML);

              el.addEventListener('input', function(e) { e.stopPropagation(); }, true);

              el.addEventListener('blur', function() {
                if (el.innerHTML !== editedElements.get(el)) {
                  editedElements.set(el, el.innerHTML);
                  window.parent.postMessage({
                    type: 'canvas-update',
                    tag: el.tagName,
                    text: el.textContent,
                    html: el.innerHTML
                  }, '*');
                }
              });

              el.addEventListener('focus', function() {
                el.style.outline = '2px solid rgba(79, 195, 247, 1)';
              });

              el.addEventListener('blur', function() {
                el.style.outline = '2px dashed rgba(79, 195, 247, 0.4)';
              });
            }

            function makeElementsEditable() {
              const elements = document.querySelectorAll(editableSelectors);
              elements.forEach(el => { enableEditableElement(el); });
            }

            makeElementsEditable();

            window.__canvasObserver = new MutationObserver((mutations) => {
              mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                  mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                      enableEditableElement(node);
                      node.querySelectorAll(editableSelectors).forEach(el => {
                        enableEditableElement(el);
                      });
                    }
                  });
                }
              });
            });

            window.__canvasObserver.observe(document.body, {
              childList: true,
              subtree: true
            });
          })();
        `;
					iframeDoc.body.appendChild(script);
				} else {
					// Disable Canvas editing
					const script = iframeDoc.createElement("script");
					script.textContent = `
            (function() {
              if (window.__canvasObserver) {
                window.__canvasObserver.disconnect();
                delete window.__canvasObserver;
              }
              const elements = document.querySelectorAll('[contenteditable="true"]');
              elements.forEach(el => {
                el.contentEditable = 'inherit';
                el.style.outline = el.dataset.oldOutline || 'none';
                el.style.cursor = el.dataset.oldCursor || 'inherit';
                delete el.dataset.oldOutline;
                delete el.dataset.oldCursor;
              });
              const oldScript = document.getElementById('canvas-edit-script');
              if (oldScript) oldScript.remove();
            })();
          `;
					iframeDoc.body.appendChild(script);
				}
			} catch (e) {
				console.error("Canvas sync error:", e);
			}
		}
	};

	// Synchronize canvas mode with iframe state
	useEffect(() => {
		const timer = setTimeout(
			() => {
				syncCanvasMode(canvasMode);
			},
			canvasMode ? 800 : 100,
		);
		return () => clearTimeout(timer);
	}, [canvasMode, key, url]);

	// Listen for canvas updates from iframe
	useEffect(() => {
		const handleCanvasUpdate = (event: MessageEvent) => {
			if (event.data.type === "canvas-update") {
				// Dispatch event for parent components to handle code updates
				window.dispatchEvent(
					new CustomEvent("canvas-text-update", {
						detail: {
							tag: event.data.tag,
							text: event.data.text,
							html: event.data.html,
						},
					}),
				);
			}
		};

		window.addEventListener("message", handleCanvasUpdate);
		return () => window.removeEventListener("message", handleCanvasUpdate);
	}, []);

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				height: "100%",
				width: "100%",
				background: "#1e1e1e",
			}}
		>
			{/* Unified Browser Toolbar (Codify Style) */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr auto 1fr",
					alignItems: "center",
					padding: "8px 12px",
					background: "#0e1011",
					borderBottom: "1px solid #1e1e1e",
					userSelect: "none",
				}}
			>
				{/* Left: Mode Toggle */}
				<div
					style={{
						display: "flex",
						justifyContent: "flex-start",
						background: "rgba(0,0,0,0.2)",
						padding: "2px",
						borderRadius: "8px",
						border: "1px solid rgba(255,255,255,0.05)",
						width: "fit-content",
					}}
				>
					<button
						type="button"
						onClick={() => setCanvasMode(false)}
						style={{
							display: "flex",
							alignItems: "center",
							gap: "6px",
							padding: "4px 10px",
							borderRadius: "6px",
							background: !canvasMode ? "#27272a" : "transparent",
							border: "none",
							color: !canvasMode ? "#fff" : "#a1a1aa",
							cursor: "pointer",
							fontSize: "12px",
							fontWeight: 500,
						}}
					>
						<Globe size={14} strokeWidth={1.5} />
						Browser
					</button>
					<button
						type="button"
						onClick={() => setCanvasMode(true)}
						style={{
							display: "flex",
							alignItems: "center",
							gap: "6px",
							padding: "4px 10px",
							borderRadius: "6px",
							background: canvasMode ? "#27272a" : "transparent",
							border: "none",
							color: canvasMode ? "#fff" : "#a1a1aa",
							cursor: "pointer",
							fontSize: "12px",
							fontWeight: 500,
						}}
					>
						<Palette size={14} strokeWidth={1.5} />
						Canvas
					</button>
				</div>

				{/* Center: Unified Pod */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						background: "#1c1c1c",
						borderRadius: "10px",
						padding: "2px 6px",
						border: "1px solid #2d2d2d",
						gap: "0px",
						position: "relative",
					}}
				>
					{/* Navigation */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0px",
						}}
					>
						<button
							type="button"
							style={{
								color: "#444",
								cursor: "not-allowed",
								background: "transparent",
								border: "none",
								padding: "8px",
								display: "flex",
								alignItems: "center",
							}}
						>
							<ArrowLeft size={18} strokeWidth={1.5} />
						</button>
						<button
							type="button"
							style={{
								color: "#444",
								cursor: "not-allowed",
								background: "transparent",
								border: "none",
								padding: "8px",
								display: "flex",
								alignItems: "center",
							}}
						>
							<ArrowRight size={18} strokeWidth={1.5} />
						</button>
						<button
							type="button"
							onClick={handleReload}
							style={{
								color: "#999",
								cursor: "pointer",
								background: "transparent",
								border: "none",
								padding: "8px",
								display: "flex",
								alignItems: "center",
							}}
						>
							<RotateCw size={18} strokeWidth={1.5} />
						</button>
					</div>

					{/* Address Bar Area */}
					<form
						onSubmit={handleNavigate}
						style={{
							display: "flex",
							alignItems: "center",
							gap: "8px",
							padding: "0 12px",
							cursor: "text",
							color: "#999",
							fontSize: "14px",
							flex: 1,
							minWidth: "150px",
						}}
					>
						<Link2
							size={16}
							color="#777"
							strokeWidth={1.5}
							style={{
								transform: "rotate(-45deg)",
								cursor: "pointer",
							}}
							onClick={(e) => {
								e.stopPropagation();
								setShowUrlPopup(true);
							}}
						/>
						<input
							type="text"
							value={inputUrl}
							onChange={(e) => setInputUrl(e.target.value)}
							onFocus={(e) => e.target.select()}
							style={{
								background: "transparent",
								border: "none",
								color: "#fff",
								fontSize: "13px",
								width: "100%",
								outline: "none",
								fontWeight: 400,
								padding: "0",
							}}
						/>
					</form>

					{/* Tool Buttons inside Pod */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0px",
						}}
					>
						<button
							type="button"
							onClick={() => setShowLogs(!showLogs)}
							style={{
								color: showLogs ? "#fff" : "#999",
								cursor: "pointer",
								background: "transparent",
								border: "none",
								padding: "8px",
								display: "flex",
								alignItems: "center",
							}}
						>
							<Wrench size={18} strokeWidth={1.5} />
						</button>

						<div style={{ position: "relative" }}>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setShowDevicePopup(!showDevicePopup);
								}}
								style={{
									color: "#999",
									cursor: "pointer",
									background: "transparent",
									border: "none",
									padding: "8px",
									display: "flex",
									alignItems: "center",
									gap: "0px",
								}}
							>
								<div
									style={{
										position: "relative",
										display: "flex",
										alignItems: "center",
									}}
								>
									<Monitor size={18} strokeWidth={1.5} />
									<span
										style={{
											fontSize: "10px",
											fontWeight: 600,
											position: "absolute",
											bottom: "-2px",
											right: "-2px",
											color: "#999",
											background: "#1c1c1c",
											padding: "0 1px",
											lineHeight: 1,
										}}
									>
										0
									</span>
								</div>
							</button>

							{showDevicePopup && (
								<div
									ref={devicePopupRef}
									style={{
										position: "absolute",
										top: "40px",
										right: "0",
										width: "220px",
										background: "#1e1e1f",
										border: "1px solid #333",
										borderRadius: "12px",
										padding: "8px 0",
										boxShadow:
											"0 10px 30px rgba(0,0,0,0.6)",
										zIndex: 1000,
										color: "#eee",
										textAlign: "left",
										overflow: "hidden",
									}}
								>
									{devices.map((device, index) => (
										<div key={device}>
											<div
												onClick={(e) => {
													e.stopPropagation();
													setActiveDevice(device);
													setShowDevicePopup(false);
												}}
												style={{
													padding: "10px 16px",
													fontSize: "13px",
													cursor: "pointer",
													display: "flex",
													justifyContent:
														"space-between",
													alignItems: "center",
													color:
														activeDevice === device
															? "#fff"
															: "#ccc",
													background: "transparent",
													transition:
														"background 0.2s",
												}}
												onMouseEnter={(e) =>
													(e.currentTarget.style.background =
														"#2d2d2d")
												}
												onMouseLeave={(e) =>
													(e.currentTarget.style.background =
														"transparent")
												}
											>
												<span
													style={{
														fontWeight:
															activeDevice ===
															device
																? 500
																: 400,
													}}
												>
													{device}
												</span>
												{activeDevice === device && (
													<span
														style={{
															fontSize: "14px",
															color: "#fff",
														}}
													>
														✓
													</span>
												)}
											</div>
											{(index === 0 || index === 1) && (
												<div
													style={{
														height: "1px",
														background: "#333",
														margin: "4px 0",
													}}
												/>
											)}
										</div>
									))}
								</div>
							)}
						</div>

						<button
							type="button"
							onClick={handleOpenExternal}
							style={{
								color: "#999",
								cursor: "pointer",
								background: "transparent",
								border: "none",
								padding: "8px",
								display: "flex",
								alignItems: "center",
							}}
						>
							<ExternalLink size={18} strokeWidth={1.5} />
						</button>
					</div>

					{/* Popups (Absolute Positioned relative to common parent or body) */}
					{showUrlPopup && (
						<div
							ref={popupRef}
							style={{
								position: "absolute",
								top: "45px",
								left: "50%",
								transform: "translateX(-50%)",
								width: "480px",
								background: "#1e1e1f",
								border: "1px solid #333",
								borderRadius: "12px",
								padding: "20px",
								boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
								zIndex: 1000,
								color: "#eee",
								textAlign: "left",
							}}
						>
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									marginBottom: "12px",
								}}
							>
								<div
									style={{
										fontWeight: 500,
										color: "#fff",
										fontSize: "14px",
									}}
								>
									Private Dev URL
								</div>
								<div
									onClick={() =>
										setIsPrivateDevEnabled(
											!isPrivateDevEnabled,
										)
									}
									style={{
										width: "36px",
										height: "20px",
										background: isPrivateDevEnabled
											? "#3b82f6"
											: "#333",
										borderRadius: "10px",
										position: "relative",
										cursor: "pointer",
										border: "1px solid #444",
										transition: "background 0.2s",
									}}
								>
									<div
										style={{
											width: "14px",
											height: "14px",
											background: "#fff",
											borderRadius: "50%",
											position: "absolute",
											top: "2px",
											left: isPrivateDevEnabled
												? "18px"
												: "2px",
											transition: "left 0.2s",
										}}
									/>
								</div>
							</div>

							<div
								style={{
									fontSize: "12px",
									color: "#999",
									lineHeight: "1.5",
								}}
							>
								Restrict Dev URL access to authenticated editors
								only.
							</div>
							<div
								style={{
									fontSize: "12px",
									color: "#999",
									marginTop: "8px",
									lineHeight: "1.5",
								}}
							>
								When this option is disabled, anyone with the
								Dev URL can access your app preview.
							</div>
							<div
								style={{
									fontSize: "12px",
									color: "#999",
									marginTop: "8px",
									marginBottom: "20px",
								}}
							>
								Need to let an external service (CI, webhook,
								status check) reach your private dev URL? Create
								an{" "}
								<span
									style={{
										color: "#4fc3f7",
										cursor: "pointer",
										textDecoration: "underline",
									}}
								>
									external access token
								</span>
								.
							</div>

							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									marginBottom: "12px",
									paddingTop: "12px",
									borderTop: "1px solid #2d2d2d",
								}}
							>
								<div
									style={{
										fontSize: "13px",
										fontWeight: 500,
										color: "#fff",
									}}
								>
									Listening on port:
								</div>
								<Settings
									size={14}
									color="#777"
									style={{ cursor: "pointer" }}
								/>
							</div>

							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "10px",
									fontSize: "13px",
									marginBottom: "20px",
								}}
							>
								<div
									style={{
										width: "16px",
										height: "16px",
										borderRadius: "50%",
										border: "2px solid #007acc",
										background: "#007acc",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<div
										style={{
											width: "6px",
											height: "6px",
											background: "#fff",
											borderRadius: "50%",
										}}
									/>
								</div>
								<span
									style={{ color: "#fff", fontWeight: 500 }}
								>
									:5500 → :80
								</span>
							</div>

							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "8px",
									color: "#4caf50",
									fontSize: "13px",
									background: "rgba(76, 175, 80, 0.05)",
									padding: "8px 12px",
									borderRadius: "6px",
									border: "1px solid rgba(76, 175, 80, 0.1)",
									marginBottom: "8px",
								}}
							>
								<span
									style={{
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										flex: 1,
									}}
								>
									{isPrivateDevEnabled
										? `https://${
												url.includes("localhost")
													? "5500-dev-tunnel"
													: window.location.hostname
											}.codify.run/preview/`
										: url}
								</span>
								<Copy
									size={16}
									color="#777"
									style={{ cursor: "pointer" }}
									onClick={() => {
										const copyUrl = isPrivateDevEnabled
											? `https://${
													url.includes("localhost")
														? "5500-dev-tunnel"
														: window.location
																.hostname
												}.codify.run/preview/`
											: url;
										navigator.clipboard.writeText(copyUrl);
									}}
								/>
							</div>
							<div
								style={{
									fontSize: "11px",
									color: "#666",
									marginBottom: "20px",
								}}
							>
								{url.includes("localhost") &&
								!isPrivateDevEnabled
									? "Warning: 'localhost' only works on this machine. To test on mobile, use your machine's local IP or enable 'Private Dev URL' for a secure tunnel."
									: "Dev URLs are managed by Codify.sh and provide temporary secure access to your local development environment."}
							</div>

							<div
								style={{
									background: "#fff",
									padding: "12px",
									borderRadius: "10px",
									width: "fit-content",
									boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
								}}
							>
								<img
									src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
										isPrivateDevEnabled ||
											url.includes("localhost")
											? `https://5500-dev-tunnel.codify.run/preview/`
											: url,
									)}`}
									alt="QR Code"
									style={{
										display: "block",
										width: "140px",
										height: "140px",
									}}
								/>
							</div>
						</div>
					)}
				</div>

				{/* Right: Empty spacer to center the Pod */}
				<div />
			</div>

			{/* Browser Viewport */}
			<div
				style={{
					flex: 1,
					position: "relative",
					background: canvasMode ? "#1a1a1b" : "#fff",
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{canvasMode && (
					<>
						{/* Website | Artifact Toggle */}
						<div
							style={{
								position: "absolute",
								top: "10px",
								left: "10px",
								zIndex: 100,
								display: "flex",
								alignItems: "center",
								background: "#2e103c",
								padding: "4px 10px",
								borderRadius: "8px",
								color: "#fff",
								fontSize: "12px",
								fontWeight: 500,
								gap: "6px",
								boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
								border: "1px solid rgba(255,255,255,0.1)",
							}}
						>
							<span style={{ color: "#fff" }}>Website</span>
							<span
								style={{
									width: "1px",
									height: "10px",
									background: "rgba(255,255,255,0.1)",
								}}
							/>
							<span style={{ color: "rgba(255,255,255,0.4)" }}>
								Artifact
							</span>
							<Play
								size={10}
								fill="rgba(255,255,255,0.4)"
								style={{ marginLeft: "2px" }}
							/>
						</div>

						{/* Bottom Canvas Toolbar */}
						<div
							style={{
								position: "absolute",
								bottom: "20px",
								left: "50%",
								transform: "translateX(-50%)",
								zIndex: 100,
								display: "flex",
								alignItems: "center",
								background: "#18181b",
								padding: "4px",
								borderRadius: "10px",
								boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
								border: "1px solid #27272a",
								gap: "0px",
							}}
						>
							<button
								onClick={() => setCanvasTool("pointer")}
								style={{
									background:
										canvasTool === "pointer"
											? "#1d3a6d"
											: "transparent",
									border: "none",
									width: "32px",
									height: "32px",
									borderRadius: "6px",
									color:
										canvasTool === "pointer"
											? "#60a5fa"
											: "#71717a",
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									margin: "2px",
								}}
							>
								<MousePointer2
									size={16}
									fill={
										canvasTool === "pointer"
											? "currentColor"
											: "none"
									}
								/>
							</button>
							<button
								onClick={() => setCanvasTool("hand")}
								style={{
									background:
										canvasTool === "hand"
											? "#1d3a6d"
											: "transparent",
									border: "none",
									width: "32px",
									height: "32px",
									borderRadius: "6px",
									color:
										canvasTool === "hand"
											? "#fff"
											: "#71717a",
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									margin: "2px",
								}}
							>
								<Hand size={16} />
							</button>
							<div
								style={{
									width: "1px",
									height: "20px",
									background: "#27272a",
									margin: "0 8px",
								}}
							/>
							<button
								onClick={() => setCanvasTool("draw")}
								style={{
									background: "transparent",
									border: "none",
									padding: "0 12px",
									height: "32px",
									borderRadius: "6px",
									color:
										canvasTool === "draw"
											? "#fff"
											: "#a1a1aa",
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									gap: "8px",
									fontSize: "13px",
									fontWeight: 500,
								}}
							>
								<Pencil size={16} />
								Draw
							</button>
							<button
								onClick={() => setCanvasTool("edit")}
								style={{
									background: "transparent",
									border: "none",
									padding: "0 12px",
									height: "32px",
									borderRadius: "6px",
									color:
										canvasTool === "edit"
											? "#fff"
											: "#a1a1aa",
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									gap: "8px",
									fontSize: "13px",
									fontWeight: 500,
								}}
							>
								<Layout size={16} />
								Edit
							</button>
							<button
								onClick={() => setCanvasTool("generate")}
								style={{
									background: "transparent",
									border: "none",
									padding: "0 12px",
									height: "32px",
									borderRadius: "6px",
									color:
										canvasTool === "generate"
											? "#fff"
											: "#a1a1aa",
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									gap: "8px",
									fontSize: "13px",
									fontWeight: 500,
								}}
							>
								<Plus size={16} />
								Generate
							</button>
						</div>
					</>
				)}
				<iframe
					ref={iframeRef}
					key={key}
					src={url}
					style={{
						width: canvasMode ? "calc(100% - 40px)" : "100%",
						height: canvasMode ? "calc(100% - 40px)" : "100%",
						margin: canvasMode ? "20px auto" : "0",
						border: "none",
						background: "#fff",
						boxShadow: canvasMode
							? "0 0 0 1px #333, 0 10px 30px rgba(0,0,0,0.5)"
							: "none",
						borderRadius: canvasMode ? "4px" : "0",
						flex: canvasMode ? "none" : 1,
						maxWidth: canvasMode ? "1200px" : "100%", // Optional: cap canvas width
					}}
					title="Chromium Preview"
					sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
				/>

				{showLogs && (
					<div
						style={{
							height: "220px",
							background: "#1c1c1c",
							borderTop: "1px solid #333",
							display: "flex",
							flexDirection: "column",
						}}
					>
						{/* Logs Header */}
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								padding: "0 12px",
								height: "36px",
								borderBottom: "1px solid #2d2d2d",
								background: "#0e1011",
							}}
						>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "16px",
									height: "100%",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "6px",
										color: "#fff",
										fontSize: "13px",
										height: "100%",
										borderBottom: "2px solid #fff",
										padding: "0 4px",
										cursor: "pointer",
									}}
								>
									<Globe size={14} strokeWidth={1.5} />
									<span>Webview Logs</span>
								</div>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "6px",
										color: "#999",
										fontSize: "13px",
										cursor: "pointer",
									}}
								>
									<Play size={14} strokeWidth={1.5} />
									<span>Start application Logs</span>
								</div>
							</div>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "12px",
								}}
							>
								<Columns
									size={14}
									color="#777"
									strokeWidth={1.5}
									style={{ cursor: "pointer" }}
								/>
								<X
									size={16}
									color="#777"
									strokeWidth={1.5}
									style={{ cursor: "pointer" }}
									onClick={() => setShowLogs(false)}
								/>
							</div>
						</div>

						{/* Logs Content */}
						<div
							style={{
								flex: 1,
								padding: "16px",
								color: "#999",
								fontSize: "13px",
								fontFamily: "monospace",
								background: "#1c1c1c",
							}}
						>
							No logs received yet
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
