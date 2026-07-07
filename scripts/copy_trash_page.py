import shutil
import os

src = r"D:\开发项目\222222\ai-notes\scripts\trash_page_clean.tsx"
dst = r"D:\开发项目\222222\ai-notes\apps\web\src\app(dashboard)\trash\page.tsx"

# Read the clean file
with open(src, "r", encoding="utf-8") as f:
    content = f.read()

# Write to destination
os.makedirs(os.path.dirname(dst), exist_ok=True)
with open(dst, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Copied {len(content)} bytes to {dst}")
