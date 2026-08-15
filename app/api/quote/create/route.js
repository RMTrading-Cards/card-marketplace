import { createQuoteSession } from "@/app/collection/actions"
import { NextResponse } from "next/server"

export async function POST() {
  const id = await createQuoteSession()
  return NextResponse.json({ id })
}