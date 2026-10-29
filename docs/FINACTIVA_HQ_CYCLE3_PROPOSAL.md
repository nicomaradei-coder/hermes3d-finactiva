# Finactiva HQ — Cycle 3 visual proposal (Phases 3–4)

Status: **proposal + single workstation POC only**. No mass asset replacement.

## Brand tokens (from Finactiva Business v2)

Source: `frontend/src/styles/v2-design-system.css` (do not invent colours).

| Token | Value | Use in HQ |
| --- | --- | --- |
| Navy | `#0f172a` | Walls, header bars, monitor bezels |
| Navy deep | `#020617` | Floor panels, screen UI dark |
| Green | `#10b981` | Accent signage, status, UI slabs |
| Cyan | `#06b6d4` | Secondary accent, chart lines on monitors |
| Page | `#f8fafc` | Light floor / paper surfaces |
| Text | `#111827` | Signage copy |
| Muted | `#64748b` | Secondary labels |

Environment name: **Finactiva Headquarters**. UI header: **FINACTIVA HQ**.  
Hermes3D remains credited as the engine in technical overlays / about copy.

## Phase 3 — identity (proposed, not rolled out)

1. Replace demo “Hermes office” chrome with FINACTIVA HQ header strip (navy + green accent rule).
2. Zone labels: Finanzas, Cashflow, Insights, Ops — decorative only; no contract changes.
3. Wall signage plates using navy/green; keep Hermes3D credit in Settings → About.
4. Monitor decorative UI: navy bezel, dark screen, green/cyan chart bars (already sketched in POC).
5. Preserve CUSTOM runtime / chat / ECO·BALANCED·HIGH unchanged.

## Phase 4 — realism (proposed evolution)

### Reference workstation (implemented POC)

Route flag: `?workstationPoc=1` → `FinactivaWorkstationPoc`.

Includes: proportional desk (~1.1×0.55), chair seat+back, monitor with Finactiva UI slab, one seated procedural agent using the Cycle 3 sit pose (`sitHeight` 0.2, lean −0.38, legs 1.08).

**Gate:** visually validate this station before cloning proportions to all eight desks.

### Recommended next steps (after approval)

| Step | Scope | Risk |
| --- | --- | --- |
| A | Apply desk/chair/monitor proportions from POC to live `desk_cubicle` meshes only | Medium — layout collision |
| B | Finactiva wall paint + signage materials (shared mats) | Low |
| C | Optional GLB chair/desk under MIT/CC0 after license + memory budget | High — defer |
| D | Humanoid GLB avatars | **Do not** without PoC + sit-rig compatibility |

### Graphics impact estimate (qualitative)

- Colour/signage materials only: negligible draw-call change; reuse shared mats.
- Proportion tweaks on existing boxes: ~0 extra draws.
- One shared monitor UI texture atlas: +1 texture, better than per-monitor unique mats.
- Full GLB furniture ×8: likely +several MB VRAM and more shadow casters — measure on BALANCED before ECO.
- Humanoid skinned meshes ×10: largest risk to ECO frame time; keep procedural until proven.

## License notes

- Procedural geometry + Finactiva Business CSS tokens: OK within this pilot fork.
- Upstream Hermes3D assets: respect original license; do not republish proprietary third-party packs.
- No external GLBs added in Cycle 3.

## Stop line

Mass furniture/avatar replacement and full office redesign are **out of scope** for this cycle.
