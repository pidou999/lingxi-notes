"""Debug check the trash page file"""
import os

path = r"D:\开发项目\222222\ai-notes\apps\web\src\app(dashboard)\trash\page.tsx"

with open(path, encoding="utf-8") as f:
    content = f.read()

print(f"File size: {len(content)} bytes")
print(f"Lines: {content.count(chr(10)) + 1}")
print(f"Starts with: {repr(content[:50])}")
print(f"Ends with: {repr(content[-50:])}")
print(f"Has 'export default': {'export default' in content}")
print(f"Has 'TrashPage': {'TrashPage' in content}")

# Check for BOM
import codecs
with open(path, "rb") as f:
    raw = f.read(10)
if raw.startswith(codecs.BOM_UTF8):
    print("Has BOM!")
else:
    print("No BOM")

# Check for any problematic characters
for i, ch in enumerate(content):
    if ch not in '\r\n\t !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~©':
        print(f"Unusual char at {i}: {repr(ch)} (U+{ord(ch):04X})")
        break
else:
    print("No unusual characters found")
