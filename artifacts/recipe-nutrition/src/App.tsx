import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  CookingPot,
  Database,
  Edit3,
  Flame,
  LayoutDashboard,
  Leaf,
  LogIn,
  Menu,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  ApprovalInputStatus,
  ApprovalStatus,
  getGetCurrentUserQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetIngredientQueryKey,
  getGetRecipeQueryKey,
  getHealthCheckQueryKey,
  getListIngredientsQueryKey,
  getListRecipesQueryKey,
  getListUsersQueryKey,
  useAddRecipeComment,
  useApproveRecipe,
  useCreateIngredient,
  useCreateRecipe,
  useCreateUser,
  useDeleteIngredient,
  useDeleteRecipe,
  useGetCurrentUser,
  useGetDashboardSummary,
  useGetIngredient,
  useGetRecipe,
  useHealthCheck,
  useListIngredients,
  useListRecipes,
  useListUsers,
  useRateRecipe,
  useUpdateRecipe,
  useUpdateIngredient,
} from '@workspace/api-client-react';
import type { ApprovalStatus as ApprovalStatusType, Ingredient, Recipe } from '@workspace/api-client-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useRoute } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-sm">
        <CookingPot size={19} strokeWidth={2.3} />
      </span>
      {!compact && <span className="font-serif text-[19px] font-semibold tracking-[-.03em]">mise.</span>}
    </Link>
  );
}

function Avatar({ name, size = 'md' }: { name?: string; size?: 'sm' | 'md' }) {
  const letters = (name || 'K S').split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <span className={`flex shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] font-mono text-[hsl(var(--secondary-foreground))] ${size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'}`} data-testid="avatar-user">{letters}</span>;
}

function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return <div className="space-y-3" aria-label="Loading">
    {Array.from({ length: lines }).map((_, i) => <div key={i} className={`skeleton h-12 rounded-xl ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />)}
  </div>;
}

function ErrorState({ message = 'We could not load this part of the kitchen.' }: { message?: string }) {
  return <div className="app-card flex flex-col items-center justify-center gap-3 p-10 text-center" data-testid="state-error">
    <CircleAlert className="text-[hsl(var(--accent))]" size={27} />
    <p className="font-serif text-xl">A small hiccup.</p>
    <p className="max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{message}</p>
  </div>;
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="app-card flex flex-col items-center justify-center gap-3 p-12 text-center" data-testid="state-empty">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Leaf size={22} /></span>
    <p className="font-serif text-xl">{title}</p>
    <p className="max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{body}</p>
    {action}
  </div>;
}

function StatCard({ label, value, detail, icon, tone = 'green' }: { label: string; value: string | number; detail: string; icon: ReactNode; tone?: 'green' | 'orange' | 'cream' }) {
  return <div className="app-card lift relative overflow-hidden p-5" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl ${tone === 'orange' ? 'bg-[hsl(var(--accent)/.14)] text-[hsl(var(--accent))]' : tone === 'cream' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]' : 'bg-[hsl(var(--primary)/.11)] text-[hsl(var(--primary))]'}`}>{icon}</div>
    <p className="eyebrow">{label}</p>
    <p className="mt-5 font-serif text-4xl tracking-[-.05em]">{value}</p>
    <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{detail}</p>
  </div>;
}

function StatusPill({ status }: { status: ApprovalStatusType }) {
  return <span className={`status-pill ${status === ApprovalStatus.APPROVED ? 'approved' : status === ApprovalStatus.PENDING ? 'pending' : 'rejected'}`} data-testid={`status-${status.toLowerCase()}`}>
    {status === ApprovalStatus.APPROVED ? <Check size={12} /> : status === ApprovalStatus.PENDING ? <Clock3 size={12} /> : <X size={12} />}
    {status.charAt(0) + status.slice(1).toLowerCase()}
  </span>;
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { data: me } = useGetCurrentUser();
  const nav = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/recipes', label: 'Recipe library', icon: BookOpen },
    { href: '/ingredients', label: 'Ingredients', icon: Database },
  ];
  return <aside className="sidebar-scroll flex h-full w-[258px] shrink-0 flex-col overflow-y-auto bg-[hsl(var(--primary))] px-4 py-5 text-[hsl(var(--primary-foreground))]" data-testid="sidebar">
    <div className="mb-9 flex items-center justify-between px-2"><Logo /><button className="rounded-lg p-1 md:hidden" onClick={onClose} data-testid="button-close-menu"><X size={18} /></button></div>
    <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary-foreground)/.45)]">Workspace</p>
    <nav className="space-y-1">
      {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`sidebar-link ${location === href || (href === '/recipes' && location.startsWith('/recipes/')) ? 'active' : ''}`} onClick={onClose} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} /><span>{label}</span></Link>)}
    </nav>
    {me?.role === 'ADMIN' && <><p className="mb-3 mt-9 px-3 font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary-foreground)/.45)]">Stewardship</p><Link href="/users" className={`sidebar-link ${location === '/users' ? 'active' : ''}`} onClick={onClose} data-testid="link-nav-users"><Users size={17} /><span>People & access</span></Link></>}
    <div className="mt-auto pt-10">
      <div className="rounded-2xl bg-[hsl(var(--primary-foreground)/.07)] p-4">
        <p className="font-serif text-base">Keep the good stuff.</p>
        <p className="mt-1 text-xs leading-5 text-[hsl(var(--primary-foreground)/.58)]">A shared shelf for recipes worth making twice.</p>
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-[hsl(var(--primary-foreground)/.14)] px-2 pt-4"><Avatar name={me?.name} size="sm" /><div className="min-w-0"><p className="truncate text-xs font-medium">{me?.name || 'Your kitchen'}</p><p className="truncate text-[10px] text-[hsl(var(--primary-foreground)/.5)]">{me?.email || 'Signed in workspace'}</p></div><Settings2 size={15} className="ml-auto text-[hsl(var(--primary-foreground)/.45)]" /></div>
    </div>
  </aside>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: me } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 60000 } });
  return <div className="paper-noise flex min-h-[100dvh] bg-[hsl(var(--background))]">
    <div className={`fixed inset-y-0 left-0 z-30 transition-transform md:relative md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}><Sidebar onClose={() => setMenuOpen(false)} /></div>
    {menuOpen && <button className="fixed inset-0 z-20 bg-[hsl(var(--foreground)/.3)] md:hidden" onClick={() => setMenuOpen(false)} aria-label="Close navigation" data-testid="button-overlay" />}
    <main className="min-w-0 flex-1">
      <header className="flex h-[76px] items-center justify-between border-b border-[hsl(var(--border)/.8)] px-5 sm:px-8 lg:px-12">
        <button className="rounded-xl p-2 hover:bg-[hsl(var(--muted))] md:hidden" onClick={() => setMenuOpen(true)} data-testid="button-open-menu"><Menu size={21} /></button>
        <div className="hidden items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] sm:flex"><span className={`h-2 w-2 rounded-full ${health?.status ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent))]'}`} title={health?.status || 'Checking kitchen connection'} /> Kitchen workspace <span className="mx-1 text-[hsl(var(--border))]">/</span> {new Date().toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
        <div className="ml-auto flex items-center gap-3"><button className="btn-quiet !rounded-xl !px-3 !py-2" onClick={() => setLocation('/recipes/new')} data-testid="button-header-add"><Plus size={16} /><span className="hidden sm:inline">New recipe</span></button><Avatar name={me?.name} /></div>
      </header>
      <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12">{children}</div>
    </main>
  </div>;
}

