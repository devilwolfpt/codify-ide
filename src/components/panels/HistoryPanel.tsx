import { CheckCircle2, Loader2, XCircle, MessageSquare } from "lucide-react";
import type { TaskEntry, ChatHistoryEntry } from "../../types";

interface HistoryPanelProps {
	tasks: TaskEntry[];
	chatHistory: ChatHistoryEntry[];
}

export function HistoryPanel({ tasks, chatHistory }: HistoryPanelProps) {
	const icon = (status: TaskEntry["status"]) => {
		if (status === "done")
			return <CheckCircle2 size={18} className="text-success" />;
		if (status === "failed")
			return <XCircle size={18} className="text-error" />;
		return <Loader2 size={18} className="spin" />;
	};

	return (
		<div className="list-panel">
			<header className="data-panel-header">
				<h2>Histórico de tarefas</h2>
			</header>
			<ul className="task-list">
				{tasks.map((t) => (
					<li key={t.id} className="task-item">
						{icon(t.status)}
						<div className="task-info">
							<strong>{t.title}</strong>
							<span>{t.duration}</span>
						</div>
						<time>
							{new Date(t.createdAt).toLocaleDateString("pt-PT")}
						</time>
					</li>
				))}
			</ul>

			{chatHistory && chatHistory.length > 0 && (
				<>
					<header
						className="data-panel-header"
						style={{ marginTop: "20px" }}
					>
						<h2>Histórico de Chats</h2>
					</header>
					<ul className="task-list">
						{chatHistory.map((h) => (
							<li key={h.id} className="task-item">
								<MessageSquare
									size={18}
									className="text-accent"
								/>
								<div className="task-info">
									<strong>{h.title}</strong>
									<span>{h.messages.length} mensagens</span>
								</div>
								<time>
									{new Date(h.timestamp).toLocaleDateString(
										"pt-PT",
									)}
								</time>
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	);
}
