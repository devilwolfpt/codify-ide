import { useState } from "react";
import {
	ChevronRight,
	File,
	Folder,
	FolderOpen,
	FilePlus,
	FolderPlus,
	Trash2,
	Code,
	Terminal,
	FileJson,
	FileText,
	Globe,
	Image,
	Archive,
} from "lucide-react";
import type { FileNode } from "../types";

interface FileTreeProps {
	nodes: FileNode[];
	activeId: string;
	onOpen: (id: string) => void;
	onCreateFile: (parentId: string, name: string) => void;
	onCreateFolder: (parentId: string, name: string) => void;
	onDelete: (id: string) => void;
	onOpenFolder?: () => void;
}

function renderFileIcon(name: string) {
	const ext = name.split(".").pop()?.toLowerCase();

	if (name === "package.json" || ext === "json") {
		return (
			<FileJson
				size={15}
				style={{ color: "#cbcb41", marginRight: "6px", flexShrink: 0 }}
			/>
		);
	}
	if (ext === "ts" || ext === "tsx") {
		return (
			<Code
				size={15}
				style={{ color: "#3178c6", marginRight: "6px", flexShrink: 0 }}
			/>
		);
	}
	if (ext === "js" || ext === "jsx") {
		return (
			<Code
				size={15}
				style={{ color: "#f7df1e", marginRight: "6px", flexShrink: 0 }}
			/>
		);
	}
	if (ext === "py") {
		return (
			<Terminal
				size={15}
				style={{ color: "#387eb8", marginRight: "6px", flexShrink: 0 }}
			/>
		);
	}
	if (ext === "html") {
		return (
			<Globe
				size={15}
				style={{ color: "#e34f26", marginRight: "6px", flexShrink: 0 }}
			/>
		);
	}
	if (ext === "md") {
		return (
			<FileText
				size={15}
				style={{ color: "#519aba", marginRight: "6px", flexShrink: 0 }}
			/>
		);
	}
	if (
		["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(ext || "")
	) {
		return (
			<Image
				size={15}
				style={{ color: "#7bc96f", marginRight: "6px", flexShrink: 0 }}
			/>
		);
	}
	// binary / unknown heavy files
	if (["exe", "dll", "pak", "bin", "dat"].includes(ext || "")) {
		return (
			<Archive
				size={15}
				style={{ color: "#b76b6b", marginRight: "6px", flexShrink: 0 }}
			/>
		);
	}

	return (
		<File
			size={15}
			style={{ color: "#888888", marginRight: "6px", flexShrink: 0 }}
		/>
	);
}

function TreeNode({
	node,
	depth,
	activeId,
	onOpen,
	onCreateFile,
	onCreateFolder,
	onDelete,
}: {
	node: FileNode;
	depth: number;
	activeId: string;
	onOpen: (id: string) => void;
	onCreateFile: (parentId: string, name: string) => void;
	onCreateFolder: (parentId: string, name: string) => void;
	onDelete: (id: string) => void;
}) {
	const [expanded, setExpanded] = useState(depth < 2);
	const isFolder = node.type === "folder";
	const isActive = node.id === activeId;

	return (
		<div>
			<div
				className={`tree-row ${isActive ? "active" : ""}`}
				style={{ paddingLeft: 8 + depth * 14 }}
				onClick={() =>
					isFolder ? setExpanded(!expanded) : onOpen(node.id)
				}
				onDoubleClick={() => !isFolder && onOpen(node.id)}
				role="treeitem"
				draggable={!isFolder}
				onDragStart={(e) => {
					if (!isFolder) {
						e.dataTransfer.setData("text/plain", node.name);
						e.dataTransfer.setData("codify-file-id", node.id);
						e.dataTransfer.setData("codify-file-name", node.name);
						e.dataTransfer.effectAllowed = "copy";
					}
				}}
				data-context-type="file-node"
				data-node-id={node.id}
				data-node-name={node.name}
				data-node-type={node.type}
			>
				{isFolder ? (
					<>
						<ChevronRight
							size={14}
							className={`chevron ${expanded ? "open" : ""}`}
						/>
						{expanded ? (
							<FolderOpen
								size={15}
								style={{
									color: "#dcb26b",
									marginRight: "6px",
									flexShrink: 0,
								}}
							/>
						) : (
							<Folder
								size={15}
								style={{
									color: "#dcb26b",
									marginRight: "6px",
									flexShrink: 0,
								}}
							/>
						)}
					</>
				) : (
					<>
						<span className="chevron-spacer" />
						{renderFileIcon(node.name)}
					</>
				)}
				<span className="tree-name">{node.name}</span>
				{node.id !== "root" && (
					<button
						type="button"
						className="tree-delete"
						onClick={(e) => {
							e.stopPropagation();
							onDelete(node.id);
						}}
						aria-label="Apagar"
					>
						<Trash2 size={12} />
					</button>
				)}
			</div>
			{isFolder &&
				expanded &&
				node.children?.map((child) => (
					<TreeNode
						key={child.id}
						node={child}
						depth={depth + 1}
						activeId={activeId}
						onOpen={onOpen}
						onCreateFile={onCreateFile}
						onCreateFolder={onCreateFolder}
						onDelete={onDelete}
					/>
				))}
		</div>
	);
}

export function FileTree({
	nodes,
	activeId,
	onOpen,
	onCreateFile,
	onCreateFolder,
	onDelete,
	onOpenFolder,
}: FileTreeProps) {
	const root = nodes[0];
	if (!root) return null;

	const handleNew = (type: "file" | "folder") => {
		const name = prompt(
			type === "file" ? "Nome do ficheiro:" : "Nome da pasta:",
		);
		if (!name) return;
		if (type === "file") onCreateFile("root", name);
		else onCreateFolder("root", name);
	};

	return (
		<div className="file-tree">
			<div className="file-tree-header">
				<span>EXPLORADOR</span>
				<div className="file-tree-actions">
					{onOpenFolder && (
						<button
							type="button"
							onClick={onOpenFolder}
							title="Abrir pasta do computador"
						>
							<FolderOpen size={14} />
						</button>
					)}
					<button
						type="button"
						onClick={() => handleNew("file")}
						title="Novo ficheiro"
					>
						<FilePlus size={14} />
					</button>
					<button
						type="button"
						onClick={() => handleNew("folder")}
						title="Nova pasta"
					>
						<FolderPlus size={14} />
					</button>
				</div>
			</div>
			<div
				className="file-tree-body"
				role="tree"
				data-context-type="file-tree-body"
			>
				{root.children?.map((child) => (
					<TreeNode
						key={child.id}
						node={child}
						depth={0}
						activeId={activeId}
						onOpen={onOpen}
						onCreateFile={onCreateFile}
						onCreateFolder={onCreateFolder}
						onDelete={onDelete}
					/>
				))}
			</div>
		</div>
	);
}
