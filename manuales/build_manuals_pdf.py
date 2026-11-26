import os
import re
import glob
import subprocess
import markdown

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

THEME_MAP = {
    "00_MANUAL_GENERAL_NEXUS": {"accent": "#2563eb", "badge": "DOCUMENTACIÓN MAESTRA", "sub": "Arquitectura, Roles RBAC & Gobernanza Global"},
    "01_MANUAL_DE_USUARIO_OPERADOR": {"accent": "#0ea5e9", "badge": "GUÍA DEL OPERADOR", "sub": "Uso Diario, Estación de Trabajo & Marcaje"},
    "02_MANUAL_MODULO_ASYS": {"accent": "#10b981", "badge": "MÓDULO ASYS", "sub": "Control de Asistencia QR, GPS & Guardias"},
    "03_MANUAL_MODULO_BRIANA": {"accent": "#0284c7", "badge": "MÓDULO BRIANA", "sub": "Telefonía Celular sin PBX & Discador Guiado"},
    "04_MANUAL_MODULO_ORIANA": {"accent": "#4f46e5", "badge": "MÓDULO ORIANA", "sub": "Command Center, Reportes Diarios & Auditoría"},
    "05_MANUAL_MODULO_RECLASIFICACION": {"accent": "#d97706", "badge": "MÓDULO RECLASIFICACIÓN", "sub": "Triage Colaborativo & Calidad Operativa"},
    "06_MANUAL_MODULO_JADE": {"accent": "#059669", "badge": "MÓDULO JADE", "sub": "Control Territorial, Misiones & Rendición"},
    "07_MANUAL_MODULO_ELECCIONES": {"accent": "#0891b2", "badge": "SALA ELECTORAL", "sub": "Monitoreo de 335 Municipios & Franjas Horarias"},
    "08_MANUAL_ENCUESTAS_Y_GOBERNANZA": {"accent": "#7c3aed", "badge": "GOBERNANZA & ENCUESTAS", "sub": "RBAC, Nexus Surveys, Avisos & Feature Flags"},
}

def transform_callouts(html: str) -> str:
    """Convierte blockquotes [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION] en tarjetas visuales."""
    styles = {
        "NOTE": ("#2563eb", "#eff6ff", "#1e3a8a", "ℹ️ NOTA"),
        "TIP": ("#059669", "#ecfdf5", "#065f46", "💡 CONSEJO OPERATIVO"),
        "IMPORTANT": ("#4f46e5", "#eef2ff", "#312e81", "📌 IMPORTANTE"),
        "WARNING": ("#d97706", "#fffbeb", "#78350f", "⚠️ ATENCIÓN"),
        "CAUTION": ("#dc2626", "#fef2f2", "#7f1d1d", "🚨 SEGURIDAD CRÍTICA"),
    }
    for key, (border, bg, fg, label) in styles.items():
        pattern = re.compile(rf"<blockquote>\s*<p>\s*\[!{key}\]\s*(.*?)</p>\s*</blockquote>", re.DOTALL)
        replacement = (
            f'<div class="callout" style="border-left: 5px solid {border}; background: {bg}; color: {fg};">'
            f'<div class="callout-title" style="color: {border};">{label}</div>'
            f'<div class="callout-body">\\1</div></div>'
        )
        html = pattern.sub(replacement, html)
    return html

def find_browser() -> str:
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    raise FileNotFoundError("No se encontró Chrome ni Edge para generar PDF.")

def extract_title(md_text: str, fallback: str) -> str:
    for line in md_text.splitlines():
        if line.startswith("# "):
            return line.lstrip("# ").strip()
    return fallback

