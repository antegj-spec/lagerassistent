# ============================================================
# migrate-state-fas4-1.ps1 — Fas 4.1 Steg 1: state-konsolidering
#
# Byter alla referenser till de gamla top-level state-vars i
# src/legacy/*.ts till de nya appState-aliasen (notes.list,
# materials.items, ui.tab, auth.user, ...).
#
# Skriptet körs EN gång — efteråt raderas det. Inga commit hooks.
#
# Hur kör jag: pwsh scripts/migrate-state-fas4-1.ps1
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

# Mappning: regex-pattern → ersättning.
# Använder \b för word-boundary; \w inkluderar [A-Za-z0-9_] så
# `materialItems` matchar inte `submaterialItemsX`. Lookbehind
# `(?<!\.)` förhindrar replace på property-access (`obj.materialItems`).

# --- SÄKRA (unika namn, ingen string/property-kollision) ---
$safe = @(
  # Materials
  @{ Pat = "(?<!\.)\bmaterialItemImages\b"; Rep = "materials.itemImages" },
  @{ Pat = "(?<!\.)\bmaterialItems\b";     Rep = "materials.items" },
  @{ Pat = "(?<!\.)\bmaterialCounts\b";    Rep = "materials.counts" },
  @{ Pat = "(?<!\.)\bmaterialHistory\b";   Rep = "materials.history" },
  @{ Pat = "(?<!\.)\bmaterialComments\b";  Rep = "materials.comments" },
  @{ Pat = "(?<!\.)\bmaterialImages\b";    Rep = "materials.images" },
  @{ Pat = "(?<!\.)\bborrowedMaterial\b";  Rep = "materials.borrowed" },
  @{ Pat = "(?<!\.)\bactionComments\b";    Rep = "materials.actionComments" },
  @{ Pat = "(?<!\.)\bopenItemId\b";        Rep = "materials.openItemId" },
  @{ Pat = "(?<!\.)\bopenMatId\b";         Rep = "materials.openId" },
  # Tasks
  @{ Pat = "(?<!\.)\bopenTaskId\b";        Rep = "tasks.openId" },
  @{ Pat = "(?<!\.)\barchivedTasks\b";     Rep = "tasks.archived" },
  @{ Pat = "(?<!\.)\btaskStatusLogs\b";    Rep = "tasks.statusLogs" },
  @{ Pat = "(?<!\.)\btaskComments\b";      Rep = "tasks.comments" },
  @{ Pat = "(?<!\.)\btaskChecklists\b";    Rep = "tasks.checklists" },
  # Returns
  @{ Pat = "(?<!\.)\breturnsList\b";       Rep = "returns.list" },
  @{ Pat = "(?<!\.)\barchivedReturns\b";   Rep = "returns.archived" },
  # Info
  @{ Pat = "(?<!\.)\bopenInfoId\b";        Rep = "info.openId" },
  @{ Pat = "(?<!\.)\binfoArticles\b";      Rep = "info.articles" },
  @{ Pat = "(?<!\.)\binfoImages\b";        Rep = "info.images" },
  @{ Pat = "(?<!\.)\binfoComments\b";      Rep = "info.comments" },
  @{ Pat = "(?<!\.)\binfoEditMode\b";      Rep = "info.editMode" },
  @{ Pat = "(?<!\.)\binfoEditImages\b";    Rep = "info.editImages" },
  # Notes
  @{ Pat = "(?<!\.)\btrashedNotes\b";      Rep = "notes.trashed" },
  # UI — unika namn
  @{ Pat = "(?<!\.)\bplanPersonFilter\b";  Rep = "ui.planPersonFilter" },
  @{ Pat = "(?<!\.)\bmatSubTab\b";         Rep = "ui.matSubTab" },
  @{ Pat = "(?<!\.)\bplanSubTab\b";        Rep = "ui.planSubTab" },
  @{ Pat = "(?<!\.)\bpinBuf\b";            Rep = "ui.pinBuf" },
  @{ Pat = "(?<!\.)\bselUser\b";           Rep = "ui.selUser" },
  @{ Pat = "(?<!\.)\bfirstPinStep\b";      Rep = "ui.firstPinStep" },
  @{ Pat = "(?<!\.)\bfirstPinNew\b";       Rep = "ui.firstPinNew" },
  @{ Pat = "(?<!\.)\bfirstPinConfirm\b";   Rep = "ui.firstPinConfirm" },
  @{ Pat = "(?<!\.)\bsearchQuery\b";       Rep = "ui.searchQuery" },
  @{ Pat = "(?<!\.)\bimgData\b";           Rep = "ui.imgData" },
  @{ Pat = "(?<!\.)\bimgFile\b";           Rep = "ui.imgFile" },
  # Komentar-bild-staging (var med _-prefix)
  @{ Pat = "(?<!\.)_matCommentImgUrl\b";   Rep = "ui.matCommentImgUrl" },
  @{ Pat = "(?<!\.)_itemCommentImgUrl\b";  Rep = "ui.itemCommentImgUrl" },
  @{ Pat = "(?<!\.)_infoCommentImgUrl\b";  Rep = "ui.infoCommentImgUrl" },
  # Short UI flags
  @{ Pat = "(?<!\.)\bfCat\b";              Rep = "ui.fCat" },
  @{ Pat = "(?<!\.)\bfStat\b";             Rep = "ui.fStat" },
  @{ Pat = "(?<!\.)\bfAssigned\b";         Rep = "ui.fAssigned" }
)

