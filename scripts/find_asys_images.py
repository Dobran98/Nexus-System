import re

with open('apps/admin-portal/public/asys/index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Buscar .bg-login-image o referencias a imágenes
for line in text.splitlines():
    if any(k in line.lower() for k in ['bg-login-image', 'background-image', 'background:', 'portada', '.jpg', '.png', '.webp']):
        if len(line.strip()) < 200:
            print(line.strip())