function Home() {
  const [, setLocation] = useLocation();
  const { data: me } = useGetCurrentUser();
  useEffect(() => { if (me) setLocation('/dashboard'); }, [me, setLocation]);
  return <div className="paper-noise min-h-[100dvh] overflow-hidden">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-10"><Logo /><div className="flex items-center gap-3"><Link href="/sign-in" className="btn-quiet !bg-transparent !px-3" data-testid="link-sign-in">Sign in</Link><Link href="/sign-up" className="btn-primary" data-testid="link-sign-up">Join the kitchen <ArrowRight size={15} /></Link></div></header>
    <section className="relative mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-12 sm:px-10 lg:grid-cols-[1fr_430px] lg:items-center lg:gap-24 lg:pb-28 lg:pt-20">
      <div className="fade-up"><p className="eyebrow mb-5">A shared recipe notebook</p><h1 className="max-w-3xl font-serif text-6xl leading-[.95] tracking-[-.065em] text-[hsl(var(--foreground))] sm:text-8xl">Make room for<br /><em className="text-[hsl(var(--accent))]">the good ones.</em></h1><p className="mt-8 max-w-lg text-lg leading-8 text-[hsl(var(--muted-foreground))]">mise. keeps the recipes your people actually cook — with the numbers, notes, and little improvements that make them yours.</p><div className="mt-9 flex flex-wrap items-center gap-3"><Link href="/sign-up" className="btn-primary !px-5 !py-3" data-testid="button-hero-start">Start your library <ArrowRight size={16} /></Link><a href="#how-it-works" className="btn-outline !border-transparent" data-testid="link-how-it-works">See how it works <ChevronRight size={16} /></a></div><div className="mt-12 flex items-center gap-7 text-xs text-[hsl(var(--muted-foreground))]"><span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[hsl(var(--primary))]" /> Nutrition at a glance</span><span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[hsl(var(--primary))]" /> Curated together</span></div></div>
      <div className="relative fade-up fade-up-2"><div className="absolute -inset-8 rounded-full bg-[hsl(var(--secondary)/.55)] blur-3xl" /><div className="relative rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-lift)]"><div className="mb-5 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Tonight's shortlist</p><MoreHorizontal size={18} className="text-[hsl(var(--muted-foreground))]" /></div><div className="overflow-hidden rounded-2xl bg-[hsl(var(--secondary))]"><div className="flex h-48 items-end justify-between bg-[radial-gradient(circle_at_25%_20%,hsl(var(--accent)/.6),transparent_30%),linear-gradient(135deg,hsl(var(--secondary)),hsl(var(--muted)))] p-5"><span className="rounded-full bg-[hsl(var(--card)/.85)] px-3 py-1 font-mono text-[10px] text-[hsl(var(--primary))]">APPROVED</span><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--card)/.9)] text-[hsl(var(--accent))]"><Flame size={22} /></span></div><div className="p-5"><h2 className="font-serif text-2xl">Sunday tomato toast</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">by Amara L. · 18 min</p><div className="mt-5 flex items-end justify-between border-t border-[hsl(var(--border)/.7)] pt-4"><div><p className="font-mono text-2xl text-[hsl(var(--primary))]">384 <span className="text-xs">kcal</span></p><p className="text-[11px] text-[hsl(var(--muted-foreground))]">per serving</p></div><div className="flex items-center gap-1 text-sm"><Star size={15} fill="currentColor" className="text-[hsl(var(--accent))]" /> 4.8</div></div></div></div></div></div>
    </section>
    <section id="how-it-works" className="border-y border-[hsl(var(--border)/.7)] bg-[hsl(var(--card)/.45)] px-6 py-20 sm:px-10"><div className="mx-auto max-w-7xl"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="eyebrow">Not another bookmark folder</p><h2 className="mt-4 max-w-md font-serif text-4xl leading-tight tracking-[-.045em]">A little structure for a very human thing.</h2></div><div className="grid gap-8 sm:grid-cols-3">{[['01', 'Collect', 'Keep the family lasagna, the weeknight standbys, and the almost-there experiments in one trusted place.'], ['02', 'Understand', 'See calories by ingredient, swap in an alternative, and make choices without turning dinner into homework.'], ['03', 'Cook together', 'Leave a note after dinner. Rate what made the cut. Approve the recipes everyone should know.']].map(([num, title, body]) => <div key={num} className="border-t-2 border-[hsl(var(--primary))] pt-4"><p className="font-mono text-xs text-[hsl(var(--accent))]">{num}</p><h3 className="mt-5 font-serif text-2xl">{title}</h3><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{body}</p></div>)}</div></div></div></section>
    <footer className="mx-auto flex max-w-7xl items-center justify-between px-6 py-10 text-xs text-[hsl(var(--muted-foreground))] sm:px-10"><span className="font-serif text-lg text-[hsl(var(--foreground))]">mise.</span><span>Made for the recipes worth passing on.</span></footer>
  </div>;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  return <div className="paper-noise flex min-h-[100dvh] bg-[hsl(var(--background))]"><div className="hidden w-[46%] flex-col justify-between bg-[hsl(var(--primary))] p-10 text-[hsl(var(--primary-foreground))] lg:flex"><Logo /><div><p className="eyebrow !text-[hsl(var(--primary-foreground)/.65)]">The kitchen is better shared</p><p className="mt-5 max-w-md font-serif text-5xl leading-[1.02] tracking-[-.05em]">Keep the notes that make a recipe yours.</p></div><p className="text-xs text-[hsl(var(--primary-foreground)/.55)]">mise. / recipe nutrition manager</p></div><div className="flex flex-1 items-center justify-center px-6 py-12"><div className="w-full max-w-[410px]"><div className="mb-10 lg:hidden"><Logo /></div><p className="eyebrow">{mode === 'sign-in' ? 'Welcome back' : 'Make a place for your recipes'}</p><h1 className="mt-3 font-serif text-4xl tracking-[-.045em]">{mode === 'sign-in' ? 'Back to the good stuff.' : 'Start your kitchen.'}</h1><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{mode === 'sign-in' ? 'Your shared shelf is waiting.' : 'Build a recipe library you will actually use.'}</p><form className="mt-8 space-y-4" onSubmit={(event) => { event.preventDefault(); setLocation('/dashboard'); }}><div className="space-y-2">{mode === 'sign-up' && <><label className="text-xs font-semibold">Your name</label><input className="app-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amara Lewis" data-testid="input-auth-name" /></>}<label className="text-xs font-semibold">Email address</label><input required type="email" className="app-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="input-auth-email" /></div><button type="submit" className="btn-primary w-full !py-3" data-testid="button-auth-submit">{mode === 'sign-in' ? <LogIn size={16} /> : <UserPlus size={16} />}{mode === 'sign-in' ? 'Sign in' : 'Create account'}</button></form><div className="my-7 flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]"><span className="h-px flex-1 bg-[hsl(var(--border))]" />or<span className="h-px flex-1 bg-[hsl(var(--border))]" /></div><button className="btn-outline w-full !py-3" onClick={() => setLocation('/dashboard')} data-testid="button-auth-demo">Continue with Google</button><p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{mode === 'sign-in' ? "New to mise.?" : 'Already have an account?'} <Link href={mode === 'sign-in' ? '/sign-up' : '/sign-in'} className="font-semibold text-[hsl(var(--primary))]" data-testid="link-auth-switch">{mode === 'sign-in' ? 'Create one' : 'Sign in'}</Link></p></div></div></div>;
}

