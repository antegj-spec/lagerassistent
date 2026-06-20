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
  | 'reparation'
  | 'reserverad';

export type TaskStatus = 'ny' | 'pågår' | 'klar';

export type InfoCategory = 'Utrustning' | 'Maskiner' | 'Rutiner' | 'Platser och Arenor' | 'Material';

export type MaterialCommentStatus =
  | 'klart'
  | 'åtgärd_krävs'
  | 'åtgärd_behövs';

export type TabName =
  | 'hem'
  | 'anteckningar'
  | 'material'
  | 'returer'
  | 'plan'
  | 'körjournal'
  | 'info'
  | 'chat'
  | 'export'
  | 'ekonomi'
  | 'trash'
  | 'dashboard';

export type EconomyCategory =
  | 'lunchrum'
  | 'övrigt'
  | 'personal'
  | 'vatten_tvätt'
  | 'knickmop'
  | 'verkstad_verktyg'
  | 'lagerutbyggnad'
  | 'reparation';

export type MainTabName =
  | 'hem'
  | 'arbete'
  | 'lager'
  | 'drift'
  | 'admin';

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
  // Artikelnummer för lagerräknat material (fritext, ej unikt). NULL = saknas.
  article_number?: string | null;
  notes?: string | null;
  emoji?: string | null;
  unit?: string | null;
  total_count?: number | null;
  info_text?: string | null;
  // Fas 6.6: tröskel för "lågt lager"-varning (count-based). NULL = av.
  min_threshold?: number | null;
  // Länk till en info-artikel (info_articles.id). NULL = ingen koppling.
  // Kräver migration 025_material_info_link.sql.
  info_article_id?: number | null;
}

export interface MaterialItem extends BaseRow {
  material_id: number;
  article_id: string;
  // Artikelnummer (fritext, ej unikt, valfritt). NULL = saknas.
  article_number?: string | null;
  status: MaterialStatus;
  last_washed?: string | null;
  // Fas 6.5: målet för reservationen ("Festivalen 2026"). Bara meningsfullt
  // när status === 'reserverad'.
  reserved_for?: string | null;
  // Fas 6.8: dagar mellan service. Räknas från last_washed. NULL = av.
  service_interval_days?: number | null;
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

// Reserverat/uthyrt material — en rad per allokering (migration 028).
// Lägger metadata (mål, datum) ovanpå material_counts aggregaten.
export type AllocationKind = 'reserverad' | 'uthyrd';
export type AllocationStatus = 'aktiv' | 'återlämnad' | 'avbruten';

export interface MaterialAllocation {
  id: number;
  material_id: number;
  // NULL för lagerräknat; satt för artikelbaserat (en artikel per rad).
  item_id?: number | null;
  kind: AllocationKind;
  quantity: number;
  // Fritext-mål (små gig/kund). Används när place_id är NULL.
  target_text?: string | null;
  // Strukturerad plats-koppling (större gig) — ligger redo, FK byggs senare.
  place_id?: number | null;
  status: AllocationStatus;
  reserved_at: Timestamp;
  // När uthyrt skickades iväg.
  sent_at?: Timestamp | null;
  expected_return?: string | null;
  returned_at?: Timestamp | null;
  comment?: string | null;
  created_by: UserName | string;
  created_at: Timestamp;
  updated_at?: Timestamp;
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
  // Legacy fritext-fält. Behålls för bakåtkompatibel visning av gamla returer.
  // Nya returer använder return_items (en rad per material) istället.
  content?: string | null;
  comment?: string | null;
  created_by?: UserName | string | null;
}

// En returnerad materialrad (migration 030). Allt fri text — ingen koppling
// till materials_v2. quantity är text ("40 m", "ca 20"), inte numerisk.
export interface ReturnItem {
  id: number;
  return_id: number;
  material: string;
  quantity?: string | null;
  comment?: string | null;
  sort_order?: number | null;
  created_by?: UserName | string;
  created_at: Timestamp;
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

export interface InfoPdf {
  id: number;
  article_id: number;
  pdf_url: string;
  pdf_name: string;
  uploaded_by: UserName | string;
  created_at: Timestamp;
}

export interface TaskInfoLink {
  id: number;
  task_id: number;
  info_article_id: number;
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

// ---------- Körjournal (Fas 8 Etapp B) ----------

export interface Car {
  id: string;                    // uuid
  reg_nr: string;
  nickname?: string | null;
  active: boolean;
  created_at: Timestamp;
  created_by?: string;
}

export interface CarTrip {
  id: string;                    // uuid
  car_id: string;                // uuid → cars.id
  driver: string;                // user name
  trip_date: string;             // ISO date (YYYY-MM-DD)
  from_loc?: string | null;
  to_loc?: string | null;
  purpose?: string | null;
  odometer_start: number;
  odometer_end: number | null;   // null = öppen (pågående) resa
  status: "open" | "closed";     // open = inledd men ej avslutad
  needs_purpose: boolean;        // true = lucka-rad, fyll i syfte i efterhand
  is_private: boolean;
  is_fueling: boolean;
  liters?: number | null;
  total_price?: number | null;
  image_path?: string | null;
  created_by: string;
  created_at: Timestamp;
  updated_at?: Timestamp | null;
}

// ---------- Ekonomi (Fas 8 Etapp C) ----------

export interface EconomyEntry {
  id: string;                    // uuid
  category: EconomyCategory | string;  // string för framtida ext-kategorier
  year: number;
  title: string;
  price: number;
  comment?: string | null;
  created_by: string;
  created_at: Timestamp;
  updated_at?: Timestamp | null;
}

// ---------- Chat (in-memory, ej DB) ----------

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
