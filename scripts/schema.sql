CREATE SCHEMA IF NOT EXISTS palace;
CREATE TABLE IF NOT EXISTS palace.menu_items (
 id uuid PRIMARY KEY, category text NOT NULL, name text NOT NULL, description text NOT NULL DEFAULT '',
 price_cents integer NOT NULL CHECK(price_cents >= 0), printer text NOT NULL DEFAULT 'kitchen' CHECK(printer IN ('kitchen','cashier')),
 stock integer CHECK(stock >= 0), active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS palace.cashiers (
 id uuid PRIMARY KEY, name text NOT NULL, pin char(4) NOT NULL UNIQUE CHECK(pin ~ '^[0-9]{4}$'), password_hash text NOT NULL,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS palace.staff_sessions (
 token_hash text PRIMARY KEY, role text NOT NULL CHECK(role IN ('admin','cashier')), cashier_id uuid REFERENCES palace.cashiers(id),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS palace.login_attempts (
 key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS palace.table_sessions (
 id uuid PRIMARY KEY, table_number integer NOT NULL CHECK(table_number BETWEEN 1 AND 999),
 opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, closed_by text
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_session_per_table ON palace.table_sessions(table_number) WHERE closed_at IS NULL;
CREATE TABLE IF NOT EXISTS palace.orders (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES palace.table_sessions(id), request_key uuid NOT NULL UNIQUE,
 tracking_hash text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
 notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, decided_by text
);
CREATE TABLE IF NOT EXISTS palace.order_items (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES palace.orders(id), menu_item_id uuid NOT NULL REFERENCES palace.menu_items(id),
 name text NOT NULL, price_cents integer NOT NULL CHECK(price_cents >= 0), quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 50),
 printer text NOT NULL CHECK(printer IN ('kitchen','cashier'))
);
CREATE INDEX IF NOT EXISTS orders_session_idx ON palace.orders(session_id);
CREATE INDEX IF NOT EXISTS orders_pending_idx ON palace.orders(created_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS order_items_order_idx ON palace.order_items(order_id);

-- Durable revision catches missed notifications and supports pooled connections.
CREATE TABLE IF NOT EXISTS palace.live_revision (
 id integer PRIMARY KEY CHECK (id = 1), revision bigint NOT NULL DEFAULT 0
);
INSERT INTO palace.live_revision(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION palace.notify_change() RETURNS trigger AS $$
BEGIN
 UPDATE palace.live_revision SET revision=revision+1 WHERE id=1;
 PERFORM pg_notify('palace_changes', 'changed');
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS live_change ON palace.orders;
CREATE TRIGGER live_change AFTER INSERT OR UPDATE OR DELETE ON palace.orders
 FOR EACH STATEMENT EXECUTE FUNCTION palace.notify_change();
DROP TRIGGER IF EXISTS live_change ON palace.table_sessions;
CREATE TRIGGER live_change AFTER INSERT OR UPDATE OR DELETE ON palace.table_sessions
 FOR EACH STATEMENT EXECUTE FUNCTION palace.notify_change();
DROP TRIGGER IF EXISTS live_change ON palace.menu_items;
CREATE TRIGGER live_change AFTER INSERT OR UPDATE OR DELETE ON palace.menu_items
 FOR EACH STATEMENT EXECUTE FUNCTION palace.notify_change();

-- Prevent an old admin form from overwriting stock deducted during service.
ALTER TABLE palace.menu_items ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
CREATE OR REPLACE FUNCTION palace.menu_version() RETURNS trigger AS $$
BEGIN
 NEW.version = OLD.version + 1;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS bump_version ON palace.menu_items;
CREATE TRIGGER bump_version BEFORE UPDATE ON palace.menu_items
 FOR EACH ROW EXECUTE FUNCTION palace.menu_version();
