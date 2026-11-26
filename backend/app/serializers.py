from app.models import STATUS_LABELS, CartItem, Order


def cart_payload(rows: list[CartItem]) -> dict:
    items = []
    total = 0
    count = 0
    for row in rows:
        line_total = row.menu_item.price * row.quantity
        total += line_total
        count += row.quantity
        items.append(
            {
                "id": row.id,
                "menu_item_id": row.menu_item_id,
                "name": row.menu_item.name,
                "price": row.menu_item.price,
                "quantity": row.quantity,
                "line_total": line_total,
            }
        )
    return {"items": items, "total": total, "count": count}


def order_payload(order: Order) -> dict:
    return {
        "id": order.id,
        "number": order.number,
        "restaurant_id": order.restaurant_id,
        "status": order.status,
        "status_label": STATUS_LABELS.get(order.status, order.status),
        "address": order.address,
        "comment": order.comment,
        "total": order.total,
        "created_at": order.created_at,
        "customer_name": order.user.full_name,
        "customer_phone": order.user.phone,
        "items": [
            {
                "name": item.name,
                "price": item.price,
                "quantity": item.quantity,
                "line_total": item.price * item.quantity,
            }
            for item in order.items
        ],
    }
