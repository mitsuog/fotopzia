import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Providers } from '@/components/providers'
import { AppShell } from '@/components/layout/AppShell'

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, avatar_url')
    .eq('id', user.id)
    .single()

  const userWithProfile = {
    email: user.email ?? '',
    profile: profile ?? undefined,
  }

  return (
    <Providers>
      <AppShell user={userWithProfile}>{children}</AppShell>
    </Providers>
  )
}
