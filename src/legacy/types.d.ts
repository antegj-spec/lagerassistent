// ============================================================
// types.d.ts (legacy bridge) — Fas 2.6
//
// Legacy-filer i src/legacy/ kor som klassiska <script>-taggar
// (tsconfig.legacy.json har module: "none"). De kan darfor inte
// "import"-a fran ES-modul-filer som src/domain/types.ts.
//
// Den har ambient bridge re-deklarerar domantyperna globalt sa
// legacy-filer kan anvanda dem direkt (Note, Task, ...) utan
// import-syntax. Forsvinner i Fas 4 nar legacy refaktoreras
// till riktiga ES modules.
// ============================================================

import type * as D from '../domain/types';

declare global {
  type UserName = D.UserName;
  type Role = D.Role;
  type Category = D.Category;
  type Priority = D.Priority;
  type NoteStatus = D.NoteStatus;
  type MaterialStatus = D.MaterialStatus;
  type TaskStatus = D.TaskStatus;
  type InfoCategory = D.InfoCategory;
  type MaterialCommentStatus = D.MaterialCommentStatus;
  type TabName = D.TabName;
  type Timestamp = D.Timestamp;

  type Note = D.Note;
  type NoteComment = D.NoteComment;
  type Material = D.Material;
  type MaterialItem = D.MaterialItem;
  type MaterialCount = D.MaterialCount;
  type MaterialHistory = D.MaterialHistory;
  type MaterialComment = D.MaterialComment;
  type MaterialImage = D.MaterialImage;
  type MaterialItemImage = D.MaterialItemImage;
  type BorrowedMaterial = D.BorrowedMaterial;
  type Return = D.Return;
  type Task = D.Task;
  type TaskStatusLog = D.TaskStatusLog;
  type TaskComment = D.TaskComment;
  type TaskChecklistItem = D.TaskChecklistItem;
  type InfoArticle = D.InfoArticle;
  type InfoImage = D.InfoImage;
  type InfoComment = D.InfoComment;
  type UserPin = D.UserPin;
  type UserRole = D.UserRole;
  type ChatMessage = D.ChatMessage;

  // Fas 3.6 (B14): kommentar-bild-globals deklareras i actions.ts
  // (med @ts-nocheck) men nollställs från ui.ts på tab-byte.
  // Ambient-deklareras här så ui.ts ser dem.
  let _matCommentImgUrl: string | null;
  let _itemCommentImgUrl: string | null;
  let _infoCommentImgUrl: string | null;
}

export {};
