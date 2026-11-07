# Local build / GitHub prerelease, without GitHub-hosted Actions minutes.
# Windows PowerShell: powershell -ExecutionPolicy Bypass -File .\scripts\preview-windows-local.ps1
# After checking the EXE: add -PublishOnly to upload the exact verified build.
[CmdletBinding()]
param([switch]$PublishOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$repo = 'JoaoVittorLi/meu-financeiro'
$branch = 'safety/cloud-migration-preflight-20261107'
function Run {
  param([string]$Executable,[string[]]$Arguments,[string]$Directory=$root)
  Push-Location $Directory
  try {
    & $Executable @Arguments
    if($LASTEXITCODE -ne 0){throw "$Executable falhou com código $LASTEXITCODE"}
  } finally { Pop-Location }
}
function Git {
  param([string[]]$Arguments)
  Push-Location $root
  try {
    $output = & git.exe @Arguments
    if($LASTEXITCODE -ne 0){throw 'Falha ao verificar git'}
    return ($output -join [Environment]::NewLine).Trim()
  } finally {Pop-Location}
}
foreach($app in @('git.exe','node.exe','npm.cmd','npx.cmd')){
  if(-not (Get-Command $app -ErrorAction SilentlyContinue)){throw "Instale $app antes de prosseguir."}
}
$active = Git @('rev-parse','--abbrev-ref','HEAD')
if($active -ne $branch){throw "Branch incorreta: $active. Esperada: $branch"}
$sha = Git @('rev-parse','HEAD')
if($sha -notmatch '^[a-f0-9]{40}$'){throw 'SHA inválido'}
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
if($version -notmatch '^\d+\.\d+\.\d+([.-][a-zA-Z0-9.-]+)?$'){throw 'Versão inválida'}
$major = [int](([string](& node.exe -p 'process.versions.node')).Split('.')[0])
if($major -lt 22){throw 'Node.js 22 ou mais recente é necessário'}
$release = Join-Path $root 'release'
$exeName = "MeuFinanceiro-Portable-$version-x64.exe"
$exe = Join-Path $release $exeName
$manifest = Join-Path $release 'PREVIEW-SHA256.txt'
$worker = Join-Path $root 'mobile-push'

if(-not $PublishOnly){
  if(-not (Test-Path (Join-Path $root 'node_modules'))){
    Run 'npm.cmd' @('install','--no-audit','--no-fund')
  }
  Run 'npm.cmd' @('run','test:db')
  Run 'npm.cmd' @('run','test:types')
  Run 'npm.cmd' @('run','compile')
  if(-not (Test-Path (Join-Path $worker 'node_modules'))){
    Run 'npm.cmd' @('install','--no-audit','--no-fund') $worker
  }
  Run 'npm.cmd' @('test') $worker
  Run 'npx.cmd' @('wrangler','deploy','--dry-run','--outdir',(Join-Path $root 'release-preview-worker-dry-run')) $worker
  $began = Get-Date
  Run 'npx.cmd' @('electron-builder','--win','portable','--x64','--publish','never')
  if(-not (Test-Path -LiteralPath $exe)){throw 'Build não gerou o EXE esperado'}
  $file = Get-Item -LiteralPath $exe
  if($file.Length -lt 10000000 -or $file.LastWriteTime -lt $began.AddMinutes(-1)){
    throw 'EXE incompleto ou não gerado nesta execução'
  }
  $hash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()
  @("Git commit: $sha","Windows preview: $version","$hash  $exeName") |
    Set-Content -LiteralPath $manifest -Encoding UTF8
  Write-Host "SUCESSO: testes locais e EXE gerado: $exe"
  Write-Host "SHA-256: $hash"
  Write-Host 'Faça um smoke test. Se aprovado, publique com -PublishOnly (não recompila).'
  exit 0
}

if(Git @('status','--porcelain')){throw 'Diretório com alterações não commitadas: não publicar'}
if(-not (Get-Command 'gh.exe' -ErrorAction SilentlyContinue)){
  throw 'Instale GitHub CLI e autentique via gh auth login antes de publicar'
}
if(-not (Test-Path -LiteralPath $exe) -or -not (Test-Path -LiteralPath $manifest)){
  throw 'Execute primeiro o build e os testes locais'
}
$lines = @(Get-Content -LiteralPath $manifest)
if($lines.Count -ne 3 -or $lines[0] -ne "Git commit: $sha"){
  throw 'O EXE local pertence a outro commit; gere novamente'
}
$hash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()
if($lines[2] -ne "$hash  $exeName"){throw 'Hash SHA256 divergente; publicação bloqueada'}
$tag = 'preview-' + $sha.Substring(0,12)
Push-Location $root
try{
  & gh.exe release view $tag --repo $repo *> $null
  if($LASTEXITCODE -eq 0){throw "A versão $tag já foi publicada. Não sobrescrever."}
}finally{Pop-Location}
Run 'gh.exe' @('release','create',$tag,$exe,$manifest,'--repo',$repo,
  '--target',$sha,'--prerelease',
  '--title',"Meu Financeiro Windows Preview $tag",
  '--notes',"Prévia privada, commit $sha. Testes executados localmente; SQLite original não foi migrado. Faça backup antes do uso.")
Run 'gh.exe' @('release','view',$tag,'--repo',$repo,'--json','tagName','--jq','.tagName')
Write-Host "LINK DIRETO: https://github.com/$repo/releases/download/$tag/$exeName"
