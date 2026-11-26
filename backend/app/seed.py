from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Category, MenuItem, Restaurant, User
from app.security import hash_password

MENU = [
    ("Супы", 1, [
        ("Шурпа", "Баранина, нут, редька, зелень", 2200, "broth"),
        ("Лагман", "Тянутая лапша, баранина, перец", 2400, "clay"),
        ("Мампар", "Домашняя лапша, баранина, картофель, зелень", 2300, "broth"),
        ("Сорпа", "Крепкий бульон, конина, лук, укроп", 2000, "broth"),
        ("Нарын-суп", "Конина, тонкая лапша, лук, бульон", 2800, "ember"),
    ]),
    ("Салаты", 2, [
        ("Ачичук", "Помидор, лук, сладкий перец, зелень", 1300, "ember"),
        ("Чимчи", "Корейская морковь, огурец, перец, кунжут", 1200, "clay"),
        ("Салат Ташкент", "Говядина, редька, лук, яйцо, майонез", 1800, "gold"),
        ("Свежий овощной", "Огурец, помидор, редис, сметана", 1100, "herb"),
        ("Греческий", "Фета, оливки, огурец, помидор, орегано", 1900, "herb"),
        ("Цезарь с курицей", "Ромэн, курица, пармезан, сухарики, соус", 2100, "gold"),
        ("Оливье", "Колбаса, картофель, горошек, огурец, яйцо", 1400, "broth"),
        ("Салат с баклажанами", "Жареный баклажан, перец, чеснок, кинза", 1700, "ember"),
        ("Хрустящие баклажаны", "Баклажан, помидор, сладкий соус, кунжут", 1800, "clay"),
        ("Салат из свёклы", "Запечённая свёкла, грецкий орех, чеснок", 1300, "ember"),
        ("Фунчоза", "Стеклянная лапша, овощи, говядина, соус", 1900, "broth"),
        ("Салат с копчёной курицей", "Курица, огурец, кукуруза, яйцо, сыр", 1700, "gold"),
    ]),
    ("Горячее", 3, [
        ("Плов чабанский", "Рис девзира, баранина, айва", 2600, "gold"),
        ("Манты", "Четыре штуки, лук, чёрный перец", 2100, "clay"),
        ("Казан-кебаб", "Баранина куском, картофель", 3200, "ember"),
        ("Бешбармак", "Конина, отварное тесто, лук, бульон", 3500, "broth"),
        ("Лагман жареный (гуйру)", "Лапша, говядина, овощи, зира", 2500, "clay"),
        ("Шашлык из баранины", "Мякоть на углях, лук, соус", 2900, "ember"),
        ("Дымляма", "Баранина, картофель, капуста, морковь", 2700, "gold"),
        ("Жаркоп", "Тушёная баранина с картофелем и луком", 2800, "clay"),
    ]),
    ("Выпечка", 4, [
        ("Самса с бараниной", "Слоёное тесто, курдюк, зира", 700, "gold"),
        ("Лепёшка тандыр", "Тёплая, с кунжутом", 400, "clay"),
        ("Баурсаки", "Пышные, жареные, шесть штук", 800, "gold"),
        ("Самса с тыквой", "Слоёное тесто, тыква, лук", 600, "gold"),
        ("Чак-чак", "Тесто, мёд, орехи", 1100, "broth"),
    ]),
    ("Напитки", 5, [
        ("Чай с чабрецом", "Чёрный чай, чабрец, изюм", 600, "herb"),
        ("Айран", "Солёный, холодный", 500, "herb"),
        ("Кумыс", "Кобылье молоко, прохладный", 900, "broth"),
        ("Шубат", "Верблюжье молоко, лёгкая кислинка", 1000, "broth"),
        ("Компот из кураги", "Курага, изюм, яблоко", 500, "gold"),
    ]),
]

STAFF = [
    ("admin@example.com", "+7 700 000 00 01", "Айгуль Серик", "admin"),
    ("kitchen@example.com", "+7 700 000 00 02", "Демо-кухня", "restaurant"),
    ("courier@example.com", "+7 700 000 00 03", "Данияр Кулов", "courier"),
]


def seed(db: Session) -> None:
    if settings.seed_demo and db.scalar(select(User.id).where(User.role != "client").limit(1)) is None:
        for email, phone, full_name, role in STAFF:
            exists = db.scalar(select(User.id).where(User.email == email))
            if exists:
                continue
            db.add(
                User(
                    email=email,
                    phone=phone,
                    full_name=full_name,
                    password_hash=hash_password("food-crm-demo"),
                    role=role,
                )
            )
    db.flush()
    kitchen = db.scalar(select(User).where(User.email == "kitchen@example.com", User.role == "restaurant"))
    demo = db.get(Restaurant, 1)
    if demo is None:
        demo = Restaurant(
            name="Демо-кухня", description="Меню с казана", address="Не указан",
            phone="Не указан", opening_hours="Не указаны",
        )
        db.add(demo)
        db.flush()
        populate_menu = True
    else:
        populate_menu = False
    if kitchen and demo.owner_id is None:
        demo.owner_id = kitchen.id
    kinds = {"Супы": "first", "Салаты": "salad", "Горячее": "main", "Напитки": "drink"}
    for name, sort_order, dishes in MENU:
        category = db.scalar(select(Category).where(Category.restaurant_id == demo.id, Category.name == name))
        if category is None and populate_menu:
            category = Category(restaurant_id=demo.id, name=name, name_key=name.casefold(),
                                sort_order=sort_order, kind=kinds.get(name, "other"))
            db.add(category)
            db.flush()
            for dish_name, description, price, tone in dishes:
                db.add(MenuItem(restaurant_id=demo.id, category_id=category.id, name=dish_name,
                                description=description, price=price, tone=tone))
    db.commit()
