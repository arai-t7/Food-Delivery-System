import { useEffect, useState } from 'react'
import { api, tenge } from './api'

const profileFields = [
  ['name', 'Название'], ['description', 'Описание'], ['address', 'Адрес'],
  ['phone', 'Телефон'], ['opening_hours', 'Часы работы'], ['logo', 'Ссылка на логотип', 'url'],
]
const dishFields = [
  ['name', 'Название'], ['description', 'Описание'], ['price', 'Цена, ₸', 'number'],
  ['image', 'Ссылка на фото', 'url'],
]
const kinds = {
  other: 'Другое', drink: 'Напиток', salad: 'Салат', first: 'Первое', main: 'Второе',
}

export function RestaurantFields({ value, onChange }) {
  return <Fields fields={profileFields} value={value} onChange={onChange} />
}

function Fields({ fields, value, onChange }) {
  return fields.map(([key, label, type = 'text']) => (
    <label key={key}>{label}
      <input type={type} min={type === 'number' ? 1 : undefined}
        minLength={key === 'phone' ? 6 : undefined} required={type !== 'url'}
        value={value[key] ?? ''} onChange={(event) => onChange({ ...value, [key]: event.target.value })} />
    </label>
  ))
}

const blankCategory = { name: '', kind: 'other' }
const blankDish = { name: '', description: '', image: '', price: '', category_id: '', is_available: true }

export function RestaurantDashboard() {
  const [profile, setProfile] = useState(null)
  const [categories, setCategories] = useState([])
  const [dishes, setDishes] = useState([])
  const [category, setCategory] = useState(blankCategory)
  const [dish, setDish] = useState(blankDish)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/api/restaurants/mine').then(async (restaurant) => {
      setProfile(restaurant)
      const [nextCategories, nextDishes] = await Promise.all([
        api(`/api/restaurants/${restaurant.id}/categories`), api('/api/restaurants/mine/dishes'),
      ])
      setCategories(nextCategories)
      setDishes(nextDishes)
    }).catch((err) => setError(err.message))
  }, [])

  async function save(path, method, body, onSaved) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await api(`/api/restaurants/mine${path}`, {
        method, body: body === undefined ? undefined : JSON.stringify(body),
      })
      await onSaved(result)
      setMessage(method === 'DELETE' ? 'Удалено.' : 'Сохранено.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function reloadCategories() {
    setCategories(await api(`/api/restaurants/${profile.id}/categories`))
    setCategory(blankCategory)
  }

  async function reloadDishes() {
    setDishes(await api('/api/restaurants/mine/dishes'))
    setDish(blankDish)
  }

  if (!profile) return <p className={error ? 'error' : 'wait'}>{error || 'Загрузка профиля…'}</p>

  return (
    <section className="restaurant-tools">
      <div className="section-head"><h1>Управление рестораном</h1></div>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="restaurant-panels">
        <section className="slip">
          <h2>Профиль</h2>
          <form onSubmit={(event) => { event.preventDefault(); save('', 'PUT', profile, setProfile) }}>
            <RestaurantFields value={profile} onChange={setProfile} />
            <button className="action" disabled={busy}>Сохранить профиль</button>
          </form>
        </section>
        <section className="slip">
          <h2>Категории</h2>
          <form onSubmit={(event) => {
            event.preventDefault()
            save(category.id ? `/categories/${category.id}` : '/categories', category.id ? 'PUT' : 'POST', category, reloadCategories)
          }}>
            <Fields fields={[[ 'name', 'Название категории' ]]} value={category} onChange={setCategory} />
            <label>Тип для Mystery Meal
              <select value={category.kind} onChange={(event) => setCategory({ ...category, kind: event.target.value })}>
                {Object.entries(kinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <button className="action" disabled={busy}>{category.id ? 'Сохранить категорию' : 'Добавить категорию'}</button>
            {category.id && <button type="button" onClick={() => setCategory(blankCategory)}>Отмена</button>}
          </form>
          <ul>{categories.map((item) => (
            <li key={item.id}>
              <div><b>{item.name}</b><span>{kinds[item.kind]}</span></div>
              <div className="cats">
                <button type="button" onClick={() => setCategory(item)}>Изменить</button>
                <button type="button" disabled={busy} onClick={() => save(`/categories/${item.id}`, 'DELETE', undefined, reloadCategories)}>Удалить</button>
              </div>
            </li>
          ))}</ul>
        </section>
        <section className="slip">
          <h2>Блюда</h2>
          <form onSubmit={(event) => {
            event.preventDefault()
            save(dish.id ? `/dishes/${dish.id}` : '/dishes', dish.id ? 'PUT' : 'POST', dish, reloadDishes)
          }}>
            <Fields fields={dishFields} value={dish} onChange={setDish} />
            <label>Категория
              <select required value={dish.category_id} onChange={(event) => setDish({ ...dish, category_id: event.target.value })}>
                <option value="">Выберите категорию</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label><input className="inline-check" type="checkbox" checked={dish.is_available}
              onChange={(event) => setDish({ ...dish, is_available: event.target.checked })} /> В наличии</label>
            <button className="action" disabled={busy || !categories.length}>{dish.id ? 'Сохранить блюдо' : 'Добавить блюдо'}</button>
            {dish.id && <button type="button" onClick={() => setDish(blankDish)}>Отмена</button>}
          </form>
          <ul>{dishes.map((item) => (
            <li key={item.id}>
              <div><b>{item.name}</b><span>{tenge(item.price)} · {item.is_available ? 'В наличии' : 'Нет в наличии'}</span></div>
              <div className="cats">
                <button type="button" onClick={() => setDish(item)}>Изменить</button>
                <button type="button" disabled={busy} onClick={() => save(`/dishes/${item.id}`, 'DELETE', undefined, reloadDishes)}>Удалить</button>
              </div>
            </li>
          ))}</ul>
        </section>
      </div>
    </section>
  )
}

export function SplitBill({ total }) {
  const [people, setPeople] = useState('2')
  const count = Number(people)
  const valid = Number.isSafeInteger(count) && count >= 1
  const base = valid ? Math.floor(total / count) : 0
  const extra = valid ? total % count : 0

  return (
    <div className="bill-split">
      <label>Разделить счёт на
        <input type="number" min="1" value={people} onChange={(event) => setPeople(event.target.value)} />
      </label>
      {valid && <p aria-live="polite">{extra
        ? `${extra} чел. по ${tenge(base + 1)}, ${count - extra} чел. по ${tenge(base)}`
        : `По ${tenge(base)} на человека`}</p>}
    </div>
  )
}

const sets = {
  main: ['drink', 'salad', 'main'],
  first: ['drink', 'salad', 'first'],
  both: ['drink', 'salad', 'first', 'main'],
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)]
}

