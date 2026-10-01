import axios from 'axios'
import { API_URL } from './config'

// One configured Axios instance for the whole app
const api = axios.create({
  baseURL: API_URL,                // '/api' → proxied by Vite in dev, same origin in production
  headers: { 'Content-Type': 'application/json' },
  timeout: 8000,
})

// Request interceptor: attach the JWT stored after login
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ca_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor: normalise error messages, auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ca_token')
      window.dispatchEvent(new Event('ca:logout'))
    }
    err.message = err.response?.data?.message || err.message
    return Promise.reject(err)
  }
)

export default api
