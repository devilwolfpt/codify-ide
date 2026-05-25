import { exec } from 'child_process';
import path from 'path';

const scriptPath = path.resolve('scratch/show_picker.ps1');
const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;

console.log("A executar script ps1...");
exec(cmd, (err, stdout, stderr) => {
  if (err) {
    console.error("Erro:", err);
    return;
  }
  console.log("Caminho selecionado:", stdout.trim());
});
