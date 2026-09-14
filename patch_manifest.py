path = "android/app/src/main/AndroidManifest.xml"
with open(path) as f:
    content = f.read()

if "ACCESS_FINE_LOCATION" not in content:
    anchor = "<manifest"
    idx = content.index(">", content.index(anchor)) + 1
    perms = '\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n'
    content = content[:idx] + perms + content[idx:]
    with open(path, 'w') as f:
        f.write(content)
    print("Permissões adicionadas!")
else:
    print("Já existia.")
