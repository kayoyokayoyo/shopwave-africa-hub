param(
  [switch]$DryRun,
  [switch]$List
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot ".env"

if (-not (Test-Path $envPath)) {
  throw "Fichier .env introuvable à la racine du projet."
}

$line = Get-Content $envPath | Where-Object { $_ -match '^\s*(SUPABASE_DB_MIGRATION_URL|LOVABLE_DB_MIGRATION_URL)\s*=' } | Select-Object -First 1
if (-not $line) {
  throw "SUPABASE_DB_MIGRATION_URL (ou LOVABLE_DB_MIGRATION_URL) est absente de .env."
}

$dbUrl = ($line -replace '^\s*(SUPABASE_DB_MIGRATION_URL|LOVABLE_DB_MIGRATION_URL)\s*=\s*', '').Trim().Trim('"', "'")
if (-not $dbUrl) {
  throw "L'URL de migration Supabase est vide."
}

$parsedUrl = [uri]$dbUrl
if ($parsedUrl.Host -notmatch '\.pooler\.supabase\.com$' -or $parsedUrl.Port -ne 5432) {
  throw "Utilise l'URI Session pooler Supabase (hôte .pooler.supabase.com, port 5432) dans SUPABASE_DB_MIGRATION_URL."
}

if ($List) {
  $cliArgs = @("migration", "list", "--db-url", $dbUrl)
} else {
  $cliArgs = @("db", "push", "--db-url", $dbUrl)
  if ($DryRun) {
    $cliArgs += "--dry-run"
  }
}

& supabase @cliArgs
exit $LASTEXITCODE