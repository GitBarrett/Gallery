import { moderationProviderContract } from '../../../../tests/contracts/moderation-provider.contract'
import { fakeModerationProvider } from './fake-moderation-provider'

moderationProviderContract('fake', fakeModerationProvider)
