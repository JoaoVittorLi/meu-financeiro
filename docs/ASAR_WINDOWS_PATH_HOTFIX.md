# Windows ASAR verification: nested paths

Base: PR #14, `56f35f09458fa6e4d7488274bfb4dc2c70bd8170`, product version 0.9.5-beta.6.

## Failure and change

The reported Windows job passed 190 unit tests and packaged the application, then
failed while reading `app/vendor/LICENSE_REACT.txt` during B00 archive verification.
That file is tracked and already included by `app/**/*`; its bytes match the
audited Git tree. Adding another broad include or removing it from the manifest
would not address the verifier's nested-directory traversal.

Manifest paths deliberately use forward slashes. The ASAR reader resolves
`dirname(name)` and splits directory components using `path.sep`. On Windows,
`dirname('app/vendor/LICENSE_REACT.txt')` retains forward slashes, which cannot
be split on `\\`. Single-directory paths such as `app/app.js` do not expose
the problem. The archive boundary now normalizes paths to the native separator;
manifest keys and hashes remain portable and unchanged.

This explains the reported error from source and a Windows-path reproducer.
The failed CircleCI archive itself has not been downloaded or examined here.

## Regression coverage

- The unit regression reproduces the old failure with Windows traversal, checks
  the corrected read on Windows and POSIX, and still rejects missing entries.
- `npm run test:asar` creates physical archives using the declared
  `@electron/asar` dependency, checks the nested license through the production
  verifier, and rejects both changed and absent license contents.
- The ASAR test is mandatory in Linux preflight and `dist:windows`, before the
  installer is built. The final real-application ASAR verification stays enabled.
- CircleCI accepts `run_preflight=true, run_windows_build=false` for standalone
  Linux validation. With both true, only the Windows workflow runs, including
  its required preflight; it does not duplicate the Linux job.

## Local verification and limits

The checkout was reconstructed against the GitHub tree; unchanged file blobs
were checked byte for byte. This environment has Node 24.22.1, an official
TypeScript 5.8.3 CLI from the audit, and a TypeScript 6.0.3 API from the audit.
It cannot install registry dependencies: package downloads are blocked.
Consequently the real-ASAR integration test, exact Node 22/TS 5.8.3 suite and
Windows installers are pending, not approved. No paid pipeline was triggered.

Local checks: B00 targeted tests 5/5; PWA 129/129; TypeScript 5.8.3 CLI
typecheck and compile passed; emitted JavaScript and new scripts passed syntax
checks. The full local Node suite had 186/191 passing: four loopback callback
tests failed in the restricted environment, and F08 failed under the available
TS 6 API (a fixture rootDir diagnostic). The physical-ASAR test could not run
because its declared dependency could not be installed. These results do not
represent a green official release gate.

A preflight success is required
before suggesting another Windows build. This hotfix does not homologate the
remaining UI, Electron startup, NVDA, installation or migration work.
