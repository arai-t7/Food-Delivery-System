from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=6, max_length=32)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str
    role: str

    model_config = {"from_attributes": True}


class AuthOut(BaseModel):
    token: str
    user: UserOut


class MenuItemOut(BaseModel):
    image: str = ""
    kind: str = "other"
    id: int
    category: str
    name: str
    description: str
    price: int
    tone: str


class CartAddIn(BaseModel):
    menu_item_id: int
    quantity: int = Field(default=1, ge=1, le=20)


class CartQtyIn(BaseModel):
    quantity: int = Field(ge=0, le=20)


class CartLineOut(BaseModel):
    id: int
    menu_item_id: int
    name: str
    price: int
    quantity: int
    line_total: int


class CartOut(BaseModel):
    items: list[CartLineOut]
    total: int
    count: int


class CheckoutIn(BaseModel):
    address: str = Field(min_length=8, max_length=240)
    comment: str = Field(default="", max_length=400)


class OrderItemOut(BaseModel):
    name: str
    price: int
    quantity: int
    line_total: int


class OrderOut(BaseModel):
    restaurant_id: int | None = None
    id: int
    number: str
    status: str
    status_label: str
    address: str
    comment: str
    total: int
    created_at: datetime
    customer_name: str
    customer_phone: str
    items: list[OrderItemOut]


class StatusIn(BaseModel):
    status: str


class RestaurantIn(BaseModel):
    model_config = {"str_strip_whitespace": True}

    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=4000)
    address: str = Field(min_length=1, max_length=240)
    phone: str = Field(min_length=6, max_length=32)
    opening_hours: str = Field(min_length=1, max_length=120)
    logo: str = Field(default="", max_length=2048, pattern=r"^(https?://\S+)?$")


class RestaurantOut(RestaurantIn):
    id: int
    model_config = {"from_attributes": True}


class RestaurantRegisterIn(RegisterIn):
    restaurant: RestaurantIn


class CategoryIn(BaseModel):
    model_config = {"str_strip_whitespace": True}

    name: str = Field(min_length=1, max_length=80)
    kind: Literal["other", "drink", "salad", "first", "main"] = "other"


class CategoryOut(CategoryIn):
    id: int
    restaurant_id: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class DishIn(BaseModel):
    model_config = {"str_strip_whitespace": True}

    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=4000)
    price: int = Field(ge=1, le=100000000)
    category_id: int
    image: str = Field(default="", max_length=2048, pattern=r"^(https?://\S+)?$")
    is_available: bool = True


class DishOut(DishIn):
    id: int
    restaurant_id: int
    model_config = {"from_attributes": True}


class CartSetIn(BaseModel):
    menu_item_ids: list[int] = Field(min_length=1, max_length=4)