function Dashboard() {
  const { data: summary, isLoading, isError } = useGetDashboardSummary();
  const { data: me } = useGetCurrentUser();
  if (isLoading) return <PageHeading title="Good morning." kicker="Your kitchen, in one glance"><LoadingBlock lines={4} /></PageHeading>;
  if (isError || !summary) return <PageHeading title="Good morning." kicker="Your kitchen, in one glance"><ErrorState /></PageHeading>;
  return <div className="space-y-8"><PageHeading title={`Good morning${me?.name ? `, ${me.name.split(' ')[0]}` : ''}.`} kicker="Your kitchen, in one glance"><Link href="/recipes/new" className="btn-primary" data-testid="button-dashboard-new"><Plus size={16} /> Add a recipe</Link></PageHeading><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Recipes" value={summary.recipeCount} detail="in your shared library" icon={<BookOpen size={18} />} /><StatCard label="Ingredients" value={summary.ingredientCount} detail="with nutrition data" icon={<Leaf size={18} />} tone="cream" /><StatCard label="To review" value={summary.pendingApprovalCount} detail={summary.pendingApprovalCount ? 'waiting for a steward' : 'the shelf is tidy'} icon={<ClipboardList size={18} />} tone="orange" /><StatCard label="Average rating" value={summary.averageRating ? summary.averageRating.toFixed(1) : '—'} detail="from the people who cook" icon={<Star size={18} />} /></div><div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]"><section className="app-card p-5 sm:p-7"><div className="mb-6 flex items-start justify-between"><div><p className="eyebrow">Recently added</p><h2 className="mt-2 font-serif text-2xl">The shelf is growing</h2></div><Link href="/recipes" className="btn-outline !px-3 !py-2 text-xs" data-testid="link-dashboard-recipes">View all <ArrowRight size={14} /></Link></div>{summary.recentRecipes.length ? <div className="space-y-2">{summary.recentRecipes.slice(0, 5).map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} />)}</div> : <EmptyState title="Your shelf is quiet." body="Add the first recipe your household cannot do without." action={<Link href="/recipes/new" className="btn-primary mt-2" data-testid="button-empty-add">Add a recipe</Link>} />}</section><section className="app-card overflow-hidden bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))]"><p className="eyebrow !text-[hsl(var(--primary-foreground)/.6)]">A tiny ritual</p><h2 className="mt-3 font-serif text-3xl leading-tight">Cook it.<br />Then leave a note.</h2><p className="mt-5 text-sm leading-6 text-[hsl(var(--primary-foreground)/.68)]">The best recipe is the one that remembers what you learned last time.</p><div className="mt-12 flex items-center gap-3 border-t border-[hsl(var(--primary-foreground)/.16)] pt-4 text-xs text-[hsl(var(--primary-foreground)/.65)]"><MessageCircle size={15} /> Notes become part of the recipe</div></section></div></div>;
}

