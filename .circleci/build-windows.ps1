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
Write-Host 'Build manual CircleCI, sem deploy e sem GitHub Releases.'

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

Write-Host 'Instalando dependências reproduzíveis com o lockfile versionado...'
& $npmExecutable ci --no-audit --no-fund
Assert-Success 'npm ci'

Write-Host 'Verificação de tipos TypeScript...'
& $npmExecutable run test:types
Assert-Success 'npm run test:types'

# D1.2: execute Electron real (GUI), renderer DOM, IPC and SQLite entirely in
# a disposable userData path before packaging. This fails closed on error.
# The current Linux preflight still validates all Node/SQLite suites.
& $npmExecutable run compile
Assert-Success 'Compilação pré-smoke Electron D1.2'
# Preserve only synthetic screenshots as separate CircleCI artifacts.
$env:MF_SMOKE_OUTPUT_DIR = Join-Path $root 'circleci-smoke-artifacts'
if (Test-Path -LiteralPath $env:MF_SMOKE_OUTPUT_DIR) {
  Remove-Item -LiteralPath $env:MF_SMOKE_OUTPUT_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $env:MF_SMOKE_OUTPUT_DIR | Out-Null
& $npmExecutable run test:electron-smoke
Assert-Success 'Smoke Electron D1.2 real e isolado'
if (!(Test-Path -LiteralPath (Join-Path $env:MF_SMOKE_OUTPUT_DIR 'visual-matrix.json'))) {
  throw 'Matriz de smoke Electron não foi gravada.'
}
$matrixFile = Join-Path $env:MF_SMOKE_OUTPUT_DIR 'visual-matrix.json'
$matrix = @(Get-Content -LiteralPath $matrixFile -Raw | ConvertFrom-Json)
$images = @(Get-ChildItem -LiteralPath $env:MF_SMOKE_OUTPUT_DIR -File -Filter '*.png')
$expectedScreenshots = 32  # 8 áreas x 4 combinações de resolução/tema/movimento
if ($matrix.Count -ne $expectedScreenshots -or $images.Count -ne $expectedScreenshots) {
  throw "Smoke Electron: esperadas $expectedScreenshots capturas e entradas no manifesto; encontrados $($images.Count) PNGs e $($matrix.Count) registros."
}
$uniqueScreenshots = @($matrix | Select-Object -ExpandProperty screenshot -Unique)
if ($uniqueScreenshots.Count -ne $expectedScreenshots) {
  throw 'Smoke Electron: nomes duplicados na matriz visual.'
}
foreach ($entry in $matrix) {
  if (!(Test-Path -LiteralPath (Join-Path $env:MF_SMOKE_OUTPUT_DIR $entry.screenshot))) {
    throw "Smoke Electron: imagem ausente no manifesto: $($entry.screenshot)"
  }
}

Write-Host 'Executando comando oficial: npm run dist:windows...'
# dist:windows executa compilação TypeScript, testes Node/SQLite e electron-builder NSIS + portable.
# Nunca bypassar os testes em caso de erro.
& $npmExecutable run dist:windows
Assert-Success 'npm run dist:windows'

Write-Host 'Verificando que o renderer atual corresponde ao commit e ao manifesto...'
& $nodeExecutable scripts/renderer-provenance.cjs verify
Assert-Success 'Manifesto B00 do renderer'

$asarCandidates = @(
  (Join-Path $root 'release/win-unpacked/resources/app.asar'),
  (Join-Path $root 'release/win-x64-unpacked/resources/app.asar')
)
$asarPath = $asarCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$asarPath) { throw 'Nenhum app.asar de staging foi encontrado para conferência B00.' }
& $nodeExecutable scripts/renderer-provenance.cjs verify-asar $asarPath
Assert-Success 'ASAR B00 versus renderer testado'
$rendererManifestPath = Join-Path $root 'app/renderer-provenance.json'
$rendererManifest = Get-Content -LiteralPath $rendererManifestPath -Raw | ConvertFrom-Json
$rendererManifestHash = (Get-FileHash -LiteralPath $rendererManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
$asarHash = (Get-FileHash -LiteralPath $asarPath -Algorithm SHA256).Hash.ToLowerInvariant()

$releaseDir = Join-Path $root 'release'
$installerName = "MeuFinanceiro-Instalador-$version-x64.exe"
$portableName = "MeuFinanceiro-Portable-$version-x64.exe"
$installerPath = Join-Path $releaseDir $installerName
$portablePath = Join-Path $releaseDir $portableName
$executables = @(Get-ChildItem -LiteralPath $releaseDir -File -Filter '*.exe' -ErrorAction Stop)
if ($executables.Count -ne 2) {
  throw "Esperados exatamente 2 arquivos EXE; encontrados $($executables.Count)."
}
foreach ($path in @($installerPath,$portablePath)) {
  if (!(Test-Path -LiteralPath $path)) {
    throw "O executável esperado não foi encontrado: $(Split-Path $path -Leaf)"
  }
  $file = Get-Item -LiteralPath $path
  if ($file.Length -lt 10000000) {
    throw "Executável possivelmente incompleto: $($file.Name)"
  }
}

# A pasta publicada contém APENAS 2 executáveis e SHA256.txt.
# Os demais arquivos intermediários do electron-builder não são distribuídos.
$artifactDir = Join-Path $root 'circleci-artifacts'
if (Test-Path -LiteralPath $artifactDir) {
  Remove-Item -LiteralPath $artifactDir -Recurse -Force
}
New-Item -ItemType Directory -Path $artifactDir | Out-Null
Copy-Item -LiteralPath $installerPath -Destination $artifactDir
Copy-Item -LiteralPath $portablePath -Destination $artifactDir

$hashLines = @(
  "# Meu Financeiro | Compilacao Windows x64 | CircleCI",
  "# Branch: $branch",
  "# Commit: $sha",
  "# Versao: $version",
  "# Origem: $($env:CIRCLE_BUILD_URL)",
  "# Renderer manifest SHA256: $rendererManifestHash",
  "# Renderer bundle SHA256: $($rendererManifest.assets.'app/app.js')",
  "# ASAR SHA256: $asarHash",
  "$((Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToLowerInvariant())  $installerName",
  "$((Get-FileHash -LiteralPath $portablePath -Algorithm SHA256).Hash.ToLowerInvariant())  $portableName"
)
$utf8 = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllLines((Join-Path $artifactDir 'SHA256.txt'), $hashLines, $utf8)
$publishedFiles = @(Get-ChildItem -LiteralPath $artifactDir -File)
if ($publishedFiles.Count -ne 3) { throw 'Devem ser publicados exatamente três artifacts.' }
Write-Host 'SUCESSO: testes concluídos e três artifacts preparados para download.'
foreach ($file in $publishedFiles) { Write-Host ("ARTIFACT: " + $file.Name + " (" + $file.Length + " bytes)") }
Write-Host "Branch=$branch; Commit=$sha; Versão=$version"
Write-Host 'Abra o job no CircleCI > Artifacts. Nenhum GitHub Release foi alterado.'
