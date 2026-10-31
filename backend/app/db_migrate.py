"""
db_migrate.py - Auto-migrate SQLite schema in development.
Ensures newly added model columns exist in the SQLite database without requiring a manual reset.
"""
import sqlite3
from sqlalchemy import inspect
from app.database import engine, Base
import app.models  # noqa: F401


def auto_migrate_sqlite():
    """Add any missing columns defined in SQLAlchemy models to SQLite tables."""
    if not str(engine.url).startswith("sqlite"):
        return

    Base.metadata.create_all(bind=engine)
    
    db_file = engine.url.database
    if not db_file or db_file == ":memory:":
        return

    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    inspector = inspect(engine)
    
    for table_name, table in Base.metadata.tables.items():
        if not inspector.has_table(table_name):
            continue
            
        existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
        
        for col in table.columns:
            if col.name not in existing_cols:
                col_type = col.type.compile(engine.dialect)
                default_clause = ""
                if col.default is not None and hasattr(col.default, "arg"):
                    arg = col.default.arg
                    if isinstance(arg, bool):
                        default_clause = f" DEFAULT {1 if arg else 0}"
                    elif isinstance(arg, (int, float)):
                        default_clause = f" DEFAULT {arg}"
                    elif isinstance(arg, str):
                        default_clause = f" DEFAULT '{arg}'"
                elif col.nullable:
                    default_clause = " DEFAULT NULL"
                elif str(col_type).upper().startswith("BOOL"):
                    default_clause = " DEFAULT 0"
                elif str(col_type).upper().startswith("VARCHAR") or str(col_type).upper().startswith("TEXT"):
                    default_clause = " DEFAULT ''"

                alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}{default_clause}"
                try:
                    cursor.execute(alter_sql)
                    print(f"[db_migrate] Added column {col.name} to {table_name}")
                except sqlite3.OperationalError as e:
                    print(f"[db_migrate] Note for {table_name}.{col.name}: {e}")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    auto_migrate_sqlite()
