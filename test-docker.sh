#!/bin/bash
echo "Testing PostgreSQL connection..."
docker exec test-repo-postgres-1 pg_isready -U aiemailuser

echo "Testing Redis connection..."
docker exec test-repo-redis-1 redis-cli ping