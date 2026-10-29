# FINACTIVA HQ — main office integration

Applies approved identity + sit fixes to the **live** `/office` scene (not POC-only).

See delivery artifact: `/opt/cursor/artifacts/hermes3d-hq-delivery.md`.

## Identity

- Default office title: **FINACTIVA HQ** (`FINACTIVA_BRAND.officeTitle`)
- Header: official logo `public/brand/finactiva-logo.png` + navy/green chrome from Finactiva Business v2 tokens
- Legacy stored title `Luke Headquarters` migrates on normalize

## Avatars

Original Hermes3D agents only. Cycle 5 Superhero / Quaternius is **not** mounted in the main office.

## Sit

Chair-matched desk seats (`deskSeats.ts`) + AgentModel sit blend (`sitBack` 0.16, `sitHeight` 0.26, forward lean 0.32).

## Preserved

ECO / BALANCED / HIGH, navigation/speed, CUSTOM runtime seam. Finactiva Business and the financial adapter are untouched.