function PageHeading({ title, kicker, children }: { title: string; kicker: string; children?: ReactNode }) {
  return <div className="fade-up mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">{kicker}</p><h1 className="mt-2 font-serif text-4xl tracking-[-.05em] sm:text-5xl">{title}</h1></div>{children}</div>;
}

function RecipeRow({ recipe }: { recipe: Recipe }) {
  return <Link href={`/recipes/${recipe.id}`} className="lift flex items-center gap-4 rounded-2xl border border-transparent p-3 hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--background)/.5)]" data-testid={`link-recipe-${recipe.id}`}><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--accent))]">{recipe.imageUrl ? <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" /> : <CookingPot size={20} />}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{recipe.name}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">by {recipe.author.name} · {recipe.ingredients.length} ingredients</p></div><div className="hidden text-right sm:block"><p className="font-mono text-sm">{Math.round(recipe.totalCalories)} <span className="text-[10px] text-[hsl(var(--muted-foreground))]">kcal</span></p><StatusPill status={recipe.status} /></div><ChevronRight size={17} className="text-[hsl(var(--muted-foreground))]" /></Link>;
}

function Recipes() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | ApprovalStatusType>('ALL');
  const params = useMemo(() => ({ search: search || undefined, status: status === 'ALL' ? undefined : status }), [search, status]);
  const { data: recipes, isLoading, isError } = useListRecipes(params);
  const { data: me } = useGetCurrentUser();
  const deleteRecipe = useDeleteRecipe();
  const qc = useQueryClient();
  return <div className="space-y-6"><PageHeading title="Recipe library" kicker="Everything worth making again"><Link href="/recipes/new" className="btn-primary" data-testid="button-new-recipe"><Plus size={16} /> New recipe</Link></PageHeading><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input className="app-input pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by recipe name..." data-testid="input-search-recipes" /></div><div className="flex gap-2 overflow-x-auto">{(['ALL', ApprovalStatus.APPROVED, ApprovalStatus.PENDING, ApprovalStatus.REJECTED] as const).map((value) => <button key={value} className={`btn-outline whitespace-nowrap !px-3 !py-2 text-xs ${status === value ? '!border-[hsl(var(--primary))] !bg-[hsl(var(--primary)/.09)] !text-[hsl(var(--primary))]' : ''}`} onClick={() => setStatus(value)} data-testid={`button-filter-${value.toLowerCase()}`}>{value === 'ALL' ? 'All recipes' : value.charAt(0) + value.slice(1).toLowerCase()}</button>)}</div></div>{isLoading ? <LoadingBlock lines={5} /> : isError ? <ErrorState /> : recipes?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} canDelete={me?.id === recipe.author.id || me?.role === 'ADMIN'} onDelete={() => { if (window.confirm(`Remove ${recipe.name}?`)) deleteRecipe.mutate({ recipeId: recipe.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListRecipesQueryKey(params) }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); } }); }} />)}</div> : <EmptyState title="No recipes found." body={search ? 'Try a different search, or add this one to the shelf.' : 'Your shared library is ready for its first recipe.'} action={<Link href="/recipes/new" className="btn-primary mt-2" data-testid="button-recipes-empty">Add recipe</Link>} />}</div>;
}

