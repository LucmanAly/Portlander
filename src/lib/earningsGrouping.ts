import type { EarningsCardModel } from '@/types/earnings'
import { formatEventDay } from '@/lib/format'

const TIMING_LABEL: Record<EarningsCardModel['timing'], string> = {
  bmo: 'Before Open',
  amc: 'After Close',
  unknown: 'Time TBD',
}

export interface EarningsGroup {
  key: string
  heading: string
  cards: EarningsCardModel[]
}

/**
 * Groups by eventDate + timing (e.g. "Today · Before Open") — the cluster/session
 * mechanism. Structurally distinct from Today's MorningHeader->Deck->NeedsAttention
 * hierarchy by construction, so this never duplicates that page's shape.
 */
export function groupEarningsCards(cards: EarningsCardModel[]): EarningsGroup[] {
  const groups = new Map<string, EarningsGroup>()

  for (const card of cards) {
    const key = `${card.eventDate}::${card.timing}`
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        heading: `${formatEventDay(card.eventDate)} · ${TIMING_LABEL[card.timing]}`,
        cards: [],
      }
      groups.set(key, group)
    }
    group.cards.push(card)
  }

  return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key))
}
