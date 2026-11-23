#!/usr/bin/env python3
"""Orquestrador determinístico de verificação do fluxo de 7 estágios do Meu Financeiro."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

STAGES = [
    "01_descoberta",
    "02_projeto",
    "03_implementacao",
    "04_teste",
    "05_correcao",
    "06_auditoria",
    "07_entrega",
]

ROOT = Path(__file__).resolve().parents[2]


def run_cmd(cmd: list[str], cwd: Path = ROOT, check: bool = True) -> subprocess.CompletedProcess[str]:
    print(f"[workflow] $ {' '.join(cmd)}", flush=True)
    proc = subprocess.run(cmd, cwd=str(cwd), text=True, capture_output=False)
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed ({proc.returncode}): {' '.join(cmd)}")
    return proc


def check_synthetic_guard() -> None:
    if os.environ.get("MF_QA_SYNTHETIC") != "1":
        raise SystemExit("REFUSED: MF_QA_SYNTHETIC=1 é obrigatório antes de executar testes.")
    if os.environ.get("MF_REAL_PROFILE"):
        raise SystemExit("REFUSED: MF_REAL_PROFILE deve estar ausente no ambiente de QA.")
    pluggy_vars = [k for k, v in os.environ.items() if k.upper().startswith("PLUGGY_") and v]
    if pluggy_vars:
        raise SystemExit(f"REFUSED: variáveis PLUGGY_* não podem estar definidas: {', '.join(pluggy_vars)}")


def check_nsis_only() -> dict:
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    win_targets = pkg.get("build", {}).get("win", {}).get("target", [])
    target_names = [t.get("target") if isinstance(t, dict) else t for t in win_targets]
    if target_names != ["nsis"]:
        raise SystemExit(f"REFUSED: package.json build.win.target esperado ['nsis'], obtido {target_names}")
    return {
        "node_engine": pkg.get("engines", {}).get("node"),
        "npm_engine": pkg.get("engines", {}).get("npm"),
        "appId": pkg.get("build", {}).get("appId"),
        "productName": pkg.get("build", {}).get("productName"),
        "win_targets": target_names,
    }


def stage_discovery(marco: str) -> None:
    print(f"=== [01_descoberta] Marco={marco} ===")
    branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=str(ROOT), text=True).strip()
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(ROOT), text=True).strip()
    status = subprocess.check_output(["git", "status", "--short"], cwd=str(ROOT), text=True).strip()
    nsis_meta = check_nsis_only()
    required_docs = [
        ROOT / "AGENTS.md",
        ROOT / "docs" / "ROADMAP_MF2.md",
        ROOT / "docs" / "ai-context" / "CURRENT_STATE.md",
        ROOT / "docs" / "ai-context" / "ACTIVE_WORK.md",
        ROOT / "docs" / "ai-context" / "GAPS_AND_GATES.md",
    ]
    missing = [str(p.relative_to(ROOT)) for p in required_docs if not p.exists()]
    if missing:
        raise SystemExit(f"Documentos canônicos ausentes: {', '.join(missing)}")
    print(json.dumps({
        "marco": marco,
        "branch": branch,
        "sha": sha,
        "clean_tree": not bool(status),
        "nsis_meta": nsis_meta,
    }, indent=2))


def stage_test(run_nivel_b: bool) -> None:
    print("=== [04_teste] Executando Nível A" + (" + Nível B" if run_nivel_b else "") + " ===")
    check_synthetic_guard()
    npm = "npm.cmd" if os.name == "nt" else "npm"
    run_cmd([npm, "run", "test:types"])
    run_cmd([npm, "run", "compile"])
    run_cmd(["node", "scripts/build-preload.cjs", "check"])
    run_cmd(["node", "scripts/renderer-provenance.cjs", "check-bundle"])
    run_cmd([npm, "run", "test:asar"])
    run_cmd([npm, "run", "test:db"])
    run_cmd([npm, "--prefix", "mobile-push", "test"])
    if run_nivel_b:
        visual_dir = Path(tempfile.mkdtemp(prefix="mf-visual-matrix-"))
        try:
            env = dict(os.environ, MF_SMOKE_OUTPUT_DIR=str(visual_dir))
            print(f"[workflow] $ {npm} run test:electron-smoke (MF_SMOKE_OUTPUT_DIR={visual_dir})", flush=True)
            proc = subprocess.run([npm, "run", "test:electron-smoke"], cwd=str(ROOT), env=env)
            if proc.returncode != 0:
                raise RuntimeError(f"Command failed ({proc.returncode}): {npm} run test:electron-smoke")
            run_cmd(["node", "scripts/verify-visual-matrix.cjs", str(visual_dir)])
        finally:
            shutil.rmtree(visual_dir, ignore_errors=True)
        run_cmd(["node", "scripts/nivel-b-interactive-qa.cjs"])


def stage_audit(sha: str | None) -> None:
    print("=== [06_auditoria] Verificação de proveniência & tree ===")
    check_synthetic_guard()
    head_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(ROOT), text=True).strip()
    if sha and not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise SystemExit("SHA inválido; informe 40 caracteres hexadecimais.")
    if sha and sha != head_sha:
        raise SystemExit(f"SHA divergente: esperado {sha}, HEAD atual {head_sha}")
    npm = "npm.cmd" if os.name == "nt" else "npm"
    run_cmd([npm, "run", "provenance:create"])
    run_cmd([npm, "run", "provenance:verify"])
    check_nsis_only()


def check_nsis_gate(sha: str | None, owner_approved: bool, approval_ref: str | None) -> None:
    if not owner_approved or not approval_ref:
        raise SystemExit(
            "BLOCKED: geração de instalador NSIS exige autorização explícita (--owner-approved-nsis --approval-ref <id>)."
        )
    stage_audit(sha)
    print(f"[workflow] NSIS gate pré-build OK para SHA={sha or 'HEAD'} (autorização={approval_ref}).")


def main() -> int:
    parser = argparse.ArgumentParser(description="Meu Financeiro — Workflow de 7 estágios e Gate NSIS")
    parser.add_argument("--marco", default="MF1", help="Identificador do marco (ex.: MF1, MF2)")
    parser.add_argument("--stage", default="01_descoberta", choices=STAGES + ["all"], help="Estágio a executar")
    parser.add_argument("--synthetic", action="store_true", help="Confirma execução estritamente sintética")
    parser.add_argument("--run-nivel-b", action="store_true", help="Inclui Electron smoke + Nível B interativo")
    parser.add_argument("--check-nsis-gate", action="store_true", help="Valida pré-condições de build NSIS")
    parser.add_argument("--sha", default=None, help="SHA de 40 caracteres para auditoria")
    parser.add_argument("--owner-approved-nsis", action="store_true", help="Confirma autorização explícita para build NSIS")
    parser.add_argument("--approval-ref", default=None, help="Referência da autorização do proprietário")
    args = parser.parse_args()

    if args.check_nsis_gate:
        check_nsis_gate(args.sha, args.owner_approved_nsis, args.approval_ref)
        return 0

    if args.stage in ("01_descoberta", "all"):
        stage_discovery(args.marco)
    if args.stage in ("02_projeto", "03_implementacao", "05_correcao", "07_entrega"):
        raise SystemExit(
            f"STAGE_AGENTICO: '{args.stage}' é conduzido pelo Orchestrator/equipe via plano e git; "
            "estágios automatizados disponíveis na CLI: 01_descoberta, 04_teste, 06_auditoria, all."
        )
    if args.stage in ("04_teste", "all"):
        if not args.synthetic:
            raise SystemExit("REFUSED: passe --synthetic junto com MF_QA_SYNTHETIC=1 para executar 04_teste.")
        stage_test(args.run_nivel_b)
    if args.stage in ("06_auditoria", "all"):
        stage_audit(args.sha)
    return 0


if __name__ == "__main__":
    sys.exit(main())
