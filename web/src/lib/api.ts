import axios, { type InternalAxiosRequestConfig } from 'axios'
import { beginModelCall, modelForUrl } from '@/lib/monlam-models'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Tag every request that reaches a Monlam model, so the UI can show which one
 * is working. Done here rather than at the call sites: the endpoint is the
 * thing that decides which model runs, and there is exactly one of those per
 * request.
 */
type TaggedConfig = InternalAxiosRequestConfig & { releaseModel?: () => void }

api.interceptors.request.use((config: TaggedConfig) => {
  const model = modelForUrl(config.url)
  if (model) config.releaseModel = beginModelCall(model)
  return config
})

const release = (config: unknown) => (config as TaggedConfig | undefined)?.releaseModel?.()

api.interceptors.response.use(
  (response) => {
    release(response.config)
    return response
  },
  (error) => {
    // Errors settle the call too, or a failed drill would leave a chip spinning.
    release(error?.config)
    return Promise.reject(error)
  },
)
