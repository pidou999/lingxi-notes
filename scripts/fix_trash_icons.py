path = r"D:\开发项目\222222\ai-notes\apps\web\src\app(dashboard)\trash\page.tsx"
with open(path, encoding="utf-8") as f:
    c = f.read()
c = c.replace("RotateCcw", "RefreshCw")
c = c.replace("AlertTriangle", "XCircle")
c = c.replace(
    'import { Trash2, RefreshCw, RotateCcw, AlertTriangle }',
    'import { Trash2, RefreshCw, XCircle }',
)
with open(path, "w", encoding="utf-8") as f:
    f.write(c)
print("done")
