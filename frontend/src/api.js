const TOKEN_KEY = 'food_crm_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (options.body) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(path, { ...options, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data.detail
    throw new Error(typeof detail === 'string' ? detail : 'Не получилось выполнить запрос')
  }
  return data
}

export function tenge(value) {
  return `${new Intl.NumberFormat('ru-KZ').format(value)} ₸`
}

export function when(iso) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const ROLE_HOME = {
  client: '/menu',
  admin: '/desk',
  restaurant: '/kitchen',
  courier: '/route',
}

export const ROLE_LABEL = {
  client: 'Клиент',
  admin: 'Администратор',
  restaurant: 'Ресторан',
  courier: 'Курьер',
}

export const STEPS = [
  ['placed', 'Принят'],
  ['cooking', 'Кухня'],
  ['ready', 'Готов'],
  ['on_the_way', 'В пути'],
  ['delivered', 'У двери'],
]
