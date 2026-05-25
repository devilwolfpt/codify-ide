import { exec } from 'child_process';

const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output 'D:\\Caça ao Tesouro\\game'"`;

exec(cmd, (err, stdout, stderr) => {
  if (err) {
    console.error("Erro:", err);
    return;
  }
  console.log("Captured string:", stdout.trim());
});