function RecipeCard({ recipe, canDelete, onDelete }: { recipe: Recipe; canDelete: boolean; onDelete: () => void }) {
  return <article className="app-card lift overflow-hidden" data-testid={`card-recipe-${recipe.id}`}><Link href={`/recipes/${recipe.id}`} data-testid={`link-card-recipe-${recipe.id}`}><div className="relative flex h-40 items-end justify-between overflow-hidden bg-[radial-gradient(circle_at_20%_20%,hsl(var(--accent)/.58),transparent_30%),linear-gradient(135deg,hsl(var(--secondary)),hsl(var(--muted)))] p-4">{recipe.imageUrl && <img src={recipe.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover mix-blend-multiply opacity-75" />}<StatusPill status={recipe.status} /><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--card)/.84)] text-[hsl(var(--accent))]"><Flame size={17} /></span></div></Link><div className="p-5"><div className="flex items-start justify-between gap-3"><div><Link href={`/recipes/${recipe.id}`} className="font-serif text-2xl leading-tight" data-testid={`link-title-recipe-${recipe.id}`}>{recipe.name}</Link><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">by {recipe.author.name}</p></div>{canDelete && <button className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/.08)] hover:text-[hsl(var(--destructive))]" onClick={onDelete} aria-label={`Delete ${recipe.name}`} data-testid={`button-delete-recipe-${recipe.id}`}><Trash2 size={15} /></button>}</div><div className="mt-5 flex items-center justify-between border-t border-[hsl(var(--border)/.7)] pt-4"><span className="flex items-center gap-1 text-sm"><Star size={14} fill="currentColor" className="text-[hsl(var(--accent))]" /> {recipe.averageRating ? recipe.averageRating.toFixed(1) : 'New'} <span className="text-xs text-[hsl(var(--muted-foreground))]">({recipe.ratingCount})</span></span><span className="font-mono text-sm text-[hsl(var(--primary))]">{Math.round(recipe.totalCalories)} <span className="text-[10px] text-[hsl(var(--muted-foreground))]">kcal</span></span></div></div></article>;
}

function RecipeNew() {
  const [, setLocation] = useLocation();
  const { data: ingredients } = useListIngredients();
  const createRecipe = useCreateRecipe();
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [rows, setRows] = useState([{ ingredientId: '', quantity: '1' }]);
  const selected = rows.map((row) => ({ ...row, item: ingredients?.find((ingredient) => ingredient.id === Number(row.ingredientId)) })).filter((row) => row.item);
  const calories = selected.reduce((sum, row) => sum + (row.item?.caloriesPerUnit || 0) * Number(row.quantity || 0), 0);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!name.trim() || selected.length === 0) return; createRecipe.mutate({ data: { name: name.trim(), imageUrl: imageUrl.trim() || null, ingredients: selected.map((row) => ({ ingredientId: Number(row.ingredientId), quantity: Number(row.quantity) })) } }, { onSuccess: (recipe) => { queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() }); setLocation(`/recipes/${recipe.id}`); } }); };
  return <div className="mx-auto max-w-4xl"><Link href="/recipes" className="mb-7 inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-back-recipes"><ChevronLeft size={16} /> Recipe library</Link><PageHeading title="New recipe" kicker="Add something worth remembering" /><form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_290px]"><div className="space-y-6"><section className="app-card p-5 sm:p-7"><p className="eyebrow">The basics</p><div className="mt-5 space-y-4"><div><label className="mb-2 block text-xs font-semibold">Recipe name</label><input required className="app-input text-lg" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weeknight lemon beans" data-testid="input-recipe-name" /></div><div><label className="mb-2 block text-xs font-semibold">Image URL <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><input className="app-input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." data-testid="input-recipe-image" /></div></div></section><section className="app-card p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="eyebrow">What goes in</p><h2 className="mt-2 font-serif text-2xl">Ingredients</h2></div><button type="button" className="btn-quiet !px-3 !py-2 text-xs" onClick={() => setRows([...rows, { ingredientId: '', quantity: '1' }])} data-testid="button-add-ingredient"><Plus size={14} /> Add line</button></div><div className="mt-6 space-y-3">{rows.map((row, index) => <div key={index} className="flex gap-2" data-testid={`row-recipe-ingredient-${index}`}><select className="app-input min-w-0 flex-1" value={row.ingredientId} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, ingredientId: e.target.value } : item))} data-testid={`select-ingredient-${index}`}><option value="">Choose an ingredient</option>{ingredients?.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}</select><div className="relative w-28"><input type="number" min="0.01" step="0.01" className="app-input pr-10" value={row.quantity} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, quantity: e.target.value } : item))} data-testid={`input-quantity-${index}`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[hsl(var(--muted-foreground))]">{selected[index]?.item?.unit || 'qty'}</span></div><button type="button" className="rounded-xl px-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/.08)] hover:text-[hsl(var(--destructive))]" onClick={() => rows.length > 1 && setRows(rows.filter((_, i) => i !== index))} aria-label="Remove ingredient" data-testid={`button-remove-ingredient-${index}`}><Minus size={16} /></button></div>)}</div></section></div><aside className="space-y-4"><div className="app-card bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))]"><p className="eyebrow !text-[hsl(var(--primary-foreground)/.6)]">Nutrition preview</p><p className="mt-6 font-mono text-5xl">{Math.round(calories)} <span className="text-sm">kcal</span></p><p className="mt-2 text-xs text-[hsl(var(--primary-foreground)/.62)]">estimated for the full recipe</p><div className="mt-6 border-t border-[hsl(var(--primary-foreground)/.17)] pt-4 text-xs text-[hsl(var(--primary-foreground)/.66)]">{selected.length} ingredient{selected.length === 1 ? '' : 's'} with nutrition data</div></div><div className="app-card p-5"><p className="text-sm font-semibold">Ready to share?</p><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">New recipes go to the review shelf for a quick check before everyone sees them.</p><button disabled={createRecipe.isPending} type="submit" className="btn-primary mt-5 w-full" data-testid="button-save-recipe">{createRecipe.isPending ? 'Saving...' : 'Save recipe'} <ArrowRight size={15} /></button></div></aside></form></div>;
}

