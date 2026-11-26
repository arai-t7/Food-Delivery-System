from sqlalchemy import inspect, select, text

from app.models import Category, Restaurant, utcnow


def migrate_legacy(engine):
    """Move the shared menu and historical orders to the legacy kitchen."""
    with engine.begin() as conn:
        if "restaurant_id" in {column["name"] for column in inspect(conn).get_columns("categories")}:
            return

        restaurant_id = conn.execute(
            Restaurant.__table__.insert().values(
                name="Демо-кухня", description="Меню с казана", address="Не указан",
                phone="Не указан", opening_hours="Не указаны",
            ).returning(Restaurant.id)
        ).scalar_one()

        # Rebuild categories on SQLite to remove the old global UNIQUE constraint.
        sqlite = conn.dialect.name == "sqlite"
        if sqlite:
            conn.exec_driver_sql("PRAGMA legacy_alter_table = ON")
            try:
                conn.exec_driver_sql("ALTER TABLE categories RENAME TO categories_legacy")
                Category.__table__.create(conn)
            finally:
                conn.exec_driver_sql("PRAGMA legacy_alter_table = OFF")
            rows = conn.execute(text("SELECT id, name, sort_order FROM categories_legacy")).mappings().all()
            for row in rows:
                conn.execute(Category.__table__.insert().values(
                    **row, kind={"Супы": "first", "Салаты": "salad", "Горячее": "main", "Напитки": "drink"}.get(row["name"], "other"), restaurant_id=restaurant_id, name_key=row["name"].casefold(),
                ))
            conn.exec_driver_sql("DROP TABLE categories_legacy")
        else:
            constraints = inspect(conn).get_unique_constraints("categories")
            for constraint in constraints:
                if constraint["column_names"] == ["name"]:
                    name = conn.dialect.identifier_preparer.quote(constraint["name"])
                    conn.exec_driver_sql(f"ALTER TABLE categories DROP CONSTRAINT {name}")
            conn.exec_driver_sql("ALTER TABLE categories ADD COLUMN restaurant_id INTEGER REFERENCES restaurants(id)")
            conn.exec_driver_sql("ALTER TABLE categories ADD COLUMN name_key VARCHAR(240)")
            conn.exec_driver_sql("ALTER TABLE categories ADD COLUMN kind VARCHAR(12) NOT NULL DEFAULT 'other'")
            for column in ("created_at", "updated_at"):
                conn.exec_driver_sql(f"ALTER TABLE categories ADD COLUMN {column} TIMESTAMP WITH TIME ZONE")
            rows = conn.execute(select(Category.id, Category.name)).all()
            for category_id, name in rows:
                conn.execute(Category.__table__.update().where(Category.id == category_id).values(
                    restaurant_id=restaurant_id, name_key=name.casefold(), kind={"Супы": "first", "Салаты": "salad", "Горячее": "main", "Напитки": "drink"}.get(name, "other"), created_at=utcnow(), updated_at=utcnow(),
                ))
            for column in ("restaurant_id", "name_key", "created_at", "updated_at"):
                conn.exec_driver_sql(f"ALTER TABLE categories ALTER COLUMN {column} SET NOT NULL")
            conn.exec_driver_sql("ALTER TABLE categories ADD UNIQUE (restaurant_id, name_key)")
        for table in ("menu_items", "orders"):
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN restaurant_id INTEGER REFERENCES restaurants(id)")
            conn.execute(text(f"UPDATE {table} SET restaurant_id = :id"), {"id": restaurant_id})
        conn.exec_driver_sql("ALTER TABLE menu_items ADD COLUMN image TEXT NOT NULL DEFAULT ''")
        if not sqlite:
            conn.exec_driver_sql("ALTER TABLE menu_items ALTER COLUMN restaurant_id SET NOT NULL")
