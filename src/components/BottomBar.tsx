import { useState, useEffect, useCallback } from "react";
import {
	Play,
	Monitor,
	LayoutGrid,
	Globe,
	Terminal,
	List,
	PanelRight,
} from "lucide-react";
import type { BottomPanel } from "../types";

type BarItem =
	| { type: "item"; id: BottomPanel; label: string }
	| { type: "separator" };

const LEFT_ITEMS: BarItem[] = [
	{ type: "item", id: "play", label: "Debug & Run" },
	{ type: "item", id: "preview", label: "Preview" },
	{ type: "item", id: "agent", label: "Agent" },
	{ type: "item", id: "web", label: "Web" },
	{ type: "separator" },
	{ type: "item", id: "terminal", label: "Terminal" },
	{ type: "item", id: "problems", label: "Problems" },
	{ type: "item", id: "split", label: "Layout" },
];

const ICONS = {
	play: Play,
	preview: Monitor,
	agent: LayoutGrid,
	web: Globe,
	terminal: Terminal,
	problems: List,
	split: PanelRight,
} as const;

interface BottomBarProps {
	active: BottomPanel;
	onChange: (panel: BottomPanel) => void;
	mobile?: boolean;
}

export function BottomBar({ active, onChange, mobile }: BottomBarProps) {
	const [isIdle, setIsIdle] = useState(false);

	const resetIdle = useCallback(() => {
		setIsIdle(false);
	}, []);

	useEffect(() => {
		const activityHandler = (e: MouseEvent) => {
			// If we are idle, only wake up if the mouse is near the bottom (lower 15% of screen)
			if (isIdle) {
				const threshold = window.innerHeight * 0.85;
				if (e.clientY > threshold) {
					resetIdle();
					document.body.classList.remove("dock-idle");
				}
			} else {
				resetIdle();
			}
		};

		const handleWakeEvents = () => {
			if (!isIdle) resetIdle();
		};

		window.addEventListener("mousemove", activityHandler);
		window.addEventListener("mousedown", handleWakeEvents);
		window.addEventListener("keydown", handleWakeEvents);
		window.addEventListener("scroll", handleWakeEvents);

		return () => {
			window.removeEventListener("mousemove", activityHandler);
			window.removeEventListener("mousedown", handleWakeEvents);
			window.removeEventListener("keydown", handleWakeEvents);
			window.removeEventListener("scroll", handleWakeEvents);
		};
	}, [resetIdle, isIdle]);

	useEffect(() => {
		let timer: NodeJS.Timeout;

		const startTimer = () => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				setIsIdle(true);
				document.body.classList.add("dock-idle");
			}, 3000);
		};

		if (!isIdle) {
			startTimer();
		}

		const handleActivity = (e: MouseEvent) => {
			if (isIdle) {
				const threshold = window.innerHeight * 0.85;
				if (e.clientY > threshold) {
					setIsIdle(false);
					document.body.classList.remove("dock-idle");
					startTimer();
				}
			} else {
				startTimer();
			}
		};

		const handlePhysicalActivity = () => {
			if (isIdle) {
				setIsIdle(false);
				document.body.classList.remove("dock-idle");
			}
			startTimer();
		};

		window.addEventListener("mousemove", handleActivity);
		window.addEventListener("mousedown", handlePhysicalActivity);
		window.addEventListener("keydown", handlePhysicalActivity);
		window.addEventListener("scroll", handlePhysicalActivity);

		return () => {
			clearTimeout(timer);
			window.removeEventListener("mousemove", handleActivity);
			window.removeEventListener("mousedown", handlePhysicalActivity);
			window.removeEventListener("keydown", handlePhysicalActivity);
			window.removeEventListener("scroll", handlePhysicalActivity);
		};
	}, [isIdle]);

	return (
		<footer
			className={`bottom-bar ${mobile ? "bottom-bar--mobile" : ""} ${isIdle ? "is-idle" : ""}`}
		>
			<div className="bottom-bar-inner">
				{LEFT_ITEMS.map((entry, i) => {
					if (entry.type === "separator") {
						return (
							<span
								key={`sep-${i}`}
								className="bottom-separator"
								aria-hidden
							/>
						);
					}

					const { id, label } = entry;
					const Icon = ICONS[id as keyof typeof ICONS];

					return (
						<button
							key={id}
							type="button"
							className={`bottom-item ${active === id ? "active" : ""}`}
							onClick={() => onChange(id)}
							title={label}
							aria-label={label}
							aria-current={active === id ? "page" : undefined}
						>
							{Icon && <Icon size={20} strokeWidth={1.75} />}
							{active === id && (
								<span className="bottom-indicator" />
							)}
						</button>
					);
				})}
			</div>
		</footer>
	);
}
