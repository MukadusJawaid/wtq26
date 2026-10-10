<#
  Builds the competition ZIP:  submission/wattwise-submission.zip

    output/level1.csv, level2.csv      the generated results
    source/...                         this project (no node_modules, .next, .git, .env)
    demo/demo.mp4                      optional: pass -Demo path\to\video

  Usage:  npm run package
          npm run package -- -Demo C:\path\to\demo.mp4
#>
param([string]$Demo)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$limitMb = 15

function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

# 1. the two result files must exist and be complete -------------------------------------------
$l1 = Join-Path $root 'output\level1.csv'
$l2 = Join-Path $root 'output\level2.csv'
foreach ($f in $l1, $l2) { if (-not (Test-Path $f)) { Fail "$f is missing. Run 'npm run generate' first." } }

$rows1 = @(Import-Csv $l1)
$rows2 = @(Import-Csv $l2)
if ($rows1.Count -eq 0) { Fail 'level1.csv has no rows.' }
if ($rows2.Count -eq 0) { Fail 'level2.csv has no rows.' }
$empty1 = @($rows1 | Where-Object { -not $_.json -or -not $_.json.Trim() }).Count
$empty2 = @($rows2 | Where-Object { -not $_.answer -or -not $_.answer.Trim() }).Count
if ($empty1 -or $empty2) { Fail "Empty cells found (level1 json: $empty1, level2 answer: $empty2). Re-run the batch." }
Write-Host "Results OK: level1.csv $($rows1.Count) rows, level2.csv $($rows2.Count) rows, no empty cells."

# 2. what goes into source/ ---------------------------------------------------------------------
$exclude = @(
  '^node_modules/', '^\.next/', '^\.git/', '^output/', '^submission/', '^coverage/', '^\.vercel/',
  '^\.env($|\.)', '\.tsbuildinfo$', '^docs/.*\.pdf$',
  '^test/bills/(?!\.gitkeep)'
)
# .env.example is the one env file that must ship
$keep = '^\.env\.example$'

$sources = Get-ChildItem -Path $root -Recurse -File -Force | ForEach-Object {
  $rel = $_.FullName.Substring($root.Path.Length + 1).Replace('\', '/')
  $skip = $false
  if ($rel -notmatch $keep) { foreach ($pattern in $exclude) { if ($rel -match $pattern) { $skip = $true; break } } }
  if (-not $skip) { [pscustomobject]@{ Path = $_.FullName; Rel = $rel } }
}
if (-not ($sources | Where-Object Rel -eq '.env.example')) { Fail '.env.example is missing.' }
if (-not ($sources | Where-Object Rel -eq 'README.md')) { Fail 'README.md is missing.' }

# 3. refuse to ship anything that looks like a real key -----------------------------------------
$secret = '(sk-ant-[A-Za-z0-9_\-]{10,}|AIza[0-9A-Za-z_\-]{30,}|sk-[A-Za-z0-9]{32,})'
$textExt = '\.(ts|tsx|js|mjs|json|md|css|ps1|example|txt|svg)$'
foreach ($s in $sources) {
  if ($s.Rel -match $textExt -or $s.Rel -eq '.env.example') {
    if (Select-String -Path $s.Path -Pattern $secret -Quiet) { Fail "Possible API key inside $($s.Rel). Remove it before packaging." }
  }
}

# 4. build the zip (forward-slash entry names so it opens everywhere) ---------------------------
Add-Type -AssemblyName System.IO.Compression.FileSystem
$outDir = Join-Path $root 'submission'
New-Item -ItemType Directory -Force $outDir | Out-Null
$zipPath = Join-Path $outDir 'wattwise-submission.zip'
if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }

$zip = [IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
  $add = {
    param($file, $entry)
    [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file, $entry, [IO.Compression.CompressionLevel]::Optimal)
  }
  & $add $l1 'output/level1.csv'
  & $add $l2 'output/level2.csv'
  foreach ($s in $sources) { & $add $s.Path ("source/" + $s.Rel) }
  if ($Demo) {
    if (-not (Test-Path $Demo)) { Fail "Demo file not found: $Demo" }
    $ext = [IO.Path]::GetExtension($Demo).ToLower()
    if ($ext -notin '.mp4', '.mov', '.webm') { Fail 'Demo must be .mp4, .mov or .webm.' }
    & $add (Resolve-Path $Demo).Path ("demo/demo$ext")
  }
} finally { $zip.Dispose() }

# 5. report -----------------------------------------------------------------------------------
$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
$check = [IO.Compression.ZipFile]::OpenRead($zipPath)
$top = $check.Entries | ForEach-Object { $_.FullName.Split('/')[0] } | Sort-Object -Unique
$count = $check.Entries.Count
$check.Dispose()
Write-Host ""
Write-Host "Created $zipPath"
Write-Host "  size   : $sizeMb MB (limit $limitMb MB)"
Write-Host "  files  : $count"
Write-Host "  folders: $($top -join ', ')"
if ($sizeMb -gt $limitMb) { Fail "ZIP is larger than $limitMb MB." }
if (-not $Demo) { Write-Host "  note   : no demo included (optional, up to 5 bonus marks). Add one with -Demo <file>." -ForegroundColor Yellow }
Write-Host "Open the ZIP once and check it before you upload: you can only submit once."
