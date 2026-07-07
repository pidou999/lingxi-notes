import os, shutil

# Copy a known-good page (edit/page.tsx) to trash/page.tsx
# Then we modify the copy to be the trash page

src = r"D:\开发项目\222222\ai-notes\apps\web\src\app(dashboard)\edit\page.tsx"
dst_dir = r"D:\开发项目\222222\ai-notes\apps\web\src\app(dashboard)\trash"
dst = os.path.join(dst_dir, "page.tsx")
os.makedirs(dst_dir, exist_ok=True)

# Just copy to see if the file works
shutil.copy2(src, dst)
print(f"Copied {src} -> {dst}")
print(f"File exists: {os.path.exists(dst)}")
print(f"Size: {os.path.getsize(dst)}")
