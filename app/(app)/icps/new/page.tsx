import Link from 'next/link'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { IcpForm } from '@/components/app/icp-form'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function NewIcpPage() {
  return (
    <div className="max-w-[900px] mx-auto">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/icps" className="gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to ICPs
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Create ICP"
        description="Describe the ideal customer. This will be used as context for content generation."
      />
      <IcpForm mode="create" />
    </div>
  )
}
