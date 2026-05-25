import { useState } from "react";

export function AgentLogo({
	size = 20,
	variant = "default",
}: {
	size?: number;
	variant?: "default" | "filled" | "icon";
}) {
	const [error, setError] = useState(false);
	const s = size / 4;

	const showSVG = error || variant === "icon";
	const src =
		variant === "filled"
			? "/Codify logo cizento.png"
			: "/logo-transparent.png";

	if (showSVG) {
		return (
			<svg
				width={size}
				height={size}
				viewBox="0 0 20 20"
				fill="none"
				aria-hidden
			>
				<rect
					x="1"
					y="1"
					width={s - 0.5}
					height={s - 0.5}
					rx="1.5"
					fill="var(--accent, #3b82f6)"
				/>
				<rect
					x={s + 1.5}
					y="1"
					width={s - 0.5}
					height={s - 0.5}
					rx="1.5"
					fill="var(--accent, #3b82f6)"
					opacity="0.85"
				/>
				<rect
					x="1"
					y={s + 1.5}
					width={s - 0.5}
					height={s - 0.5}
					rx="1.5"
					fill="var(--accent, #3b82f6)"
					opacity="0.7"
				/>
				<rect
					x={s + 1.5}
					y={s + 1.5}
					width={s - 0.5}
					height={s - 0.5}
					rx="1.5"
					fill="var(--accent, #3b82f6)"
					opacity="0.55"
				/>
			</svg>
		);
	}

	return (
		<div
			className="agent-logo-wrapper"
			style={{
				width: size,
				height: size,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<img
				src={src}
				alt="Agent Logo"
				onError={() => setError(true)}
				style={{
					width: "100%",
					height: "100%",
					objectFit: "contain",
				}}
			/>
		</div>
	);
}

export function CraftyLogo({
	size = 24,
	variant = "default",
}: {
	size?: number;
	variant?: "default" | "filled" | "icon";
}) {
	return (
		<div className="crafty-logo" style={{ width: size, height: size }}>
			<AgentLogo size={size} variant={variant} />
		</div>
	);
}
