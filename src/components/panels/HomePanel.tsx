import { Bot, Code2, Terminal, Database, Sparkles } from "lucide-react";

const FEATURES = [
	{
		icon: Bot,
		title: "IA Proativa",
		desc: 'Cérebro central que age — detecta intenções como "Build" e ativa módulos.',
	},
	{
		icon: Sparkles,
		title: "Super-memória",
		desc: "Persistência extrema com reconexão infinita (ECONNRESET).",
	},
	{
		icon: Code2,
		title: "Editor Monaco",
		desc: "Syntax highlighting, minimap, tabs e split view.",
	},
	{
		icon: Terminal,
		title: "Terminal integrado",
		desc: "Comandos npm, node, agent status e mais.",
	},
	{
		icon: Database,
		title: "Secrets & DB",
		desc: "Gestão de variáveis, tabelas e autenticação.",
	},
];

interface HomePanelProps {
	onNavigate: (view: "agent" | "secrets" | "database") => void;
}

export function HomePanel({ onNavigate }: HomePanelProps) {
	return (
		<div className="home-panel">
			<div className="home-hero">
				<h1>Codify IDE</h1>
				<p>
					IDE completo para criar, testar e iterar com o teu Agent IA.
				</p>
				<div className="home-actions">
					<button
						type="button"
						className="btn-primary"
						onClick={() => onNavigate("agent")}
					>
						Abrir Agent
					</button>
					<button
						type="button"
						className="btn-secondary"
						onClick={() => onNavigate("secrets")}
					>
						Configurar Secrets
					</button>
				</div>
			</div>
			<div className="home-grid">
				{FEATURES.map(({ icon: Icon, title, desc }) => (
					<article key={title} className="home-card">
						<Icon size={24} className="home-card-icon" />
						<h3>{title}</h3>
						<p>{desc}</p>
					</article>
				))}
			</div>
		</div>
	);
}
