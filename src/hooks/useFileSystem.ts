import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import type { FileNode } from "../types";
import { DEFAULT_FILES } from "../data/defaults";
import { usePersisted } from "./usePersisted";

function findNode(nodes: FileNode[], id: string): FileNode | null {
	for (const n of nodes) {
		if (n.id === id) return n;
		if (n.children) {
			const found = findNode(n.children, id);
			if (found) return found;
		}
	}
	return null;
}

function updateNode(
	nodes: FileNode[],
	id: string,
	updater: (n: FileNode) => FileNode,
): FileNode[] {
	return nodes.map((n) => {
		if (n.id === id) return updater(n);
		if (n.children)
			return { ...n, children: updateNode(n.children, id, updater) };
		return n;
	});
}

function deleteNode(nodes: FileNode[], id: string): FileNode[] {
	return nodes
		.filter((n) => n.id !== id)
		.map((n) =>
			n.children ? { ...n, children: deleteNode(n.children, id) } : n,
		);
}

function addChild(
	nodes: FileNode[],
	parentId: string,
	child: FileNode,
): FileNode[] {
	return nodes.map((n) => {
		if (n.id === parentId && n.type === "folder") {
			return { ...n, children: [...(n.children ?? []), child] };
		}
		if (n.children)
			return { ...n, children: addChild(n.children, parentId, child) };
		return n;
	});
}

function flattenFiles(
	nodes: FileNode[],
	prefix = "",
): { id: string; path: string; node: FileNode }[] {
	const result: { id: string; path: string; node: FileNode }[] = [];
	for (const n of nodes) {
		const path = prefix ? `${prefix}/${n.name}` : n.name;
		if (n.type === "file") result.push({ id: n.id, path, node: n });
		if (n.children) result.push(...flattenFiles(n.children, path));
	}
	return result;
}

