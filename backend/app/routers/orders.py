from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import STATUSES, CartItem, Order, OrderItem, Restaurant, User
from app.routers.cart import lock_cart
from app.schemas import CheckoutIn, OrderOut, StatusIn
from app.serializers import order_payload

router = APIRouter(prefix="/api/orders", tags=["orders"])

CLIENT_STEPS = ("placed", "cooking", "ready", "on_the_way", "delivered")

ALLOWED = {
    "restaurant": {("placed", "cooking"), ("cooking", "ready"), ("placed", "cancelled")},
    "courier": {("ready", "on_the_way"), ("on_the_way", "delivered")},
}


def owned_ids(user: User):
    return select(Restaurant.id).where(Restaurant.owner_id == user.id)


def check_restaurant_access(db: Session, user: User, order: Order):
    if user.role == "restaurant":
        restaurant_id = db.scalar(owned_ids(user))
        if restaurant_id is None or order.restaurant_id != restaurant_id:
            raise HTTPException(403, "Это заказ другого ресторана.")


def _load(db: Session, order_id: int) -> Order | None:
    return db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.user))
    )


@router.post("", response_model=OrderOut)
def checkout(body: CheckoutIn, db: Session = Depends(get_db), user: User = Depends(require_roles("client"))):
    lock_cart(db, user.id)
    rows = list(
        db.scalars(
            select(CartItem)
            .where(CartItem.user_id == user.id)
            .options(selectinload(CartItem.menu_item))
        ).all()
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Чек пустой. Добавьте блюдо.")

    restaurants = {row.menu_item.restaurant_id for row in rows}
    if len(restaurants) != 1 or any(not row.menu_item.is_available for row in rows):
        raise HTTPException(409, "Проверьте наличие блюд и выберите один ресторан для заказа.")
    total = sum(row.menu_item.price * row.quantity for row in rows)
    order = Order(
        number=uuid4().hex[:20],
        restaurant_id=restaurants.pop(),
        user_id=user.id,
        status="placed",
        address=body.address.strip(),
        comment=body.comment.strip(),
        total=total,
    )
    db.add(order)
    db.flush()
    order.number = f"FC-{1000 + order.id}"
    for row in rows:
        db.add(
            OrderItem(
                order_id=order.id,
                menu_item_id=row.menu_item_id,
                name=row.menu_item.name,
                price=row.menu_item.price,
                quantity=row.quantity,
            )
        )
        db.delete(row)
    db.commit()
    created = _load(db, order.id)
    return order_payload(created)


@router.get("/mine", response_model=list[OrderOut])
def my_orders(db: Session = Depends(get_db), user: User = Depends(require_roles("client"))):
    rows = db.scalars(
        select(Order)
        .where(Order.user_id == user.id)
        .options(selectinload(Order.items), selectinload(Order.user))
        .order_by(Order.id.desc())
    ).all()
    return [order_payload(order) for order in rows]


@router.get("/queue", response_model=list[OrderOut])
def queue(db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "restaurant", "courier"))):
    query = select(Order).options(selectinload(Order.items), selectinload(Order.user))
    if user.role == "restaurant":
        query = query.where(Order.status.in_(("placed", "cooking", "ready")), Order.restaurant_id.in_(owned_ids(user)))
    elif user.role == "courier":
        query = query.where(Order.status.in_(("ready", "on_the_way")))
    rows = db.scalars(query.order_by(Order.id.desc())).all()
    return [order_payload(order) for order in rows]


@router.get("/{order_id}", response_model=OrderOut)
def one_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    order = _load(db, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заказ не найден.")
    check_restaurant_access(db, user, order)
    if user.role == "client" and order.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Это чужой заказ.")
    return order_payload(order)


@router.patch("/{order_id}/status", response_model=OrderOut)
def set_status(
    order_id: int,
    body: StatusIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "restaurant", "courier")),
):
    if body.status not in STATUSES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Неизвестный статус.")
    order = _load(db, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заказ не найден.")
    check_restaurant_access(db, user, order)
    if user.role != "admin" and (order.status, body.status) not in ALLOWED[user.role]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Так статус сменить нельзя.")
    if body.status == "cancelled" and order.status in {"delivered", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Этот заказ уже закрыт.")
    order.status = body.status
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    return order_payload(_load(db, order.id))
