from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models import Category, MenuItem, User
from app.schemas import MenuItemOut

router = APIRouter(prefix="/api/menu", tags=["menu"])


@router.get("", response_model=list[MenuItemOut])
def list_menu(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return menu_items(db)


@router.get("/{restaurant_id}", response_model=list[MenuItemOut])
def restaurant_menu(restaurant_id: int, db: Session = Depends(get_db)):
    return menu_items(db, restaurant_id)


def menu_items(db: Session, restaurant_id: int | None = None):
    query = (
        select(MenuItem)
        .join(MenuItem.category)
        .where(MenuItem.is_available.is_(True))
        .options(selectinload(MenuItem.category))
        .order_by(Category.sort_order, MenuItem.id)
    )
    if restaurant_id is not None:
        query = query.where(MenuItem.restaurant_id == restaurant_id)
    rows = db.scalars(query).all()
    return [
        MenuItemOut(
            id=item.id,
            category=item.category.name,
            name=item.name,
            description=item.description,
            price=item.price,
            tone=item.tone,
            image=item.image,
            kind=item.category.kind,
        )
        for item in rows
    ]
