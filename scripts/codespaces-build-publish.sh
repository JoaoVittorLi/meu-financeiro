#!/usr/bin/env bash
# Compilação Linux->Windows automatizada pelo GitHub Codespaces.
# Executado após criação do Codespace; NÃO requer GitHub Actions nem Node local.
set -Eeuo pipefail

REPOSITORY='JoaoVittorLi/meu-financeiro'
EXPECTED_BRANCH='feat/inteligencia-e2-chatgpt-shared'
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG_DIR="$ROOT/codespaces-release"
mkdir -p "$LOG_DIR"
STATUS="$LOG_DIR/RESULTADO.txt"

failure() {
  local line="$1"
  printf 'ERRO: build interrompido na linha %s.\nA release NÃO foi publicada.\nConsulte as mensagens de erro do Codespaces. Nunca compartilhe tokens ou dados financeiros.\n' "$line" | tee "$STATUS"
}
trap 'failure "$LINENO"' ERR

echo '=============================================='
echo 'MEU FINANCEIRO | INSTALADOR WINDOWS NA NUVEM'
echo '=============================================='
printf 'Branch esperado: %s\n' "$EXPECTED_BRANCH"

if [[ "$(printenv CODESPACES || true)" != 'true' ]]; then
  echo 'Este script foi preparado para um GitHub Codespace.'
  exit 1
fi
CURRENT_BRANCH="$(git symbolic-ref --quiet --short HEAD)"
if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
  echo "Branch incorreto: $CURRENT_BRANCH; não será publicada release."
  exit 1
fi
SHA="$(git rev-parse --verify HEAD)"
VERSION="$(node -p "require('./package.json').version")"
if ! [[ "$SHA" =~ ^[a-f0-9]{40}$ && "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  echo 'Commit ou versão inválidos.'
  exit 1
fi
if [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]]; then
  echo 'É necessário Node.js 22. O Codespaces deveria configurá-lo.'
  exit 1
fi
for command in npm node npx wine gh sha256sum; do
  if ! command -v "$command" >/dev/null; then
    echo "Componente não encontrado: $command"
    exit 1
  fi
done

TAG="preview-inteligencia-$(git rev-parse --short=12 HEAD)"
INSTALLER="MeuFinanceiro-Instalador-$VERSION-x64.exe"
PORTABLE="MeuFinanceiro-Portable-$VERSION-x64.exe"
RELEASE_DIR="$ROOT/release"

echo "Commit: $SHA"
echo 'Etapa 1/4: dependências e testes do desktop...'
npm install --no-audit --no-fund --package-lock=false
npm run test:types
npm run test:db
npm run compile

echo 'Etapa 2/4: testes Worker/PWA e dry-run Cloudflare...'
(
  cd mobile-push
  npm install --no-audit --no-fund --package-lock=false
  npm test
  npx wrangler deploy --dry-run --outdir "$LOG_DIR/cloudflare-dry-run"
)

echo 'Etapa 3/4: instalador e portátil Windows x64...'
export CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-builder --win nsis portable --x64 --publish never
test -s "$RELEASE_DIR/$INSTALLER"
test -s "$RELEASE_DIR/$PORTABLE"
if [[ $(stat -c %s "$RELEASE_DIR/$INSTALLER") -lt 10000000 ]]; then
  echo 'Instalador menor que o mínimo esperado; publicação bloqueada.'
  exit 1
fi
(
 cd "$RELEASE_DIR"
 sha256sum "$INSTALLER" "$PORTABLE" > "PREVIEW-SHA256.txt"
)

echo 'Etapa 4/4: publicação no GitHub Releases privado...'
# Autenticação restrita ao próprio repositório, fornecida pelo GitHub Codespaces.
# Nunca imprimir o token.
GH_TOKEN="$(printenv GH_TOKEN || printenv GITHUB_TOKEN || true)"
export GH_TOKEN
if [[ -z "$GH_TOKEN" ]]; then
  echo 'Codespaces não disponibilizou credencial para publicar; build pronto, release pendente.'
  exit 1
fi
if gh release view "$TAG" --repo "$REPOSITORY" >/dev/null 2>&1; then
  echo 'Release desse commit já existe; não sobrescrevendo.'
else
  gh release create "$TAG" \
    "$RELEASE_DIR/$INSTALLER" \
    "$RELEASE_DIR/$PORTABLE" \
    "$RELEASE_DIR/PREVIEW-SHA256.txt" \
    --repo "$REPOSITORY" --target "$SHA" --prerelease \
    --title "Meu Financeiro — Inteligência E1+E2 (prévia $TAG)" \
    --notes "Prévia do commit $SHA gerada no GitHub Codespaces após testes desktop, Node, Worker e compilação Windows. OAuth ainda precisa de homologação real. Não habilita migração financeira, produção Cloudflare ou API paga. Faça backup e teste como prévia."
fi

URL="https://github.com/$REPOSITORY/releases/download/$TAG/$INSTALLER"
{
  echo 'SUCESSO — INSTALADOR GERADO E PUBLICADO'
  echo "Commit: $SHA"
  echo "Release: https://github.com/$REPOSITORY/releases/tag/$TAG"
  echo "DOWNLOAD DIRETO: $URL"
  echo "PORTATIL: https://github.com/$REPOSITORY/releases/download/$TAG/$PORTABLE"
} | tee "$STATUS"
echo 'Abra o link DOWNLOAD DIRETO ou consulte a aba Releases do GitHub.'
