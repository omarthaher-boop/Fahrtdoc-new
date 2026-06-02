---
name: Hermes base64 / btoa
description: Base64 encoding pitfalls in React Native / Hermes for the FahrtDoc PDF export.
---

# Don't rely on global btoa in Hermes

`global.btoa` is a browser API and is not guaranteed in Hermes/React Native. PDF export
(`artifacts/mobile/utils/exportPDF.ts`, native path) previously did
`btoa(charByCharBinaryString)` which (a) depends on btoa and (b) builds a multi-megabyte
intermediate string for large trip lists → OOM/crash risk.

**Rule:** convert `Uint8Array` → base64 with a local `bytesToBase64` encoder (3-byte→4-char
groups) before `FileSystem.writeAsStringAsync(..., { encoding: Base64 })`.

**Why:** removes the btoa dependency and the giant intermediate string; works identically on
web and native. The web export path is separate (DOM-based) and unaffected.
