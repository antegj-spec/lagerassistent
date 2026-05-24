# ============================================================
# migrate-arrays-fas4-1.ps1 — Fas 4.1 Steg 1b: array-aliases
#
# `notes`, `materials`, `tasks`, `chat` ändrades från Note[], Material[],
# Task[], ChatMessage[] till objekt-aliaser ({list, ...}). Detta script
# uppdaterar alla array-användningar (`notes.filter` → `notes.list.filter`,
# `notes = newArr` → `notes.list = newArr`).
# ============================================================

$ErrorActionPreference = "Stop"
$files = @(
  "src/legacy/supabase.ts",
  "src/legacy/auth.ts",
  "src/legacy/ui.ts",
  "src/legacy/render.ts",
  "src/legacy/realtime.ts",
  "src/legacy/actions.ts"
)

$aliases = @("notes", "materials", "tasks", "chat")

# Array-methods som finns på native Array.prototype
$arrayMethods = "filter|map|forEach|find|findIndex|length|push|slice|some|reduce|every|includes|indexOf|lastIndexOf|sort|join|concat|flat|flatMap|reverse|at|pop|shift|unshift|splice|fill|copyWithin|values|keys|entries|toString|toLocaleString"

foreach ($file in $files) {
  if (-not (Test-Path $file)) {
    Write-Warning "Skipping missing file: $file"
    continue
  }
  $orig = Get-Content $file -Raw
  $new = $orig

  foreach ($alias in $aliases) {
    # 1) `alias.method(...)` → `alias.list.method(...)`
    $new = [regex]::Replace($new, "(?<!\.)\b$alias\.($arrayMethods)\b", "$alias.list.`$1")

    # 2) `alias = ...` (assignment, inkl `alias = []`)
    #    Måste inte matcha `alias.X = ...` (property assignment).
    #    Lookahead `\s*=(?!=)` — bara enkelt `=`, inte `==` eller `===`.
    $new = [regex]::Replace($new, "(?<!\.)\b$alias\b(\s*=)(?!=)", "$alias.list`$1")

    # 3) `[...alias]` spread
    $new = [regex]::Replace($new, "\[\.\.\.\b$alias\b\]", "[...$alias.list]")

    # 4) `alias[index]` index access — alias följt av `[`
    #    Måste inte matcha `aliasX[...]` (substring) eller `obj.alias[...]`.
    $new = [regex]::Replace($new, "(?<!\.)\b$alias\[", "$alias.list[")
  }

  if ($new -ne $orig) {
    Set-Content -Path $file -Value $new -NoNewline -Encoding UTF8
    Write-Host "Updated $file"
  } else {
    Write-Host "Unchanged $file"
  }
}

Write-Host ""
Write-Host "DONE. Verifiera med 'git diff' + 'npm run typecheck'."
