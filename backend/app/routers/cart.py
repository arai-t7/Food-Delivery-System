from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import require_roles
from app.models import CartItem, MenuItem, User
from app.schemas import CartAddIn, CartOut, CartQtyIn, CartSetIn
from app.serializers import cart_payload

router = APIRouter(prefix="/api/cart", tags=["cart"])


def lock_cart(db: Session, user_id: int):
    # Serialize cart mutations and checkout for the same client.
    db.execute(update(User).where(User.id == user_id).values(id=User.id))


def _cart(db: Session, user_id: int) -> list[CartItem]:
    return list(
        db.scalars(
            select(CartItem)
            .where(CartItem.user_id == user_id)
            .options(selectinload(CartItem.menu_item))
            .order_by(CartItem.id)
        ).all()
    )


@router.get("", response_model=CartOut)
def get_cart(db: Session = Depends(get_db), user: User = Depends(require_roles("client"))):
    return cart_payload(_cart(db, user.id))


@router.post("", response_model=CartOut)
def add_to_cart(body: CartAddIn, db: Session = Depends(get_db), user: User = Depends(require_roles("client"))):
    return add_dishes(db, user, {body.menu_item_id: body.quantity})


@router.post("/set", response_model=CartOut)
def add_set(body: CartSetIn, db: Session = Depends(get_db), user: User = Depends(require_roles("client"))):
    if len(set(body.menu_item_ids)) != len(body.menu_item_ids):
        raise HTTPException(422, "Выберите разные блюда для набора.")
    return add_dishes(db, user, dict.fromkeys(body.menu_item_ids, 1), strict=True)


def add_dishes(db: Session, user: User, quantities: dict[int, int], strict=False):
    lock_cart(db, user.id)
    dishes = db.scalars(select(MenuItem).where(
        MenuItem.id.in_(quantities), MenuItem.is_available.is_(True),
    )).all()
    if len(dishes) != len(quantities):
        raise HTTPException(404, "Одного из блюд сейчас нет в меню.")
    rows = _cart(db, user.id)
    restaurants = {dish.restaurant_id for dish in dishes}
    restaurants.update(row.menu_item.restaurant_id for row in rows)
    if len(restaurants) != 1:
        raise HTTPException(409, "В одном чеке могут быть блюда только одного ресторана.")
    existing = {row.menu_item_id: row for row in rows}
    for dish in dishes:
        quantity = quantities[dish.id]
        row = existing.get(dish.id)
        if row is None:
            db.add(CartItem(user_id=user.id, menu_item_id=dish.id, quantity=quantity))
        elif strict and row.quantity + quantity > 20:
            raise HTTPException(409, "В чеке уже слишком много порций одного из блюд.")
        else:
            row.quantity = min(20, row.quantity + quantity)
    db.commit()
    return cart_payload(_cart(db, user.id))


@router.patch("/{item_id}", response_model=CartOut)
def update_qty(
    item_id: int,
    body: CartQtyIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("client")),
):
    lock_cart(db, user.id)
    row = db.scalar(select(CartItem).where(CartItem.id == item_id, CartItem.user_id == user.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Позиции нет в чеке.")
    if body.quantity == 0:
        db.delete(row)
    else:
        row.quantity = body.quantity
    db.commit()
    return cart_payload(_cart(db, user.id))
