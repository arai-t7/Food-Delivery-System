import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { ROLE_HOME, ROLE_LABEL, STEPS, api, clearToken, getToken, setToken, tenge, when } from './api'
import FortuneWheel from './FortuneWheel'
import { MysteryMeal, RestaurantDashboard, RestaurantFields, SplitBill } from './RestaurantTools'

const AuthContext = createContext(null)

function useAuth() {
  return useContext(AuthContext)
}

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <path d="M5 14h22c0 7.2-4.6 12-11 12S5 21.2 5 14z" />
        <path d="M11 9c.4-2 1.2-3.2 1.6-4M16 8c.3-2.2 1-3.6 1.4-4.6M21 9c.2-1.6.8-2.8 1.2-3.6" />
      </svg>
    </span>
  )
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      setReady(true)
      return
    }
    api('/api/auth/me')
      .then(setUser)
      .catch(() => {
        clearToken()
        setUser(null)
      })
      .finally(() => setReady(true))
  }, [])

  const value = useMemo(
    () => ({
      user,
      ready,
      async enter(path, body) {
        const data = await api(path, { method: 'POST', body: JSON.stringify(body) })
        setToken(data.token)
        setUser(data.user)
        return data.user
      },
      exit() {
        clearToken()
        setUser(null)
      },
    }),
    [user, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function RequireAuth({ roles, children }) {
  const { user, ready } = useAuth()
  if (!ready) return <p className="wait">Открываем смену…</p>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />
  return children
}

function Home() {
  const { user, ready } = useAuth()
  if (!ready) return <p className="wait">Открываем смену…</p>
  if (!user) return <Catalog />
  return <Navigate to={ROLE_HOME[user.role]} replace />
}

function Gate({ mode }) {
  const { enter, user, ready } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isRegister = mode === 'register'
  const [restaurant, setRestaurant] = useState(null)

  useEffect(() => {
    if (ready && user) navigate(ROLE_HOME[user.role], { replace: true })
  }, [ready, user, navigate])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = isRegister
        ? (restaurant ? { ...form, restaurant } : form)
        : { email: form.email, password: form.password }
      const next = await enter(isRegister ? (restaurant ? '/api/auth/register/restaurant' : '/api/auth/register') : '/api/auth/login', body)
      navigate(ROLE_HOME[next.role], { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="gate">
      <section className="story">
        <p className="brand"><Mark /> food CRM</p>
        <h1>Заказ идёт одним чеком: казан, курьер, дверь.</h1>
        <p className="lede">
          Клиент собирает чек и следит, где еда. Кухня, курьер и стол видят тот же номер.
        </p>
        <ol className="story-list">
          <li>Шурпа и лагман</li>
          <li>Плов, манты, казан-кебаб</li>
          <li>Самса и чай с чабрецом</li>
        </ol>
      </section>
      <section className="gate-form">
        <h2>{isRegister ? 'Регистрация' : 'Вход'}</h2>
        <p className="hint">
          {isRegister
            ? 'Выберите тип аккаунта.'
            : 'После входа откроется экран вашей роли.'}
        </p>
        <form onSubmit={submit}>
          {isRegister && (
            <>
              <label>Тип аккаунта
                <select value={restaurant ? 'restaurant' : 'client'} onChange={(event) => setRestaurant(event.target.value === 'restaurant' ? {} : null)}>
                  <option value="client">Клиент</option><option value="restaurant">Ресторан</option>
                </select>
              </label>
              <label>
                Имя
                <input value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} required minLength={2} />
              </label>
              <label>
                Телефон
                <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} required minLength={6} />
              </label>
            </>
          )}
          <label>
            Почта
            <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required />
          </label>
          <label>
            Пароль
            <input type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} required minLength={6} />
          </label>
          {isRegister && restaurant && <RestaurantFields value={restaurant} onChange={setRestaurant} />}
          {error && <p className="error">{error}</p>}
          <button className="action" type="submit" disabled={busy}>
            {busy ? 'Секунду…' : isRegister ? 'Создать аккаунт' : 'Войти'}
          </button>
        </form>
        {isRegister ? (
          <p className="switch">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
        ) : (
          <p className="switch">Первый раз? <Link to="/register">Регистрация</Link></p>
        )}
        {!isRegister && (
          <div className="staff">
            <p>Персонал, пароль food-crm-demo</p>
            {[
              ['admin@example.com', 'Стол'],
              ['kitchen@example.com', 'Кухня'],
              ['courier@example.com', 'Маршрут'],
            ].map(([email, label]) => (
              <button key={email} type="button" onClick={() => setField('email', email)}>
                <span>{email}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function Shell({ children }) {
  const { user, exit } = useAuth()
  const navigate = useNavigate()
  const client = user?.role === 'client'

  return (
    <div className="shell">
      <header className="top">
        <Link to={user ? ROLE_HOME[user.role] : '/'} className="brand"><Mark /> food CRM</Link>
        <nav>
          {client ? (
            <>
              <NavLink to="/menu" end>Рестораны</NavLink>
              <NavLink to="/cart">Корзина</NavLink>
              <NavLink to="/orders">Заказы</NavLink>
            </>
          ) : user ? (
            <>
              <span className="role-chip">{ROLE_LABEL[user.role]}</span>
              {user.role === 'restaurant' && <><NavLink to="/kitchen">Заказы</NavLink><NavLink to="/restaurant">Профиль и меню</NavLink></>}
            </>
          ) : (
            <><NavLink to="/login">Войти</NavLink><NavLink to="/register">Регистрация</NavLink></>
          )}
        </nav>
        {user && <div className="who">
          <span>{user.full_name}</span>
          <button
            type="button"
            onClick={() => {
              exit()
              navigate('/login')
            }}
          >
            Выйти
          </button>
        </div>}
      </header>
      {children}
    </div>
  )
}

function Slip({ cart, onQty, onCheckout }) {
  const [address, setAddress] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onCheckout({ address, comment })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <aside className="slip">
      <header>
        <p>Чек</p>
        <strong>{cart.count ? `${cart.count} поз.` : 'пусто'}</strong>
      </header>
      {cart.items.length === 0 ? (
        <p className="empty">Добавьте блюдо — оно встанет в этот чек.</p>
      ) : (
        <ul>
          {cart.items.map((item) => (
            <li key={item.id}>
              <div>
                <b>{item.name}</b>
                <span>{tenge(item.line_total)}</span>
              </div>
              <div className="qty">
                <button type="button" onClick={() => onQty(item.id, item.quantity - 1)} aria-label="Меньше">−</button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => onQty(item.id, item.quantity + 1)} aria-label="Больше">+</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="slip-total"><span>К оплате</span><b>{tenge(cart.total)}</b></p>
      {cart.items.length > 0 && <SplitBill total={cart.total} />}
      <form onSubmit={submit}>
        <label>
          Адрес
          <input value={address} onChange={(e) => setAddress(e.target.value)} minLength={8} required placeholder="Улица, дом, квартира" />
        </label>
        <label>
          Комментарий
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Домофон, без лука" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="action" type="submit" disabled={busy || cart.items.length === 0}>
          {busy ? 'Отправляем…' : 'Отправить на кухню'}
        </button>
      </form>
    </aside>
  )
}

function Catalog() {
  const [restaurants, setRestaurants] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api('/api/restaurants').then(setRestaurants).catch((err) => setError(err.message))
  }, [])

  return (
    <Shell>
      <section className="restaurant-tools">
        <div className="section-head"><h1>Рестораны</h1></div>
        {error && <p className="error">{error}</p>}
        {!error && (restaurants ? !restaurants.length && <p>Пока нет ресторанов.</p> : <p>Загрузка ресторанов…</p>)}
        <div className="restaurant-panels">
          {restaurants?.map((item) => (
            <Link key={item.id} className="slip restaurant-card" to={`/menu/${item.id}`}>
              {item.logo && <img src={item.logo} alt="" />}
              <h2>{item.name}</h2><p>{item.description}</p>
              <p>{item.address} · {item.opening_hours}</p>
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  )
}

function MenuPage({ cartOnly = false }) {
  const { restaurantId } = useParams()
  const { user } = useAuth()
  const [restaurant, setRestaurant] = useState(null)
  const navigate = useNavigate()
  const [menu, setMenu] = useState([])
  const [cart, setCart] = useState({ items: [], total: 0, count: 0 })
  const [category, setCategory] = useState(null)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const loadMenu = cartOnly ? Promise.resolve([null, []]) : Promise.all([
      api('/api/restaurants'), api(`/api/menu/${encodeURIComponent(restaurantId)}`),
    ])
    Promise.all([loadMenu, user ? api('/api/cart') : null])
      .then(([[restaurants, dishes], slip]) => {
        if (!active) return
        const match = restaurants?.find((item) => String(item.id) === restaurantId)
        if (!cartOnly && !match) throw new Error('Ресторан не найден.')
        setRestaurant(match)
        setMenu(dishes)
        if (slip) setCart(slip)
      })
      .catch((err) => { if (active) setError(err.message) })
    return () => { active = false }
  }, [cartOnly, restaurantId, user])

  const categories = [null, ...[...new Set(menu.map((item) => item.category))].sort((a, b) => a.localeCompare(b, 'ru'))]
  const visible = menu.filter((item) => category === null || item.category === category)
  const inCart = Object.fromEntries(cart.items.map((item) => [item.menu_item_id, item.quantity]))

  async function add(id) {
    if (!user) { navigate('/login'); return }
    setError('')
    try {
      setCart(await api('/api/cart', { method: 'POST', body: JSON.stringify({ menu_item_id: id, quantity: 1 }) }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function setQty(id, quantity) {
    const next = Math.max(0, Math.min(20, quantity))
    setError('')
    try {
      setCart(await api(`/api/cart/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity: next }) }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function addSet(ids) {
    if (!user) { navigate('/login'); return false }
    setError('')
    try {
      setCart(await api('/api/cart/set', { method: 'POST', body: JSON.stringify({ menu_item_ids: ids }) }))
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  async function checkout(body) {
    const order = await api('/api/orders', { method: 'POST', body: JSON.stringify(body) })
    navigate(`/orders/${order.id}`)
  }

  return (
    <Shell>
      <div className="shop">
        <section>
          <div className="section-head">
            <h1>{cartOnly ? 'Корзина' : restaurant?.name || 'Меню ресторана'}</h1>
            {restaurant && <p>{restaurant.address} · {restaurant.opening_hours}</p>}
            {!cartOnly && <button type="button" className="wheel-open" onClick={() => setWheelOpen(true)} disabled={menu.length === 0}>
              Не можете выбрать? Колесо фортуны
            </button>}
          </div>
          {!cartOnly && <MysteryMeal menu={menu} onAdd={addSet} />}
          {!cartOnly && <div className="cats">
            {categories.map((name) => (
              <button key={name} type="button" className={name === category ? 'on' : ''} onClick={() => setCategory(name)}>
                {name ?? 'Все'}
              </button>
            ))}
          </div>}
          {error && <p className="error" role="alert">{error}</p>}
          <ul className="dishes">
            {visible.map((dish) => (
              <li key={dish.id}>
                {dish.image ? <img className="dish-photo" src={dish.image} alt="" /> : <i className={`swatch ${dish.tone}`} />}
                <div>
                  <b>{dish.name}</b>
                  <span>{dish.description}</span>
                </div>
                <strong>{tenge(dish.price)}</strong>
                <button type="button" onClick={() => add(dish.id)}>
                  {inCart[dish.id] ? `В чеке ${inCart[dish.id]}` : 'В чек'}
                </button>
              </li>
            ))}
          </ul>
        </section>
        {user && <Slip cart={cart} onQty={setQty} onCheckout={checkout} />}
      </div>
      {wheelOpen && (
        <FortuneWheel dishes={menu} inCart={inCart} onAdd={add} onClose={() => setWheelOpen(false)} />
      )}
    </Shell>
  )
}

function Tracker({ status }) {
  if (status === 'cancelled') return <p className="cancelled">Заказ отменён</p>
  const current = STEPS.findIndex(([key]) => key === status)
  return (
    <ol className="tracker">
      {STEPS.map(([key, label], index) => (
        <li key={key} className={index < current ? 'done' : index === current ? 'now' : ''}>{label}</li>
      ))}
    </ol>
  )
}

function OrdersPage() {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/orders/mine').then(setOrders).catch((err) => setError(err.message))
  }, [])

  return (
    <Shell>
      <section className="board">
        <div className="section-head">
          <h1>Ваши заказы</h1>
          <p>Статус обновляет кухня и курьер. Откройте номер, чтобы видеть путь чека.</p>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="frame">
          {orders === null ? (
            <p className="empty">Сверяем заказы…</p>
          ) : orders.length === 0 ? (
            <p className="empty">Заказов ещё нет. Соберите чек в меню.</p>
          ) : (
            <ul className="order-list">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link to={`/orders/${order.id}`}>
                    <b>{order.number}</b>
                    <span>{when(order.created_at)}</span>
                    <em className={`st st-${order.status}`}>{order.status_label}</em>
                    <strong>{tenge(order.total)}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Shell>
  )
}

function OrderPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stop = false
    async function load() {
      try {
        const data = await api(`/api/orders/${id}`)
        if (!stop) setOrder(data)
      } catch (err) {
        if (!stop) setError(err.message)
      }
    }
    load()
    const timer = setInterval(load, 5000)
    return () => {
      stop = true
      clearInterval(timer)
    }
  }, [id])

  return (
    <Shell>
      <section className="board narrow">
        <Link className="back" to="/orders">Все заказы</Link>
        {error && <p className="error">{error}</p>}
        {!order ? (
          <p className="empty">Ищем чек…</p>
        ) : (
          <article className="ticket">
            <header>
              <div>
                <p>Заказ</p>
                <h1>{order.number}</h1>
              </div>
              <em className={`st st-${order.status}`}>{order.status_label}</em>
            </header>
            <Tracker status={order.status} />
            <p className="meta">{when(order.created_at)} · {order.address}</p>
            {order.comment && <p className="meta">Комментарий: {order.comment}</p>}
            <ul>
              {order.items.map((item) => (
                <li key={item.name}>
                  <span>{item.name} × {item.quantity}</span>
                  <b>{tenge(item.line_total)}</b>
                </li>
              ))}
            </ul>
            <p className="slip-total"><span>Итого</span><b>{tenge(order.total)}</b></p>
          </article>
        )}
      </section>
    </Shell>
  )
}

const NEXT = {
  restaurant: {
    placed: ['cooking', 'На кухню'],
    cooking: ['ready', 'Готово'],
  },
  courier: {
    ready: ['on_the_way', 'Забрал'],
    on_the_way: ['delivered', 'Доставлен'],
  },
}

const DESK = {
  admin: {
    title: 'Стол',
    lead: 'Все живые заказы. Статус пишется в тот же чек, который видит клиент.',
  },
  restaurant: {
    title: 'Кухня',
    lead: 'Новый чек — на огонь. Готовое ждёт курьера.',
  },
  courier: {
    title: 'Маршрут',
    lead: 'Заберите готовое и отметьте, когда отдали в руки.',
  },
}

function WorkPage({ role }) {
  const copy = DESK[role]
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState({})

  async function load() {
    try {
      setOrders(await api('/api/orders/queue'))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [])

  async function move(id, status) {
    setError('')
    try {
      await api(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const open = (orders || []).filter((order) => order.status !== 'delivered' && order.status !== 'cancelled')

  return (
    <Shell>
      <section className="board">
        <div className="section-head">
          <h1>{copy.title}</h1>
          <p>{copy.lead} Сейчас в работе {open.length}.</p>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="frame">
          {orders === null ? (
            <p className="empty">Смотрим очередь…</p>
          ) : orders.length === 0 ? (
            <p className="empty">Пока тихо. Новых заказов нет.</p>
          ) : (
            <ul className="queue">
              {orders.map((order) => {
                const next = NEXT[role]?.[order.status]
                return (
                  <li key={order.id}>
                    <div className="queue-main">
                      <b>{order.number}</b>
                      <span>{order.customer_name} · {order.customer_phone}</span>
                      <span>{order.address}</span>
                      <span>{order.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</span>
                    </div>
                    <em className={`st st-${order.status}`}>{order.status_label}</em>
                    <strong>{tenge(order.total)}</strong>
                    {next && (
                      <button type="button" className="action" onClick={() => move(order.id, next[0])}>{next[1]}</button>
                    )}
                    {role === 'restaurant' && order.status === 'placed' && (
                      <button type="button" className="quiet" onClick={() => move(order.id, 'cancelled')}>Отменить</button>
                    )}
                    {role === 'admin' && order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <form
                        className="status-form"
                        onSubmit={(event) => {
                          event.preventDefault()
                          move(order.id, drafts[order.id] || order.status)
                        }}
                      >
                        <select
                          value={drafts[order.id] || order.status}
                          onChange={(event) => setDrafts((prev) => ({ ...prev, [order.id]: event.target.value }))}
                        >
                          {STEPS.map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                          <option value="cancelled">Отменён</option>
                        </select>
                        <button type="submit">Записать</button>
                      </form>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </Shell>
  )
}

function RestaurantMenuRoute() {
  const { restaurantId } = useParams()
  const { user, ready } = useAuth()
  if (!ready) return <p className="wait">Загрузка меню…</p>
  if (user && user.role !== 'client') return <Navigate to={ROLE_HOME[user.role]} replace />
  return <MenuPage key={restaurantId} />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Gate key="login" mode="login" />} />
        <Route path="/register" element={<Gate key="register" mode="register" />} />
        <Route path="/menu" element={<Catalog />} />
        <Route path="/menu/:restaurantId" element={<RestaurantMenuRoute />} />
        <Route path="/cart" element={<RequireAuth roles={['client']}><MenuPage cartOnly /></RequireAuth>} />
        <Route path="/restaurant" element={<RequireAuth roles={['restaurant']}><Shell><RestaurantDashboard /></Shell></RequireAuth>} />
        <Route path="/orders" element={<RequireAuth roles={['client']}><OrdersPage /></RequireAuth>} />
        <Route path="/orders/:id" element={<RequireAuth roles={['client']}><OrderPage /></RequireAuth>} />
        <Route path="/desk" element={<RequireAuth roles={['admin']}><WorkPage role="admin" /></RequireAuth>} />
        <Route path="/kitchen" element={<RequireAuth roles={['restaurant']}><WorkPage role="restaurant" /></RequireAuth>} />
        <Route path="/route" element={<RequireAuth roles={['courier']}><WorkPage role="courier" /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
