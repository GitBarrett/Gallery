import { toPublicSettings } from '../../modules/settings'

// Public read of the non-sensitive settings (quality thresholds, feature flags), for every visitor
export default defineEventHandler(async (event) => toPublicSettings(await event.context.container.settings()))
