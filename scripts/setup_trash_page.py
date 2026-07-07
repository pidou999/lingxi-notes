"""Check if trash page exists and recreate it cleanly"""
import os

# The actual on-disk directory name has parentheses
app_dir = r"D:\开发项目\222222\ai-notes\apps\web\src\app"
dashboard = None
for name in os.listdir(app_dir):
    if name.replace("(", "").replace(")", "") == "dashboard":
        dashboard = name
        break

if dashboard:
    trash_dir = os.path.join(app_dir, dashboard, "trash")
    trash_page = os.path.join(trash_dir, "page.tsx")
    
    if not os.path.exists(trash_dir):
        os.makedirs(trash_dir)
        print(f"Created {trash_dir}")
    
    # Read a known working page
    edit_page = os.path.join(app_dir, dashboard, "edit", "page.tsx")
    if os.path.exists(edit_page):
        with open(edit_page, "r", encoding="utf-8") as f:
            content = f.read()
        print(f"Read edit page: {len(content)} bytes")
        # Write to trash
        with open(trash_page, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Wrote trash page: {os.path.getsize(trash_page)} bytes")
    else:
        print(f"edit page not found at {edit_page}")
else:
    print("dashboard dir not found")
    print(f"Contents: {os.listdir(app_dir)}")
