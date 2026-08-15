import { createClient } from "@/lib/supabase/server"
import { getQuoteSession } from "../../collection/actions"
import QuoteScan from "./QuoteScan"
import QuoteClaim from "./QuoteClaim"
import { notFound } from "next/navigation"

export default async function QuotePage({ params }) {
  const { id } = await params
  const session = await getQuoteSession(id)
  if (!session) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    return <QuoteClaim quoteId={id} alreadyClaimed={session.claimed} />
  }

  return <QuoteScan quoteId={id} />
}