function RecipeDetail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/recipes/:id');
  const id = Number(params?.id || 0);
  const { data: recipe, isLoading, isError } = useGetRecipe(id, { query: { enabled: Boolean(id), queryKey: getGetRecipeQueryKey(id) } });
  const { data: me } = useGetCurrentUser();
  const comment = useAddRecipeComment();
  const rate = useRateRecipe();
  const approve = useApproveRecipe();
  const deleteRecipe = useDeleteRecipe();
  const updateRecipe = useUpdateRecipe();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  if (isLoading) return <LoadingBlock lines={5} />;
  if (isError || !recipe) return <ErrorState message="This recipe may have moved or you may not have access to it." />;
  const canManage = me?.role === 'ADMIN' || me?.id === recipe.author.id;
  const saveComment = (event: FormEvent) => { event.preventDefault(); if (!note.trim()) return; comment.mutate({ recipeId: id, data: { note: note.trim(), cookedAt: new Date().toISOString() } }, { onSuccess: () => { setNote(''); qc.invalidateQueries({ queryKey: getGetRecipeQueryKey(id) }); } }); };
  const saveRecipeName = (event: FormEvent) => { event.preventDefault(); if (!editName.trim()) return; updateRecipe.mutate({ recipeId: id, data: { name: editName.trim() } }, { onSuccess: () => { setEditing(false); qc.invalidateQueries({ queryKey: getGetRecipeQueryKey(id) }); qc.invalidateQueries({ queryKey: getListRecipesQueryKey() }); } }); };
  return <div className="mx-auto max-w-5xl"><div className="mb-7 flex items-center justify-between"><Link href="/recipes" className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]" data-testid="link-detail-back"><ChevronLeft size={16} /> Recipe library</Link>{canManage && <button className="btn-outline !px-3 !py-2 text-xs" onClick={() => { setEditName(recipe.name); setEditing(true); }} data-testid="button-edit-recipe"><Edit3 size={14} /> Edit title</button>}</div><div className="grid gap-8 lg:grid-cols-[1fr_330px]"><div><div className="relative flex min-h-[250px] items-end overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_20%_20%,hsl(var(--accent)/.62),transparent_29%),linear-gradient(135deg,hsl(var(--secondary)),hsl(var(--muted)))] p-7 sm:min-h-[320px]">{recipe.imageUrl && <img src={recipe.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover mix-blend-multiply opacity-70" />}<div className="relative"><StatusPill status={recipe.status} /><h1 className="mt-5 max-w-2xl font-serif text-5xl leading-[.98] tracking-[-.06em] sm:text-6xl">{recipe.name}</h1><p className="mt-4 text-sm text-[hsl(var(--foreground)/.65)]">By {recipe.author.name} · added {new Date(recipe.createdAt).toLocaleDateString()}</p></div></div>{editing && <form onSubmit={saveRecipeName} className="app-card mt-4 flex gap-2 border-[hsl(var(--primary)/.3)] p-4"><input className="app-input" value={editName} onChange={(e) => setEditName(e.target.value)} data-testid="input-edit-recipe-name" /><button className="btn-primary" disabled={updateRecipe.isPending} type="submit" data-testid="button-save-recipe-edit"><Check size={15} /> Save</button><button type="button" className="btn-quiet" onClick={() => setEditing(false)} data-testid="button-cancel-recipe-edit"><X size={15} /></button></form>}<div className="mt-6 app-card p-5 sm:p-7"><div className="flex items-end justify-between border-b border-[hsl(var(--border)/.8)] pb-5"><div><p className="eyebrow">Ingredients</p><p className="mt-2 font-mono text-3xl text-[hsl(var(--primary))]">{Math.round(recipe.totalCalories)} <span className="text-xs text-[hsl(var(--muted-foreground))]">total kcal</span></p></div><div className="flex items-center gap-1 text-sm"><Star size={16} fill="currentColor" className="text-[hsl(var(--accent))]" /> {recipe.averageRating ? recipe.averageRating.toFixed(1) : 'No ratings'} <span className="text-xs text-[hsl(var(--muted-foreground))]">({recipe.ratingCount})</span></div></div><div className="mt-4 divide-y divide-[hsl(var(--border)/.65)]">{recipe.ingredients.map((ingredient) => <div key={ingredient.ingredientId} className="flex items-center justify-between py-3" data-testid={`ingredient-detail-${ingredient.ingredientId}`}><div><p className="font-medium">{ingredient.ingredientName}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{ingredient.quantity} {ingredient.unit}</p></div><p className="font-mono text-sm text-[hsl(var(--primary))]">{Math.round(ingredient.calories)} kcal</p></div>)}</div></div><section className="mt-6 app-card p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="eyebrow">Cook's notes</p><h2 className="mt-2 font-serif text-2xl">What did you learn?</h2></div><MessageCircle className="text-[hsl(var(--accent))]" size={21} /></div><form onSubmit={saveComment} className="mt-5 flex gap-2"><input className="app-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="The sauce needed a little more time..." data-testid="input-comment" /><button className="btn-primary !px-3" disabled={comment.isPending} aria-label="Add note" data-testid="button-add-comment"><Send size={16} /></button></form><div className="mt-6 space-y-4">{recipe.comments.length ? recipe.comments.map((entry) => <div key={entry.id} className="flex gap-3" data-testid={`comment-${entry.id}`}><Avatar name={entry.user.name} size="sm" /><div><p className="text-sm leading-6">{entry.note}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{entry.user.name} · {new Date(entry.cookedAt).toLocaleDateString()}</p></div></div>) : <p className="py-3 text-sm text-[hsl(var(--muted-foreground))]">No notes yet. Be the first to leave one after cooking.</p>}</div></section></div><aside className="space-y-4"><div className="app-card p-6"><p className="eyebrow">Your take</p><p className="mt-3 font-serif text-xl">Would you make it again?</p><div className="mt-5 flex gap-1">{[1, 2, 3, 4, 5].map((value) => <button key={value} className="rounded-lg p-1.5 hover:bg-[hsl(var(--secondary))]" onClick={() => { setRating(value); rate.mutate({ recipeId: id, data: { rating: value } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetRecipeQueryKey(id) }) }); }} aria-label={`Rate ${value} out of 5`} data-testid={`button-rate-${value}`}><Star size={22} fill={value <= rating ? 'currentColor' : 'none'} className={value <= rating ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--border))]'} /></button>)}</div><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{rate.isPending ? 'Saving your rating...' : rating ? `You gave it ${rating} out of 5.` : 'Tap a star to rate it.'}</p></div>{canManage && recipe.status === ApprovalStatus.PENDING && <div className="app-card border-[hsl(var(--accent)/.35)] bg-[hsl(var(--accent)/.06)] p-6"><p className="eyebrow !text-[hsl(var(--accent))]">Steward review</p><p className="mt-3 text-sm leading-6">This recipe is waiting for a quick check before it joins the shared shelf.</p><div className="mt-5 flex gap-2"><button className="btn-primary flex-1 !bg-[hsl(var(--primary))]" onClick={() => approve.mutate({ recipeId: id, data: { status: ApprovalInputStatus.APPROVED } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetRecipeQueryKey(id) }) })} data-testid="button-approve-recipe"><Check size={15} /> Approve</button><button className="btn-danger" onClick={() => approve.mutate({ recipeId: id, data: { status: ApprovalInputStatus.REJECTED } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetRecipeQueryKey(id) }) })} data-testid="button-reject-recipe">Reject</button></div></div>}{canManage && <button className="btn-danger w-full" onClick={() => { if (window.confirm('Remove this recipe from the library?')) deleteRecipe.mutate({ recipeId: id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListRecipesQueryKey() }); setLocation('/recipes'); } }); }} data-testid="button-detail-delete"><Trash2 size={15} /> Remove recipe</button>}</aside></div></div>;
}