export function MysteryMeal({ menu, onAdd }) {
  const [budget, setBudget] = useState('')
  const [mode, setMode] = useState('single')
  const [category, setCategory] = useState('')
  const [structure, setStructure] = useState('main')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  function generate(event) {
    event.preventDefault()
    const limit = Number(budget)
    if (mode === 'single') {
      const dish = pick(menu.filter((item) => item.price <= limit && (!category || item.category === category)))
      setResult(dish ? [dish] : [])
      return
    }

    const groups = sets[structure].map((kind) => menu.filter((item) => item.kind === kind))
    const minimums = groups.map((group) => group.reduce((min, item) => Math.min(min, item.price), Infinity))
    if (minimums.reduce((sum, price) => sum + price, 0) > limit) {
      setResult([])
      return
    }

    let remaining = limit
    setResult(groups.map((group, index) => {
      const reserve = minimums.slice(index + 1).reduce((sum, price) => sum + price, 0)
      const dish = pick(group.filter((item) => item.price <= remaining - reserve))
      remaining -= dish.price
      return dish
    }))
  }

  return (
    <details className="slip mystery">
      <summary>Mystery Meal</summary>
      <form onSubmit={generate} onChange={() => setResult(null)}>
        <label>Бюджет, ₸ <input type="number" min="1" required value={budget} onChange={(event) => setBudget(event.target.value)} /></label>
        <label>Что подобрать
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="single">Одну позицию</option><option value="set">Набор</option>
          </select>
        </label>
        {mode === 'single' ? (
          <label>Категория
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Любая</option>
              {[...new Set(menu.map((item) => item.category))].map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
        ) : (
          <label>Состав набора
            <select value={structure} onChange={(event) => setStructure(event.target.value)}>
              {Object.entries(sets).map(([key, group]) => <option key={key} value={key}>{group.map((kind) => kinds[kind]).join(' + ')}</option>)}
            </select>
          </label>
        )}
        <button className="action" disabled={busy}>{result ? 'Подобрать снова' : 'Подобрать'}</button>
      </form>
      {result && (result.length ? (
        <>
          <ul>{result.map((item) => <li key={item.id}><div><b>{item.name}</b><span>{tenge(item.price)}</span></div></li>)}</ul>
          <p>Итого {tenge(result.reduce((sum, item) => sum + item.price, 0))}</p>
          <button type="button" className="action" disabled={busy} onClick={async () => {
            setBusy(true)
            try {
              if (await onAdd(result.map((item) => item.id))) setResult(null)
            } finally {
              setBusy(false)
            }
          }}>Добавить в чек</button>
        </>
      ) : <p role="status">Подходящих блюд нет. Увеличьте бюджет или измените категорию или состав набора.</p>)}
    </details>
  )
}
