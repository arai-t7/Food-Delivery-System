from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Restaurant, User
from app.schemas import AuthOut, LoginIn, RegisterIn, RestaurantIn, RestaurantRegisterIn, UserOut
from app.security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _email(value: str) -> str:
    email = value.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Укажите почту целиком.")
    return email


@router.post("/register", response_model=AuthOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    return _register(body, db)


@router.post("/register/restaurant", response_model=AuthOut)
def register_restaurant(body: RestaurantRegisterIn, db: Session = Depends(get_db)):
    return _register(body, db, body.restaurant)


def _register(body: RegisterIn, db: Session, restaurant: RestaurantIn | None = None):
    email = _email(body.email)
    taken = db.scalar(select(User.id).where(func.lower(User.email) == email))
    if taken:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Такая почта уже зарегистрирована.")
    user = User(
        email=email,
        phone=body.phone.strip(),
        full_name=body.full_name.strip(),
        password_hash=hash_password(body.password),
        role="restaurant" if restaurant else "client",
    )
    db.add(user)
    try:
        db.flush()
        if restaurant:
            db.add(Restaurant(owner_id=user.id, **restaurant.model_dump()))
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Такая почта уже зарегистрирована.") from exc
    db.refresh(user)
    return AuthOut(token=create_token(user.id, user.role), user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверная почта или пароль.")
    return AuthOut(token=create_token(user.id, user.role), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