function Ingredients() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { data: ingredients, isLoading, isError } = useListIngredients({ search: search || undefined });
  const { data: ingredientDetail } = useGetIngredient(editing?.id || 0, { query: { enabled: Boolean(editing?.id), queryKey: getGetIngredientQueryKey(editing?.id || 0) } });
  const create = useCreateIngredient();
  const update = useUpdateIngredient();
  const remove = useDeleteIngredient();
  const qc = useQueryClient();
  const [name, setName] = useState(''); const [unit, setUnit] = useState('g'); const [calories, setCalories] = useState('');
  const openNew = () => { setEditing(null); setName(''); setUnit('g'); setCalories(''); setFormOpen(true); };
  const openEdit = (ingredient: Ingredient) => { setEditing(ingredient); setName(ingredient.name); setUnit(ingredient.unit); setCalories(String(ingredient.caloriesPerUnit)); setFormOpen(true); };
  const submit = (event: FormEvent) => { event.preventDefault(); const data = { name: name.trim(), unit: unit.trim(), caloriesPerUnit: Number(calories) }; if (!data.name || Number.isNaN(data.caloriesPerUnit)) return; const done = () => { setFormOpen(false); qc.invalidateQueries({ queryKey: getListIngredientsQueryKey() }); }; if (editing) update.mutate({ ingredientId: editing.id, data }, { onSuccess: done }); else create.mutate({ data }, { onSuccess: done }); };
  return <div className="space-y-6"><PageHeading title="Ingredient catalog" kicker="The building blocks"><button className="btn-primary" onClick={openNew} data-testid="button-new-ingredient"><Plus size={16} /> Add ingredient</button></PageHeading><div className="relative max-w-xl"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input className="app-input pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ingredients..." data-testid="input-search-ingredients" /></div>{formOpen && <section className="app-card max-w-2xl border-[hsl(var(--primary)/.28)] p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="eyebrow">{editing ? 'Edit ingredient' : 'New ingredient'}</p><h2 className="mt-2 font-serif text-2xl">{editing ? (ingredientDetail?.name || editing.name) : 'Add a building block'}</h2></div><button className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]" onClick={() => setFormOpen(false)} data-testid="button-close-ingredient-form"><X size={17} /></button></div><form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_110px_130px_auto] sm:items-end"><label className="text-xs font-semibold">Name<input required className="app-input mt-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chickpeas" data-testid="input-ingredient-name" /></label><label className="text-xs font-semibold">Unit<input required className="app-input mt-2" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g" data-testid="input-ingredient-unit" /></label><label className="text-xs font-semibold">kcal / unit<input required type="number" min="0" className="app-input mt-2" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="164" data-testid="input-ingredient-calories" /></label><button type="submit" className="btn-primary" disabled={create.isPending || update.isPending} data-testid="button-save-ingredient"><Check size={15} /> Save</button></form></section>}{isLoading ? <LoadingBlock lines={6} /> : isError ? <ErrorState /> : ingredients?.length ? <div className="app-card overflow-hidden"><div className="hidden grid-cols-[1.4fr_.7fr_.8fr_90px] gap-4 border-b border-[hsl(var(--border))] px-5 py-3 text-[10px] font-mono uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))] sm:grid"><span>Ingredient</span><span>Serving unit</span><span>Energy</span><span /></div>{ingredients.map((ingredient) => <div key={ingredient.id} className="grid gap-3 border-b border-[hsl(var(--border)/.6)] px-5 py-4 last:border-0 sm:grid-cols-[1.4fr_.7fr_.8fr_90px] sm:items-center" data-testid={`row-ingredient-${ingredient.id}`}><div><p className="font-semibold">{ingredient.name}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{ingredient.alternatives.length ? `${ingredient.alternatives.length} alternative${ingredient.alternatives.length > 1 ? 's' : ''}` : 'No alternatives yet'}</p></div><span className="text-sm text-[hsl(var(--muted-foreground))]">{ingredient.unit}</span><span className="font-mono text-sm text-[hsl(var(--primary))]">{ingredient.caloriesPerUnit} <span className="text-[10px] text-[hsl(var(--muted-foreground))]">kcal</span></span><div className="flex gap-1 sm:justify-end"><button className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" onClick={() => openEdit(ingredient)} aria-label={`Edit ${ingredient.name}`} data-testid={`button-edit-ingredient-${ingredient.id}`}><Edit3 size={15} /></button><button className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/.08)] hover:text-[hsl(var(--destructive))]" onClick={() => { if (window.confirm(`Delete ${ingredient.name}?`)) remove.mutate({ ingredientId: ingredient.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListIngredientsQueryKey() }) }); }} aria-label={`Delete ${ingredient.name}`} data-testid={`button-delete-ingredient-${ingredient.id}`}><Trash2 size={15} /></button></div></div>)}</div> : <EmptyState title="A clean pantry sheet." body="Add ingredients with their unit and calorie count to make recipe nutrition automatic." action={<button className="btn-primary mt-2" onClick={openNew} data-testid="button-empty-ingredient">Add ingredient</button>} />}</div>;
}

