const fs = require("fs");
const path = require("path");

let obfuscator;
try {
	obfuscator = require("javascript-obfuscator");
} catch (err) {
	console.warn(
		"[obfuscate] javascript-obfuscator is not installed; skipping obfuscation.",
	);
	process.exit(0);
}

const distDir = path.join(__dirname, "..", "dist");
if (!fs.existsSync(distDir)) {
	console.error("[obfuscate] dist directory not found, run build first.");
	process.exit(1);
}

function walk(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full);
		} else if (entry.isFile() && full.endsWith(".js")) {
			// skip workers and known heavy binaries to avoid breaking them
			const lower = full.toLowerCase();
			if (
				lower.includes(".worker.") ||
				lower.includes("prettier") ||
				lower.includes("monaco")
			) {
				console.log("[obfuscate] Skipping worker/vendor file:", full);
				continue;
			}

			try {
				console.log("[obfuscate] Obfuscating", full);
				const code = fs.readFileSync(full, "utf8");
				const obf = obfuscator
					.obfuscate(code, {
						compact: true,
						controlFlowFlattening: true,
						controlFlowFlatteningThreshold: 0.75,
						deadCodeInjection: true,
						deadCodeInjectionThreshold: 0.4,
						debugProtection: false,
						disableConsoleOutput: true,
						identifierNamesGenerator: "hexadecimal",
						renameGlobals: false,
						rotateStringArray: true,
						seed: 12345,
						stringArray: true,
						stringArrayEncoding: ["rc4"],
						stringArrayThreshold: 0.75,
					})
					.getObfuscatedCode();

				fs.writeFileSync(full, obf, "utf8");
			} catch (err) {
				console.error(
					"[obfuscate] Failed to obfuscate",
					full,
					err && err.message,
				);
			}
		}
	}
}

walk(distDir);
console.log("[obfuscate] Done.");
