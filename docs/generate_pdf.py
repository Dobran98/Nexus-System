import os
import subprocess
import markdown

md_path = r"C:\Users\Maria\Desktop\SCRIPTS\NEXUS SYSTEM\MANUAL_DE_FUNCIONAMIENTO_NEXUS_SYSTEM.md"
pdf_path_root = r"C:\Users\Maria\Desktop\SCRIPTS\NEXUS SYSTEM\MANUAL_DE_FUNCIONAMIENTO_NEXUS_SYSTEM.pdf"
pdf_path_docs = r"C:\Users\Maria\Desktop\SCRIPTS\NEXUS SYSTEM\docs\MANUAL_DE_FUNCIONAMIENTO_NEXUS_SYSTEM.pdf"
temp_html_path = r"C:\Users\Maria\Desktop\SCRIPTS\NEXUS SYSTEM\docs\manual_temp.html"

with open(md_path, "r", encoding="utf-8") as f:
    md_content = f.read()

# Convert markdown to HTML with tables and fenced code
html_body = markdown.markdown(
    md_content,
    extensions=['tables', 'fenced_code', 'nl2br']
)

# HTML template with professional styling for PDF printing
full_html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Manual de Funcionamiento y Operaciones — NEXUS SYSTEM</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');

    @page {{
      size: A4 portrait;
      margin: 20mm 15mm 20mm 15mm;
      @bottom-right {{
        content: counter(page);
        font-family: 'Inter', sans-serif;
        font-size: 8pt;
        color: #64748b;
      }}
    }}

    body {{
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 9.5pt;
      line-height: 1.6;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }}

    .cover-page {{
      page-break-after: always;
      height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      border-left: 6px solid #2563eb;
      padding-left: 30px;
      margin-top: 50px;
    }}

    .cover-title {{
      font-size: 26pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.15;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }}

    .cover-subtitle {{
      font-size: 13pt;
      font-weight: 600;
      color: #2563eb;
      margin-bottom: 25px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }}

    .cover-meta {{
      font-size: 9pt;
      color: #64748b;
      line-height: 1.8;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      margin-top: 20px;
    }}

    .cover-meta strong {{
      color: #334155;
    }}

    h1, h2, h3, h4 {{
      color: #0f172a;
      font-weight: 700;
      letter-spacing: -0.3px;
    }}

    h1 {{
      font-size: 16pt;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 6px;
      margin-top: 28px;
      margin-bottom: 14px;
      page-break-after: avoid;
    }}

    h2 {{
      font-size: 13pt;
      color: #1e40af;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 22px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }}

    h3 {{
      font-size: 11pt;
      color: #334155;
      margin-top: 16px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }}

    p {{
      margin-top: 0;
      margin-bottom: 10px;
      text-align: justify;
    }}

    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }}

    th {{
      background-color: #0f172a;
      color: #ffffff;
      font-weight: 600;
      text-align: left;
      padding: 7px 10px;
      border: 1px solid #0f172a;
      text-transform: uppercase;
      font-size: 7.5pt;
      letter-spacing: 0.5px;
    }}

    td {{
      padding: 6px 10px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }}

    tr:nth-child(even) td {{
      background-color: #f8fafc;
    }}

    pre {{
      background-color: #0f172a;
      color: #f8fafc;
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 7.5pt;
      line-height: 1.45;
      padding: 10px 14px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 12px 0;
      page-break-inside: avoid;
    }}

    code {{
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 8pt;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 1px 4px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }}

    pre code {{
      background-color: transparent;
      color: inherit;
      padding: 0;
      border: none;
    }}

    ul, ol {{
      margin-top: 0;
      margin-bottom: 10px;
      padding-left: 20px;
    }}

    li {{
      margin-bottom: 4px;
    }}

    blockquote {{
      border-left: 4px solid #2563eb;
      background-color: #eff6ff;
      color: #1e3a8a;
      margin: 12px 0;
      padding: 8px 14px;
      border-radius: 0 6px 6px 0;
      font-size: 9pt;
    }}

    hr {{
      border: none;
      border-top: 1px solid #cbd5e1;
      margin: 20px 0;
    }}

    .badge {{
      display: inline-block;
      padding: 2px 6px;
      font-size: 7.5pt;
      font-weight: 700;
      border-radius: 4px;
      text-transform: uppercase;
    }}

    .badge-success {{ background-color: #dcfce7; color: #166534; }}
    .badge-warning {{ background-color: #fef3c7; color: #92400e; }}
    .badge-danger {{ background-color: #fee2e2; color: #991b1b; }}
    .badge-info {{ background-color: #dbeafe; color: #1e40af; }}
  </style>
</head>
<body>
  <div class="cover-page">
    <div class="cover-subtitle">Documentación Técnica y Operativa</div>
    <div class="cover-title">MANUAL DE FUNCIONAMIENTO Y OPERACIONES</div>
    <div style="font-size: 14pt; color: #475569; margin-top: 5px;">Sistema Unificado de Intranet Empresarial (NEXUS SYSTEM)</div>
    <div class="cover-meta">
      <div><strong>Versión Oficial:</strong> 2.0.0 (Release Enterprise)</div>
      <div><strong>Fecha de Emisión:</strong> Noviembre 2026</div>
      <div><strong>Plataforma:</strong> Next.js 14 / Supabase BaaS PostgreSQL 15 / Vercel Serverless</div>
      <div><strong>Repositorio Git:</strong> https://github.com/Dobran98/Nexus-System.git</div>
      <div><strong>Distribución:</strong> Personal Operativo, Supervisores, Analistas y Administradores de Infraestructura</div>
    </div>
  </div>

  <div class="content">
    {html_body}
  </div>
</body>
</html>
"""

with open(temp_html_path, "w", encoding="utf-8") as f:
    f.write(full_html)

print("HTML temporal generado en:", temp_html_path)

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
browser_exec = chrome_path if os.path.exists(chrome_path) else edge_path

print("Utilizando motor Chromium:", browser_exec)

cmd = [
    browser_exec,
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_path_root}",
    temp_html_path
]

res = subprocess.run(cmd, capture_output=True, text=True)
print("Return code:", res.returncode)

if os.path.exists(pdf_path_root):
    # Copiar a docs
    import shutil
    shutil.copyfile(pdf_path_root, pdf_path_docs)
    size_mb = os.path.getsize(pdf_path_root) / (1024 * 1024)
    print(f"PDF generado exitosamente: {pdf_path_root} ({size_mb:.2f} MB)")
    print(f"PDF replicado en docs: {pdf_path_docs}")
else:
    print("Error: No se pudo generar el PDF.")
    print("STDOUT:", res.stdout)
    print("STDERR:", res.stderr)