def build_pdf(md_path: str, browser_exec: str):
    name = os.path.splitext(os.path.basename(md_path))[0]
    pdf_path = os.path.join(BASE_DIR, f"{name}.pdf")
    temp_html = os.path.join(BASE_DIR, f".tmp_{name}.html")

    with open(md_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    theme = THEME_MAP.get(name, {"accent": "#2563eb", "badge": "MANUAL NEXUS", "sub": "Documentación Oficial"})
    accent = theme["accent"]
    title = extract_title(md_text, name)

    html_body = markdown.markdown(md_text, extensions=["tables", "fenced_code", "nl2br"])
    html_body = transform_callouts(html_body)

    full_html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>{title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');

    @page {{
      size: A4 portrait;
      margin: 18mm 14mm 18mm 14mm;
      @bottom-right {{
        content: "Página " counter(page) " de " counter(pages);
        font-family: 'Inter', sans-serif;
        font-size: 7.5pt;
        color: #64748b;
      }}
      @bottom-left {{
        content: "NEXUS SYSTEM · Documentación Oficial";
        font-family: 'Inter', sans-serif;
        font-size: 7.5pt;
        color: #94a3b8;
      }}
    }}

    body {{
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 9.5pt;
      line-height: 1.58;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }}

    .cover-card {{
      page-break-after: always;
      border-radius: 14px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #f8fafc;
      padding: 44px 36px;
      border-top: 8px solid {accent};
      margin-top: 30px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.15);
    }}

    .cover-badge {{
      display: inline-block;
      background: {accent};
      color: #ffffff;
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: 1.2px;
      padding: 5px 12px;
      border-radius: 999px;
      margin-bottom: 18px;
    }}

    .cover-title {{
      font-size: 22pt;
      font-weight: 800;
      line-height: 1.2;
      margin: 0 0 10px 0;
      color: #ffffff;
    }}

    .cover-sub {{
      font-size: 11.5pt;
      color: #cbd5e1;
      margin-bottom: 32px;
      font-weight: 500;
    }}

    .cover-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      border-top: 1px solid rgba(255,255,255,0.14);
      padding-top: 22px;
      font-size: 8.5pt;
      color: #cbd5e1;
    }}

    .cover-box {{
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 10px 12px;
    }}

    .cover-box strong {{
      display: block;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      margin-bottom: 3px;
    }}

    h1 {{
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 3px solid {accent};
      padding-bottom: 6px;
      margin: 20px 0 12px 0;
      page-break-after: avoid;
    }}

    h2 {{
      font-size: 12.5pt;
      font-weight: 700;
      color: {accent};
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin: 20px 0 10px 0;
      page-break-after: avoid;
    }}

    h3 {{
      font-size: 10.5pt;
      font-weight: 700;
      color: #334155;
      margin: 14px 0 6px 0;
      page-break-after: avoid;
    }}

    p {{
      margin: 0 0 9px 0;
    }}

    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 16px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
      border-radius: 8px;
      overflow: hidden;
    }}

    th {{
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}

    td {{
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #f1f5f9;
      vertical-align: top;
    }}

    tr:nth-child(even) td {{
      background: #f8fafc;
    }}

    pre {{
      background: #0f172a;
      color: #e2e8f0;
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 7.5pt;
      line-height: 1.45;
      padding: 12px 14px;
      border-radius: 8px;
      border-left: 4px solid {accent};
      overflow-x: auto;
      margin: 12px 0;
      page-break-inside: avoid;
    }}

    code {{
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 8pt;
      background: #f1f5f9;
      color: #0f172a;
      padding: 1px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }}

    pre code {{
      background: transparent;
      color: inherit;
      padding: 0;
      border: none;
    }}

    ul, ol {{
      margin: 0 0 10px 0;
      padding-left: 20px;
    }}

    li {{
      margin-bottom: 4px;
    }}

    .callout {{
      margin: 12px 0;
      padding: 10px 14px;
      border-radius: 0 8px 8px 0;
      font-size: 8.8pt;
      page-break-inside: avoid;
    }}

    .callout-title {{
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }}

    blockquote {{
      border-left: 4px solid {accent};
      background: #f8fafc;
      margin: 12px 0;
      padding: 8px 14px;
      border-radius: 0 6px 6px 0;
    }}

    hr {{
      border: none;
      border-top: 1px solid #cbd5e1;
      margin: 16px 0;
    }}
  </style>
</head>
<body>
  <div class="cover-card">
    <div class="cover-badge">{theme['badge']}</div>
    <div class="cover-title">{title}</div>
    <div class="cover-sub">{theme['sub']}</div>
    <div class="cover-grid">
      <div class="cover-box">
        <strong>Plataforma</strong>
        NEXUS SYSTEM (Intranet Corporativa)
      </div>
      <div class="cover-box">
        <strong>Versión & Emisión</strong>
        Release 3.0.0 · Noviembre 2026
      </div>
      <div class="cover-box">
        <strong>Infraestructura</strong>
        Next.js 14 · Supabase · Vercel · GAS
      </div>
      <div class="cover-box">
        <strong>Archivo Fuente</strong>
        manuales/{name}.md
      </div>
    </div>
  </div>
  <div class="content">
    {html_body}
  </div>
</body>
</html>"""

    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(full_html)

    cmd = [
        browser_exec,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        temp_html,
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(temp_html):
        os.remove(temp_html)

    if res.returncode == 0 and os.path.exists(pdf_path):
        size_kb = os.path.getsize(pdf_path) / 1024
        print(f"[OK] {name}.pdf ({size_kb:.1f} KB)")
        return True
    else:
        print(f"[ERROR] {name}.pdf -> code {res.returncode}: {res.stderr}")
        return False

def main():
    browser_exec = find_browser()
    print(f"Motor PDF: {browser_exec}")
    md_files = sorted(glob.glob(os.path.join(BASE_DIR, "*.md")))
    ok = 0
    for md_file in md_files:
        if build_pdf(md_file, browser_exec):
            ok += 1
    print(f"Completado: {ok}/{len(md_files)} PDFs generados en {BASE_DIR}")

if __name__ == "__main__":
    main()
