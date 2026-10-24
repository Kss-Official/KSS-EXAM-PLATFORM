---
name: neon-postgres
description: Guides and best practices for working with Lakebase Postgres on Neon: connections, pooled vs direct, schema migrations, branching, autoscaling, scale-to-zero, instant restore, read replicas, IP allow lists, logical replication, and Lakebase Search.
metadata:
  parent: neon
  source: https://github.com/neondatabase/agent-skills/tree/main/skills/neon-postgres
---

# Lakebase Postgres on Neon

Lakebase Postgres is the database at the core of Neon, running OLTP directly on cloud object storage with autoscaling, branching, and scale-to-zero.

## When to use pooled vs direct connections
- **Web applications & serverless**: Pooled (`-pooler` suffix in hostname)
- **Schema migrations & DDL**: Direct (non-pooled hostname)
- **pg_dump / pg_restore**: Direct

## Connection Driver Best Practices
- FastAPI / SQLAlchemy: Use `psycopg2` or `asyncpg` with connection pooling (`pool_pre_ping=True`, `pool_recycle=1800`)
- Node.js: Use `@neondatabase/serverless` or `pg` (node-postgres)
