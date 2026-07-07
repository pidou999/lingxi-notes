import os

# List directories under apps/web/src/app to find actual paths
base = r"D:\开发项目\222222\ai-notes\apps\web\src\app"
for name in os.listdir(base):
    full = os.path.join(base, name)
    if os.path.isdir(full):
        print(f"Dir: {repr(name)} -> {full}")
        for sub in os.listdir(full):
            sub_full = os.path.join(full, sub)
            if os.path.isdir(sub_full):
                for sub2 in os.listdir(sub_full):
                    if 'trash' in sub2.lower() or 'edit' in sub2.lower() or 'notes' in sub2.lower():
                        print(f"  Sub: {repr(sub)} -> {sub_full}")
