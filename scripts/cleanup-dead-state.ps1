# Rensar dead state-refs (userPins, pinSet, loadPins) i auth.ts och supabase.ts

$ErrorActionPreference = "Stop"

# --- auth.ts ---
$auth = Get-Content 'src/legacy/auth.ts' -Raw

# Ta bort kommentar + loadPins-anrop (2 ställen: checkPin och restoreSession)
$auth = $auth -replace "(?m)^\s*// Ladda pinSet i bakgrunden.*?\r?\n", ""
$auth = $auth -replace "(?m)^\s*loadPins\(\)\.catch\(\(\) => \{\}\);\r?\n", ""

# Ta bort userPins/pinSet-rensning i logout (3 ställen)
$auth = $auth -replace "(?m)^\s*userPins = \{\};\r?\n", ""
$auth = $auth -replace "(?m)^\s*pinSet = \{\};\r?\n", ""
$auth = $auth -replace "(?m)^\s*if \(auth\.user\) pinSet\[auth\.user\] = true;\r?\n", ""

Set-Content 'src/legacy/auth.ts' -Value $auth -NoNewline -Encoding UTF8
Write-Host "auth.ts cleaned"

# --- supabase.ts ---
$sb = Get-Content 'src/legacy/supabase.ts' -Raw

# Ta bort hela loadPins-funktionen
$sb = $sb -replace "(?ms)async function loadPins\(\): Promise<void> \{.*?\r?\n\}\r?\n\r?\n", ""

# Ta bort dead state-skrivningar i savePin
$sb = $sb -replace "(?m)^\s*userPins\[userName\] = pin;\r?\n", ""
$sb = $sb -replace "(?m)^\s*pinSet\[userName\] = isSet;\r?\n", ""

Set-Content 'src/legacy/supabase.ts' -Value $sb -NoNewline -Encoding UTF8
Write-Host "supabase.ts cleaned"
