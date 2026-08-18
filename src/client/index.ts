/**
 * DeepSeek usage/cost — Client half.
 *
 * Mounts the generated `usageCost` Remote namespace, injects the stylesheet, and
 * registers three surfaces: the session-header cost badge, the per-reply cost
 * chip, and the settings "用量" section.
 *
 * @module @frostgao/dsh-usage-cost/client
 */

import type { Context } from '@deepseek-ai/cordis'
import usageCostRemote from '../../lib/typert.remote-client.js'
import { HeaderCostBadge, MessageCostChip, UsageSettingsSection } from './components.ts'
import { CSS } from './style.ts'
import type { TimerService, UsageCostNamespace, UsageCostRemote } from './remote-types.ts'

const ID = '@frostgao/dsh-usage-cost'

/** Runtime slot registry surface used by this plugin. */
interface SlotRegistry {
  inject(name: string, callback: () => () => void): void
  register(options: Record<string, unknown>, component: unknown): () => void
}

interface ClientContext extends Context {
  remote: UsageCostRemote
  slots: SlotRegistry
}

/** Required services: the Remote carrier, the slot registry, and the timer. */
export const inject = ['remote', 'slots', 'timer']

/**
 * Client plugin body: mount the Remote namespace, inject styles, register slots.
 * @param ctx - client root context.
 * @returns disposer that unmounts the Remote namespace on unload.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const client = ctx as unknown as ClientContext
  const remote = client.remote
  const slots = client.slots
  const timer = ctx.get('timer') as TimerService | undefined

  const disposeRemote = await remote.$mount(usageCostRemote)
  const usageCost = ctx.get('remote.usageCost') as unknown as UsageCostNamespace | undefined
  if (usageCost === undefined) {
    await disposeRemote()
    return async () => {}
  }

  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = ID
    tag.dataset.pluginCss = 'usage-cost'
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'usage-cost: styles')

  slots.inject('conversation.session.header.utilities', () => slots.register({
    name: 'conversation.session.header.utilities',
    id: 'usage-cost',
    order: 50,
    inject: () => ({ usageCost, timer }),
  }, HeaderCostBadge))

  slots.inject('conversation.chat.assistant-actions', () => slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'usage-cost',
    order: 90,
  }, MessageCostChip))

  slots.inject('settings.section', () => slots.register({
    name: 'settings.section',
    id: 'usage',
    order: 200,
    label: '用量',
    inject: () => ({ usageCost, timer }),
  }, UsageSettingsSection))

  return async () => {
    await disposeRemote()
  }
}
