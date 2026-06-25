'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Settings,
  ChevronDown,
  LogOut,
  Plus,
  Building2,
  Menu,
  X,
  ShieldAlert,
  Link2,
  Tag as TagIcon,
  Layers,
  Megaphone,
  Building,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface Project {
  id: string
  name: string
  companyName: string
  memberRole?: string
}

interface Props {
  user: { id: string; name: string; email: string }
  currentProject: { id: string; name: string; companyName: string }
  projects: Project[]
  children: React.ReactNode
}

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'ICP Management', href: '/icps', icon: Users },
  { label: 'Content Studio', href: '/content', icon: Sparkles },
  { label: 'Platforms', href: '/platforms', icon: Layers },
  { label: 'Internal Links', href: '/internal-links', icon: Link2 },
  { label: 'Tags', href: '/tags', icon: TagIcon },
  { label: 'Red Flags', href: '/red-flags', icon: ShieldAlert },
  { label: 'Glossary', href: '/glossary', icon: BookOpen },
  { label: 'Company', href: '/company', icon: Building },
  { label: 'Marketing OS', href: '/marketing', icon: Megaphone },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export function DashboardShell({ user, currentProject, projects, children }: Props) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)

  const handleCreateProject = async () => {
    const name = window.prompt('Project name?')
    if (!name) return
    const companyName = window.prompt('Company name?') ?? name
    setCreatingProject(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, companyName }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'Could not create project')
        return
      }
      toast.success('Project created')
      router.refresh()
    } finally {
      setCreatingProject(false)
    }
  }

  const SidebarBody = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground font-display font-bold text-sm">
            N5
          </div>
          <span className="font-display font-semibold text-lg tracking-tight">N5Deal</span>
        </Link>
      </div>

      {/* Project switcher */}
      <div className="p-4 border-b border-border">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
          Workspace
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center justify-between gap-2 bg-secondary hover:bg-secondary/80 px-3 py-2.5 text-left transition-colors"
              type="button"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 items-center justify-center bg-primary text-primary-foreground shrink-0">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{currentProject?.name ?? 'Workspace'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{currentProject?.companyName ?? ''}</p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Your projects</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(projects ?? []).map((p) => (
              <DropdownMenuItem key={p.id} className="flex-col items-start">
                <span className="text-sm font-medium">{p?.name}</span>
                <span className="text-[11px] text-muted-foreground">{p?.companyName}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCreateProject} disabled={creatingProject}>
              <Plus className="h-4 w-4 mr-2" /> Create project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-secondary'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary transition-colors" type="button">
              <div className="flex h-8 w-8 items-center justify-center bg-accent text-accent-foreground text-xs font-semibold">
                {user?.name?.[0]?.toUpperCase?.() ?? 'U'}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4 mr-2" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-card border-r border-border flex-col">
        {SidebarBody}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col lg:hidden transition-transform',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {SidebarBody}
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 lg:hidden flex items-center justify-between bg-card border-b border-border h-14 px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 hover:bg-secondary"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center bg-primary text-primary-foreground font-display font-bold text-xs">
              N5
            </div>
            <span className="font-display font-semibold tracking-tight">N5Deal</span>
          </div>
          <div className="w-9" />
        </div>
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
