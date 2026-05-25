import os
import requests
from tqdm import tqdm

# URL do modelo
URL = "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf"

# Pasta e ficheiro
OUTPUT_DIR = "models"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "qwen2.5-coder-1.5b-q4_k_m.gguf")

# Criar pasta
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Tamanho dos chunks -> 500MB
CHUNK_SIZE = 500 * 1024 * 1024

# Verifica se já existe parte do ficheiro
resume_byte_pos = 0
if os.path.exists(OUTPUT_FILE):
    resume_byte_pos = os.path.getsize(OUTPUT_FILE)

headers = {
    "Range": f"bytes={resume_byte_pos}-"
}

print(f"\n📦 A continuar download de: {resume_byte_pos / (1024*1024):.2f} MB\n")

response = requests.get(URL, headers=headers, stream=True)

# Tamanho total
total_size = int(response.headers.get("content-length", 0)) + resume_byte_pos

mode = "ab" if resume_byte_pos else "wb"

with open(OUTPUT_FILE, mode) as file, tqdm(
    total=total_size,
    initial=resume_byte_pos,
    unit="B",
    unit_scale=True,
    unit_divisor=1024,
    desc="⬇ Download"
) as bar:

    for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
        if chunk:
            file.write(chunk)
            bar.update(len(chunk))

print("\n✅ Download concluído!")
print(f"📁 Guardado em: {OUTPUT_FILE}")