# --- RISKABLA (kort + vanligt namn — behöver striktare context) ---
# Lookbehind: föregående tecken får INTE vara `"` (sträng), `.` (property
# access), `-` (HTML attr som data-user, CSS class som mat-loading),
# `_` eller `\w` (substring), eller `/` (URL-path).
# Lookahead: nästa tecken får INTE vara `_` eller `\w` (substring),
# `"` (sträng-key), `:` (object-literal-key som {tab: x}), `=` (HTML
# attr som loading="lazy"), eller `-` (CSS class som loading-spinner).
$risky = @(
  @{ Pat = '(?<![".\-/_\w])user(?![_\w":=\-])';      Rep = "auth.user" },
  @{ Pat = '(?<![".\-/_\w])isAdmin(?![_\w":=\-])';   Rep = "auth.isAdmin" },
  @{ Pat = '(?<![".\-/_\w])tab(?![_\w":=\-])';       Rep = "ui.tab" },
  @{ Pat = '(?<![".\-/_\w])loading(?![_\w":=\-])';   Rep = "ui.loading" },
  @{ Pat = '(?<![".\-/_\w])openId(?![_\w":=\-])';    Rep = "notes.openId" },
  # `comments` är överlappande med notes.comments — vissa funktionsparametrar
  # heter "noteId" eller "id", inte "comments", så det borde gå. Risk: någon
  # lokal var heter `comments` också. Verifiera diff.
  @{ Pat = '(?<![".\-/_\w])comments(?![_\w":=\-])';  Rep = "notes.comments" }
)

# `notes`, `materials`, `tasks`, `chat` är aliaser med samma namn som
# de var. Vi behöver bara byta deras *array-användningar* från
# `notes.X` (array-method) till `notes.list.X`. Detta är inte
# trivialt med regex — hanteras manuellt nedan.

function Run-Replacements {
  param([string]$Content, [array]$Rules)
  foreach ($rule in $Rules) {
    $Content = [regex]::Replace($Content, $rule.Pat, $rule.Rep)
  }
  return $Content
}

foreach ($file in $files) {
  if (-not (Test-Path $file)) {
    Write-Warning "Skipping missing file: $file"
    continue
  }
  $orig = Get-Content $file -Raw
  $new = Run-Replacements -Content $orig -Rules $safe
  $new = Run-Replacements -Content $new -Rules $risky
  if ($new -ne $orig) {
    Set-Content -Path $file -Value $new -NoNewline -Encoding UTF8
    Write-Host "Updated $file"
  } else {
    Write-Host "Unchanged $file"
  }
}

Write-Host ""
Write-Host "DONE. Next: manually update array-aliases (notes/materials/tasks/chat)"
Write-Host "and verify with 'git diff' + 'npm run typecheck'."