export function useFileSystem() {
	const [files, setFiles] = useState<FileNode[]>(DEFAULT_FILES);
	const [workspacePath, setWorkspacePath] = useState<string>("");
	const [openTabs, setOpenTabs] = usePersisted<string[]>("codify-tabs", [
		"main-ts",
	]);
	const [activeTab, setActiveTab] = usePersisted<string>(
		"codify-active-tab",
		"main-ts",
	);
	const [autoSave, setAutoSave] = usePersisted<boolean>(
		"codify-autosave",
		true,
	);
	const [dirtyFiles, setDirtyFiles] = useState<string[]>([]);

	// Load the initial workspace folder on boot and free the localStorage quota!
	useEffect(() => {
		try {
			localStorage.removeItem("codify-files");
		} catch {}

		fetch("/api/read-folder")
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					setFiles(data.files);
					setWorkspacePath(data.path);
				}
			})
			.catch((err) => console.error("[Initial Load Error]", err));
	}, []);

	const flatFiles = useMemo(() => flattenFiles(files), [files]);

	const activeFile = useMemo(
		() => findNode(files, activeTab),
		[files, activeTab],
	);

	const syncTimeoutRef = useRef<Record<string, any>>({});

	const syncPhysicalFile = useCallback(
		(id: string, content: string, customPath?: string) => {
			let pathStr = customPath;
			if (!pathStr) {
				const fileItem = flatFiles.find((f) => f.id === id);
				if (!fileItem) return;
				pathStr = fileItem.path;
			}
			if (!pathStr || pathStr === "...") return;
			fetch("/api/save-file", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ pathStr, content }),
			}).catch((err) => console.error("[Physical Sync Error]", err));
		},
		[flatFiles],
	);

	const openFile = useCallback(
		async (id: string) => {
			const node = findNode(files, id);
			if (!node || node.type !== "file") return;

			if (node.content === undefined || node.content === null) {
				try {
					const res = await fetch(
						`/api/read-file?path=${encodeURIComponent(id)}`,
					);
					const data = await res.json();
					if (data.success) {
						setFiles((f) =>
							updateNode(f, id, (n) => ({
								...n,
								content: data.content,
							})),
						);
					} else {
						console.error(
							"[Open File Error] Failed to read content:",
							data.error,
						);
					}
				} catch (err) {
					console.error("[Open File Error] Fetch failed:", err);
				}
			}

			setOpenTabs((tabs) => (tabs.includes(id) ? tabs : [...tabs, id]));
			setActiveTab(id);
		},
		[files, setOpenTabs, setActiveTab, setFiles],
	);

	const closeTab = useCallback(
		(id: string) => {
			setOpenTabs((tabs) => {
				const next = tabs.filter((t) => t !== id);
				if (activeTab === id && next.length > 0) {
					const idx = tabs.indexOf(id);
					setActiveTab(next[Math.max(0, idx - 1)] ?? next[0]);
				}
				return next;
			});
		},
		[activeTab, setOpenTabs, setActiveTab],
	);

	const updateContent = useCallback(
		(id: string, content: string) => {
			setFiles((f) => updateNode(f, id, (n) => ({ ...n, content })));

			if (autoSave) {
				if (syncTimeoutRef.current[id]) {
					clearTimeout(syncTimeoutRef.current[id]);
				}
				syncTimeoutRef.current[id] = setTimeout(() => {
					syncPhysicalFile(id, content);
					delete syncTimeoutRef.current[id];
				}, 300);
			} else {
				setDirtyFiles((prev) =>
					prev.includes(id) ? prev : [...prev, id],
				);
			}
		},
		[setFiles, syncPhysicalFile, autoSave],
	);

	const saveFile = useCallback(
		(id: string) => {
			const fileItem = flatFiles.find((f) => f.id === id);
			if (!fileItem || fileItem.node.type !== "file") return;
			syncPhysicalFile(id, fileItem.node.content || "");
			setDirtyFiles((prev) => prev.filter((x) => x !== id));
		},
		[flatFiles, syncPhysicalFile],
	);

	const saveActiveFile = useCallback(() => {
		if (activeTab) {
			saveFile(activeTab);
		}
	}, [activeTab, saveFile]);

	const openWorkspaceFolder = useCallback(
		async (folderPath: string) => {
			try {
				const res = await fetch(
					`/api/read-folder?path=${encodeURIComponent(folderPath)}`,
				);
				const data = await res.json();
				if (data.success) {
					setFiles(data.files);
					setWorkspacePath(data.path);
					setOpenTabs([]);
					setActiveTab("");
					setDirtyFiles([]);
					return { success: true, path: data.path };
				} else {
					return { success: false, error: data.error };
				}
			} catch (err: any) {
				return { success: false, error: err.message };
			}
		},
		[setFiles, setOpenTabs, setActiveTab, setWorkspacePath],
	);

	const openFolderDialog = useCallback(async () => {
		try {
			const res = await fetch("/api/open-folder-dialog");
			const data = await res.json();
			if (data.success) {
				setFiles(data.files);
				setWorkspacePath(data.path);
				setOpenTabs([]);
				setActiveTab("");
				setDirtyFiles([]);
				return { success: true, path: data.path };
			} else {
				return { success: false, error: data.error };
			}
		} catch (err: any) {
			return { success: false, error: err.message };
		}
	}, [setFiles, setOpenTabs, setActiveTab, setWorkspacePath]);

	const createFile = useCallback(
		(parentId: string, name: string) => {
			const id = `file-${Date.now()}`;
			const ext = name.split(".").pop() ?? "";
			const langMap: Record<string, string> = {
				ts: "typescript",
				js: "javascript",
				json: "json",
				md: "markdown",
				css: "css",
				html: "html",
			};
			const child: FileNode = {
				id,
				name,
				type: "file",
				content: "",
				language: langMap[ext] ?? "plaintext",
			};

			const parentNode = findNode(files, parentId);
			let pathStr = name;
			if (parentNode && parentId !== "root") {
				const parentItem = flatFiles.find((f) => f.id === parentId);
				if (parentItem) {
					pathStr = `${parentItem.path}/${name}`;
				} else {
					pathStr = `${parentNode.name}/${name}`;
				}
			}

			setFiles((f) => addChild(f, parentId, child));
			openFile(id);
			syncPhysicalFile(id, "", pathStr);
		},
		[setFiles, openFile, syncPhysicalFile, files, flatFiles],
	);

	const createFolder = useCallback(
		(parentId: string, name: string) => {
			const child: FileNode = {
				id: `folder-${Date.now()}`,
				name,
				type: "folder",
				children: [],
			};

			const parentNode = findNode(files, parentId);
			let pathStr = name;
			if (parentNode && parentId !== "root") {
				const parentItem = flatFiles.find((f) => f.id === parentId);
				if (parentItem) {
					pathStr = `${parentItem.path}/${name}`;
				} else {
					pathStr = `${parentNode.name}/${name}`;
				}
			}

			setFiles((f) => addChild(f, parentId, child));

			if (pathStr && pathStr !== "...") {
				fetch("/api/save-file", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ pathStr, isFolder: true }),
				}).catch((err) =>
					console.error("[Physical Folder Sync Error]", err),
				);
			}
		},
		[setFiles, files, flatFiles],
	);

	const deleteFile = useCallback(
		(id: string) => {
			setFiles((f) => deleteNode(f, id));
			closeTab(id);
		},
		[setFiles, closeTab],
	);

	const syncFileSystemNode = useCallback(
		(type: "file" | "folder", pathStr: string, content = "") => {
			const isFolder = type === "folder";
			setFiles((currentFiles) => {
				const parts = pathStr
					.replace(/\\/g, "/")
					.split("/")
					.filter(Boolean);
				if (parts.length === 0) return currentFiles;

				let tempFiles = JSON.parse(JSON.stringify(currentFiles)); // deep clone to prevent direct mutations

				let rootNode = tempFiles.find((n: any) => n.id === "root");
				if (!rootNode) {
					rootNode = {
						id: "root",
						name: "projeto",
						type: "folder",
						children: [],
					};
					tempFiles.push(rootNode);
				}

				let currentChildren = rootNode.children || [];

				for (let i = 0; i < parts.length; i++) {
					const part = parts[i];
					const isLast = i === parts.length - 1;

					if (isLast) {
						const existingNode = currentChildren.find(
							(n: any) => n.name === part,
						);
						if (existingNode) {
							if (!isFolder && content !== undefined) {
								existingNode.content = content;
							}
						} else {
							const id = isFolder
								? `folder-${Date.now()}-${part}`
								: `file-${Date.now()}-${part}`;
							const ext = part.split(".").pop() ?? "";
							const langMap: Record<string, string> = {
								ts: "typescript",
								js: "javascript",
								json: "json",
								md: "markdown",
								css: "css",
								html: "html",
							};
							const child: FileNode = isFolder
								? {
										id,
										name: part,
										type: "folder",
										children: [],
									}
								: {
										id,
										name: part,
										type: "file",
										content: content || "",
										language: langMap[ext] ?? "plaintext",
									};
							currentChildren.push(child);
						}
					} else {
						let folderNode = currentChildren.find(
							(n: any) => n.name === part && n.type === "folder",
						);
						if (!folderNode) {
							const id = `folder-${Date.now()}-${part}`;
							folderNode = {
								id,
								name: part,
								type: "folder",
								children: [],
							};
							currentChildren.push(folderNode);
						}
						if (!folderNode.children) {
							folderNode.children = [];
						}
						currentChildren = folderNode.children;
					}
				}

				return tempFiles;
			});
		},
		[setFiles],
	);

	const uploadOSFile = useCallback(
		async (file: File) => {
			return new Promise<{
				success: boolean;
				id?: string;
				path?: string;
				error?: string;
			}>((resolve) => {
				const reader = new FileReader();
				reader.onload = async (e) => {
					const result = e.target?.result as string;
					if (!result)
						return resolve({
							success: false,
							error: "Falha ao ler o ficheiro",
						});

					// Strip the "data:image/png;base64," prefix
					const base64 = result.split(",")[1];
					if (!base64)
						return resolve({
							success: false,
							error: "Ficheiro vazio ou corrompido",
						});

					const pathStr = `uploads/${file.name}`;

					try {
						const res = await fetch("/api/save-file-base64", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ pathStr, base64 }),
						});
						const data = await res.json();

						if (data.success) {
							// Register it in the virtual file system without sending the base64 string as text content
							syncFileSystemNode("file", pathStr, "");

							// We need to find the generated ID for this node
							resolve({
								success: true,
								id: `file-${Date.now()}-${file.name}`,
								path: pathStr,
							});
						} else {
							resolve({ success: false, error: data.error });
						}
					} catch (err: any) {
						resolve({ success: false, error: err.message });
					}
				};
				reader.onerror = () =>
					resolve({ success: false, error: "Erro de leitura local" });
				reader.readAsDataURL(file);
			});
		},
		[syncFileSystemNode],
	);

	return {
		files,
		flatFiles,
		workspacePath,
		openTabs,
		activeTab,
		activeFile,
		openFile,
		closeTab,
		setActiveTab,
		updateContent,
		createFile,
		createFolder,
		deleteFile,
		syncFileSystemNode,
		autoSave,
		setAutoSave,
		dirtyFiles,
		saveFile,
		saveActiveFile,
		openWorkspaceFolder,
		openFolderDialog,
		uploadOSFile,
	};
}
