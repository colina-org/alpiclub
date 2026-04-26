// Hand-written types matching supabase/migrations/0001_initial_schema.sql.
// Once you wire up the Supabase CLI, these can be regenerated automatically with:
//   pnpm supabase gen types typescript --project-id <id> > src/types/database.ts

export type AppRole = 'admin' | 'member'

export interface Agency {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  color: string | null
  website_url: string | null
  instagram_url: string | null
  linkedin_url: string | null
  facebook_url: string | null
  youtube_url: string | null
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  description: string | null
  color: string | null
  agency_id: string
  parent_team_id: string | null
  created_at: string
  updated_at: string
}

export interface TeamWithAgency extends Team {
  agency: Pick<Agency, 'id' | 'name' | 'slug' | 'color' | 'logo_url'> | null
}

export interface Profile {
  id: string
  full_name: string | null
  nickname: string | null
  email: string
  avatar_url: string | null
  position: string | null
  team_id: string | null
  is_head: boolean
  is_lead: boolean
  app_role: AppRole
  bio: string | null
  birthday: string | null   // ISO date (YYYY-MM-DD)
  joined_at: string | null  // ISO date (YYYY-MM-DD)
  archived_at: string | null
  instagram_url: string | null
  linkedin_url: string | null
  github_url: string | null
  website_url: string | null
  clickup_user_id: string | null
  created_at: string
  updated_at: string
}

export interface ProfileWithTeam extends Profile {
  team: (Pick<Team, 'id' | 'name' | 'color'> & {
    agency: Pick<Agency, 'id' | 'name' | 'slug' | 'color'> | null
  }) | null
  partnerships: { agency_id: string }[]
}

export interface AgencyPartner {
  id: string
  agency_id: string
  profile_id: string
  created_at: string
}

export interface AgencyPartnerWithProfile extends AgencyPartner {
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'position'> | null
}

export type AchievementCategory =
  | 'trabalho_em_equipe'
  | 'excelencia_tecnica'
  | 'inovacao'
  | 'lideranca'
  | 'iniciativa'
  | 'cultura'
  | 'premiacao'
  | 'outro'

export interface Achievement {
  id: string
  recipient_id: string
  granted_by_id: string
  category: AchievementCategory
  title: string
  message: string | null
  image_url: string | null
  granted_at: string
  created_at: string
  updated_at: string
}

type ProfileMini = Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'position'>

export interface AchievementLike {
  id: string
  achievement_id: string
  profile_id: string
  created_at: string
}

export interface AchievementWithPeople extends Achievement {
  recipient: ProfileMini | null
  granted_by: ProfileMini | null
  likes?: Pick<AchievementLike, 'profile_id'>[]
}

export const ACHIEVEMENT_CATEGORIES: Record<
  AchievementCategory,
  { label: string; color: string }
> = {
  trabalho_em_equipe: { label: 'Trabalho em equipe', color: '#0d9b6c' },
  excelencia_tecnica: { label: 'Excelência técnica', color: '#2563eb' },
  inovacao:           { label: 'Inovação',            color: '#a855f7' },
  lideranca:          { label: 'Liderança',           color: '#0891b2' },
  iniciativa:         { label: 'Iniciativa',          color: '#ea580c' },
  cultura:            { label: 'Cultura',             color: '#db2777' },
  premiacao:          { label: 'Premiação',           color: '#ca8a04' },
  outro:              { label: 'Outro',               color: '#64748b' },
}

export type BookReadStatus = 'wishlist' | 'reading' | 'read'

export interface Book {
  id: string
  title: string
  author: string
  cover_url: string | null
  url: string | null
  description: string | null
  category: string | null
  available_at_bibliotech: boolean
  added_by_id: string | null
  created_at: string
  updated_at: string
}

