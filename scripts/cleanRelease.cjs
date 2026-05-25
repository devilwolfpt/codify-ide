const fs = require("fs");
const path = require("path");

const releaseDir = path.join(__dirname, "..", "release");
try {
	if (fs.existsSync(releaseDir)) {
		console.log(
			"[cleanRelease] Removing existing release directory:",
			releaseDir,
		);
		fs.rmSync(releaseDir, { recursive: true, force: true });
	}
} catch (err) {
	console.warn(
		"[cleanRelease] Failed to remove release directory, continuing:",
		err && err.message,
	);
}

// Also try to remove old win-unpacked resources lock if present
const unpacked = path.join(
	__dirname,
	"..",
	"release",
	"win-unpacked",
	"resources",
	"app.asar.unpacked",
);
try {
	if (fs.existsSync(unpacked)) {
		console.log("[cleanRelease] Removing leftover unpacked dir:", unpacked);
		fs.rmSync(unpacked, { recursive: true, force: true });
	}
} catch (err) {
	console.warn(
		"[cleanRelease] Failed to remove unpacked dir, continuing:",
		err && err.message,
	);
}

process.exit(0);
