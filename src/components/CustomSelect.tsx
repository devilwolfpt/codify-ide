import { useState, useRef, useEffect, ReactNode } from "react";
import {
	ChevronDown,
	LayoutGrid,
	Check,
	AlertTriangle,
	Settings,
	ChevronRight,
} from "lucide-react";

interface Option {
	value: string;
	label: string;
	icon?: ReactNode;
	// optional grouping header
	group?: string;
	// right-aligned metadata (e.g. "1x", "0.33x", "10% discount")
	right?: string;
	// small badge text shown on the right (e.g. "Upgrade")
	badge?: string;
	// status hint: 'warning' shows an icon, 'info' nothing special
	status?: "warning" | "info";
	// whether this option represents a checked/active special choice (e.g. Auto)
	checked?: boolean;
	disabled?: boolean;
}

interface CustomSelectProps {
	value: string;
	onChange: (value: string) => void;
	options: Option[];
}

interface CustomSelectExtraProps {
	// called when user wants to open the global settings from inside the dropdown
	onOpenSettings?: () => void;
}

export function CustomSelect({
	value,
	onChange,
	options,
	onOpenSettings,
}: CustomSelectProps & CustomSelectExtraProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isAbove, setIsAbove] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const wrapperRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const selectedOption = options.find((o) => o.value === value);

	const filteredOptions = options.filter((o) =>
		o.label.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	// group options preserving the order they appear in `filteredOptions`
	const groupedOptions: Array<{ name: string | null; items: Option[] }> = [];
	filteredOptions.forEach((opt) => {
		const name = opt.group ?? "";
		let g = groupedOptions.find((gr) => gr.name === name);
		if (!g) {
			g = { name, items: [] };
			groupedOptions.push(g);
		}
		g.items.push(opt);
	});

	const [collapsedGroups, setCollapsedGroups] = useState<
		Record<string, boolean>
	>({});

	useEffect(() => {
		// Initialize collapsed state for groups when menu opens
		if (isOpen) {
			const init: Record<string, boolean> = {};
			groupedOptions.forEach((g) => {
				if (g.name && g.name !== "") init[g.name] = false; // expanded by default
			});
			setCollapsedGroups((prev) => ({ ...init, ...prev }));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	const toggleGroup = (name: string) => {
		setCollapsedGroups((s) => ({ ...s, [name]: !s[name] }));
	};

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				wrapperRef.current &&
				!wrapperRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () =>
				document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isOpen]);

	// Verificar se o dropdown sai da tela
	useEffect(() => {
		if (isOpen && triggerRef.current) {
			const rect = triggerRef.current.getBoundingClientRect();
			const menuHeight = 220 + 12; // max-height + gap
			const spaceBelow = window.innerHeight - rect.bottom;

			// Se não houver espaço suficiente em baixo, colocar acima
			setIsAbove(spaceBelow < menuHeight && rect.top > menuHeight);
		}
	}, [isOpen]);

	// Focus no input de pesquisa quando abre
	useEffect(() => {
		if (isOpen && searchInputRef.current) {
			setTimeout(() => searchInputRef.current?.focus(), 50);
		} else {
			setSearchQuery("");
		}
	}, [isOpen]);

	const handleSelect = (optionValue: string) => {
		onChange(optionValue);
		setIsOpen(false);
	};

	return (
		<div
			className={`custom-select-container ${isAbove ? "above" : ""}`}
			ref={wrapperRef}
		>
			<button
				ref={triggerRef}
				type="button"
				className="custom-select-trigger"
				onClick={() => setIsOpen(!isOpen)}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
			>
				<LayoutGrid size={13} className="select-icon-left" />
				<span className="select-val">
					{selectedOption?.label || "Selecionar"}
					{selectedOption?.icon && (
						<span className="select-option-icon">
							{selectedOption.icon}
						</span>
					)}
				</span>
				<ChevronDown
					size={13}
					className={`select-icon-right ${isOpen ? "open" : ""}`}
				/>
			</button>

			{isOpen && (
				<div className="custom-select-menu">
					<div className="custom-select-header">
						<input
							ref={searchInputRef}
							type="text"
							className="custom-select-search"
							placeholder="Search models"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Escape") {
									setIsOpen(false);
								}
							}}
						/>
						<button
							className="settings-gear-btn"
							type="button"
							onClick={() => {
								setIsOpen(false);
								onOpenSettings?.();
							}}
							aria-label="Configurações"
						>
							<Settings size={16} />
						</button>
					</div>
					<div className="custom-select-options" role="listbox">
						{groupedOptions.map((group, gi) => (
							<div
								key={`group-${gi}`}
								className="custom-select-group-wrap"
							>
								{group.name && group.name !== "" ? (
									<div
										className="custom-select-group-header"
										onClick={() => toggleGroup(group.name!)}
									>
										<ChevronRight
											size={14}
											className={`group-chevron ${
												collapsedGroups[
													group.name ?? ""
												]
													? ""
													: "expanded"
											}`}
										/>
										<div className="custom-select-group">
											{group.name}
										</div>
									</div>
								) : null}
								<ul
									style={{
										display:
											group.name &&
											collapsedGroups[group.name ?? ""]
												? "none"
												: undefined,
									}}
								>
									{group.items.map((option) => (
										<li key={option.value}>
											<button
												type="button"
												className={`custom-select-option ${value === option.value || option.checked ? "active" : ""} ${option.disabled ? "disabled" : ""}`}
												onClick={() =>
													!option.disabled &&
													handleSelect(option.value)
												}
												role="option"
												aria-selected={
													value === option.value
												}
												disabled={option.disabled}
											>
												<div className="option-left">
													{value === option.value ||
													option.checked ? (
														<Check
															size={14}
															className="option-check"
														/>
													) : null}
													<span className="option-label">
														{option.label}
													</span>
												</div>
												<div className="option-meta">
													{option.icon && (
														<span className="select-option-icon">
															{option.icon}
														</span>
													)}
													{option.badge && (
														<button
															className="option-upgrade"
															type="button"
														>
															{option.badge}
														</button>
													)}
													{option.right && (
														<span className="option-right">
															{option.right}
														</span>
													)}
													{option.status ===
														"warning" && (
														<AlertTriangle
															size={14}
															className="option-warning"
														/>
													)}
												</div>
											</button>
										</li>
									))}
								</ul>
							</div>
						))}

						{filteredOptions.length === 0 && (
							<div className="custom-select-empty">
								Nenhum resultado
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
