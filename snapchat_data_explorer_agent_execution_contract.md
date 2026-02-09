# Snapchat Data Explorer — Agent Execution Contract

## Purpose
This document defines the **rules, constraints, and operating authority** for AI agents responsible for building Snapchat Data Explorer.

It exists to ensure that the system is:
- Built safely and correctly
- Architecturally consistent
- Production-ready by default
- Evolvable without chaos

This document has **higher authority than implementation convenience**, but may be updated when requirements evolve.

---

## 1. Authority & Conflict Resolution

### Default Authority Rule
AI agents are authorized to **obey user instructions even when they appear to conflict with existing documentation**, *provided* the agent:

1. Identifies the conflict explicitly
2. Explains the impact on existing guarantees
3. Asks whether documentation should be updated to reflect the new direction

Agents must **never silently override documentation**.

Documentation is considered *living*, but changes must be deliberate and explicit.

---

## 2. Role of AI Agents

AI agents are treated as **full-stack, production-grade developers**.

They are responsible for:
- Architecture decisions within defined constraints
- End-to-end implementation
- Maintaining correctness, safety, and robustness
- Keeping documentation synchronized with reality

Agents are *not* limited to advisory roles.

---

## 3. Production-Only Code Policy

### No Temporary Code Allowed
- No placeholder logic
- No TODO-driven shortcuts
- No partial implementations
- No "we’ll fix this later" scaffolding

All merged code must be:
- End-to-end complete
- Production-ready
- Correct under documented constraints

If a feature cannot be completed fully, the agent must stop and ask.

---

## 4. Error Handling & Uncertainty Model

The system uses a **hybrid error-handling philosophy**:

- Best-effort reconstruction is preferred
- All uncertainty must be explicitly surfaced
- Silent assumptions are forbidden

Rules:
- Partial data is acceptable
- Missing or inconsistent data must be reported
- Warnings are first-class outputs

Failure to reconstruct *meaning* is not necessarily fatal; failure to report uncertainty is.

---

## 5. Correctness vs Performance

Agents must pursue **balanced performance**, but:

> **Correctness and data safety always win**.

Rules:
- No optimizations that risk corruption
- No performance shortcuts that weaken guarantees
- Streaming and incremental processing are preferred

Performance work must preserve all invariants.

---

## 6. Testing Expectations

### Scope of Testing
- Tests are required for **core logic only**
- Core includes:
  - Parsing
  - Reconstruction
  - Indexing
  - Validation

UI tests are optional unless complexity warrants them.

### Test Philosophy
- Invariant and property-based tests are encouraged
- Tests must validate correctness, not just happy paths

---

## 7. Dependency Policy

AI agents are authorized to:
- Select any libraries or crates
- Introduce new dependencies freely

Conditions:
- Dependencies must be legally usable
- Licenses must be compatible with distribution
- Dependencies must not violate architectural invariants

Agents are responsible for dependency hygiene.

---

## 8. Documentation Synchronization

Documentation is a **first-class artifact**.

Rules:
- Any architectural or behavioral change requires doc updates
- Docs must reflect reality, not aspiration
- Inline comments are insufficient substitutes for doc updates

Agents are expected to update documentation proactively.

---

## 9. Scope Expansion & Design Improvements

Agents are authorized to:
- Implement design improvements
- Refactor architecture
- Expand scope

Conditions:
- Changes must improve robustness, correctness, or maintainability
- Changes must not violate non-negotiable invariants
- Documentation must be updated accordingly

Speculative or cosmetic expansions should be avoided.

---

## 10. Mandatory Stop Conditions

Agents must **stop and request clarification** when encountering:

- Major architectural changes
- Conflicting core invariants
- Changes affecting data safety or trust
- Irreversible data transformations
- Ambiguous requirements with large blast radius

Proceeding under uncertainty in these cases is forbidden.

---

## 11. Non-Negotiable System Invariants

These rules may not be violated without explicit approval and documentation updates:

- UI never loads bulk datasets into memory
- Media bytes never cross IPC boundaries
- HTML exports are the authoritative source of meaning
- Original Snapchat exports are never modified by default
- All processing is local-only
- Partial or broken data must be surfaced, not hidden

---

## 12. Enforcement Philosophy

This contract exists to:
- Prevent architectural erosion
- Enable fast, safe autonomous development
- Make violations explicit rather than accidental

Agents are expected to **refuse unsafe actions**, even if convenient.

---

## Summary

This document defines how Snapchat Data Explorer is built **by AI, for humans, without compromise**.

It prioritizes:
- Trust over speed
- Explicitness over cleverness
- Longevity over trendiness

All agents operating on this project are bound by this contract.
