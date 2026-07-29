-- 1. Markiere offene Bestellungen, die ausschliesslich alte Produkte enthalten, als cancelled
WITH old_products AS (
  SELECT id FROM products WHERE category IN (
    'Bier','Cocktails','Hot','Mocktails','Pizza - 50cm','Shots','Snacks','Softdrinks','Wein'
  )
),
orders_with_old_items AS (
  SELECT oi.order_id, bool_and(oi.product_id IN (SELECT id FROM old_products)) AS only_old
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status NOT IN ('paid','cancelled')
  GROUP BY oi.order_id
),
orders_to_cancel AS (
  SELECT order_id FROM orders_with_old_items WHERE only_old = true
)
DELETE FROM orders WHERE id IN (SELECT order_id FROM orders_to_cancel);

-- 2. Lösche die verbleibenden Order-Items, die auf alte Produkte verweisen (Sicherheit, falls Bestellungen gemischt waren)
DELETE FROM order_items
WHERE product_id IN (
  SELECT id FROM products WHERE category IN (
    'Bier','Cocktails','Hot','Mocktails','Pizza - 50cm','Shots','Snacks','Softdrinks','Wein'
  )
);

-- 3. Lösche die alten Produkte endgültig
DELETE FROM products
WHERE category IN (
  'Bier','Cocktails','Hot','Mocktails','Pizza - 50cm','Shots','Snacks','Softdrinks','Wein'
);
