path = ".github/workflows/build-apk.yml"
with open(path) as f:
    content = f.read()

old = """      - name: Build do site
        run: npm run build"""
new = """      - name: Build do site
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print("OK: workflow atualizado")
else:
    print("AVISO: trecho não encontrado, veja o arquivo manualmente")