function UsersPage() {
  const { data: users, isLoading, isError } = useListUsers();
  const create = useCreateUser();
  const [open, setOpen] = useState(false); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState<'ADMIN' | 'BASIC'>('BASIC');
  const qc = useQueryClient();
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ data: { name, email, role } }, { onSuccess: () => { setOpen(false); setName(''); setEmail(''); qc.invalidateQueries({ queryKey: getListUsersQueryKey() }); } }); };
  return <div className="space-y-6"><PageHeading title="People & access" kicker="Keep the shelf cared for"><button className="btn-primary" onClick={() => setOpen(!open)} data-testid="button-new-user"><UserPlus size={16} /> Invite person</button></PageHeading>{open && <form onSubmit={submit} className="app-card grid gap-3 border-[hsl(var(--primary)/.28)] p-5 sm:grid-cols-[1fr_1fr_150px_auto] sm:items-end"><label className="text-xs font-semibold">Name<input required className="app-input mt-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam Rivera" data-testid="input-user-name" /></label><label className="text-xs font-semibold">Email<input required type="email" className="app-input mt-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sam@example.com" data-testid="input-user-email" /></label><label className="text-xs font-semibold">Role<select className="app-input mt-2" value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'BASIC')} data-testid="select-user-role"><option value="BASIC">Cook</option><option value="ADMIN">Steward</option></select></label><button className="btn-primary" disabled={create.isPending} data-testid="button-save-user"><Send size={15} /> Send invite</button></form>}{isLoading ? <LoadingBlock lines={5} /> : isError ? <ErrorState message="People access is available to kitchen stewards." /> : users?.length ? <div className="app-card overflow-hidden">{users.map((user) => <div key={user.id} className="flex items-center gap-4 border-b border-[hsl(var(--border)/.6)] px-5 py-4 last:border-0" data-testid={`row-user-${user.id}`}><Avatar name={user.name} /><div className="min-w-0 flex-1"><p className="font-semibold">{user.name}</p><p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{user.email}</p></div><span className={`hidden rounded-full px-2.5 py-1 font-mono text-[10px] sm:inline-flex ${user.role === 'ADMIN' ? 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{user.role === 'ADMIN' ? 'STEWARD' : 'COOK'}</span><span className={`h-2 w-2 rounded-full ${user.active ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted-foreground))]'}`} title={user.active ? 'Active' : 'Inactive'} data-testid={`status-user-${user.id}`} /></div>)}</div> : <EmptyState title="No other cooks yet." body="Invite the people who make your kitchen worth organizing." action={<button className="btn-primary mt-2" onClick={() => setOpen(true)} data-testid="button-empty-user">Invite someone</button>} />}</div>;
}

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} /><Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} /><Route path="/dashboard">{() => <AppShell><Dashboard /></AppShell>}</Route><Route path="/recipes/new">{() => <AppShell><RecipeNew /></AppShell>}</Route><Route path="/recipes/:id">{() => <AppShell><RecipeDetail /></AppShell>}</Route><Route path="/recipes">{() => <AppShell><Recipes /></AppShell>}</Route><Route path="/ingredients">{() => <AppShell><Ingredients /></AppShell>}</Route><Route path="/users">{() => <AppShell><UsersPage /></AppShell>}</Route><Route component={NotFound} /></Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><Router /></WouterRouter></QueryClientProvider>;
}

export default App;