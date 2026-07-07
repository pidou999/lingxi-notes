"""Deep check"""
path = r"D:\开发项目\222222\ai-notes\apps\web\src\app(dashboard)\trash\page.tsx"
with open(path, encoding="utf-8") as f:
    content = f.read()

# Check for zero-width characters
for i, ch in enumerate(content):
    cp = ord(ch)
    if cp in (0x200B, 0x200C, 0x200D, 0xFEFF, 0x00AD):
        print(f"Zero-width char at {i}: U+{cp:04X}")
    
# Check that the Python string escapes are correct
# The raw string might have issues with double backslashes

# Show the import lines
for line in content.split("\n"):
    if "import" in line:
        print(f"Import: {repr(line)}")

# Show the export default
for line in content.split("\n"):
    if "export default" in line:
        print(f"Export: {repr(line)}")
