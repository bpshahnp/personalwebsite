# MCQ Paper Maker — Project Memory & Architecture Guide

## Overview
**MCQ Paper Maker** is a standalone, client-side web application for creating, formatting, managing, previewing, and printing professional Multiple Choice Question (MCQ) exam papers. It supports LaTeX math formulas, multi-column and multi-copy layouts, Aiken/AI text imports, Canvas math plotting, Word (.docx) export, and printable OMR bubble sheets.

---

## File Structure & Responsibilities

| File | Type | Key Responsibilities |
| :--- | :--- | :--- |
| `index.html` | Markup | UI layout, sidebar navigation (Library, Setup, Questions, Import, Export tabs), print preview container (`#wrap`), Math Plotter modal (`#pd`), Aiken export modal (`#modal-aiken`), MathJax 3.2.2 & docx 8.5.0 CDN scripts. |
| `mcqmaker.css` | Stylesheet | App UI styling, sidebar controls, math symbol palettes, sheet/tile layout rules, print media queries (`@media print`), cut lines (`.cut-v`, `.cut-h`), LaTeX inline/display SVGs, OMR bubble sheet layout. |
| `mcqmaker.js` | JavaScript | State management, IndexedDB storage (`mcq-maker-pro`), MathJax SVG rendering/caching, Canvas math plotter, Aiken/AI parser, DOCX generator, dynamic pagination/overflow engine, OMR generator. |
| `og-preview.png` / `.jpg` | Assets | Open Graph and Twitter Card social preview images. |

---

## Key Features & Subsystems

### 1. Paper Storage & Multi-Paper Library
- **Storage Engine**: Uses IndexedDB database `mcq-maker-pro` (stores `papers`, `meta`, `s`) with graceful fallback to `localStorage`.
- **Capabilities**: Auto-saving with debounce, New Paper, Duplicate Paper, Download JSON, Backup all papers to a single JSON archive, Restore from JSON, live search filter.

### 2. Exam Setup & Configuration
- **Header Metadata**: Institution name, Exam title, Subject, Grade/Class, Time allowed, Full marks (Manual or Auto-calculated), General instructions.
- **Candidate Fields**: Checkboxes for Name, Roll No / ID, Section, Date.
- **Paper & Layout Options**:
  - Paper Sizes: `A4`, `Letter`, `Legal`
  - Orientations: `Portrait`, `Landscape`
  - Margin Presets: `Tight (4mm)`, `Compact (6mm)`, `Normal (10mm)`, `Spacious (14mm)`, `Duplex / Back-Print Safe (12mm outer, 18mm gutter)`
  - Columns: 1, 2, 3, or 4 columns (for 1-copy mode)
  - Copies per Sheet: 1 (Full page), 2 (Half sheets), 4 (Quarter sheets) with automatic cut guides (`✂ Cut here`)
  - Typography: Times New Roman, Arial, Georgia, System UI; configurable base font size (pt)
  - Default Option Layout: Auto, 1x4 Row, 2x2 Grid, 4x1 Stacked

### 3. Question Editor & Math Engine
- **Rich Formatting**: Markdown parsing (`**bold**`, `*italic*`, `__underline__`, `~sub~`, `^sup^`, `` `code` ``).
- **LaTeX Math Rendering**: Inline `$math$` and block `$$math$$` parsed into SVG via MathJax 3.2.2 (`MathJax.tex2svg`) with LRU-style SVG caching (`mcache`).
- **LaTeX Palette**: Categorized quick-insertion buttons for Algebra, Symbols, Calculus, Greek, and Science.
- **Dynamic Options**: Supports 2 to 6 options per question with radio button answer selection.
- **Media & Graphs**:
  - Image attachment via file picker or direct clipboard paste (Ctrl+V) with adjustable mm width.
  - Built-in Math Function Plotter: Evaluates JS math expressions on HTML5 Canvas, supports multiple functions, axis labels, grid, and exports directly to question images.
- **Utilities**: Reorder questions (Up/Down), duplicate, delete, shuffle questions, shuffle options, per-question marks, and optional explanations.

### 4. Import & Export Engines
- **Smart Text / AI Parser**: Parses raw pasted text or `.txt` files from Word, PDFs, ChatGPT, Claude, Gemini, or Aiken format. Detects question numbering, options (A-F), correct answer markers (`Answer: B`, `*A`, `Ans: C`), and explanation lines.
- **Sample Presets**: Quick-load sample test papers for Math & Calculus, Physical Sciences, and General Knowledge.
- **Export Formats**:
  - **Browser Print / PDF**: Native `window.print()` with precise `@page` dimensions, pagination, and print-specific stylesheets.
  - **Microsoft Word (`.docx`)**: Complete Word document generation using `docx.js`, converting LaTeX formulas to high-resolution PNGs and arranging multi-column layouts into tables.
  - **Aiken Format**: LMS-compatible format export for Moodle, Blackboard, and Canvas.
- **Answer Key Options**:
  - Hidden (None)
  - Inline compact key at end of paper
  - Dedicated full answer key page with tabular grid and detailed step-by-step explanations
- **Printable OMR Sheet**: Generates standardized optical response sheets with 4 corner fiducial alignment marks, candidate info & signatures, 6-digit 0–9 roll number bubble matrix, test booklet set code, 5-question row grouping, and adaptive A–D / A–E bubble columns.
- **Teacher vs. Student View**: Quick-toggle to view or print the Teacher Master Copy with answers marked in green with checkmarks.

---

## Technical Constraints & Best Practices

1. **Pure Client-Side**: No backend server or build step required. The application runs directly by opening `index.html` in any modern web browser.
2. **Third-Party CDNs**:
   - `MathJax 3.2.2` (`tex-svg.js`) for LaTeX rendering.
   - `docx 8.5.0` (`docx.js`) for `.docx` binary generation.
3. **Print Precision**:
   - Sheet dimensions and paddings are calculated in millimeters (`mm`).
   - Avoid fixed pixel heights inside printable sheets to ensure print engine compatibility.
   - Multi-copy mode automatically calculates column/row divisions and gutter margins.
