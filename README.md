# RMS (Recipe Management System)

## Overview
The original document management system stored **Manufacturing Condition Work Instructions** and **Manufacturing Specifications** as Word files, which made it hard to quickly compare differences between versions. In addition, process parameters could not be synchronized to the parameter downstream system.  
This project provides an optimized solution: after a work instruction or specification is created in the system, it triggers EIP to start the approval workflow. Once approved, a PDF is archived back into the document management system.

## Goals
- Replace Word-based workflows with structured, comparable documents.
- Enable quick version diffing and auditability.
- Synchronize manufacturing parameters to downstream systems.
- Integrate with EIP for approvals and automatically archive approved PDFs.

## System Flow
1. Create or edit a **Manufacturing Condition Work Instruction** or **Manufacturing Specification** in the RMS UI.
2. Submit to **EIP** to start the approval workflow.
3. After approval, the system exports **PDF** and archives it to the document management system.
4. Parameters are **synced** to downstream systems.

## Tech Snapshot
- **Frontend**: Vue 3, TipTap
- **Backend**: Flask (Python), ReportLab (PDF), MySQL
- **Integrations**: EIP (approval), MES (machines/groups), file uploads

## Getting Started
```bash
# clone
git clone RMS-frontend
cd RMS-frontend

npm install
npm install axios
npm install uuid
npm install vue-router@next

npm install @tiptap/vue-3 @tiptap/core
npm install @tiptap/extension-paragraph @tiptap/extension-text @tiptap/extension-document @tiptap/extension-history
npm install @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-header @tiptap/extension-table-cell
npm install @tiptap/extension-color @tiptap/extension-text-style
npm install @tiptap/extension-image
npm install @tiptap/starter-kit @tiptap/extension-placeholder
npm install @tiptap/extension-document

npm run dev
