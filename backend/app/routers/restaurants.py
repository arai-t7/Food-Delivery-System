from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models import CartItem, Category, MenuItem, OrderItem, Restaurant, User
from app.schemas import CategoryIn, CategoryOut, DishIn, DishOut, RestaurantIn, RestaurantOut

router = APIRouter(prefix="/api/restaurants", tags=["restaurants"])


def owned_restaurant(db: Session, user: User) -> Restaurant:
    restaurant = db.scalar(select(Restaurant).where(Restaurant.owner_id == user.id))
    if restaurant is None:
        raise HTTPException(404, "Профиль ресторана не найден.")
    return restaurant


def owner_profile(db: Session = Depends(get_db), user: User = Depends(require_roles("restaurant"))):
    return owned_restaurant(db, user)


def get_for_restaurant(db, model, item_id, restaurant_id):
    item = db.scalar(select(model).where(model.id == item_id, model.restaurant_id == restaurant_id))
    if item is None:
        raise HTTPException(404, "Запись не найдена в этом ресторане.")
    return item


def save_category(db, category, body):
    category.name = body.name
    category.name_key = body.name.casefold()
    category.kind = body.kind
    db.add(category)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Категория с таким названием уже есть.") from exc
    return category


@router.get("", response_model=list[RestaurantOut])
def restaurants(db: Session = Depends(get_db)):
    return db.scalars(select(Restaurant).order_by(Restaurant.name, Restaurant.id)).all()


@router.get("/mine", response_model=RestaurantOut)
def my_profile(restaurant: Restaurant = Depends(owner_profile)):
    return restaurant


@router.put("/mine", response_model=RestaurantOut)
def edit_profile(body: RestaurantIn, db: Session = Depends(get_db), restaurant: Restaurant = Depends(owner_profile)):
    for key, value in body.model_dump().items():
        setattr(restaurant, key, value)
    db.commit()
    return restaurant


@router.get("/mine/dishes", response_model=list[DishOut])
def my_dishes(db: Session = Depends(get_db), restaurant: Restaurant = Depends(owner_profile)):
    return db.scalars(select(MenuItem).where(MenuItem.restaurant_id == restaurant.id).order_by(MenuItem.id)).all()


@router.post("/mine/dishes", response_model=DishOut, status_code=201)
def add_dish(body: DishIn, db: Session = Depends(get_db), restaurant: Restaurant = Depends(owner_profile)):
    get_for_restaurant(db, Category, body.category_id, restaurant.id)
    dish = MenuItem(restaurant_id=restaurant.id, **body.model_dump())
    db.add(dish)
    db.commit()
    return dish


@router.put("/mine/dishes/{dish_id}", response_model=DishOut)
def edit_dish(dish_id: int, body: DishIn, db: Session = Depends(get_db),
              restaurant: Restaurant = Depends(owner_profile)):
    dish = get_for_restaurant(db, MenuItem, dish_id, restaurant.id)
    get_for_restaurant(db, Category, body.category_id, restaurant.id)
    for key, value in body.model_dump().items():
        setattr(dish, key, value)
    db.commit()
    return dish


@router.delete("/mine/dishes/{dish_id}", status_code=204)
def remove_dish(dish_id: int, db: Session = Depends(get_db), restaurant: Restaurant = Depends(owner_profile)):
    dish = get_for_restaurant(db, MenuItem, dish_id, restaurant.id)
    db.execute(delete(CartItem).where(CartItem.menu_item_id == dish.id))
    db.execute(update(OrderItem).where(OrderItem.menu_item_id == dish.id).values(menu_item_id=None))
    db.delete(dish)
    db.commit()


@router.get("/{restaurant_id}/categories", response_model=list[CategoryOut])
def categories(restaurant_id: int, db: Session = Depends(get_db)):
    if db.get(Restaurant, restaurant_id) is None:
        raise HTTPException(404, "Ресторан не найден.")
    rows = db.scalars(select(Category).where(Category.restaurant_id == restaurant_id))
    return sorted(rows, key=lambda category: category.name_key)


@router.post("/mine/categories", response_model=CategoryOut, status_code=201)
def add_category(body: CategoryIn, db: Session = Depends(get_db), restaurant: Restaurant = Depends(owner_profile)):
    return save_category(db, Category(restaurant_id=restaurant.id), body)


@router.put("/mine/categories/{category_id}", response_model=CategoryOut)
def edit_category(category_id: int, body: CategoryIn, db: Session = Depends(get_db),
                  restaurant: Restaurant = Depends(owner_profile)):
    return save_category(db, get_for_restaurant(db, Category, category_id, restaurant.id), body)


@router.delete("/mine/categories/{category_id}", status_code=204)
def remove_category(category_id: int, db: Session = Depends(get_db), restaurant: Restaurant = Depends(owner_profile)):
    category = get_for_restaurant(db, Category, category_id, restaurant.id)
    if category.items:
        raise HTTPException(409, "Сначала перенесите или удалите блюда этой категории.")
    db.delete(category)
    db.commit()
