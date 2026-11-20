import { AppError } from '../platform/http-errors'
import { isAllowedRequest } from '../platform/origin'

export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/')) return
  const request = {
    method: event.method,
    origin: getHeader(event, 'origin'),
    secFetchSite: getHeader(event, 'sec-fetch-site'),
  }
  if (!isAllowedRequest(request, event.context.container.config.siteUrl)) {
    throw new AppError('FORBIDDEN', 'Cross-origin request refused')
  }
})
