path = "src/App.tsx"
with open(path) as f:
    content = f.read()

anchor = '      {/* HEADER TOP BAR */}'
banner = '''      {locationError && (
        <div className="absolute top-16 inset-x-4 z-50 bg-amber-600/90 text-white text-xs font-semibold p-2.5 rounded-xl text-center shadow-lg">
          {locationError}
        </div>
      )}

''' + anchor

content = content.replace(anchor, banner)

with open(path, 'w') as f:
    f.write(content)

print("Patch aplicado!")
