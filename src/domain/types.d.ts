// ============================================================
// types.ts — Domän-typer för Lagerassistent (Fas 2.5)
//
// Typer endast — ingen runtime-kod. Konsumeras i 2.6+ när
// legacy-filer konverteras till TS.
//
// Fält härledda från src/legacy/supabase.js:s sb()-anrop samt
// Supabase-schemat dokumenterat i docs/HANDOVER.md.
// Saknade fält upptäcks och läggs till i 2.6+ när vi rör
// config.ts och hittar typfel.
// ============================================================

// ---------- Identitet & roller ----------

export type UserName = 'Admin' | 'Andreas' | 'Nicklas' | 'Per' | 'Johannes';
export type Role = 'admin' | 'intern_user' | 'user';

// ---------- Enums / union-typer ----------

export type Category =
  | 'reparation'
  | 'tvätt'
  | 'logistik'
  | 'idé'
  | 'material'
  | 'övrigt'
  | 'intern';

export type Priority = 'hög' | 'medel' | 'låg';
export type NoteStatus = 'ny' | 'pågår' | 'klar';

export type MaterialStatus =
  | 'okänd'
  | 'tillgänglig'
  | 'uthyrd'
  | 'tvätt'
  | 'reparation';

export type TaskStatus = 'ny' | 'pågår' | 'klar';

export type InfoCategory = 'Utrustning' | 'Maskiner' | 'Rutiner';

export type MaterialCommentStatus =
  | 'klart'
  | 'åtgärd_krävs'
  | 'åtgärd_behövs';

export type TabName =
  | 'hem'
  | 'anteckningar'
  | 'material'
  | 'plan'
  | 'info'
  | 'chat'
  | 'export'
  | 'trash';

// ---------- ISO-tidsstämpel-alias ----------

export type Timestamp = string;

// ---------- Bas-interface (gemensamma fält) ----------

interface BaseRow {
  id: number;
  created_at: Timestamp;
  updated_at?: Timestamp;
}

interface SoftDeletable {
  deleted_at?: Timestamp | null;
}

// ---------- Anteckningar ----------

export interface Note extends BaseRow, SoftDeletable {
  text: string;
  category: Category;
  status: NoteStatus;
  priority?: Priority;
  image_url?: string | null;
  created_by?: UserName | string;
  assigned_to?: string | null;
  deadline?: string | null;
  material_id?: number | null;
}

export interface NoteComment extends BaseRow {
  note_id: number;
  text: string;
  created_by: UserName | string;
}

// ---------- Material ----------

export interface Material extends BaseRow, SoftDeletable {
  name: string;
  is_article_based: boolean;
  supplier?: string | null;
  category?: string | null;
  notes?: string | null;
  emoji?: string | null;
  unit?: string | null;
  total_count?: number | null;
  info_text?: string | null;
}

export interface MaterialItem extends BaseRow {
  material_id: number;
  article_id: string;
  status: MaterialStatus;
  last_washed?: string | null;
}

export interface MaterialCount {
  id: number;
  material_id: number;
  status: MaterialStatus;
  count: number;
  updated_at?: Timestamp;
}

export interface MaterialHistory {
  id: number;
  material_id: number;
  item_id?: number | null;
  from_status?: MaterialStatus | null;
  to_status?: MaterialStatus | null;
  old_status?: MaterialStatus | null;
  new_status?: MaterialStatus | null;
  changed_by: UserName | string;
  created_at: Timestamp;
  notes?: string | null;
  count_change?: number | null;
  comment?: string | null;
  article_id?: string | null;
}

export interface MaterialComment {
  id: number;
  material_id: number;
  item_id?: number | null;
  text: string;
  image_url?: string | null;
  status: MaterialCommentStatus;
  created_by: UserName | string;
  created_at: Timestamp;
  updated_at?: Timestamp;
}

export interface MaterialImage {
  id: number;
  material_id: number;
  image_url: string;
  uploaded_by: UserName | string;
  created_at: Timestamp;
}

export interface MaterialItemImage {
  id: number;
  item_id: number;
  material_id: number;
  image_url: string;
  uploaded_by: UserName | string;
  created_at: Timestamp;
}

export interface BorrowedMaterial extends BaseRow, SoftDeletable {
  material_id: number;
  supplier?: string | null;
  start_date: string;
  end_date?: string | null;
  notes?: string | null;
  quantity?: number | null;
  comment?: string | null;
  reason?: string | null;
}

// ---------- Returer ----------

export interface Return extends BaseRow, SoftDeletable {
  return_date: string;
  supplier?: string | null;
  notes?: string | null;
  image_url?: string | null;
  archived: boolean;
  name?: string | null;
  received_by?: UserName | string | null;
  content?: string | null;
  comment?: string | null;
  created_by?: UserName | string | null;
}

// ---------- Tasks ----------

export interface Task extends BaseRow, SoftDeletable {
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority?: Priority;
  deadline?: string | null;
  assigned_to?: string[];
  responsible?: UserName | string | null;
  archived: boolean;
  created_by?: UserName | string;
  extra_staff?: number | null;
  start_date?: string | null;
}

export interface TaskStatusLog {
  id: number;
  task_id: number;
  old_status?: TaskStatus | null;
  new_status: TaskStatus;
  changed_by: UserName | string;
  created_at: Timestamp;
}

export interface TaskComment extends BaseRow {
  task_id: number;
  text: string;
  created_by: UserName | string;
}

export interface TaskChecklistItem {
  id: number;
  task_id: number;
  text: string;
  done: boolean;
  created_by: UserName | string;
  created_at: Timestamp;
}

// ---------- Info-artiklar ----------

export interface InfoArticle extends BaseRow, SoftDeletable {
  title: string;
  body: string | null;
  category: InfoCategory;
  is_pinned: boolean;
  created_by: UserName | string;
}

export interface InfoImage {
  id: number;
  article_id: number;
  image_url: string;
  uploaded_by: UserName | string;
  created_at: Timestamp;
}

export interface InfoComment {
  id: number;
  article_id: number;
  body: string;
  image_url?: string | null;
  created_by: UserName | string;
  created_at: Timestamp;
}

// ---------- PINs & roller (Supabase-tabeller) ----------

export interface UserPin {
  id?: number;
  user_name: UserName | string;
  pin_set: boolean;
  pin_hash?: string;
  locked_until?: Timestamp | null;
  failed_attempts?: number;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface UserRole {
  user_name: UserName | string;
  role: Role;
}

// ---------- Chat (in-memory, ej DB) ----------

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
