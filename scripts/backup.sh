#!/usr/bin/env sh
# Daily backup of the database, property photos and ID photos (the whole /data volume). Run from the repo root, e.g. via cron:
#   0 2 * * *  cd /opt/rentalhub && ./scripts/backup.sh >> backup.log 2>&1
# Copy the files in ./backups to a DIFFERENT machine or bucket — a backup on the same disk is not a backup.
set -eu
STAMP=$(date +%Y%m%d-%H%M%S); DIR=./backups; mkdir -p "$DIR"
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U rentalhub rentalhub | gzip > "$DIR/db-$STAMP.sql.gz"
docker run --rm -v rentalhub_appdata:/data -v "$(pwd)/$DIR":/out alpine tar czf "/out/appdata-$STAMP.tar.gz" -C /data .
find "$DIR" -type f -mtime +14 -delete        # keep 14 days
echo "backup $STAMP done"