export interface BookRead {
  id: string
  profile_id: string
  book_id: string
  status: BookReadStatus
  rating: number | null
  review: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

export interface BookWithReads extends Book {
  reads: Pick<BookRead, 'id' | 'profile_id' | 'status' | 'rating'>[]
  borrowings?: Pick<BookBorrowing, 'id' | 'profile_id' | 'status'>[]
}

export interface BookReadWithProfile extends BookRead {
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'position'> | null
}

export const BOOK_READ_STATUS: Record<BookReadStatus, { label: string; color: string }> = {
  wishlist: { label: 'Quero ler', color: '#64748b' },
  reading:  { label: 'Lendo',     color: '#2563eb' },
  read:     { label: 'Lido',      color: '#0d9b6c' },
}

export type BookBorrowStatus = 'borrowed' | 'returned' | 'queued'

export interface BookBorrowing {
  id: string
  book_id: string
  profile_id: string
  status: BookBorrowStatus
  borrowed_at: string
  returned_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BookBorrowingWithProfile extends BookBorrowing {
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'> | null
}

export interface BookBorrowingWithBook extends BookBorrowing {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url'> | null
}

export interface BookReadWithBook extends BookRead {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url' | 'category'> | null
}

export type CourseStatus = 'planned' | 'in_progress' | 'completed'

export interface Course {
  id: string
  profile_id: string
  title: string
  provider: string | null
  url: string | null
  status: CourseStatus
  workload_hours: number | null
  started_at: string | null
  finished_at: string | null
  certificate_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export const COURSE_STATUS: Record<CourseStatus, { label: string; color: string }> = {
  planned:     { label: 'Planejado',  color: '#64748b' },
  in_progress: { label: 'Cursando',   color: '#2563eb' },
  completed:   { label: 'Concluído',  color: '#0d9b6c' },
}

export type PdiCycleStatus = 'active' | 'completed' | 'cancelled'
export type PdiGoalStatus = 'not_started' | 'in_progress' | 'completed' | 'paused'
export type PdiGoalCategory = 'hard_skill' | 'soft_skill' | 'leadership' | 'business' | 'other'

export interface PdiCycle {
  id: string
  profile_id: string
  title: string
  status: PdiCycleStatus
  started_at: string | null
  ends_at: string | null
  summary: string | null
  self_assessment: string | null
  self_assessment_score: number | null
  manager_assessment: string | null
  manager_assessment_score: number | null
  manager_assessment_by_id: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export type PdiResourceType = 'book' | 'course' | 'achievement'

export interface PdiGoalResource {
  id: string
  goal_id: string
  resource_type: PdiResourceType
  resource_id: string
  created_at: string
}

export interface ResolvedGoalResource extends PdiGoalResource {
  title: string
  subtitle: string | null
  link: { name: string; params: Record<string, string> } | null
}

export const PDI_RESOURCE_TYPE: Record<PdiResourceType, { label: string; icon: string }> = {
  book:        { label: 'Livro',     icon: '📚' },
  course:      { label: 'Curso',     icon: '🎓' },
  achievement: { label: 'Conquista', icon: '★' },
}

export interface PdiGoal {
  id: string
  cycle_id: string
  title: string
  description: string | null
  category: PdiGoalCategory
  status: PdiGoalStatus
  progress: number
  target_date: string | null
  priority: number
  created_at: string
  updated_at: string
}

export interface PdiCheckIn {
  id: string
  cycle_id: string
  author_id: string
  message: string
  created_at: string
}

type ProfileMiniPdi = Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'>

export interface PdiCheckInWithAuthor extends PdiCheckIn {
  author: ProfileMiniPdi | null
}

export const PDI_CYCLE_STATUS: Record<PdiCycleStatus, { label: string; color: string }> = {
  active:    { label: 'Ativo',     color: '#0d9b6c' },
  completed: { label: 'Concluído', color: '#64748b' },
  cancelled: { label: 'Cancelado', color: '#dc2626' },
}

export const PDI_GOAL_STATUS: Record<PdiGoalStatus, { label: string; color: string }> = {
  not_started: { label: 'Não iniciado', color: '#64748b' },
  in_progress: { label: 'Em andamento', color: '#2563eb' },
  completed:   { label: 'Concluído',    color: '#0d9b6c' },
  paused:      { label: 'Pausado',      color: '#ca8a04' },
}

export const PDI_GOAL_CATEGORY: Record<PdiGoalCategory, { label: string; color: string }> = {
  hard_skill: { label: 'Hard skill', color: '#2563eb' },
  soft_skill: { label: 'Soft skill', color: '#a855f7' },
  leadership: { label: 'Liderança',  color: '#0891b2' },
  business:   { label: 'Negócio',    color: '#ea580c' },
  other:      { label: 'Outro',      color: '#64748b' },
}

export type NotificationType =
  | 'achievement_received'
  | 'pdi_comment'
  | 'pdi_goal_updated'
  | 'book_return_reminder'
  | 'book_available_for_you'

export interface Notification {
  id: string
  profile_id: string
  type: NotificationType
  title: string
  message: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export const NOTIFICATION_ICON: Record<NotificationType, string> = {
  achievement_received:    '★',
  pdi_comment:             '💬',
  pdi_goal_updated:        '➤',
  book_return_reminder:    '📚',
  book_available_for_you:  '✨',
}
