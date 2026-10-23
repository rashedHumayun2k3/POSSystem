const { spawn } = require("node:child_process");
const path = require("node:path");

// Explicit values override inherited production settings and Expo's dotenv files.
const child = spawn(process.execPath, [require.resolve("expo/bin/cli"), "start", "--web", "--port", "8081", "--clear", "--offline"], {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "development",
    BROWSER: "none",
    EXPO_PUBLIC_API_URL: "http://localhost:5018/api/v1",
    EXPO_PUBLIC_HUB_URL: "http://localhost:5018/hubs/live",
    EXPO_PUBLIC_MEDIA_URL: "http://localhost:5090",
  },
});
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
