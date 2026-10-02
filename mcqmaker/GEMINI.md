# MCQ Paper Maker — Project Context & Rules

This project is **MCQ Paper Maker**, a zero-backend, client-side web application for creating, customizing, previewing, and printing professional Multiple Choice Question (MCQ) exam papers.

For full architectural details, component interactions, and feature specifications, refer to [AGENTS.md](file:///d:/B.%20Prasad%20Shah/mcqmaker/AGENTS.md).

## Core Architecture Summary
- **Frontend Stack**: Vanilla HTML5, CSS3, ES6+ JavaScript.
- **External Dependencies (CDN)**:
  - MathJax 3.2.2 (`tex-svg.js`) for LaTeX math typesetting.
  - docx 8.5.0 (`docx.js`) for Word document generation.
- **State & Storage**:
  - IndexedDB database `mcq-maker-pro` with `papers`, `meta`, and `s` stores.
  - Fallback to `localStorage`.
- **Main Files**:
  - `index.html`: Sidebar controls, modals, and preview stage.
  - `mcqmaker.css`: Screen styling, print CSS (`@media print`), and responsive rules.
  - `mcqmaker.js`: Pagination engine, parser, canvas plotter, and export controllers.
