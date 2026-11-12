# Meu Financeiro — CircleCI Windows x64.
# Dependências e runtime instalados apenas na VM; nenhum setup no PC do usuário.
# Não faz deploy e não toca em dados locais, Cloudflare ou releases do GitHub.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Assert-Success([string]$Step) {
  if ($LASTEXITCODE -ne 0) { throw "$Step falhou com código $LASTEXITCODE." }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $root
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$sha = (& git.exe rev-parse HEAD).Trim()
Assert-Success 'Git'
if ($sha -notmatch '^[a-f0-9]{40}$') { throw 'Commit não reconhecido.' }
if ($env:CIRCLE_SHA1 -and $sha -ne $env:CIRCLE_SHA1) {
  throw 'O checkout não corresponde ao commit informado pelo CircleCI.'
}
$branch = if ($env:CIRCLE_BRANCH) { $env:CIRCLE_BRANCH } else { '(sem branch informado)' }
$package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version
if ($version -notmatch '^\d+\.\d+\.\d+([.-][a-zA-Z0-9.-]+)?$') {
  throw 'Versão inválida no package.json.'
}
Write-Host "Meu Financeiro | Windows x64"
Write-Host "Branch: $branch"
Write-Host "Commit: $sha"
Write-Host "Versão do package.json: $version"
Write-Host 'QA manual; sem instalador, deploy ou perfil pessoal.'

# Instalamos Node 22 diretamente de nodejs.org, conferindo SHA-256 oficial.
# Isso não depende de Chocolatey, nvm, winget nem de software no PC local.
$toolRoot = Join-Path $env:TEMP 'mf-circleci-node22'
New-Item -ItemType Directory -Path $toolRoot -Force | Out-Null
$checksumFile = Join-Path $toolRoot 'SHASUMS256.txt'
$nodeVersionExpected = '22.23.4'
$npmVersionExpected = '10.9.9'
$nodeDist = "https://nodejs.org/dist/v$nodeVersionExpected/"
$expectedZipName = "node-v$nodeVersionExpected-win-x64.zip"
Write-Host 'Obtendo os hashes oficiais do Node.js $nodeVersionExpected...'
Invoke-WebRequest -UseBasicParsing -Uri ($nodeDist + 'SHASUMS256.txt') -OutFile $checksumFile
$validLine = $null
foreach ($line in (Get-Content -LiteralPath $checksumFile)) {
  $match = [regex]::Match($line.Trim(), '^(?<hash>[a-fA-F0-9]{64})\s+(?<name>node-v22\.\d+\.\d+-win-x64\.zip)$')
  if ($match.Success -and $match.Groups['name'].Value -eq $expectedZipName) { $validLine = $match; break }
}
if ($null -eq $validLine) { throw 'Não foi encontrado o ZIP oficial do Node.js 22 Windows x64.' }
$zipName = $validLine.Groups['name'].Value
$expectedHash = $validLine.Groups['hash'].Value.ToLowerInvariant()
$zipPath = Join-Path $toolRoot $zipName
Invoke-WebRequest -UseBasicParsing -Uri ($nodeDist + $zipName) -OutFile $zipPath
$actualHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $expectedHash) { throw 'O download do Node.js não passou no SHA256 oficial.' }
Expand-Archive -LiteralPath $zipPath -DestinationPath $toolRoot -Force
$nodeDirectory = Join-Path $toolRoot $zipName.Replace('.zip', '')
$nodeExecutable = Join-Path $nodeDirectory 'node.exe'
$npmExecutable = Join-Path $nodeDirectory 'npm.cmd'
if (!(Test-Path -LiteralPath $nodeExecutable) -or !(Test-Path -LiteralPath $npmExecutable)) {
  throw 'Node.js 22 ou npm não foram extraídos corretamente.'
}
$env:PATH = "$nodeDirectory;$env:PATH"
$nodeVersion = (& $nodeExecutable --version).Trim()
Assert-Success 'Verificação do Node.js'
if ($nodeVersion -ne "v$nodeVersionExpected") { throw "Node.js incorreto: $nodeVersion; esperado v$nodeVersionExpected" }
$npmVersion = (& $npmExecutable --version).Trim()
Assert-Success 'Verificação do npm'
if ($npmVersion -ne $npmVersionExpected) { throw "npm incorreto: $npmVersion; esperado $npmVersionExpected" }
Write-Host "Node verificado: $nodeVersion | npm: $npmVersion"


$artifacts = Join-Path $root 'circleci-qa-artifacts'
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
Start-Transcript -Path (Join-Path $artifacts 'qa-transcript.txt')
try {
  & $npmExecutable ci --no-audit --no-fund
  Assert-Success 'npm ci'
  foreach ($gate in @('test:types','test:db','compile','test:asar','provenance:create','provenance:verify')) {
    & $npmExecutable run $gate
    Assert-Success $gate
  }
  & $nodeExecutable scripts/renderer-provenance.cjs check-bundle
  Assert-Success 'F08'
  $env:MF_SMOKE_OUTPUT_DIR = Join-Path $artifacts 'official-smoke'
  & $npmExecutable run test:electron-smoke
  Assert-Success 'Official isolated Electron smoke'
  $env:MF_PRODUCT_QA_OUTPUT_DIR = Join-Path $artifacts 'product'
  & $nodeExecutable scripts/product-electron-qa.cjs
  Assert-Success 'Product Electron QA'
} finally { Stop-Transcript }
